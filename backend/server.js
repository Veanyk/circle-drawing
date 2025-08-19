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

// === ОБЯЗАТЕЛЬНО В .env ===
// BOT_TOKEN=123456:ABC...
const BOT_TOKEN = process.env.BOT_TOKEN || '7672739920:AAEJO4dq29025OPWt9Hr1fwWwPB5rYSrPKE';

// Восстановление ОДНОЙ попытки
const ATTEMPT_REGEN_INTERVAL_MS = 1 * 60 * 1000; // 1 минута
const REFERRAL_TASK_ID = 2;
const REFERRAL_TASK_REWARD = 30;

// ------ Admin auth ------
const ADMIN_KEYS = (process.env.ADMIN_KEYS || '779077474')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

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
  /^https?:\/\/draw-a-circle\.chickenkiller\.com$/i,
  /^https?:\/\/web\.telegram\.org$/i,
  /^https?:\/\/t\.me$/i,
  /^https?:\/\/desktop\.telegram\.org$/i,
  /^https?:\/\/appassets\.androidplatform\.net$/i,
  /^https?:\/\/webapp\.telegram\.org$/i,
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
// FIX для path-to-regexp v6
app.options(/.*/, cors(corsOptions));

// Лимит тела
app.use(express.json({ limit: '1mb' }));

