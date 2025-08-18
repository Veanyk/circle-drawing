'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 8000;
const DB_PATH = path.join(__dirname, 'database.json');

// Восстановление ОДНОЙ попытки
const ATTEMPT_REGEN_INTERVAL_MS = 1 * 60 * 1000; // 1 минута

// ------ Admin auth ------
const ADMIN_KEYS = (process.env.ADMIN_KEYS || '')
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
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ip=${req.ip} origin=${req.headers.origin || '-'}`);
  next();
});

// ---------- DB helpers ----------
function ensureDb() { if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, '{}', { flag: 'w' }); }
function readDb() {
  ensureDb();
  const data = fs.readFileSync(DB_PATH, 'utf8');
  try { return JSON.parse(data || '{}'); }
  catch (e) { console.error('Ошибка парсинга JSON:', e); return {}; }
}
function writeDb(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }
const values = obj => Object.values(obj || {}).filter(v => v && typeof v === 'object');

// ---------- Regen attempts (ровно 1 за тик) ----------
function regenAttempts(u) {
  const now = Date.now();
  if (u.attempts < u.max_attempts && u.nextAttemptTimestamp && now >= u.nextAttemptTimestamp) {
    u.attempts += 1;
    if (u.attempts >= u.max_attempts) {
      u.nextAttemptTimestamp = null;
    } else {
      const next = u.nextAttemptTimestamp + ATTEMPT_REGEN_INTERVAL_MS;
      u.nextAttemptTimestamp = next > now ? next : now + ATTEMPT_REGEN_INTERVAL_MS;
    }
  }
}

// ---------- ROUTES ----------
app.get('/health', (_req, res) => res.json({ ok: true }));

// Создание/чтение пользователя
app.post('/getUserData', (req, res) => {
  try {
    const { user_id, ref_id, username } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'user_id не предоставлен' });

    const db = readDb();
    let user = db[user_id];

    if (!user) {
      user = {
        user_id,
        username: username || `User_${String(user_id).slice(-4)}`,
        referrer_id: ref_id || null,
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

      if (ref_id && db[ref_id]) {
        db[ref_id].referrals = Array.isArray(db[ref_id].referrals) ? db[ref_id].referrals : [];
        if (!db[ref_id].referrals.includes(user_id)) db[ref_id].referrals.push(user_id);
      }
    } else if (ref_id && !user.referrer_id && ref_id !== user_id) {
      user.referrer_id = ref_id;
      if (db[ref_id]) {
        db[ref_id].referrals = Array.isArray(db[ref_id].referrals) ? db[ref_id].referrals : [];
        if (!db[ref_id].referrals.includes(user_id)) db[ref_id].referrals.push(user_id);
      }
    }

    // regen
    regenAttempts(user);

    writeDb(db);
    // не засоряем БД вычисляемым полем
    const response = { ...user, walletEligible: (user.coins || 0) >= 100 };
    res.json(response);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
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

    const now = Date.now();
    const u = { ...prev };

    // Попытки: только уменьшение
    if (typeof data.attempts === 'number' && Number.isFinite(data.attempts)) {
      const nextAttempts = Math.max(0, Math.min(prev.max_attempts, Math.floor(data.attempts)));
      if (nextAttempts < prev.attempts) {
        u.attempts = nextAttempts;
        if (prev.attempts === prev.max_attempts && nextAttempts === prev.max_attempts - 1 && !prev.nextAttemptTimestamp) {
          u.nextAttemptTimestamp = now + ATTEMPT_REGEN_INTERVAL_MS;
        }
      }
    }

    // Coins
    if (typeof data.coins === 'number' && Number.isFinite(data.coins)) {
      u.coins = Math.max(0, data.coins);
    }

    // Completed tasks
    if (Array.isArray(data.completed_tasks)) {
      u.completed_tasks = Array.from(new Set(data.completed_tasks));
    }

    // Best score
    if (typeof data.score === 'number' && Number.isFinite(data.score) && data.score > (prev.best_score || 0)) {
      u.best_score = data.score;
    }

    // Не позволяем менять кошелёк через этот маршрут
    if (typeof data.wallet !== 'undefined' || typeof data.wallet_updated_at !== 'undefined') {
      console.warn('Ignored wallet field in updateUserData');
    }

    // regen
    regenAttempts(u);

    // Реф. бонус
    const earned = (u.coins || 0) - (prev.coins || 0);
    if (earned > 0 && prev.referrer_id && db[prev.referrer_id]) {
      const ref = db[prev.referrer_id];
      const bonus = earned * 0.05;
      ref.coins = (ref.coins || 0) + bonus;
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
    const leaders = values(db)
      .filter(u => u && typeof u.coins === 'number' && Number.isFinite(u.coins))
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

// ---------- Wallet ----------
function isWalletString(s) {
  if (typeof s !== 'string') return false;
  const v = s.trim();
  if (v.length < 6 || v.length > 120) return false;
  return true; // минимум валидации, т.к. разные сети
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

// ---------- Admin endpoints ----------
app.get('/admin/stats', requireAdmin, (_req, res) => {
  const db = readDb();
  const users = values(db);
  const total = users.length;

  const coinsArr = users.map(u => Number(u.coins) || 0);
  const bestArr  = users.map(u => Number(u.best_score) || 0);

  const sum = a => a.reduce((s, v) => s + v, 0);

  const browserUsers = users.filter(u => String(u.user_id).startsWith('browser_')).length;
  const telegramUsers = total - browserUsers;
  const withReferrer  = users.filter(u => !!u.referrer_id).length;
  const totalReferrals = users.reduce((s, u) => s + (Array.isArray(u.referrals) ? u.referrals.length : 0), 0);
  const ge100 = users.filter(u => (u.coins || 0) >= 100).length;
  const walletsTotal = users.filter(u => u.wallet && String(u.wallet).trim()).length;
  const walletsGe100 = users.filter(u => (u.coins || 0) >= 100 && u.wallet && String(u.wallet).trim()).length;

  const top10 = users
    .slice()
    .sort((a, b) => (b.coins || 0) - (a.coins || 0))
    .slice(0, 10)
    .map(u => ({ user_id: u.user_id, username: u.username, coins: u.coins || 0, best_score: u.best_score || 0, referrer_id: u.referrer_id || null }));

  res.json({
    total_users: total,
    telegram_users: telegramUsers,
    browser_users: browserUsers,
    with_referrer: withReferrer,
    total_referrals: totalReferrals,
    avg_tokens: total ? +(sum(coinsArr) / total).toFixed(2) : 0,
    avg_accuracy: total ? +(sum(bestArr) / total).toFixed(2) : 0,
    users_ge_100: ge100,
    wallets_total: walletsTotal,
    wallets_ge_100: walletsGe100,
    top10,
  });
});

app.get('/admin/wallets', requireAdmin, (req, res) => {
  const minCoins = Number(req.query.min_coins || 0);
  const db = readDb();
  const users = values(db);
  const out = users
    .filter(u => (u.wallet && String(u.wallet).trim()) || ((u.coins || 0) >= minCoins))
    .map(u => ({
      user_id: u.user_id,
      username: u.username,
      coins: Number(u.coins) || 0,
      best_score: Number(u.best_score) || 0,
      referrer_id: u.referrer_id || null,
      referrals_count: Array.isArray(u.referrals) ? u.referrals.length : 0,
      wallet: u.wallet || null,
      wallet_updated_at: u.wallet_updated_at || null,
    }));
  res.json(out);
});

app.get('/admin/wallets.csv', requireAdmin, (req, res) => {
  const db = readDb();
  const users = values(db).filter(u => u.wallet && String(u.wallet).trim());
  const rows = [
    ['user_id','username','coins','best_score','referrer_id','referrals_count','wallet','wallet_updated_at'].join(','),
    ...users.map(u => [
      JSON.stringify(u.user_id),
      JSON.stringify(u.username || ''),
      (Number(u.coins) || 0).toFixed(2),
      Math.round(Number(u.best_score) || 0),
      JSON.stringify(u.referrer_id || ''),
      (Array.isArray(u.referrals) ? u.referrals.length : 0),
      JSON.stringify(u.wallet),
      JSON.stringify(u.wallet_updated_at || '')
    ].join(',')),
  ];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="wallets.csv"');
  res.send(rows.join('\n'));
});

// Глобальный обработчик ошибок
app.use((err, _req, res, _next) => {
  console.error('Необработанная ошибка:', err);
  res.status(500).json({ error: 'internal_server_error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на http://0.0.0.0:${PORT}`);
});
