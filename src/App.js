// src/App.js
import React, { useState, useEffect } from 'react';
import Canvas from './components/Canvas';
import Result from './components/Result';
import Tasks from './components/Tasks';
import TabBar from './components/TabBar';
import Referrals from './components/Referrals';
import Leaderboards from './components/Leaderboards';
import './App.css';

import totalCoinsBanner from './assets/total_coins.png';
import totalAttemptsBanner from './assets/total_attempts.png';

function App() {
  const [score, setScore] = useState(null);
  const [currentTab, setCurrentTab] = useState('circle');
  const [drawingData, setDrawingData] = useState(null);

  const [userId, setUserId] = useState(null);

  // Состояние для данных пользователя
  const [userData, setUserData] = useState({
    coins: 0,
    attempts: 25,
    maxAttempts: 25,
    attemptRecoveryTime: 60,
    completedTasks: [],
    referrals: [],
  });

  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.expand();
      document.body.style.backgroundColor = tg.themeParams.bg_color || '#0f0f0f';

      // Получаем информацию о пользователе
      const user = tg.initDataUnsafe.user;
      if (user && user.id) {
        setUserId(user.id);
      }
    } else {
      // Если не в Telegram, можно использовать параметр в URL
      const urlParams = new URLSearchParams(window.location.search);
      const userIdFromUrl = urlParams.get('user_id');
      if (userIdFromUrl) {
        setUserId(parseInt(userIdFromUrl, 10));
      }
    }
  }, []);

  useEffect(() => {
    if (userId) {
      // Получаем данные пользователя с сервера
      fetch('http://your-server-address/getUserData', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      })
        .then((response) => response.json())
        .then((data) => {
          setUserData({
            coins: data.coins,
            attempts: data.attempts,
            maxAttempts: data.max_attempts,
            attemptRecoveryTime: data.attempt_recovery_time,
            completedTasks: data.completed_tasks,
            referrals: data.referrals,
          });
        })
        .catch((error) => {
          console.error('Error fetching user data:', error);
        });
    }
  }, [userId]);

  const updateUserData = (updatedData) => {
    if (userId) {
      const newUserData = { ...userData, ...updatedData };
      setUserData(newUserData);

      // Отправляем обновленные данные на сервер
      fetch('http://your-server-address/updateUserData', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId, data: newUserData }),
      })
        .then((response) => response.text())
        .then((message) => {
          console.log(message);
        })
        .catch((error) => {
          console.error('Error updating user data:', error);
        });

      // Отправляем данные боту через Telegram WebApp
      if (window.Telegram.WebApp) {
        window.Telegram.WebApp.sendData(JSON.stringify(newUserData));
      }
    }
  };

  // Обработчик окончания рисования
  const onDrawEnd = (score, points, canvas, size) => {
    if (userData.attempts > 0) {
      const earnedCoins = parseFloat((0.01 * score).toFixed(2));
      setScore(score);
      setDrawingData(canvas.toDataURL());

      // Обновляем данные пользователя
      updateUserData({
        coins: userData.coins + earnedCoins,
        attempts: userData.attempts - 1,
      });

      // Начинаем восстановление попытки
      setTimeout(() => {
        updateUserData({
          attempts: userData.attempts + 1,
        });
      }, userData.attemptRecoveryTime * 1000);
    } else {
      alert('У вас закончились попытки!');
    }
  };

  const onReset = () => {
    setScore(null);
    setDrawingData(null);
  };

  const onTaskComplete = (taskId, tokens) => {
    if (!userData.completedTasks.includes(taskId)) {
      const updatedTasks = [...userData.completedTasks, taskId];
      updateUserData({
        coins: userData.coins + tokens,
        completedTasks: updatedTasks,
      });
    }
  };

  // Определяем, нужно ли показывать поля монет и попыток
  const showStats = (currentTab === 'circle') || (score !== null && currentTab === 'circle');

  return (
    <div className="App">
      {/* Отображаем монеты и попытки только на Canvas и Result */}
      {showStats && (
        <>
          <div className="coins-display">
            <div className="banner-container">
              <img src={totalCoinsBanner} alt="Всего монет" className="banner-icon" />
              <span className="banner-text">{userData.coins.toFixed(2)}</span>
            </div>
          </div>

          <div className="attempts-display">
            <div className="banner-container">
              <img src={totalAttemptsBanner} alt="Всего попыток" className="banner-icon" />
              <span className="banner-text">{userData.attempts}/{userData.maxAttempts}</span>
            </div>
          </div>
        </>
      )}

      {/* Основной контент */}
      <div className="main-content">
        {currentTab === 'circle' && (
          <>
            {score === null ? (
              <Canvas onDrawEnd={onDrawEnd} attempts={userData.attempts} />
            ) : (
              <Result score={score} onReset={onReset} drawing={drawingData} />
            )}
          </>
        )}

        {currentTab === 'tasks' && (
          <Tasks
            onTaskComplete={onTaskComplete}
            completedTasks={userData.completedTasks}
            setCurrentTab={setCurrentTab}
          />
        )}

        {currentTab === 'referrals' && (
          <Referrals
            coins={userData.coins}
            onTaskComplete={onTaskComplete}
            completedTasks={userData.completedTasks}
          />
        )}

        {currentTab === 'leaderboards' && (
          <Leaderboards />
        )}
      </div>

      {/* TabBar внизу */}
      <TabBar currentTab={currentTab} setCurrentTab={setCurrentTab} />
    </div>
  );
}

export default App;
