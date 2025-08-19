'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const querystring = require('querystring');

const app = express();
const PORT = Number(process.env.PORT) || 8000;
const DB_PATH = path.join(__dirname, 'database.json');
const LOG_PATH = path.join(__dirname, 'server.log');

// === ОБЯЗАТЕЛЬНО В .env ===
// BOT_TOKEN=123456:ABC...
const BOT_TOKEN = process.env.BOT_TOKEN || '7672739920:AAEJO4dq29025OPWt9Hr1fwWwPB5rYSrPKE';

const ATTEMPT_REGEN_INTERVAL_MS = 1 * 60 * 1000; // 1 минута
const REFERRAL_TASK_ID = 2;
const REFERRAL_TASK_REWARD = 30;

// ------ Admin auth ------
const ADMIN_KEYS = (process.env.ADMIN_KEYS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// ---------- простой файловый лог ----------
function toStr(a) {
  if (a === undefined) return 'undefined';
  if (a === null) return 'null';
  if (typeof a === 'string') return a;
  try { return JSON.stringify(a); } catch { return String(a); }
}
function log(...args) {
  const line = `[${new Date().toISOString()}] ` + args.map(toStr).join(' ') + '\n';
  try { fs.appendFileSync(LOG_PATH, line); } catch {}
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

// ---------- CORS ----------
const ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/i,
  /^https?:\/\/.*\.vercel\.app$/i,
  /^https?:\/\/web\.telegram\.org$/i,
  /^https?:\/\/t\.me$/i,
  /^https?:\/\/desktop\.telegram\.org$/i,
  /^https?:\/\/appassets\.androidplatform\.net$/i,
  /^https?:\/\/webapp\.telegram\.org$/i,
  // при необходимости добавьте ваш прод-домен
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

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

app.use((req, _res, next) => {
  log(`${req.method} ${req.path}`, `ip=${req.ip}`, `origin=${req.headers.origin || '-'}`);
  next();
});

// ---------- DB helpers ----------
function ensureDb() {
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, '{}', { flag: 'w' });
}
function readDb() {
  ensureDb();
  const data = fs.readFileSync(DB_PATH, 'utf8');
  try { return JSON.parse(data || '{}'); }
  catch (e) { log('Ошибка парсинга JSON:', e); return {}; }
}
function writeDb(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }
const values = obj => Object.values(obj || {}).filter(v => v && typeof v === 'object');

function isTelegramId(id) {
  // Сохраняем пользователя ТОЛЬКО если его id — чисто числовая строка
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

function normalizeUser(u) {
  const n = { ...u };
  n.user_id = String(n.user_id);
  n.max_attempts = Number.isFinite(n.max_attempts) && n.max_attempts > 0 ? Math.floor(n.max_attempts) : 25;

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
  return n;
}

function awardInviteIfNeeded(refUser) {
  refUser.completed_tasks = Array.isArray(refUser.completed_tasks) ? refUser.completed_tasks : [];
  if (!refUser.completed_tasks.includes(REFERRAL_TASK_ID)) {
    refUser.completed_tasks.push(REFERRAL_TASK_ID);
    refUser.coins = (refUser.coins || 0) + REFERRAL_TASK_REWARD;
    log(`Referral task awarded: +${REFERRAL_TASK_REWARD} tokens to ${refUser.user_id}`);
  }
}

function regenAttempts(u) {
  u.max_attempts = Math.max(1, Math.floor(u.max_attempts || 25));
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

// ---------- Telegram WebApp initData verification ----------
function getFirst(val) {
  return Array.isArray(val) ? (val[0] ?? '') : (val ?? '');
}

// ВАЖНО: исключаем и "hash", и "signature" из data_check_string
function verifyInitData(initData, botToken) {
  if (!initData) throw new Error('initData_empty');
  if (!botToken) throw new Error('bot_token_missing');

  const parsed = querystring.parse(initData);

  const providedHash = getFirst(parsed.hash);
  if (!providedHash) throw new Error('hash_missing');

  const entries = Object.keys(parsed)
    .filter(k => k !== 'hash' && k !== 'signature')
    .sort()
    .map(k => `${k}=${getFirst(parsed[k])}`);
  const dataCheckString = entries.join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const calc = Buffer.from(hmac);
  const recv = Buffer.from(providedHash);
  if (calc.length !== recv.length || !crypto.timingSafeEqual(calc, recv)) {
    throw new Error('bad_signature');
  }

  let user = {};
  const userRaw = getFirst(parsed.user);
  if (userRaw) {
    try { user = JSON.parse(userRaw); } catch { user = {}; }
  }
  const start_param = getFirst(parsed.start_param) || '';

  return { user, start_param };
}

// ---------- Rebuild referrals ----------
function rebuildReferrals(db, referrerId) {
  const rid = String(referrerId);
  const user = db[rid];
  if (!user) return [];

  const existing = new Set((Array.isArray(user.referrals) ? user.referrals : []).map(String));

  const foundIds = values(db)
    .filter(u => u && String(u.referrer_id || '') === rid)
    .map(u => String(u.user_id));

  let changed = false;
  for (const id of foundIds) {
    if (!existing.has(id)) {
      existing.add(id);
      changed = true;
    }
  }

  const mergedIds = Array.from(existing);

  if (changed) {
    user.referrals = mergedIds;
    db[rid] = user;
    writeDb(db);
  }

  return mergedIds.map(id => db[id]).filter(Boolean);
}

// ---------- ROUTES ----------
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

// Создание/чтение пользователя
// Браузерные user_id (нечисловые) — НЕ сохраняем, возвращаем эфемерные данные
app.post('/getUserData', (req, res) => {
  try {
    let { user_id, ref_id, username } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'user_id не предоставлен' });

    user_id = String(user_id);
    const providedUsername = sanitizeTelegramUsername(username);

    // Если не Telegram ID — отдаем «на лету» и ничего не пишем в БД
    if (!isTelegramId(user_id)) {
      const demo = {
        user_id,
        username: providedUsername || 'Guest',
        referrer_id: null,
        coins: 0,
        attempts: 25,
        max_attempts: 25,
        best_score: 0,
        completed_tasks: [],
        referrals: [],
        nextAttemptTimestamp: null,
        wallet: null,
        wallet_updated_at: null,
        walletEligible: false,
      };
      return res.json(demo);
    }

    // Telegram user — сохраняем
    const db = readDb();
    let user = db[user_id];

    const refIdStr = ref_id ? String(ref_id) : null;

    if (!user) {
      user = {
        user_id,
        username: providedUsername || `User_${user_id.slice(-4)}`,
        referrer_id: (refIdStr && refIdStr !== user_id) ? refIdStr : null,
        coins: 0,
        attempts: 25,
        max_attempts: 25,
        best_score: 0,
        completed_tasks: [],
        referrals: [],
        nextAttemptTimestamp: null,
        wallet: null,
        wallet_updated_at: null,
      };
      db[user_id] = user;

      // Если реферер уже есть в БД — сразу свяжем и наградим
      if (user.referrer_id && db[user.referrer_id]) {
        const ref = normalizeUser(db[user.referrer_id]);
        ref.referrals = Array.isArray(ref.referrals) ? ref.referrals : [];
        if (!ref.referrals.includes(user_id)) {
          ref.referrals.push(user_id);
          awardInviteIfNeeded(ref);
          db[user.referrer_id] = ref;
        }
      }
    } else {
      user = normalizeUser(user);
      if (providedUsername && providedUsername !== user.username) {
        user.username = providedUsername;
      }
    
      // 🔹 Новое: поздняя привязка по ref_id, если у пользователя ещё нет реферера
      if (!user.referrer_id && refIdStr && refIdStr !== user_id) {
        user.referrer_id = refIdStr;
    
        const ref = normalizeUser(db[refIdStr] || {
          user_id: refIdStr,
          username: `User_${String(refIdStr).slice(-4)}`,
          coins: 0, attempts: 25, max_attempts: 25, best_score: 0,
          completed_tasks: [], referrals: [], nextAttemptTimestamp: null,
          wallet: null, wallet_updated_at: null,
        });
    
        ref.referrals = Array.isArray(ref.referrals) ? ref.referrals : [];
        if (!ref.referrals.includes(user_id)) {
          ref.referrals.push(user_id);
          // единовременная награда за приглашение
          awardInviteIfNeeded(ref);
        }
        db[refIdStr] = ref;
      }
    
      // «догоняем» связь, если referrer_id уже был, но реферер появился позже
      if (user.referrer_id && db[user.referrer_id]) {
        const ref = normalizeUser(db[user.referrer_id]);
        ref.referrals = Array.isArray(ref.referrals) ? ref.referrals : [];
        if (!ref.referrals.includes(user_id)) {
          ref.referrals.push(user_id);
          awardInviteIfNeeded(ref);
          db[user.referrer_id] = ref;
        }
      }
    }

    regenAttempts(user);
    db[user_id] = user;
    writeDb(db);

    res.json({ ...user, walletEligible: (user.coins || 0) >= 100 });
  } catch (e) {
    log(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Обновление данных пользователя
// Браузерные user_id — не сохраняем, просто возвращаем то, что прислали (эфемерно)
app.post('/updateUserData', (req, res) => {
  try {
    let { user_id, data } = req.body || {};
    if (!user_id || !data) return res.status(400).json({ error: 'Некорректные данные' });

    user_id = String(user_id);

    if (!isTelegramId(user_id)) {
      const coins = typeof data.coins === 'number' && Number.isFinite(data.coins) ? Math.max(0, data.coins) : 0;
      const attempts = typeof data.attempts === 'number' && Number.isFinite(data.attempts) ? Math.max(0, Math.floor(data.attempts)) : 25;
      const max_attempts = 25;
      const best_score = typeof data.score === 'number' ? data.score : 0;
      return res.json({
        user_id,
        username: 'Guest',
        referrer_id: null,
        coins,
        attempts,
        max_attempts,
        best_score,
        completed_tasks: Array.isArray(data.completed_tasks) ? Array.from(new Set(data.completed_tasks)) : [],
        referrals: [],
        nextAttemptTimestamp: null,
        wallet: null,
        wallet_updated_at: null,
        walletEligible: false,
      });
    }

    // Telegram user — сохраняем
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
      if (uName && uName !== u.username) {
        u.username = uName;
      }
    }

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
    res.json({ ...u, walletEligible: (u.coins || 0) >= 100 });
  } catch (e) {
    log(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Таблица лидеров
app.get('/getLeaderboard', (_req, res) => {
  try {
    const db = readDb();

    const ensureUser = (u) => {
      const n = { ...u };
      n.coins = Number.isFinite(n.coins) ? Number(n.coins) : Number(n?.coins) || 0;
      n.best_score = Number.isFinite(n.best_score) ? Number(n.best_score) : 0;
      n.username = typeof n.username === 'string' ? n.username : null;
      n.user_id = n.user_id ?? null;
      return n;
    };

    const leaders = values(db)
      .map(ensureUser)
      .sort((a, b) => b.coins - a.coins)
      .slice(0, 10);

    res.json(leaders);
  } catch (e) {
    log(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Мои рефералы (для браузерных — всегда пусто)
app.post('/getReferrals', (req, res) => {
  try {
    let { user_id } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'user_id не предоставлен' });
    user_id = String(user_id);

    if (!isTelegramId(user_id)) {
      return res.json([]); // гость — не сохраняем и не показываем
    }

    const db = readDb();
    const refs = rebuildReferrals(db, user_id);
    return res.json(refs);
  } catch (e) {
    log(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Привязка реферала через Telegram WebApp (только с валидным initData)
app.post('/acceptReferral', (req, res) => {
  try {
    log('[acceptReferral] body =', req.body);
    const { inviter_id, initData } = req.body || {};
    if (!Number.isFinite(Number(inviter_id))) {
      return res.status(400).json({ error: 'inviter_id_invalid' });
    }
    if (!initData) {
      log('[acceptReferral] initData is empty');
      return res.status(400).json({ error: 'initData_required' });
    }

    let parsed;
    try {
      parsed = verifyInitData(initData, BOT_TOKEN);
    } catch (e) {
      log('[acceptReferral] verifyInitData failed:', e.message);
      return res.status(400).json({ error: 'invalid_initData', reason: e.message });
    }
    log('[acceptReferral] parsed.start_param =', parsed.start_param, 'user.id =', parsed.user?.id);

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

    if (!db[invitee_id]) {
      db[invitee_id] = normalizeUser({
        user_id: invitee_id,
        username: sanitizeTelegramUsername(invitee?.username) || `User_${invitee_id.slice(-4)}`,
        referrer_id: null,
        coins: 0,
        attempts: 25,
        max_attempts: 25,
        best_score: 0,
        completed_tasks: [],
        referrals: [],
        nextAttemptTimestamp: null,
        wallet: null,
        wallet_updated_at: null,
      });
    }
    if (!db[inviter_id_str]) {
      db[inviter_id_str] = normalizeUser({
        user_id: inviter_id_str,
        username: `User_${inviter_id_str.slice(-4)}`,
        coins: 0, attempts: 25, max_attempts: 25, best_score: 0,
        completed_tasks: [], referrals: [], nextAttemptTimestamp: null,
        wallet: null, wallet_updated_at: null,
      });
    }

    const inviteeUser = normalizeUser(db[invitee_id]);
    const inviterUser = normalizeUser(db[inviter_id_str]);

    if (inviteeUser.referrer_id) {
      writeDb(db);
      return res.json({ ok: true, skipped: 'already_has_referrer', referrer_id: inviteeUser.referrer_id });
    }

    inviteeUser.referrer_id = inviter_id_str;
    inviterUser.referrals = Array.isArray(inviterUser.referrals) ? inviterUser.referrals : [];
    if (!inviterUser.referrals.includes(invitee_id)) {
      inviterUser.referrals.push(invitee_id);
    }
    awardInviteIfNeeded(inviterUser);

    db[invitee_id] = inviteeUser;
    db[inviter_id_str] = inviterUser;
    writeDb(db);

    log('[acceptReferral] ATTACHED', { inviter_id: inviter_id_str, invitee_id });
    res.json({ ok: true, inviter_id: inviter_id_str, invitee_id });
  } catch (e) {
    log(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Wallet (только Telegram user)
function isWalletString(s) {
  if (typeof s !== 'string') return false;
  const v = s.trim();
  if (v.length < 6 || v.length > 120) return false;
  return true;
}

app.post('/setWallet', (req, res) => {
  try {
    let { user_id, wallet } = req.body || {};
    if (!user_id || typeof wallet !== 'string') return res.status(400).json({ error: 'bad_request' });

    user_id = String(user_id);

    if (!isTelegramId(user_id)) {
      return res.status(403).json({ error: 'telegram_only' });
    }

    const db = readDb();
    const u = db[user_id];
    if (!u) return res.status(404).json({ error: 'user_not_found' });

    if ((u.coins || 0) < 100) {
      return res.status(403).json({ error: 'not_eligible', need: 100, have: u.coins || 0 });
    }
    if (!isWalletString(wallet)) return res.status(400).json({ error: 'invalid_wallet' });

    u.wallet = wallet.trim();
    u.wallet_updated_at = new Date().toISOString();
    db[user_id] = u;
    writeDb(db);

    res.json({ ok: true, wallet: u.wallet });
  } catch (e) {
    log(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Глобальный обработчик ошибок
app.use((err, _req, res, _next) => {
  log('Необработанная ошибка:', err);
  res.status(500).json({ error: 'internal_server_error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на http://0.0.0.0:${PORT}`);
});
