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
  'https://circle-drawing.vercel.app',      // замените
  'https://web.telegram.org', // если открываете в Telegram WebView
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
function regenAttempts(u){
  const now = Date.now();
  if (u.attempts < u.max_attempts && u.nextAttemptTimestamp && now >= u.nextAttemptTimestamp) {
    const elapsed = now - u.nextAttemptTimestamp;
    const cnt = Math.floor(elapsed / ATTEMPT_REGEN_INTERVAL_MS) + 1;
    u.attempts = Math.min(u.max_attempts, u.attempts + cnt);
    u.nextAttemptTimestamp = (u.attempts < u.max_attempts)
      ? u.nextAttemptTimestamp + cnt*ATTEMPT_REGEN_INTERVAL_MS
      : null;
  }
}

// --- ROUTES ---
app.get('/health', (req,res) => res.json({ok:true}));

app.post('/getUserData', (req,res) => {
  try {
    const { user_id } = req.body || {};
    if (!user_id) return res.status(400).json({error:'user_id не предоставлен'});
    const db = readDb();
    let u = db[user_id] || (db[user_id] = {
      user_id, coins:0, attempts:25, max_attempts:25, best_score:0,
      completed_tasks:[], referrals:[], nextAttemptTimestamp:null
    });
    regenAttempts(u); writeDb(db); res.json(u);
  } catch (e) { console.error(e); res.status(500).json({error:'internal_error'}); }
});

app.get('/getUserData', (req,res) => {
  const user_id = req.query.user_id;
  if (!user_id) return res.status(400).json({error:'user_id не предоставлен'});
  const db = readDb();
  let u = db[user_id] || (db[user_id] = {
    user_id, coins:0, attempts:25, max_attempts:25, best_score:0,
    completed_tasks:[], referrals:[], nextAttemptTimestamp:null
  });
  regenAttempts(u); writeDb(db); res.json(u);
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
    writeDb(db); res.json(db[user_id]);
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