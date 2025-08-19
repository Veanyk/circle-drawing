import React, { useState, useEffect, useCallback } from 'react';
import Canvas from './components/Canvas';
import Result from './components/Result';
import Tasks from './components/Tasks';
import TabBar from './components/TabBar';
import Referrals from './components/Referrals';
import Leaderboards from './components/Leaderboards';
import resultCircleImage from './assets/result_circle.png';
import './App.css';

// Единый источник для URL сервера
const SERVER_URL = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '/api';
const ATTEMPT_REGEN_INTERVAL_MS = 1 * 60 * 1000;

// Функция для получения ID пользователя (вынесена для чистоты)
const initializeUserId = () => {
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (tgUser?.id) {
    return String(tgUser.id);
  }
  let userId = localStorage.getItem('circleGameUserId');
  if (!userId) {
    userId = `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('circleGameUserId', userId);
  }
  return userId;
};

const ScoreCircle = ({ score }) => {
  const angle = (Math.max(0, Math.min(100, Number(score) || 0)) / 100) * 360;
  const circleStyle = {
    backgroundImage: `conic-gradient(#BE5200 ${angle}deg, #ffffff ${angle}deg 360deg)`,
  };
  return (
    <div className="score-circle-header">
      <div className="score-circle-dynamic" style={circleStyle}></div>
      <img src={resultCircleImage} alt="Result" className="score-circle-image" />
      <div className="score-circle-text">{Math.round(score)}%</div>
    </div>
  );
};

function App() {
  const [score, setScore] = useState(null);
  const [currentTab, setCurrentTab] = useState('circle');
  const [drawingData, setDrawingData] = useState(null);

  // Cостояния пользователя
  const [userId, setUserId] = useState(null); // <-- Инициализируем как null
  const [coins, setCoins] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(25);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [nextAttemptTimestamp, setNextAttemptTimestamp] = useState(null);
  const [timeToNextAttempt, setTimeToNextAttempt] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // <-- Состояние загрузки

  // 1. Инициализация пользователя при первом запуске
  useEffect(() => {
    // Расширяем приложение Telegram
    window.Telegram?.WebApp?.expand();

    const finalUserId = initializeUserId();
    setUserId(finalUserId); // Устанавливаем userId один раз

    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const urlParams = new URLSearchParams(window.location.search);
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    let refId = urlParams.get('ref') || (startParam?.startsWith('ref_') ? startParam.slice(4) : null);
    if (refId) {
      localStorage.setItem('referrerId', refId);
    } else {
      refId = localStorage.getItem('referrerId');
    }

    // Запрашиваем данные пользователя с сервера
    fetch(`${SERVER_URL}/getUserData`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: finalUserId,
        ref_id: refId,
        username: tgUser?.username,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (!data) return;
        setCoins(Number(data.coins) || 0);
        setAttempts(Number(data.attempts) || 0);
        setMaxAttempts(Number(data.max_attempts) || 25);
        setCompletedTasks(Array.isArray(data.completed_tasks) ? data.completed_tasks : []);
        setNextAttemptTimestamp(Number.isFinite(data.nextAttemptTimestamp) ? data.nextAttemptTimestamp : null);
      })
      .catch(err => console.error('Ошибка при получении данных пользователя:', err))
      .finally(() => setIsLoading(false)); // <-- Загрузка завершена
  }, []);

  // 2. Таймер восстановления попыток
  useEffect(() => {
    if (!userId || attempts >= maxAttempts || !nextAttemptTimestamp) {
      setTimeToNextAttempt(null);
      return;
    }
    const timer = setInterval(() => {
      const timeLeftMs = Math.max(0, nextAttemptTimestamp - Date.now());
      if (timeLeftMs <= 0) {
        // Просто сбрасываем таймер, данные сами обновятся поллингом
        setAttempts(prev => Math.min(maxAttempts, prev + 1));
        setNextAttemptTimestamp(Date.now() + ATTEMPT_REGEN_INTERVAL_MS);
      }
      const totalSec = Math.ceil(timeLeftMs / 1000);
      const minutes = Math.floor(totalSec / 60);
      const seconds = totalSec % 60;
      setTimeToNextAttempt(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [userId, attempts, maxAttempts, nextAttemptTimestamp]);

  // 3. Коллбэк для обновления данных на сервере
  const updateUserDataOnServer = useCallback((newData) => {
    if (!userId) return;
    fetch(`${SERVER_URL}/updateUserData`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, data: newData })
    }).catch(err => console.error('Ошибка при обновлении данных на сервере:', err));
  }, [userId]);

  const onDrawEnd = (circleAccuracy, points, canvas) => {
    if (attempts <= 0) return;
    const newAttempts = attempts - 1;
    const tokensEarned = parseFloat((0.01 * circleAccuracy).toFixed(2));
    const newCoins = coins + tokensEarned;

    setScore(circleAccuracy);
    setDrawingData(canvas.toDataURL());
    setCoins(newCoins);
    setAttempts(newAttempts);
    if (newAttempts < maxAttempts && !nextAttemptTimestamp) {
      setNextAttemptTimestamp(Date.now() + ATTEMPT_REGEN_INTERVAL_MS);
    }
    updateUserDataOnServer({ coins: newCoins, attempts: newAttempts, score: circleAccuracy });
  };

  const onReset = () => {
    setScore(null);
    setDrawingData(null);
  };

  const onTaskComplete = (taskId, tokens) => {
    if (completedTasks.includes(taskId)) return;
    const newCompletedTasks = [...completedTasks, taskId];
    const newCoins = coins + tokens;
    setCompletedTasks(newCompletedTasks);
    setCoins(newCoins);
    updateUserDataOnServer({ coins: newCoins, completed_tasks: newCompletedTasks });
  };

  // Показываем заглушку, пока userId не определен
  if (isLoading) {
    return <div className="App-loading">Loading...</div>;
  }

  return (
    <div className="App">
      {currentTab === 'circle' && (
        <div className="app-header">
            <div className="coins-display">
                <div className="banner-container">
                <img src={require('./assets/total_coins.png')} alt="Total coins" className="banner-icon"/>
                <span className="banner-text">{coins.toFixed(2)}</span>
                </div>
            </div>
            <div className="attempts-display">
                <div className="banner-container">
                <img src={require('./assets/total_attempts.png')} alt="Total attempts" className="banner-icon"/>
                <span className="banner-text">{attempts}/{maxAttempts}</span>
                </div>
                {timeToNextAttempt && <div className="timer-display"><span className="timer-text">{timeToNextAttempt}</span></div>}
            </div>
            {score !== null && <ScoreCircle score={score} />}
        </div>
      )}

      <div className="main-content">
        <div className={`tab-pane ${currentTab === 'circle' ? 'active' : ''}`}>
          {score === null ? <Canvas onDrawEnd={onDrawEnd} attempts={attempts} /> : <Result score={score} onReset={onReset} drawing={drawingData} userId={userId} />}
        </div>
        <div className={`tab-pane ${currentTab === 'tasks' ? 'active' : ''}`}>
          <Tasks onTaskComplete={onTaskComplete} completedTasks={completedTasks} setCurrentTab={setCurrentTab} />
        </div>
        <div className={`tab-pane ${currentTab === 'referrals' ? 'active' : ''}`}>
          {/* Передаем userId, который теперь точно не null */}
          <Referrals userId={userId} />
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