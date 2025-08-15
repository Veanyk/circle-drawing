import React, { useState, useEffect, useCallback } from 'react';
import Canvas from './components/Canvas';
import Result from './components/Result';
import Tasks from './components/Tasks';
import TabBar from './components/TabBar';
import Referrals from './components/Referrals';
import Leaderboards from './components/Leaderboards';
import './App.css';

const SERVER_URL = 'https://draw-a-circle.chickenkiller.com';
const ATTEMPT_REGEN_INTERVAL_MS = 1 * 60 * 1000;

const getBrowserUserId = () => {
  let userId = localStorage.getItem('circleGameUserId');
  if (!userId) {
    userId = `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('circleGameUserId', userId);
  }
  return userId;
};

function App() {
  const [score, setScore] = useState(null);
  const [currentTab, setCurrentTab] = useState('circle');
  const [drawingData, setDrawingData] = useState(null);
  const [userId, setUserId] = useState(null);
  const [coins, setCoins] = useState(0);
  const [attempts, setAttempts] = useState(0); // Начинаем с 0, пока не загрузим
  const [maxAttempts, setMaxAttempts] = useState(25);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [nextAttemptTimestamp, setNextAttemptTimestamp] = useState(null);
  const [timeToNextAttempt, setTimeToNextAttempt] = useState(null);

  // 1. Эффект для определения ID пользователя (выполняется один раз)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tgUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    setUserId(tgUserId ? tgUserId.toString() : getBrowserUserId());

    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.expand();
      document.body.style.backgroundColor = tg.themeParams.bg_color || '#0f0f0f';
    }
  }, []);

  // 2. Функция для отправки данных на сервер
  const updateUserDataOnServer = useCallback((newData) => {
    if (!userId) return;
    fetch(`${SERVER_URL}/updateUserData`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, data: newData })
    })
    .catch(err => console.error('Ошибка при обновлении данных на сервере:', err));
  }, [userId]);

  // 3. Главный эффект для ЗАГРУЗКИ данных (выполняется, когда появляется userId)
  useEffect(() => {
    if (!userId) return; // Не делаем ничего, пока нет ID

    const fetchUserData = () => {
      fetch(`${SERVER_URL}/getUserData`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      })
      .then(res => res.json())
      .then(data => {
        if (data) {
          setCoins(data.coins || 0);
          setAttempts(data.attempts || 0); // Устанавливаем реальное количество попыток
          setMaxAttempts(data.max_attempts || 25);
          setCompletedTasks(data.completed_tasks || []);
          setNextAttemptTimestamp(data.nextAttemptTimestamp || null);

          // Логика рефералов перенесена сюда для надежности
          const refId = new URLSearchParams(window.location.search).get('ref');
          if (refId && refId !== String(userId) && !data.referrals?.includes(refId)) {
            updateUserDataOnServer({ referrals: [...(data.referrals || []), refId] });
          }
        }
      })
      .catch(err => console.error('Ошибка при получении данных пользователя:', err));
    };

    fetchUserData(); // Вызываем сразу при появлении userId

    // Устанавливаем интервал для периодической синхронизации с сервером
    const syncInterval = setInterval(fetchUserData, 30000); // Синхронизация каждые 30 секунд

    return () => clearInterval(syncInterval); // Очищаем интервал при размонтировании

  }, [userId, updateUserDataOnServer]);

  // 4. Эффект для ТАЙМЕРА (отдельный и более простой)
  useEffect(() => {
    if (attempts >= maxAttempts || !nextAttemptTimestamp) {
      setTimeToNextAttempt(null);
      return;
    }

    const timerInterval = setInterval(() => {
      const timeLeft = Math.round((nextAttemptTimestamp - Date.now()) / 1000);
      if (timeLeft <= 0) {
        // Не перезагружаем страницу, а просто сбрасываем таймер.
        // Следующая синхронизация (из эффекта #3) сама обновит попытки.
        setTimeToNextAttempt(null);
        clearInterval(timerInterval);
        return;
      }
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      setTimeToNextAttempt(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [attempts, maxAttempts, nextAttemptTimestamp]);

  // --- ОБРАБОТЧИКИ СОБЫТИЙ (без критических изменений) ---
  const onDrawEnd = (circleAccuracy, points, canvas, size) => {
    if (attempts <= 0) {
      alert('You are out of attempts!');
      return;
    }
    const newAttempts = attempts - 1;
    const tokensEarned = parseFloat((0.01 * circleAccuracy).toFixed(2));
    const newCoins = coins + tokensEarned;

    let newTimestamp = nextAttemptTimestamp;
    if (attempts === maxAttempts) {
      newTimestamp = Date.now() + ATTEMPT_REGEN_INTERVAL_MS;
      setNextAttemptTimestamp(newTimestamp); // Немедленно обновляем, чтобы запустить таймер
    }

    setScore(circleAccuracy);
    setDrawingData(canvas.toDataURL());
    setCoins(newCoins);
    setAttempts(newAttempts);

    updateUserDataOnServer({
      coins: newCoins,
      attempts: newAttempts,
      score: circleAccuracy,
      nextAttemptTimestamp: newTimestamp
    });
  };

  const onReset = () => { setScore(null); setDrawingData(null); };

  const onTaskComplete = (taskId, tokens) => {
    if (completedTasks.includes(taskId)) {
      alert('This task has already been completed.'); return;
    }
    const newCompletedTasks = [...completedTasks, taskId];
    const newCoins = coins + tokens;
    setCompletedTasks(newCompletedTasks); setCoins(newCoins);
    alert(`You have earned ${tokens} tokens!`);
    updateUserDataOnServer({ coins: newCoins, completed_tasks: newCompletedTasks });
  };

  return (
    // ... ваш JSX без изменений ...
    <div className="App">
      {currentTab === 'circle' && (
        <>
          <div className="coins-display">
            <div className="banner-container">
              <img src={require('./assets/total_coins.png')} alt="Total coins" className="banner-icon" />
              <span className="banner-text">{coins.toFixed(2)}</span>
            </div>
          </div>
          <div className="attempts-display">
            <div className="banner-container">
              <img src={require('./assets/total_attempts.png')} alt="Total attempts" className="banner-icon" />
              <span className="banner-text">{attempts}/{maxAttempts}</span>
            </div>
            {timeToNextAttempt && (
              <div className="timer-display">
                <span className="timer-text">{timeToNextAttempt}</span>
              </div>
            )}
          </div>
        </>
      )}
      <div className="main-content">
        <div className={`tab-pane ${currentTab === 'circle' ? 'active' : ''}`}>
          {score === null ? (
            <Canvas onDrawEnd={onDrawEnd} attempts={attempts} />
          ) : (
            <Result score={score} onReset={onReset} drawing={drawingData} userId={userId} />
          )}
        </div>
        <div className={`tab-pane ${currentTab === 'tasks' ? 'active' : ''}`}>
          <Tasks onTaskComplete={onTaskComplete} completedTasks={completedTasks} setCurrentTab={setCurrentTab} />
        </div>
        <div className={`tab-pane ${currentTab === 'referrals' ? 'active' : ''}`}>
          <Referrals userId={userId} coins={coins} onTaskComplete={onTaskComplete} completedTasks={completedTasks} />
        </div>
        <div className={`tab-pane ${currentTab === 'leaderboards' ? 'active' : ''}`}>
          <Leaderboards userId={userId} />
        </div>
      </div>
      <TabBar currentTab={currentTab} setCurrentTab={setCurrentTab} />
    </div>
  );
}

export default App;