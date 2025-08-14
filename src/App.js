import React, { useState, useEffect, useCallback } from 'react';
import Canvas from './components/Canvas';
import Result from './components/Result';
import Tasks from './components/Tasks';
import TabBar from './components/TabBar';
import Referrals from './components/Referrals';
import Leaderboards from './components/Leaderboards';
import './App.css';

const SERVER_URL = 'http://45.153.69.251:8000';
const ATTEMPT_REGEN_INTERVAL_MS = 1 * 60 * 1000; // 1 минута на одну попытку

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
  const [attempts, setAttempts] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(25);
  const [completedTasks, setCompletedTasks] = useState([]);

  // Состояния для таймера
  const [nextAttemptTimestamp, setNextAttemptTimestamp] = useState(null);
  const [timeToNextAttempt, setTimeToNextAttempt] = useState(null);

  // --- ЭФФЕКТЫ ---

  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.expand();
      document.body.style.backgroundColor = tg.themeParams.bg_color || '#0f0f0f';
    }
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tgUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    let finalUserId;

    if (tgUserId) {
      finalUserId = tgUserId.toString();
    } else {
      finalUserId = getBrowserUserId();
    }
    setUserId(finalUserId);
  }, []);

  const updateUserDataOnServer = useCallback((newData) => {
    if (!userId) return;
    fetch(`${SERVER_URL}/updateUserData`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, data: newData })
    })
    .catch(err => console.error('Ошибка при обновлении данных на сервере:', err));
  }, [userId]);

  const fetchUserData = useCallback(() => {
    if (!userId) return;

    const urlParams = new URLSearchParams(window.location.search);
    const refId = urlParams.get('ref');

    fetch(`${SERVER_URL}/getUserData`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    })
    .then(res => res.json())
    .then(data => {
      if (data) {
        setCoins(data.coins || 0);
        setAttempts(data.attempts || 0);
        setMaxAttempts(data.max_attempts || 25);
        setCompletedTasks(data.completed_tasks || []);
        setNextAttemptTimestamp(data.nextAttemptTimestamp || null);

        if (refId && refId !== String(userId)) {
          const refs = data.referrals || [];
          if (!refs.includes(refId)) {
            updateUserDataOnServer({ referrals: [...refs, refId] });
          }
        }
      }
    })
    .catch(err => console.error('Ошибка при получении данных пользователя:', err));
  }, [userId, updateUserDataOnServer]);

  useEffect(() => {
    fetchUserData();
  }, [userId, fetchUserData]);

  useEffect(() => {
    if (attempts >= maxAttempts || !nextAttemptTimestamp) {
      setTimeToNextAttempt(null);
      return;
    }

    const intervalId = setInterval(() => {
      const now = Date.now();
      const timeLeft = Math.round((nextAttemptTimestamp - now) / 1000);

      if (timeLeft <= 0) {
        // Время вышло, просто перезапрашиваем данные с сервера.
        // Сервер сам начислит попытки.
        fetchUserData();
        return;
      }

      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      setTimeToNextAttempt(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [attempts, maxAttempts, nextAttemptTimestamp, fetchUserData]);

  const onDrawEnd = (circleAccuracy, points, canvas, size) => {
    if (attempts > 0) {
      const newAttempts = attempts - 1;
      const tokensEarned = parseFloat((0.01 * circleAccuracy).toFixed(2));
      const newCoins = coins + tokensEarned;

      let newTimestamp = nextAttemptTimestamp;
      if (attempts === maxAttempts) {
        newTimestamp = Date.now() + ATTEMPT_REGEN_INTERVAL_MS;
        setNextAttemptTimestamp(newTimestamp);
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
    } else {
      alert('You are out of attempts!');
    }
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
            {/* --- БЛОК ДЛЯ ОТОБРАЖЕНИЯ ТАЙМЕРА --- */}
            {timeToNextAttempt && (
              <div className="timer-display">
                <span className="timer-text">{timeToNextAttempt}</span>
              </div>
            )}
          </div>
        </>
      )}

      <div className="main-content">
        {/* ... остальная разметка без изменений ... */}
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
          <Leaderboards />
        </div>
      </div>
      <TabBar currentTab={currentTab} setCurrentTab={setCurrentTab} />
    </div>
  );
}

export default App;