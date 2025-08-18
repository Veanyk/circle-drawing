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

// Вспомогательный компонент для круга с результатом в шапке
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
  const [score, setScore] = useState(null);
  const [currentTab, setCurrentTab] = useState('circle');
  const [drawingData, setDrawingData] = useState(null);
  const [userId, setUserId] = useState(null);
  const [coins, setCoins] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(25);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [nextAttemptTimestamp, setNextAttemptTimestamp] = useState(null);
  const [timeToNextAttempt, setTimeToNextAttempt] = useState(null);

  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.expand();
      document.body.style.backgroundColor = tg.themeParams.bg_color || '#0f0f0f';
    }
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
    setUserId(finalUserId);

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
          const rawTs = data?.nextAttemptTimestamp;
          const parsedTs = typeof rawTs === 'number'
            ? rawTs
            : (typeof rawTs === 'string' ? parseInt(rawTs, 10) : NaN);
          setNextAttemptTimestamp(Number.isFinite(parsedTs) && parsedTs > 0 ? parsedTs : null);
        }
      })
      .catch(err => console.error('Ошибка при получении данных пользователя:', err));
    }
  }, []);

  useEffect(() => {
    if (attempts >= maxAttempts || !nextAttemptTimestamp) {
      setTimeToNextAttempt(null);
      return;
    }

    const timerInterval = setInterval(() => {
      const timeLeft = Math.max(0, Math.ceil((nextAttemptTimestamp - Date.now()) / 1000));

      if (timeLeft <= 0) {
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
      setNextAttemptTimestamp(newTimestamp);
    }

    setScore(circleAccuracy);
    setDrawingData(canvas.toDataURL());
    setCoins(newCoins);
    setAttempts(newAttempts);

    updateUserDataOnServer({
      coins: newCoins,
      attempts: newAttempts,
      score: circleAccuracy
    });
  };

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
      {currentTab === 'circle' && (
        <div className="app-header">
          {score !== null ? (
            <ScoreCircle score={score} />
          ) : (
            <div className="coins-display">
              <div className="banner-container">
                <img src={require('./assets/total_coins.png')} alt="Total coins" className="banner-icon" />
                <span className="banner-text">{coins.toFixed(2)}</span>
              </div>
            </div>
          )}

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
        </div>
      )}
      <div className="main-content">
        <div className={`tab-pane ${currentTab === 'circle' ? 'active' : ''}`}>
          {score === null ? (
            <Canvas onDrawEnd={onDrawEnd} attempts={attempts} />
          ) : (
            <Result
              score={score}
              onReset={onReset}
              drawing={drawingData}
              userId={userId}
            />
          )}
        </div>
        <div className={`tab-pane ${currentTab === 'tasks' ? 'active' : ''}`}>
          <Tasks
            onTaskComplete={onTaskComplete}
            completedTasks={completedTasks}
            setCurrentTab={setCurrentTab}
          />
        </div>
        <div className={`tab-pane ${currentTab === 'referrals' ? 'active' : ''}`}>
          <Referrals userId={userId} />
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