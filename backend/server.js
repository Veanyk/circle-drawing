const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 8000;
const DB_PATH = path.join(__dirname, 'database.json');
const ATTEMPT_REGEN_INTERVAL_MS = 1 * 60 * 1000; // 1 минута

// --- CORS ---
// Настройка CORS осталась вашей, она хороша
const ALLOWED = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://circle-drawing.vercel.app',
  'https://draw-a-circle.chickenkiller.com',
  'https://web.telegram.org',
]);

const corsOptions = {
  origin(origin, cb) {
    if (!origin || ALLOWED.has(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// --- DB helpers ---
function ensureDb() { if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, '{}'); }
function readDb() {
  ensureDb();
  const data = fs.readFileSync(DB_PATH, 'utf8');
  try {
    return JSON.parse(data || '{}');
  } catch (e) {
    console.error("Ошибка парсинга JSON, файл мог быть поврежден:", data);
    return {}; // Возвращаем пустой объект в случае ошибки парсинга
  }
}
function writeDb(data) { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

// --- Логика восстановления попыток (ваша логика здесь хороша) ---
function regenAttempts(u) {
  const now = Date.now();
  while (u.attempts < u.max_attempts && u.nextAttemptTimestamp && now >= u.nextAttemptTimestamp) {
    u.attempts += 1;
    u.nextAttemptTimestamp += ATTEMPT_REGEN_INTERVAL_MS;
  }
  if (u.attempts >= u.max_attempts) {
    u.nextAttemptTimestamp = null;
  }
}

// --- ROUTES ---
app.get('/health', (req, res) => res.json({ ok: true }));

// ЕДИНСТВЕННЫЙ МАРШРУТ для получения данных
app.post('/getUserData', (req, res) => {
  try {
    // Принимаем все данные, которые прислал фронтенд
    const { user_id, ref_id, username } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id не предоставлен' });

    const db = readDb();
    let user = db[user_id];

    // Если пользователя нет, создаем его
    if (!user) {
      user = {
        user_id,
        // Используем присланный username. Если его нет, используем user_id как запасной вариант.
        username: username || `User_${String(user_id).slice(-4)}`,
        referrer_id: ref_id || null,
        coins: 0,
        attempts: 25,
        max_attempts: 25,
        best_score: 0,
        completed_tasks: [],
        referrals: [],
        nextAttemptTimestamp: null
      };
      db[user_id] = user;

      // Логика добавления нового пользователя в список рефералов его "пригласителя"
      if (ref_id && db[ref_id]) {
        if (!db[ref_id].referrals) {
          db[ref_id].referrals = [];
        }
        // Убедимся, что не добавляем дубликаты
        if (!db[ref_id].referrals.includes(user_id)) {
            db[ref_id].referrals.push(user_id);
        }
      }
    }

    // Логика для уже существующего пользователя, который впервые пришел по реф. ссылке
    if (user && ref_id && !user.referrer_id && ref_id !== user_id) {
        user.referrer_id = ref_id;
        if (db[ref_id]) {
            if (!db[ref_id].referrals) db[ref_id].referrals = [];
            if (!db[ref_id].referrals.includes(user_id)) {
                db[ref_id].referrals.push(user_id);
            }
        }
    }

    regenAttempts(user);
    writeDb(db);
    res.json(user);
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal_error' }); }
});

app.post('/updateUserData', (req, res) => {
  try {
    const { user_id, data } = req.body || {};
    if (!user_id || !data) return res.status(400).json({ error: 'Некорректные данные' });

    const db = readDb();
    if (!db[user_id]) return res.status(404).json({ error: 'Пользователь не найден' });

    const prevUserData = { ...db[user_id] }; // Сохраняем старое состояние пользователя

    // Обновляем данные
    db[user_id] = { ...prevUserData, ...data };

    // Обновляем лучший результат, если нужно
    if (typeof data.score === 'number' && data.score > (prevUserData.best_score || 0)) {
      db[user_id].best_score = data.score;
    }

    // --- УЛУЧШЕННАЯ ЛОГИКА РЕФЕРАЛЬНОГО БОНУСА ---
    const earnedCoins = (db[user_id].coins || 0) - (prevUserData.coins || 0);

    if (earnedCoins > 0 && prevUserData.referrer_id) {
      const referrer = db[prevUserData.referrer_id];
      if (referrer) {
        const bonus = earnedCoins * 0.05; // 5% бонус
        referrer.coins = (referrer.coins || 0) + bonus;
        console.log(`Начислен бонус ${bonus.toFixed(4)} монет пользователю ${referrer.user_id} от реферала ${user_id}`);
      }
    }

    writeDb(db);
    res.json(db[user_id]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal_error' }); }
});


// Маршруты Leaderboard и Referrals остаются почти без изменений, только добавляем проверки
app.get('/getLeaderboard', (req, res) => {
  try {
    const db = readDb();
    const leaders = Object.values(db)
      .filter(u => u && typeof u.coins === 'number')
      .sort((a, b) => b.coins - a.coins)
      .slice(0, 10);
    res.json(leaders);
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal_error' }); }
});

app.post('/getReferrals', (req, res) => {
  try {
    const { user_id } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'user_id не предоставлен' });
    const db = readDb();
    const user = db[user_id];
    if (!user || !Array.isArray(user.referrals)) return res.json([]);
    const referralsData = user.referrals.map(id => db[id]).filter(Boolean);
    res.json(referralsData);
  } catch (e) { console.error(e); res.status(500).json({ error: 'internal_error' }); }
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error('Необработанная ошибка:', err);
  res.status(500).json({ error: 'internal_server_error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на http://0.0.0.0:${PORT}`);
});