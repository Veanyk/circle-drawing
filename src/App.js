import React, { useState, useEffect, useCallback } from 'react';
import Canvas from './components/Canvas';
import Result from './components/Result';
import Tasks from './components/Tasks';
import TabBar from './components/TabBar';
import Referrals from './components/Referrals';
import Leaderboards from './components/Leaderboards';
import resultCircleImage from './assets/result_circle.png';
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
      document.body.style.backgroundColor = tg.themeParams?.bg_color || '#0f0f0f';
    }
  }, []);

  const updateUserDataOnServer = useCallback((newData) => {
    if (!userId) return;
    fetch(`${SERVER_URL}/updateUserData`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, data: newData })
    }).catch(err => console.error('Ошибка при обновлении данных на сервере:', err));
  }, [userId]);

  // Инициализация пользователя и первичная загрузка
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    // 1) берём из URL (?ref=)
    let refId = urlParams.get('ref');
    // 2) или из Telegram start_param (ref_<id>)
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (!refId && startParam && String(startParam).startsWith('ref_')) {
      refId = String(startParam).slice(4);
    }
    // 3) или из localStorage (запоминаем на будущее)
    if (!refId) {
      refId = localStorage.getItem('referrerId') || null;
    } else {
      localStorage.setItem('referrerId', refId);
    }

    let finalUserId;
    if (tgUser?.id) {
      finalUserId = String(tgUser.id);
    } else {
      finalUserId = getBrowserUserId();
    }
    setUserId(finalUserId);

    if (finalUserId) {
      const handle = tgUser?.username ? tgUser.username.replace(/^@/, '') : null;
      const initialUserData = {
        user_id: finalUserId,
        ref_id: refId || null,
        username: handle,
      };

      fetch(`${SERVER_URL}/getUserData`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initialUserData)
      })
        .then(res => res.json())
        .then(data => {
          if (!data) return;
          setCoins(Number.isFinite(Number(data.coins)) ? Number(data.coins) : 0);
          setAttempts(Number.isFinite(Number(data.attempts)) ? Number(data.attempts) : 0);
          setMaxAttempts(Number.isFinite(Number(data.max_attempts)) ? Number(data.max_attempts) : 25);
          setCompletedTasks(Array.isArray(data.completed_tasks) ? data.completed_tasks : []);

          const rawTs = data.nextAttemptTimestamp;
          const parsedTs =
            typeof rawTs === 'number' ? rawTs :
              (typeof rawTs === 'string' ? parseInt(rawTs, 10) : NaN);
          setNextAttemptTimestamp(Number.isFinite(parsedTs) && parsedTs > 0 ? parsedTs : null);
        })
        .catch(err => console.error('Ошибка при получении данных пользователя:', err));
    }
  }, []);

  // Таймер восстановления попыток (тик каждую секунду)
  useEffect(() => {
    if (attempts >= maxAttempts || !nextAttemptTimestamp) {
      setTimeToNextAttempt(null);
      return;
    }
    const timer = setInterval(() => {
      const timeLeftMs = Math.max(0, nextAttemptTimestamp - Date.now());
      if (timeLeftMs <= 0) {
        // подхватим новые значения с сервера
        fetch(`${SERVER_URL}/getUserData`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId })
        })
          .then(res => res.json())
          .then(data => {
            if (!data) return;
            setAttempts(Number.isFinite(Number(data.attempts)) ? Number(data.attempts) : attempts);
            const rawTs = data.nextAttemptTimestamp;
            const parsedTs =
              typeof rawTs === 'number' ? rawTs :
                (typeof rawTs === 'string' ? parseInt(rawTs, 10) : NaN);
            setNextAttemptTimestamp(Number.isFinite(parsedTs) && parsedTs > 0 ? parsedTs : null);
          })
          .catch(() => { /* no-op */ });
        setTimeToNextAttempt(null);
        clearInterval(timer);
        return;
      }
      const totalSec = Math.ceil(timeLeftMs / 1000);
      const minutes = Math.floor(totalSec / 60);
      const seconds = totalSec % 60;
      setTimeToNextAttempt(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [attempts, maxAttempts, nextAttemptTimestamp, userId]);

  // Автообновление монет/статуса заданий, пока открыт экран рефералов
  useEffect(() => {
    if (currentTab !== 'referrals' || !userId) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/getUserData`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId }),
        });
        const data = await res.json();
        if (!stop && data) {
          setCoins(Number.isFinite(Number(data.coins)) ? Number(data.coins) : 0);
          setCompletedTasks(Array.isArray(data.completed_tasks) ? data.completed_tasks : []);
        }
      } catch { /* ignore */ }
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => { stop = true; clearInterval(iv); };
  }, [currentTab, userId]);

  const onDrawEnd = (circleAccuracy, points, canvas, size) => {
    if (attempts <= 0) {
      alert('You are out of attempts!');
      return;
    }

    const newAttempts = attempts - 1;
    const tokensEarned = parseFloat((0.01 * circleAccuracy).toFixed(2));
    const newCoins = coins + tokensEarned;

    // если тратим с полного запаса — запускаем локальный таймер
    if (attempts === maxAttempts) {
      const ts = Date.now() + ATTEMPT_REGEN_INTERVAL_MS;
      setNextAttemptTimestamp(ts);
    }

    setScore(circleAccuracy);
    setDrawingData(canvas.toDataURL());
    setCoins(newCoins);
    setAttempts(newAttempts);

    // сервер сам управляет nextAttemptTimestamp, не передаём его
    updateUserDataOnServer({
      coins: newCoins,
      attempts: newAttempts,
      score: circleAccuracy,
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
        {/* Монеты — фиксированный блок справа сверху */}
        <div className="coins-display">
          <div className="banner-container">
            <img
              src={require('./assets/total_coins.png')}
              alt="Total coins"
              className="banner-icon"
            />
            <span className="banner-text">{coins.toFixed(2)}</span>
          </div>
        </div>

        {/* Попытки + таймер — фиксированный блок ниже монет */}
        <div className="attempts-display">
          <div className="banner-container">
            <img
              src={require('./assets/total_attempts.png')}
              alt="Total attempts"
              className="banner-icon"
            />
            <span className="banner-text">{attempts}/{maxAttempts}</span>
          </div>
          {timeToNextAttempt && (
            <div className="timer-display">
              <span className="timer-text">{timeToNextAttempt}</span>
            </div>
          )}
        </div>

        {/* Один-единственный круг по центру сверху — только когда уже есть результат */}
        {score !== null && <ScoreCircle score={score} />}
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
        <Leaderboards userId={userId} />
      </div>
    </div>

    <TabBar currentTab={currentTab} setCurrentTab={setCurrentTab} />
  </div>
  );
}
export default App;