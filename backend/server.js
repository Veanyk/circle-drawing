'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 8000;
const DB_PATH = path.join(__dirname, 'database.json');

// Время восстановления ОДНОЙ попытки
const ATTEMPT_REGEN_INTERVAL_MS = 1 * 60 * 1000; // 1 минута

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
    if (!origin) return cb(null, true); // curl/вебвью
    const ok = ORIGIN_PATTERNS.some(rx => rx.test(origin));
    return ok ? cb(null, true) : cb(new Error(`CORS: ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
// ⬇️ FIX: вместо '*' используем регэксп, чтобы не падать на path-to-regexp v6
app.options(/.*/, cors(corsOptions));

// Лимит тела (защита от больших аплоадов)
app.use(express.json({ limit: '1mb' }));

// Логирование
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} origin=${req.headers.origin || '-'} ip=${req.ip}`);
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
  catch (e) {
    console.error('Ошибка парсинга JSON:', e);
    return {};
  }
}
function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ---------- Восстановление попыток (РОВНО 1 за тик) ----------
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

    // начислим, если пришло время (ровно на 1)
    regenAttempts(user);

    writeDb(db);
    res.json(user);
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

    // Попытки: разрешаем ТОЛЬКО уменьшение, рост даёт только regenAttempts
    if (typeof data.attempts === 'number' && Number.isFinite(data.attempts)) {
      const nextAttempts = Math.max(0, Math.min(prev.max_attempts, Math.floor(data.attempts)));
      if (nextAttempts < prev.attempts) {
        u.attempts = nextAttempts;

        // если потрачена первая из полного стакана — ставим таймер
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

    // +1 попытка по таймеру (если пришло время)
    regenAttempts(u);

    // Реферальный бонус: 5% от прироста монет
    const earned = (u.coins || 0) - (prev.coins || 0);
    if (earned > 0 && prev.referrer_id && db[prev.referrer_id]) {
      const ref = db[prev.referrer_id];
      const bonus = earned * 0.05;
      ref.coins = (ref.coins || 0) + bonus;
      console.log(`Начислен бонус ${bonus.toFixed(4)} монет пользователю ${ref.user_id} от реферала ${user_id}`);
    }

    db[user_id] = u;
    writeDb(db);
    res.json(u);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Таблица лидеров
app.get('/getLeaderboard', (_req, res) => {
  try {
    const db = readDb();
    const leaders = Object.values(db)
      .filter(u => u && typeof u.coins === 'number' && Number.isFinite(u.coins))
      .sort((a, b) => b.coins - a.coins)
      .slice(0, 10);
    res.json(leaders);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Рефералы
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

// Глобальный обработчик ошибок
app.use((err, _req, res, _next) => {
  console.error('Необработанная ошибка:', err);
  res.status(500).json({ error: 'internal_server_error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на http://0.0.0.0:${PORT}`);
});
