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
    ? 'http://localhost:8000'
    : '/api';

const ATTEMPT_REGEN_INTERVAL_MS = 1 * 60 * 1000; // 1 минута

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

  const [userId, setUserId] = useState(null); // только Telegram ID
  const [initData, setInitData] = useState(''); // подписанные данные Telegram
  const [notInTelegram, setNotInTelegram] = useState(false); // гейт для браузера

  const [coins, setCoins] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(25);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [nextAttemptTimestamp, setNextAttemptTimestamp] = useState(null);
  const [timeToNextAttempt, setTimeToNextAttempt] = useState(null);

  // Инициализация Telegram окружения
  useEffect(() => {
    const tg = window?.Telegram?.WebApp;
    if (tg) {
      tg.expand();
      document.body.style.backgroundColor = tg.themeParams?.bg_color || '#0f0f0f';
      const data = tg?.initData || '';
      setInitData(data);
      setNotInTelegram(!data); // если пусто — запущено не в Mini App
      const tgUser = tg?.initDataUnsafe?.user;
      if (tgUser?.id) setUserId(String(tgUser.id));
    } else {
      setNotInTelegram(true);
    }
  }, []);

  // АВТОЗАХВАТ РЕФЕРАЛА из start_param / tgWebAppStartParam (только в TG, т.к. нужен initData)
  useEffect(() => {
    if (!initData) return; // только внутри Telegram Mini App

    const tg = window?.Telegram?.WebApp;
    const url = new URL(window.location.href);
    const qs = url.searchParams;

    const sp = tg?.initDataUnsafe?.start_param;       // "ref_123"
    const qStart = qs.get('tgWebAppStartParam');      // "ref_123" или "123"

    const extractRef = (v) => {
      if (!v) return null;
      let s = String(v);
      if (s.startsWith('ref_')) s = s.slice(4);
      const n = Number(s);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const inviterId = extractRef(sp) ?? extractRef(qStart);
    if (!inviterId) return;

    fetch(`${SERVER_URL}/acceptReferral`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviter_id: inviterId, initData }),
    })
      .then(r => r.json().catch(() => ({})))
      .then(j => console.log('[AutoAttach] /acceptReferral resp:', j))
      .catch(e => console.error('[AutoAttach] acceptReferral failed:', e));
  }, [initData]);

  // Обновление на сервере — всегда передаём initData, user_id не шлём
  const updateUserDataOnServer = useCallback((newData) => {
    if (!initData) return;
    fetch(`${SERVER_URL}/updateUserData`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: newData, initData }),
    }).catch(err => console.error('Ошибка при обновлении данных на сервере:', err));
  }, [initData]);

  // Инициализация пользователя и первичная загрузка — только внутри Telegram
  useEffect(() => {
    if (notInTelegram || !initData) return;

    const tg = window?.Telegram?.WebApp;
    const tgUser = tg?.initDataUnsafe?.user;

    // достаём возможный ref из URL/start_param — сервер обработает
    const urlParams = new URLSearchParams(window.location.search);
    let refId = null;

    const qStart = urlParams.get('tgWebAppStartParam');
    if (qStart) {
      const val = String(qStart);
      refId = val.startsWith('ref_') ? val.slice(4) : val;
    }

    const startParam = tg?.initDataUnsafe?.start_param;
    if (!refId && typeof startParam === 'string' && startParam.startsWith('ref_')) {
      refId = startParam.slice(4);
    }

    const handle = tgUser?.username ? tgUser.username.replace(/^@/, '') : null;

    fetch(`${SERVER_URL}/getUserData`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ref_id: refId || null,
        username: handle,
        initData, // сервер возьмёт user_id из initData
      }),
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
  }, [initData, notInTelegram]);

  // Таймер восстановления попыток (тик каждую секунду)
  useEffect(() => {
    if (notInTelegram) return;
    if (attempts >= maxAttempts || !nextAttemptTimestamp) {
      setTimeToNextAttempt(null);
      return;
    }
    const timer = setInterval(() => {
      const timeLeftMs = Math.max(0, nextAttemptTimestamp - Date.now());
      if (timeLeftMs <= 0) {
        fetch(`${SERVER_URL}/getUserData`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
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
  }, [attempts, maxAttempts, nextAttemptTimestamp, initData, notInTelegram]);

  // Автообновление монет/статуса заданий, пока открыт экран рефералов (только в TG)
  useEffect(() => {
    if (notInTelegram || currentTab !== 'referrals' || !initData) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/getUserData`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
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
  }, [currentTab, initData, notInTelegram]);

  const onDrawEnd = (circleAccuracy, _points, canvas, _size) => {
    if (notInTelegram) {
      alert('Open in Telegram Mini App to play.');
      return;
    }
    if (attempts <= 0) {
      alert('You are out of attempts!');
      return;
    }

    const newAttempts = attempts - 1;
    const tokensEarned = parseFloat((0.01 * circleAccuracy).toFixed(2));
    const newCoins = coins + tokensEarned;

    if (attempts === maxAttempts) {
      const ts = Date.now() + ATTEMPT_REGEN_INTERVAL_MS;
      setNextAttemptTimestamp(ts);
    }

    setScore(circleAccuracy);
    setDrawingData(canvas.toDataURL());
    setCoins(newCoins);
    setAttempts(newAttempts);

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
    if (notInTelegram) {
      alert('Open in Telegram Mini App to play.');
      return;
    }
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

  // Гейт: если открыто не в Telegram — показываем инструкцию и выходим
  if (notInTelegram) {
    return (
      <div className="App" style={{ padding: 24, color: '#fff' }}>
        <h2>Open in Telegram</h2>
        <p>This game works only inside the Telegram Mini App.</p>
        <p>
          Open:&nbsp;
          <a
            href="https://t.me/circle_drawing_bot/circle_drawer"
            target="_blank"
            rel="noreferrer"
          >
            t.me/circle_drawing_bot/circle_drawer
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="App">
      {currentTab === 'circle' && (
        <div className="app-header">
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
          {/* Referrals может использовать userId для отображения; запросы на сервер пусть шлют initData внутри самого компонента */}
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
