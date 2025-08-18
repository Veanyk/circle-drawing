import React, { useState, useEffect, useCallback } from 'react';
import Canvas from './components/Canvas';
import Result from './components/Result';
import Tasks from './components/Tasks';
import TabBar from './components/TabBar';
import Referrals from './components/Referrals';
import Leaderboards from './components/Leaderboards';
import './App.css';

const SERVER_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:8000'  // локально бьёмся напрямую в ваш backend
    : '/api';                  // на Vercel ходим на тот же origin, а rewrites прокинут дальше
const ATTEMPT_REGEN_INTERVAL_MS = 1 * 60 * 1000; // 1 минута

const getBrowserUserId = () => {
  let userId = localStorage.getItem('circleGameUserId');
  if (!userId) {
    userId = `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('circleGameUserId', userId);
  }
  return userId;
};

const ScoreCircle = ({ score }) => {
  const angle = (score / 100) * 360;
  const circleStyle = {
    backgroundImage: `conic-gradient(#BE5200 ${angle}deg, #ffffff ${angle}deg 360deg)`,
  };

  return (
    <div className="result-image-header">
      <div className="result-circle-dynamic" style={circleStyle}></div>
      <img
        src={require('./assets/result_circle.png')}
        alt="Result"
        className="result-circle-image"
      />
      <div className="result-text-overlay">{score}%</div>
    </div>
  );
};

function App() {
  // --- Состояния компонента ---
  const [score, setScore] = useState(null);
  const [currentTab, setCurrentTab] = useState('circle');
  const [drawingData, setDrawingData] = useState(null);
  const [userId, setUserId] = useState(null);
  const [coins, setCoins] = useState(0);
  const [attempts, setAttempts] = useState(0); // Начинаем с 0, пока не загрузим данные
  const [maxAttempts, setMaxAttempts] = useState(25);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [nextAttemptTimestamp, setNextAttemptTimestamp] = useState(null);
  const [timeToNextAttempt, setTimeToNextAttempt] = useState(null);

  // --- Эффект для работы с Telegram API (выполняется один раз) ---
  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.expand();
      document.body.style.backgroundColor = tg.themeParams.bg_color || '#0f0f0f';
    }
  }, []);

  // --- Функция для отправки обновлений на сервер ---
  const updateUserDataOnServer = useCallback((newData) => {
    if (!userId) return; // Не отправляем ничего, если ID пользователя еще не определен
    fetch(`${SERVER_URL}/updateUserData`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, data: newData })
    })
    .catch(err => console.error('Ошибка при обновлении данных на сервере:', err));
  }, [userId]); // Эта функция пересоздается только если изменился userId

  // --- Главный эффект для определения ID и ЗАГРУЗКИ данных (выполняется один раз) ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const refId = urlParams.get('ref');
    let finalUserId;

    if (tgUser?.id) {
      finalUserId = tgUser.id.toString();
    } else {
      finalUserId = getBrowserUserId();
    }
    setUserId(finalUserId); // Устанавливаем ID пользователя

    // После того как ID установлен, загружаем данные
    if (finalUserId) {
      const initialUserData = {
        user_id: finalUserId,
        ref_id: refId || null,
        username: tgUser?.username ? tgUser.username.replace('@', '') : tgUser?.first_name,
      };

      fetch(`${SERVER_URL}/getUserData`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initialUserData)
      })
      .then(res => res.json())
      .then(data => {
        if (data) {
          setCoins(data.coins || 0);
          setAttempts(data.attempts || 0);
          setMaxAttempts(data.max_attempts || 25);
          setCompletedTasks(data.completed_tasks || []);
          setNextAttemptTimestamp(
              Number.isFinite(Number(data.nextAttemptTimestamp)) ? Number(data.nextAttemptTimestamp) : null
            );
        }
      })
      .catch(err => console.error('Ошибка при получении данных пользователя:', err));
    }
    // Пустой массив зависимостей `[]` гарантирует, что этот код выполнится ТОЛЬКО ОДИН раз
  }, []);

  // --- Отдельный эффект для ТАЙМЕРА восстановления попыток ---
  useEffect(() => {
    if (attempts >= maxAttempts || !nextAttemptTimestamp) {
      setTimeToNextAttempt(null);
      return; // Выходим, если таймер не нужен
    }

    const timerInterval = setInterval(() => {
      const now = Date.now();
      const ts = Number(nextAttemptTimestamp);
      const timeLeft = Math.max(0, Math.ceil((ts - Date.now()) / 1000));

      if (timeLeft <= 0) {
        // Время вышло. Перезагружаем данные с сервера, чтобы получить новые попытки
        fetch(`${SERVER_URL}/getUserData`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId })
        })
        .then(res => res.json())
        .then(data => {
          if (data) {
            setAttempts(data.attempts);
            setNextAttemptTimestamp(data.nextAttemptTimestamp);
          }
        });
        setTimeToNextAttempt(null);
        clearInterval(timerInterval);
        return;
      }

      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      setTimeToNextAttempt(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [attempts, maxAttempts, nextAttemptTimestamp, userId]);

  // --- Обработчики событий ---
  const onDrawEnd = (circleAccuracy, points, canvas, size) => {
    if (attempts <= 0) {
      alert('You are out of attempts!');
      return;
    }

    const newAttempts = attempts - 1;
    const tokensEarned = parseFloat((0.01 * circleAccuracy).toFixed(2));
    const newCoins = coins + tokensEarned;

    let newTimestamp = nextAttemptTimestamp;
    // Если мы только что потратили попытку, когда они были полные, запускаем таймер
    if (attempts === maxAttempts) {
      newTimestamp = Date.now() + ATTEMPT_REGEN_INTERVAL_MS;
      setNextAttemptTimestamp(newTimestamp); // Немедленно обновляем, чтобы запустить таймер
    }

    // Оптимистичное обновление UI
    setScore(circleAccuracy);
    setDrawingData(canvas.toDataURL());
    setCoins(newCoins);
    setAttempts(newAttempts);

    // Отправка данных на сервер
    updateUserDataOnServer({
      coins: newCoins,
      attempts: newAttempts,
      score: circleAccuracy
    });

  const onReset = () => {
    setScore(null);
    setDrawingData(null);
  };

  const onTaskComplete = (taskId, tokens) => {
    if (completedTasks.includes(taskId)) {
      alert('This task has already been completed.');
      return;
    }

    const newCompletedTasks = [...completedTasks, taskId];
    const newCoins = coins + tokens;
    setCompletedTasks(newCompletedTasks);
    setCoins(newCoins);
    alert(`You have earned ${tokens} tokens!`);
    updateUserDataOnServer({
      coins: newCoins,
      completed_tasks: newCompletedTasks,
    });
  };

  return (
    <div className="App">
      {/* --- ШАПКА ПРИЛОЖЕНИЯ --- */}
      {currentTab === 'circle' && (
        <div className="app-header">
          {/* Если есть результат, показываем круг с процентами */}
          {score !== null ? (
            <ScoreCircle score={score} />
          ) : (
            /* Если результата нет, показываем баннер с монетами */
            <div className="coins-display">
              <div className="banner-container">
                <img src={require('./assets/total_coins.png')} alt="Total coins" className="banner-icon" />
                <span className="banner-text">{coins.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Баннер с попытками и таймер показываем всегда на этой вкладке */}
        <div className="attempts-display">
          <div className="banner-container">
            <img src={require('./assets/total_attempts.png')} alt="Total attempts" className="banner-icon" />
            <span className="banner-text">{attempts}/{maxAttempts}</span>
            {timeToNextAttempt && (
              <span className="timer-chip" title="До следующей попытки">
                {timeToNextAttempt}
              </span>
            )}
          </div>
        </div>
      )}

      {/* --- ОСНОВНОЙ КОНТЕНТ --- */}
      <div className="main-content">
        {/* ... остальная часть вашего return без изменений ... */}
      </div>

      <TabBar currentTab={currentTab} setCurrentTab={setCurrentTab} />
    </div>
  );
}

export default App;