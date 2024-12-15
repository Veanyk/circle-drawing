// src/App.js
import React, { useState, useEffect } from 'react';
import Canvas from './components/Canvas';
import Result from './components/Result';
import Tasks from './components/Tasks';
import TabBar from './components/TabBar';
import Referrals from './components/Referrals';
import Leaderboards from './components/Leaderboards';
import './App.css';

const SERVER_URL = 'http://45.153.69.251:8000';

function App() {
  const [score, setScore] = useState(null);
  const [currentTab, setCurrentTab] = useState('circle');
  const [drawingData, setDrawingData] = useState(null);

  const [userId, setUserId] = useState(null);
  const [coins, setCoins] = useState(0);
  const [attempts, setAttempts] = useState(25);
  const [maxAttempts, setMaxAttempts] = useState(25);
  // REMOVED: attemptRecoveryTime, bestScore states
  const [completedTasks, setCompletedTasks] = useState([]);

  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.expand();
      document.body.style.backgroundColor = tg.themeParams.bg_color || '#0f0f0f';
    }
  }, []);

  const updateUserDataOnServer = (newData) => {
    if (!userId) return;
    fetch(`${SERVER_URL}/updateUserData`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, data: newData })
    })
    .then(() => {
      return fetch(`${SERVER_URL}/getUserData`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user_id: userId })
      });
    })
    .then(res => res.json())
    .then(data => {
      setCoins(data.coins);
      setAttempts(data.attempts);
      setMaxAttempts(data.max_attempts);
      setCompletedTasks(data.completed_tasks);
    })
    .catch(err => console.error('Ошибка при обновлении данных пользователя:', err));
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const uId = urlParams.get('user_id');
    const refId = urlParams.get('ref');
    let finalUserId = uId;

    if (!finalUserId && refId) {
      // Если пользователь вошел по ссылке ?ref=..., но без user_id (браузерная версия)
      finalUserId = Date.now();
    }

    setUserId(finalUserId);

    if (finalUserId) {
      fetch(`${SERVER_URL}/getUserData`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: finalUserId })
      })
      .then(res => res.json())
      .then(data => {
        setCoins(data.coins);
        setAttempts(data.attempts);
        setMaxAttempts(data.max_attempts);
        setCompletedTasks(data.completed_tasks || []);

        // Если есть refId и он не совпадает с finalUserId, то добавим реферал
        if (refId && refId !== String(finalUserId)) {
          const refs = data.referrals || [];
          if (!refs.includes(refId)) {
            refs.push(refId);
            updateUserDataOnServer({ referrals: refs });
          }
        }
      })
      .catch(err => console.error('Ошибка при получении данных пользователя:', err));
    }
  // добавили updateUserDataOnServer в зависимости
  }, [updateUserDataOnServer]);

  const onDrawEnd = (circleAccuracy, points, canvas, size) => {
    if (attempts > 0) {
      setScore(circleAccuracy);
      setDrawingData(canvas.toDataURL());

      const tokensEarned = parseFloat((0.01 * circleAccuracy).toFixed(2));
      const newCoins = coins + tokensEarned;
      const newAttempts = attempts - 1;

      updateUserDataOnServer({
        coins: newCoins,
        attempts: newAttempts,
        score: circleAccuracy
      });
    } else {
      alert('У вас закончились попытки!');
    }
  };

  const onReset = () => {
    setScore(null);
    setDrawingData(null);
  };

  const onTaskComplete = (taskId, tokens) => {
    if (!completedTasks.includes(taskId)) {
      const newCompletedTasks = [...completedTasks, taskId];
      const newCoins = coins + tokens;
      updateUserDataOnServer({
        coins: newCoins,
        completed_tasks: newCompletedTasks
      });
      alert(`Вы получили ${tokens} токенов!`);
    } else {
      alert('Это задание уже выполнено.');
    }
  };

  return (
    <div className="App">
      {currentTab === 'circle' && (
        <>
          <div className="coins-display">
            <div className="banner-container">
              <img src={require('./assets/total_coins.png')} alt="Всего монет" className="banner-icon" />
              <span className="banner-text">{coins.toFixed(2)}</span>
            </div>
          </div>

          <div className="attempts-display">
            <div className="banner-container">
              <img src={require('./assets/total_attempts.png')} alt="Всего попыток" className="banner-icon" />
              <span className="banner-text">{attempts}/{maxAttempts}</span>
            </div>
          </div>
        </>
      )}

      <div className="main-content">
        {currentTab === 'circle' && (
          <>
            {score === null ? (
              <Canvas onDrawEnd={onDrawEnd} attempts={attempts} />
            ) : (
              <Result score={score} onReset={onReset} drawing={drawingData} />
            )}
          </>
        )}

        {currentTab === 'tasks' && (
          <Tasks
            onTaskComplete={onTaskComplete}
            completedTasks={completedTasks}
            setCurrentTab={setCurrentTab}
          />
        )}

        {currentTab === 'referrals' && (
          <Referrals
            coins={coins}
            onTaskComplete={onTaskComplete}
            completedTasks={completedTasks}
          />
        )}

        {currentTab === 'leaderboards' && (
          <Leaderboards />
        )}
      </div>

      <TabBar currentTab={currentTab} setCurrentTab={setCurrentTab} />
    </div>
  );
}

export default App;