// Лог
app.use((req, _res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.path} ip=${req.ip} origin=${req.headers.origin || '-'}`
  );
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
  catch (e) { console.error('Ошибка парсинга JSON:', e); return {}; }
}
function writeDb(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }
const values = obj => Object.values(obj || {}).filter(v => v && typeof v === 'object');

// ---------- User helpers ----------
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
  return n;
}

function awardInviteIfNeeded(refUser) {
  refUser.completed_tasks = Array.isArray(refUser.completed_tasks) ? refUser.completed_tasks : [];
  if (!refUser.completed_tasks.includes(REFERRAL_TASK_ID)) {
    refUser.completed_tasks.push(REFERRAL_TASK_ID);
    refUser.coins = (refUser.coins || 0) + REFERRAL_TASK_REWARD;
    console.log(`Referral task awarded: +${REFERRAL_TASK_REWARD} tokens to ${refUser.user_id}`);
  }
}

// ---------- Regen attempts (ровно 1 за тик) ----------
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

function verifyInitData(initData, botToken) {
  if (!initData) throw new Error('initData_empty');
  if (!botToken) throw new Error('bot_token_missing');

  // initData — это querystring
  const parsed = querystring.parse(initData);

  const providedHash = getFirst(parsed.hash);
  if (!providedHash) throw new Error('hash_missing');

  // Собираем data_check_string без hash
  const entries = Object.keys(parsed)
    .filter(k => k !== 'hash')
    .sort()
    .map(k => `${k}=${getFirst(parsed[k])}`);
  const dataCheckString = entries.join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // Сравниваем безопасно
  const ok = crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(providedHash));
  if (!ok) throw new Error('bad_signature');

  let user = {};
  const userRaw = getFirst(parsed.user);
  if (userRaw) {
    try { user = JSON.parse(userRaw); } catch { user = {}; }
  }
  const start_param = getFirst(parsed.start_param) || '';

  return { user, start_param };
}

// ---------- ROUTES ----------
app.get('/health', (_req, res) => res.json({ ok: true }));

// Создание/чтение пользователя
app.post('/getUserData', (req, res) => {
  try {
    const { user_id, ref_id, username } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'user_id не предоставлен' });

    const db = readDb();
    const providedUsername = sanitizeTelegramUsername(username);
    let user = db[user_id];

    if (!user) {
      user = {
        user_id,
        username: providedUsername || `User_${String(user_id).slice(-4)}`,
        referrer_id: ref_id && ref_id !== String(user_id) ? String(ref_id) : null,
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

      // первичное закрепление к рефереру и награда, если ref_id валиден
      if (user.referrer_id && db[user.referrer_id]) {
        const ref = normalizeUser(db[ref_id]);
        ref.referrals = Array.isArray(ref.referrals) ? ref.referrals : [];
        if (!ref.referrals.includes(user_id)) {
          ref.referrals.push(user_id);
          awardInviteIfNeeded(ref);
          db[ref_id] = ref;
        }
      }
    } else {
      user = normalizeUser(user);
      if (providedUsername && providedUsername !== user.username) {
        user.username = providedUsername;
      }

      // «задним числом» привязка, если ещё нет
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

    // реген попыток
    regenAttempts(user);

    db[user_id] = user;
    writeDb(db);

    res.json({ ...user, walletEligible: (user.coins || 0) >= 100 });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: 'invalid_initData', reason: e.message });
  }
});

// Обновление данных пользователя
app.post('/updateUserData', (req, res) => {
  try {
    const { user_id, data } = req.body || {};
    if (!user_id || !data) return res.status(400).json({ error: 'Некорректные данные' });

    const db = readDb();
    const prev = db[user_id];
    if (!prev) return res.status(404).json({ error: 'Пользователь не найден' });

    const u = normalizeUser({ ...prev });

    // попытки
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

    // Реф. бонус 5% с заработанного (как было)
    const earned = (u.coins || 0) - (prev.coins || 0);
    if (earned > 0 && prev.referrer_id && db[prev.referrer_id]) {
      const ref = normalizeUser(db[prev.referrer_id]);
      const bonus = earned * 0.05;
      ref.coins = (ref.coins || 0) + bonus;
      db[prev.referrer_id] = ref;
      console.log(`Начислен бонус ${bonus.toFixed(4)} монет пользователю ${ref.user_id} от реферала ${user_id}`);
    }

    db[user_id] = u;
    writeDb(db);
    res.json({ ...u, walletEligible: (u.coins || 0) >= 100 });
  } catch (e) {
    console.error(e);
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
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Мои рефералы
app.post('/getReferrals', (req, res) => {
  try {
    const { user_id } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'user_id не предоставлен' });

    const db = readDb();
    const user = db[user_id];
    if (!user || !Array.isArray(user.referrals)) return res.json([]);

    const refs = user.referrals.map(id => db[id]).filter(Boolean);
    res.json(refs);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// === НОВОЕ: Mini App эндпоинт для закрепления реферала с верификацией initData ===
app.post('/acceptReferral', (req, res) => {
  try {
    console.log('[acceptReferral] body =', req.body);
    const { inviter_id, initData } = req.body || {};
    if (!Number.isFinite(Number(inviter_id))) {
      return res.status(400).json({ error: 'inviter_id_invalid' });
    }
    if (!initData) {
      return res.status(400).json({ error: 'initData_required' });
    }

    // Верификация подписи Telegram WebApp
    let parsed;
    try {
      parsed = verifyInitData(initData, BOT_TOKEN);
    } catch (e) {
      console.warn('verifyInitData failed:', e.message);
      return res.status(400).json({ error: 'invalid_initData' });
    }

    const invitee = parsed.user || {};
    const invitee_id_num = Number(invitee.id);
    if (!Number.isFinite(invitee_id_num)) {
      return res.status(400).json({ error: 'invitee_invalid' });
    }
    const invitee_id = String(invitee_id_num);
    const inviter_id_str = String(inviterId);
    if (inviterId === invitee_id_num) {
      return res.json({ ok: true, skipped: 'self_ref' });
    }

    const db = readDb();

    // гарантируем наличие записей
    if (!db[invitee_id]) {
      db[invitee_id] = normalizeUser({
        user_id: invitee_id,
        username: sanitizeTelegramUsername(invitee?.username) || `User_${String(invitee_id).slice(-4)}`,
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
      // при желании можно создать "пустого" пригласившего
      db[inviterId] = normalizeUser({
        user_id: inviter_id_str,
        username: `User_${String(inviterId).slice(-4)}`,
        coins: 0, attempts: 25, max_attempts: 25, best_score: 0,
        completed_tasks: [], referrals: [], nextAttemptTimestamp: null,
        wallet: null, wallet_updated_at: null,
      });
    }

    const inviteeUser = normalizeUser(db[invitee_id]);
    const inviterUser = normalizeUser(db[inviter_id_str]);

    // Идемпотентность: если уже есть реферер — не меняем
    if (inviteeUser.referrer_id) {
      writeDb(db);
      return res.json({ ok: true, skipped: 'already_has_referrer', referrer_id: inviteeUser.referrer_id });
    }

    // Закрепление и награда
    inviteeUser.referrer_id = inviter_id_str;
    inviterUser.referrals = Array.isArray(inviterUser.referrals) ? inviterUser.referrals : [];
    if (!inviterUser.referrals.includes(invitee_id)) {
      inviterUser.referrals.push(invitee_id);
    }
    awardInviteIfNeeded(inviterUser);

    db[invitee_id] = inviteeUser;
    db[inviter_id_str] = inviterUser;
    writeDb(db);

    res.json({ ok: true, inviter_id: inviter_id_str, invitee_id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ---------- Wallet ----------
function isWalletString(s) {
  if (typeof s !== 'string') return false;
  const v = s.trim();
  if (v.length < 6 || v.length > 120) return false;
  return true;
}

app.post('/setWallet', (req, res) => {
  try {
    const { user_id, wallet } = req.body || {};
    if (!user_id || typeof wallet !== 'string') return res.status(400).json({ error: 'bad_request' });

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
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Глобальный обработчик ошибок
app.use((err, _req, res, _next) => {
  console.error('Необработанная ошибка:', err);
  res.status(500).json({ error: 'internal_server_error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на http://0.0.0.0:${PORT}`);
});
