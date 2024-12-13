// src/App.js
import React, { useState, useEffect } from 'react';
import Canvas from './components/Canvas';
import Result from './components/Result';
import Tasks from './components/Tasks';
import TabBar from './components/TabBar';
import Referrals from './components/Referrals';
import Leaderboards from './components/Leaderboards';
import './App.css';

const SERVER_URL = 'http://45.153.69.251'; // Замените на реальный адрес/порт вашего сервера

function App() {
  const [score, setScore] = useState(null);
  const [currentTab, setCurrentTab] = useState('circle');
  const [drawingData, setDrawingData] = useState(null);

  const [userId, setUserId] = useState(null);
  const [coins, setCoins] = useState(0);
  const [attempts, setAttempts] = useState(25);
  const [maxAttempts, setMaxAttempts] = useState(25);
  const [attemptRecoveryTime, setAttemptRecoveryTime] = useState(60);
  const [completedTasks, setCompletedTasks] = useState([]);

  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.expand();
      document.body.style.backgroundColor = tg.themeParams.bg_color || '#0f0f0f';
    }
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const uId = urlParams.get('user_id');
    setUserId(uId);

    if (uId) {
      fetch(`${SERVER_URL}/getUserData`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user_id: uId })
      })
      .then(res => res.json())
      .then(data => {
        setCoins(data.coins);
        setAttempts(data.attempts);
        setMaxAttempts(data.max_attempts);
        setAttemptRecoveryTime(data.attempt_recovery_time);
        setCompletedTasks(data.completed_tasks);
      })
      .catch(err => console.error('Ошибка при получении данных пользователя:', err));
    }
  }, []);

  const updateUserDataOnServer = (newData) => {
    if (!userId) return;
    fetch(`${SERVER_URL}/updateUserData`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ user_id: userId, data: newData })
    })
    .then(res => res.text())
    .then(() => {
      return fetch(`${SERVER_URL}/getUserData`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ user_id: userId })
      })
    })
    .then(res => res.json())
    .then(data => {
      setCoins(data.coins);
      setAttempts(data.attempts);
      setMaxAttempts(data.max_attempts);
      setAttemptRecoveryTime(data.attempt_recovery_time);
      setCompletedTasks(data.completed_tasks);
    })
    .catch(err => console.error('Ошибка при обновлении данных пользователя:', err));
  }

  const onDrawEnd = (score, points, canvas, size) => {
    if (attempts > 0) {
      setScore(score);
      setDrawingData(canvas.toDataURL());
      const newCoins = coins + parseFloat((0.01 * score).toFixed(2));
      const newAttempts = attempts - 1;

      updateUserDataOnServer({
        coins: newCoins,
        attempts: newAttempts
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
