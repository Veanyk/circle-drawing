'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT) || 8000;
const DB_PATH = path.join(__dirname, 'database.json');
const LOG_PATH = path.join(__dirname, 'server.log');

const BOT_TOKEN = process.env.BOT_TOKEN;

const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 10000);
const ATTEMPT_REGEN_INTERVAL_MS = 1 * 60 * 1000;
const REFERRAL_TASK_ID = 2;
const REFERRAL_TASK_REWARD = 30;

// Пороги монет для слотов кошельков
const WALLET_THRESHOLDS = { '420': 420, '690': 690, '1000': 1000 };
const parseWalletSlot = (slot) => {
  const s = String(slot || '').trim();
  if (s === '420' || s === '690' || s === '1000') return s;
  return '420';
};

const ADMIN_KEYS = (process.env.ADMIN_KEYS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function toStr(a) {
  if (a === undefined) return 'undefined';
  if (a === null) return 'null';
  if (typeof a === 'string') return a;
  try { return JSON.stringify(a); } catch { return String(a); }
}

let logQueue = Promise.resolve();
async function appendLog(line) {
  try { await fsp.appendFile(LOG_PATH, line); } catch {}
}
function log(...args) {
  const line = `[${new Date().toISOString()}] ` + args.map(toStr).join(' ') + '\n';
  logQueue = logQueue.then(() => appendLog(line));
  try { console.log(...args); } catch {}
}

function requireAdmin(req, res, next) {
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const key = (req.headers['x-admin-key'] || bearer || '').toString();
  if (ADMIN_KEYS.length === 0) {
    return res.status(403).json({ error: 'admin_disabled', hint: 'Set ADMIN_KEYS env' });
  }
  if (ADMIN_KEYS.includes(key)) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

const ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/i,
  /^https?:\/\/.*\.vercel\.app$/i,
  /^https?:\/\/web\.telegram\.org$/i,
  /^https?:\/\/t\.me$/i,
  /^https?:\/\/desktop\.telegram\.org$/i,
  /^https?:\/\/appassets\.androidplatform\.net$/i,
  /^https?:\/\/webapp\.telegram\.org$/i,
  /^https?:\/\/circle-drawing\.vercel\.app$/i,
];

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    const ok = ORIGIN_PATTERNS.some(rx => rx.test(origin));
    return ok ? cb(null, true) : cb(new Error(`CORS: ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.set('trust proxy', 1);
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// Таймаут на ответ (защита от «зависших» запросов)
app.use((req, res, next) => {
  res.setTimeout(REQUEST_TIMEOUT_MS, () => {
    log('Request timed out', req.method, req.originalUrl);
    if (!res.headersSent) res.status(504).json({ error: 'timeout' });
  });
  next();
});

app.use((req, _res, next) => {
  log(`${req.method} ${req.originalUrl}`, `ip=${req.ip}`, `origin=${req.headers.origin || '-'}`);
  next();
});

// JSON-БД кешируется в памяти; запись коалесцируется и идёт через атомарную замену
const DB_DIR = path.dirname(DB_PATH);
let dbCache = Object.create(null);
let flushScheduled = false;
let writeLock = Promise.resolve();

async function initDb() {
  try {
    await fsp.mkdir(DB_DIR, { recursive: true });
    const raw = await fsp.readFile(DB_PATH, 'utf8').catch(() => '{}');
    dbCache = JSON.parse(raw || '{}');
  } catch (e) {
    log('Ошибка initDb:', e);
    dbCache = {};
  }
}
initDb();

function readDb() {
  return dbCache;
}

function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  setTimeout(() => {
    flushScheduled = false;
    const data = JSON.stringify(dbCache, null, 2);
    const tmp = DB_PATH + '.tmp';
    writeLock = writeLock.then(async () => {
      await fsp.writeFile(tmp, data, 'utf8');
      await fsp.rename(tmp, DB_PATH); // атомарная запись базы
    }).catch(e => log('DB write error:', e));
  }, 50);
}

function writeDb(nextData) {
  dbCache = nextData;
  scheduleFlush();
}

const values = obj => Object.values(obj || {}).filter(v => v && typeof v === 'object');

function isTelegramId(id) {
  return typeof id === 'string' && /^\d+$/.test(id);
}

function sanitizeTelegramUsername(name) {
  if (typeof name !== 'string') return null;
  let v = name.trim().replace(/^@+/, '');
  if (!v) return null;
  v = v.replace(/[^\w]/g, '');
  if (v.length > 32) v = v.slice(0, 32);
  return v || null;
}

// Поддержка legacy-поля wallet -> перенос в wallet_420; три независимых слота
function normalizeUser(u) {
  const n = { ...u };
  n.user_id = String(n.user_id);
  n.max_attempts = Number.isFinite(n.max_attempts) && n.max_attempts > 0 ? Math.floor(n.max_attempts) : 10;

  if (!Number.isFinite(n.attempts) || n.attempts < 0) n.attempts = n.max_attempts;
  n.attempts = Math.min(n.max_attempts, Math.floor(n.attempts));

  if (!Array.isArray(n.completed_tasks)) n.completed_tasks = [];
  if (!Array.isArray(n.referrals)) n.referrals = [];
  if (!Number.isFinite(n.best_score)) n.best_score = 0;
  if (!Number.isFinite(n.coins)) n.coins = 0;

  if (!(typeof n.nextAttemptTimestamp === 'number' && isFinite(n.nextAttemptTimestamp) && n.nextAttemptTimestamp > 0)) {
    n.nextAttemptTimestamp = null;
  }
  if (n.referrer_id != null) n.referrer_id = String(n.referrer_id);
  n.referrals = n.referrals.map(String);
  if (typeof n.referral_processed !== 'boolean') n.referral_processed = false;

  if (typeof n.wallet_420 === 'undefined') {
    n.wallet_420 = (typeof n.wallet === 'string' && n.wallet.trim()) ? n.wallet.trim() : null;
  }
  if (typeof n.wallet_690 === 'undefined') n.wallet_690 = null;
  if (typeof n.wallet_1000 === 'undefined') n.wallet_1000 = null;

  if (typeof n.wallet_420_updated_at !== 'string') n.wallet_420_updated_at = null;
  if (typeof n.wallet_690_updated_at !== 'string') n.wallet_690_updated_at = null;
  if (typeof n.wallet_1000_updated_at !== 'string') n.wallet_1000_updated_at = null;

  return n;
}

function awardInviteIfNeeded(refUser) {
  refUser.completed_tasks = Array.isArray(refUser.completed_tasks) ? refUser.completed_tasks : [];
  if (!refUser.completed_tasks.includes(REFERRAL_TASK_ID)) {
    refUser.completed_tasks.push(REFERRAL_TASK_ID);
    refUser.coins = (refUser.coins || 0) + REFERRAL_TASK_REWARD;
    log(`Referral task awarded: +${REFERRAL_TASK_REWARD} tokens to ${refUser.user_id}`);
    return true;
  }
  return false;
}

// Восстановление попыток по фиксированному интервалу
function regenAttempts(u) {
  u.max_attempts = Math.max(1, Math.floor(u.max_attempts || 10));
  u.attempts = Math.max(0, Math.min(u.max_attempts, Math.floor(u.attempts || 0)));

  const now = Date.now();

  if (u.attempts >= u.max_attempts) {
    u.nextAttemptTimestamp = null;
    return;
  }

  if (!u.nextAttemptTimestamp) {
    u.nextAttemptTimestamp = now + ATTEMPT_REGEN_INTERVAL_MS;
    return;
  }

  if (now < u.nextAttemptTimestamp) return;

  const ticks = Math.floor((now - u.nextAttemptTimestamp) / ATTEMPT_REGEN_INTERVAL_MS) + 1;
  u.attempts = Math.min(u.max_attempts, u.attempts + ticks);

  if (u.attempts >= u.max_attempts) {
    u.nextAttemptTimestamp = null;
  } else {
    u.nextAttemptTimestamp = u.nextAttemptTimestamp + ticks * ATTEMPT_REGEN_INTERVAL_MS;
    if (u.nextAttemptTimestamp <= now) u.nextAttemptTimestamp = now + ATTEMPT_REGEN_INTERVAL_MS;
  }
}

// Проверка подписи initData Telegram WebApp (совместимо с V1/V2)
function verifyInitData(initData, botToken) {
  if (!initData) throw new Error('initData_empty');
  if (!botToken) throw new Error('bot_token_missing');

  const params = new URLSearchParams(initData);
  const providedHashHex = params.get('hash');
  if (!providedHashHex) throw new Error('hash_missing');

  const keys = Array.from(params.keys())
    .filter(k => k !== 'hash' && k !== 'signature')
    .sort();
  const dataCheckString = keys.map(k => `${k}=${params.get(k) ?? ''}`).join('\n');

  const secretV1 = crypto.createHash('sha256').update(botToken).digest();
  const secretV2 = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();

  const calcHexV1 = crypto.createHmac('sha256', secretV1).update(dataCheckString).digest('hex');
  const calcHexV2 = crypto.createHmac('sha256', secretV2).update(dataCheckString).digest('hex');

  const recv = Buffer.from(providedHashHex, 'hex');
  const c1 = Buffer.from(calcHexV1, 'hex');
  const c2 = Buffer.from(calcHexV2, 'hex');

  const ok =
    (recv.length === c1.length && crypto.timingSafeEqual(recv, c1)) ||
    (recv.length === c2.length && crypto.timingSafeEqual(recv, c2));

  if (!ok) throw new Error('bad_signature');

  let user = {};
  const userRaw = params.get('user');
  if (userRaw) {
    try { user = JSON.parse(userRaw); } catch { user = {}; }
  }
  const start_param = params.get('start_param') || '';

  return { user, start_param };
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/debug/ping', (_req, res) => {
  try {
    const db = readDb();
    const keys = Object.keys(db);
    res.json({
      ok: true,
      botTokenSet: Boolean(process.env.BOT_TOKEN || BOT_TOKEN),
      dbUsers: keys.length,
      logFile: LOG_PATH,
      now: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.get('/getTask3', (_req, res) => {
  try {
    const db = readDb();
    const link = db.__config?.task3_link || '';
    res.json({ link });
  } catch (e) {
    res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/getUserData', async (req, res) => {
  try {
    let { user_id, ref_id, username } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'user_id не предоставлен' });

    user_id = String(user_id);
    const providedUsername = sanitizeTelegramUsername(username);

    if (!isTelegramId(user_id)) {
      return res.json({
        user_id,
        username: providedUsername || 'Guest',
        referrer_id: null,
        coins: 0,
        attempts: 10,
        max_attempts: 10,
        best_score: 0,
        completed_tasks: [],
        referrals: [],
        nextAttemptTimestamp: null,
        wallet: null,
        wallet_420: null,
        wallet_690: null,
        wallet_1000: null,
        wallet_420_updated_at: null,
        wallet_690_updated_at: null,
        wallet_1000_updated_at: null,
        walletEligible: false,
        walletEligible690: false,
        walletEligible1000: false,
      });
    }

    const db = readDb();
    let user = db[user_id];
    let inviter = null;

    const refIdStr = ref_id ? String(ref_id) : null;
    const isRefLinkValid = refIdStr && refIdStr !== user_id && isTelegramId(refIdStr);

    if (!user) {
      user = normalizeUser({
        user_id,
        username: providedUsername || `User_${user_id.slice(-4)}`,
        referrer_id: isRefLinkValid ? refIdStr : null,
      });
    } else {
      user = normalizeUser(user);
      if (providedUsername && providedUsername !== user.username) {
        user.username = providedUsername;
      }
      if (isRefLinkValid && !user.referrer_id) {
        user.referrer_id = refIdStr;
      }
    }

    // Обработка реферала и единоразовое начисление за приглашение
    if (user.referrer_id && !user.referral_processed) {
      const inviterId = user.referrer_id;
      if (db[inviterId]) {
        inviter = normalizeUser(db[inviterId]);
        if (!inviter.referrals.includes(user_id)) inviter.referrals.push(user_id);
        const rewardGiven = awardInviteIfNeeded(inviter);
        if (rewardGiven) log(`Награда за реферала (+${REFERRAL_TASK_REWARD}) начислена ${inviter.user_id} от ${user_id}`);
        user.referral_processed = true;
      }
    }

    regenAttempts(user);

    db[user_id] = user;
    if (inviter) db[inviter.user_id] = inviter;
    writeDb(db);

    const c = user.coins || 0;

    res.json({
      ...user,
      wallet: user.wallet_420 ?? null, // back-compat — поле wallet = слот 420
      wallet_420: user.wallet_420 ?? null,
      wallet_690: user.wallet_690 ?? null,
      wallet_1000: user.wallet_1000 ?? null,
      wallet_420_updated_at: user.wallet_420_updated_at ?? null,
      wallet_690_updated_at: user.wallet_690_updated_at ?? null,
      wallet_1000_updated_at: user.wallet_1000_updated_at ?? null,
      walletEligible: c >= 420,
      walletEligible690: c >= 690,
      walletEligible1000: c >= 1000,
    });

  } catch (e) {
    log('Ошибка в /getUserData:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/updateUserData', async (req, res) => {
  try {
    let { user_id, data } = req.body || {};
    if (!user_id || !data) return res.status(400).json({ error: 'Некорректные данные' });

    user_id = String(user_id);

    if (!isTelegramId(user_id)) {
      return res.json({
        user_id,
        username: 'Guest',
        referrer_id: null,
        coins: 0,
        attempts: 10,
        max_attempts: 10,
        best_score: 0,
        completed_tasks: [],
        referrals: [],
        nextAttemptTimestamp: null,
        wallet: null,
        wallet_420: null,
        wallet_690: null,
        wallet_1000: null,
        wallet_420_updated_at: null,
        wallet_690_updated_at: null,
        wallet_1000_updated_at: null,
        walletEligible: false,
        walletEligible690: false,
        walletEligible1000: false,
      });
    }

    const db = readDb();
    const prev = db[user_id];
    if (!prev) return res.status(404).json({ error: 'Пользователь не найден' });

    const u = normalizeUser({ ...prev });

    if (typeof data.attempts === 'number' && data.attempts < u.attempts) {
      u.attempts = Math.max(0, Math.floor(data.attempts));
      if (u.attempts < u.max_attempts && !u.nextAttemptTimestamp) {
        u.nextAttemptTimestamp = Date.now() + ATTEMPT_REGEN_INTERVAL_MS;
      }
    }
    if (typeof data.coins === 'number' && Number.isFinite(data.coins)) {
      u.coins = Math.max(0, data.coins);
    }
    if (Array.isArray(data.completed_tasks)) {
      u.completed_tasks = Array.from(new Set(data.completed_tasks));
    }
    if (typeof data.score === 'number' && data.score > (u.best_score || 0)) {
      u.best_score = data.score;
    }
    if (typeof data.username === 'string') {
      const uName = sanitizeTelegramUsername(data.username);
      if (uName && uName !== u.username) u.username = uName;
    }

    // 5% бонус рефереру от прироста монет реферала
    const earned = (u.coins || 0) - (prev.coins || 0);
    if (earned > 0 && prev.referrer_id && db[prev.referrer_id]) {
      const ref = normalizeUser(db[prev.referrer_id]);
      const bonus = earned * 0.05;
      ref.coins = (ref.coins || 0) + bonus;
      db[prev.referrer_id] = ref;
      log(`Начислен бонус ${bonus.toFixed(4)} монет пользователю ${ref.user_id} от реферала ${user_id}`);
    }

    db[user_id] = u;
    writeDb(db);

    const c = u.coins || 0;

    res.json({
      ...u,
      wallet: u.wallet_420 ?? null, // back-compat — поле wallet = слот 420
      wallet_420: u.wallet_420 ?? null,
      wallet_690: u.wallet_690 ?? null,
      wallet_1000: u.wallet_1000 ?? null,
      wallet_420_updated_at: u.wallet_420_updated_at ?? null,
      wallet_690_updated_at: u.wallet_690_updated_at ?? null,
      wallet_1000_updated_at: u.wallet_1000_updated_at ?? null,
      walletEligible: c >= 420,
      walletEligible690: c >= 690,
      walletEligible1000: c >= 1000,
    });
  } catch (e) {
    log(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.get('/getLeaderboard', (_req, res) => {
  try {
    const db = readDb();
    const leaders = values(db)
      .map(u => normalizeUser(u))
      .sort((a, b) => b.coins - a.coins)
      .slice(0, 10);
    res.json(leaders);
  } catch (e) {
    log(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.post('/getReferrals', (req, res) => {
  try {
    let { user_id } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'user_id не предоставлен' });
    user_id = String(user_id);

    if (!isTelegramId(user_id)) {
      return res.json([]);
    }

    const db = readDb();
    const user = db[user_id];

    if (!user || !Array.isArray(user.referrals)) {
      return res.json([]);
    }

    const referralData = user.referrals
      .map(refId => db[String(refId)])
      .filter(Boolean)
      .map(refUser => normalizeUser(refUser));

    return res.json(referralData);
  } catch (e) {
    log(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// AcceptReferral — проверка initData, защита от self-ref и повторной привязки
app.post('/acceptReferral', (req, res) => {
  try {
    const { inviter_id, initData } = req.body || {};
    if (!Number.isFinite(Number(inviter_id))) {
      return res.status(400).json({ error: 'inviter_id_invalid' });
    }
    if (!initData) {
      return res.status(400).json({ error: 'initData_required' });
    }

    let parsed;
    try {
      parsed = verifyInitData(initData, BOT_TOKEN);
    } catch (e) {
      log('[acceptReferral] verifyInitData failed:', e.message);
      return res.status(400).json({ error: 'invalid_initData', reason: e.message });
    }

    const invitee = parsed.user || {};
    const invitee_id_num = Number(invitee.id);
    if (!Number.isFinite(invitee_id_num)) {
      return res.status(400).json({ error: 'invitee_invalid' });
    }

    const inviterId = Number(inviter_id);
    if (inviterId === invitee_id_num) {
      return res.json({ ok: true, skipped: 'self_ref' });
    }

    const invitee_id = String(invitee_id_num);
    const inviter_id_str = String(inviterId);

    const db = readDb();

    let inviteeUser = db[invitee_id] ? normalizeUser(db[invitee_id]) : null;
    let inviterUser = db[inviter_id_str] ? normalizeUser(db[inviter_id_str]) : null;

    if (!inviteeUser) {
      inviteeUser = normalizeUser({
        user_id: invitee_id,
        username: sanitizeTelegramUsername(invitee?.username) || `User_${invitee_id.slice(-4)}`,
      });
    }

    if (!inviterUser) {
      inviterUser = normalizeUser({ user_id: inviter_id_str });
    }

    if (inviteeUser.referrer_id) {
      return res.json({ ok: true, skipped: 'already_has_referrer', referrer_id: inviteeUser.referrer_id });
    }

    inviteeUser.referrer_id = inviter_id_str;
    inviteeUser.referral_processed = true;

    if (!inviterUser.referrals.includes(invitee_id)) {
      inviterUser.referrals.push(invitee_id);
    }

    const rewardGiven = awardInviteIfNeeded(inviterUser);

    db[invitee_id] = inviteeUser;
    db[inviter_id_str] = inviterUser;
    writeDb(db);

    log('[acceptReferral] SUCCESS', { inviter_id: inviter_id_str, invitee_id, reward_given: rewardGiven });
    res.json({ ok: true, inviter_id: inviter_id_str, invitee_id, reward_given: rewardGiven });

  } catch (e) {
    log('[acceptReferral] ERROR:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Проверка порога монет и запись только выбранного слота; back-compat дублируем в wallet (420)
app.post('/setWallet', (req, res) => {
  try {
    let { user_id, wallet, slot } = req.body || {};
    if (!user_id || typeof wallet !== 'string') {
      return res.status(400).json({ error: 'bad_request' });
    }

    user_id = String(user_id);
    if (!isTelegramId(user_id)) {
      return res.status(403).json({ error: 'telegram_only' });
    }

    const db = readDb();
    const prev = db[user_id];
    if (!prev) return res.status(404).json({ error: 'user_not_found' });

    const u = normalizeUser({ ...prev });

    const s = parseWalletSlot(slot);
    const needCoins = WALLET_THRESHOLDS[s];

    if ((u.coins || 0) < needCoins) {
      return res.status(403).json({ error: 'not_eligible', need: needCoins, have: u.coins || 0 });
    }

    const w = wallet.trim();
    if (w.length < 6 || w.length > 120) {
      return res.status(400).json({ error: 'invalid_wallet' });
    }

    const nowIso = new Date().toISOString();

    if (s === '1000') {
      u.wallet_1000 = w;
      u.wallet_1000_updated_at = nowIso;
    } else if (s === '690') {
      u.wallet_690 = w;
      u.wallet_690_updated_at = nowIso;
    } else {
      u.wallet_420 = w;
      u.wallet_420_updated_at = nowIso;
      u.wallet = w; // back-compat для старых клиентов
    }

    db[user_id] = u;
    writeDb(db);

    return res.json({
      ok: true,
      wallet: u.wallet_420 ?? null,
      wallet_420: u.wallet_420 ?? null,
      wallet_690: u.wallet_690 ?? null,
      wallet_1000: u.wallet_1000 ?? null,
      wallet_420_updated_at: u.wallet_420_updated_at ?? null,
      wallet_690_updated_at: u.wallet_690_updated_at ?? null,
      wallet_1000_updated_at: u.wallet_1000_updated_at ?? null,
    });
  } catch (e) {
    log(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Централизованный обработчик ошибок
app.use((err, _req, res, _next) => {
  log('Необработанная ошибка:', err);
  res.status(500).json({ error: 'internal_server_error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на http://0.0.0.0:${PORT}`);
});
