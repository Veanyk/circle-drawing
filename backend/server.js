// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 8000;
const DB_PATH = path.join(__dirname, 'database.json');
const ATTEMPT_REGEN_INTERVAL_MS = 60_000;

// --- CORS ---
const ALLOWED = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // прод-URL(ы):
  'https://circle-drawing.vercel.app',
  'https://draw-a-circle.chickenkiller.com',
  'https://web.telegram.org',
]);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);            // Postman/health
    if (ALLOWED.has(origin)) return cb(null, true);
    if (/^https?:\/\/66\.151\.32\.20(?::\d+)?$/.test(origin)) return cb(null, true);
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions)); // обработка preflight для всех путей
app.use(express.json());

// --- DB helpers ---
function ensureDb() { if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, '{}'); }
function readDb() { ensureDb(); return JSON.parse(fs.readFileSync(DB_PATH,'utf8') || '{}'); }
function writeDb(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data,null,2)); }

// --- логика восстановления попыток ---
function regenAttempts(u) {
  const now = Date.now();

  // Запускаем цикл, который будет работать, пока есть что восстанавливать
  while (
    u.attempts < u.max_attempts &&       // Если попытки не полные
    u.nextAttemptTimestamp &&            // Если таймер вообще был запущен
    now >= u.nextAttemptTimestamp      // И если время восстановления уже наступило
  ) {
    // Добавляем СТРОГО ОДНУ попытку
    u.attempts += 1;

    // Сдвигаем время следующего восстановления на один интервал вперед
    // Это ключевой момент: мы не сбрасываем таймер, а продолжаем его с того места, где он был.
    u.nextAttemptTimestamp += ATTEMPT_REGEN_INTERVAL_MS;
  }

  // Если после всех восстановлений попытки заполнились до максимума,
  // то полностью сбрасываем таймер.
  if (u.attempts >= u.max_attempts) {
    u.nextAttemptTimestamp = null;
  }
}

// --- ROUTES ---
app.get('/health', (req,res) => res.json({ok:true}));

app.post('/getUserData', (req,res) => {
  try {
    const { user_id, first_name } = req.body; // Принимаем и user_id, и first_name
    if (!user_id) return res.status(400).json({error:'user_id не предоставлен'});

    const db = readDb();
    let u = db[user_id];

    // Если пользователя нет, создаем его С НОВЫМ ПОЛЕМ `username`
    if (!u) {
      u = db[user_id] = {
        user_id,
        username: first_name || user_id, // Используем first_name, если есть, иначе user_id
        coins: 0,
        attempts: 25,
        max_attempts: 25,
        best_score: 0,
        completed_tasks: [],
        referrals: [],
        nextAttemptTimestamp: null
      };
    }

    regenAttempts(u);
    writeDb(db);
    res.json(u);
  } catch (e) { console.error(e); res.status(500).json({error:'internal_error'}); }
});

app.get('/getUserData', (req,res) => {
  const { user_id, first_name, ref_id } = req.body;
  if (!user_id) return res.status(400).json({error:'user_id не предоставлен'});
  const db = readDb();
  let u = db[user_id];

  if (!u) {
    u = db[user_id] = {
      user_id,
      username: user_id,
      referrer_id: ref_id || null,
      coins: 0,
      attempts: 25,
      max_attempts: 25,
      best_score: 0,
      completed_tasks: [],
      referrals: [],
      nextAttemptTimestamp: null
    };
  }

  regenAttempts(u);
  writeDb(db);
  res.json(u);
});
app.post('/updateUserData', (req,res) => {
  try {
    const { user_id, data } = req.body || {};
    if (!user_id || !data) return res.status(400).json({error:'Некорректные данные'});
    const db = readDb();
    if (!db[user_id]) return res.status(404).json({error:'Пользователь не найден'});
    const prev = db[user_id];
    db[user_id] = { ...prev, ...data };
    if (typeof data.score === 'number' && data.score > (prev.best_score||0)) {
      db[user_id].best_score = data.score;
    }

    const earnedCoins = (data.coins || 0) - (prevUserData.coins || 0);
    // Если пользователь заработал монеты (не потратил) и у него есть реферер
    if (earnedCoins > 0 && prevUserData.referrer_id) {
      const referrer = db[prevUserData.referrer_id];

      // Если реферер существует в базе
      if (referrer) {
        const bonus = earnedCoins * 0.05; // 5% от заработка
        referrer.coins = (referrer.coins || 0) + bonus;
        console.log(`Начислен бонус ${bonus.toFixed(4)} монет пользователю ${referrer.user_id} от реферала ${user_id}`);
      }
    }

    writeDb(db);
    res.json(db[user_id]);
  } catch (e) { console.error(e); res.status(500).json({error:'internal_error'}); }
});

app.get('/getLeaderboard', (req,res) => {
  try {
    const db = readDb();
    const leaders = Object.values(db)
      .filter(v => v && typeof v.coins === 'number')
      .sort((a,b) => b.coins - a.coins)
      .slice(0, 10);
    res.json(leaders);
  } catch (e) { console.error(e); res.status(500).json({error:'internal_error'}); }
});

app.post('/getReferrals', (req,res) => {
  try {
    const { user_id } = req.body || {};
    if (!user_id) return res.status(400).json({error:'user_id не предоставлен'});
    const db = readDb();
    const u = db[user_id];
    if (!u || !Array.isArray(u.referrals)) return res.json([]);
    const refs = u.referrals.map(id => db[id]).filter(Boolean);
    res.json(refs);
  } catch (e) { console.error(e); res.status(500).json({error:'internal_error'}); }
});

// — глобальный обработчик: добавим CORS даже на неожиданных ошибках
app.use((err, req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (ALLOWED.has(origin) || /^https?:\/\/66\.151\.32\.20/.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)/.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  console.error('Unhandled:', err);
  res.status(500).json({error:'internal_error'});
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API on http://0.0.0.0:${PORT}`);
});