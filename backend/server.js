const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 8000;
const DB_PATH = path.join(__dirname, 'database.json');
const ATTEMPT_REGEN_INTERVAL_MS = 1 * 60 * 1000; // 1 минута на одну попытку

app.use(cors());
app.use(bodyParser.json());

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (без изменений) ---
const readDatabase = () => {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Ошибка чтения базы данных!", error);
        return {};
    }
};

const writeDatabase = (data) => {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error("Ошибка записи в базу данных!", error);
    }
};

// --- МАРШРУТЫ (С ИЗМЕНЕНИЯМИ) ---

app.post('/getUserData', (req, res) => {
    const { user_id } = req.body;
    if (!user_id) {
        return res.status(400).json({ error: 'user_id не предоставлен' });
    }

    const db = readDatabase();
    let userData = db[user_id];

    if (!userData) {
        userData = {
            user_id: user_id,
            coins: 0,
            attempts: 25,
            max_attempts: 25,
            best_score: 0,
            completed_tasks: [],
            referrals: [],
            nextAttemptTimestamp: null, // Поле для времени следующей попытки
        };
        db[user_id] = userData;
        writeDatabase(db);
    }

    // --- ГЛАВНАЯ ЛОГИКА ВОССТАНОВЛЕНИЯ ПОПЫТОК ---
    const now = Date.now();
    // Проверяем, нужно ли восстанавливать попытки
    if (userData.attempts < userData.max_attempts && userData.nextAttemptTimestamp && now >= userData.nextAttemptTimestamp) {
        // Рассчитываем, сколько попыток должно было восстановиться за прошедшее время
        const elapsedTime = now - userData.nextAttemptTimestamp;
        const attemptsToRestore = Math.floor(elapsedTime / ATTEMPT_REGEN_INTERVAL_MS) + 1;

        const newAttempts = Math.min(userData.max_attempts, userData.attempts + attemptsToRestore);

        userData.attempts = newAttempts;

        // Если попытки все еще не полные, вычисляем новый таймстамп для следующей
        if (newAttempts < userData.max_attempts) {
            userData.nextAttemptTimestamp = userData.nextAttemptTimestamp + (attemptsToRestore * ATTEMPT_REGEN_INTERVAL_MS);
        } else {
            // Если попытки восстановились до максимума, сбрасываем таймер
            userData.nextAttemptTimestamp = null;
        }

        // Сохраняем обновленные данные в базу
        db[user_id] = userData;
        writeDatabase(db);
    }
    // ---------------------------------------------

    console.log(`Отправлены данные для пользователя ${user_id}`);
    res.json(userData);
});

app.post('/updateUserData', (req, res) => {
    const { user_id, data: newData } = req.body;
    if (!user_id || !newData) {
        return res.status(400).json({ error: 'Некорректные данные' });
    }
    const db = readDatabase();
    if (!db[user_id]) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }

    db[user_id] = { ...db[user_id], ...newData };

    if (newData.score && newData.score > (db[user_id].best_score || 0)) {
        db[user_id].best_score = newData.score;
    }

    writeDatabase(db);
    console.log(`Обновлены данные для пользователя ${user_id}`);
    res.json(db[user_id]);
});

// ... остальные маршруты (getLeaderboard, getReferrals) остаются без изменений ...
app.get('/getLeaderboard', (req, res) => {
    const db = readDatabase();
    const leaders = Object.values(db).sort((a, b) => b.coins - a.coins).slice(0, 10);
    res.json(leaders);
});
app.post('/getReferrals', (req, res) => {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id не предоставлен' });
    const db = readDatabase();
    const user = db[user_id];
    if (!user || !user.referrals) return res.json([]);
    const referralsData = user.referrals.map(refId => db[refId]).filter(Boolean);
    res.json(referralsData);
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});