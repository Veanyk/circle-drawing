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

  // Состояние для монет
  const [coins, setCoins] = useState(() => {
    const savedCoins = localStorage.getItem('coins');
    return savedCoins ? parseFloat(savedCoins) : 0;
  });

  // Состояние для попыток
  const [attempts, setAttempts] = useState(() => {
    const savedAttempts = localStorage.getItem('attempts');
    return savedAttempts ? parseInt(savedAttempts, 10) : 25;
  });

  const [maxAttempts, setMaxAttempts] = useState(() => {
    const savedMaxAttempts = localStorage.getItem('maxAttempts');
    return savedMaxAttempts ? parseInt(savedMaxAttempts, 10) : 25;
  });

  // Состояние для времени восстановления попыток в секундах
  const [attemptRecoveryTime, setAttemptRecoveryTime] = useState(() => {
    const savedRecoveryTime = localStorage.getItem('attemptRecoveryTime');
    return savedRecoveryTime ? parseInt(savedRecoveryTime, 10) : 60;
  });

  // Состояние для выполненных заданий
  const [completedTasks, setCompletedTasks] = useState(() => {
    const savedTasks = localStorage.getItem('completedTasks');
    return savedTasks ? JSON.parse(savedTasks) : [];
  });

  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.expand();
      document.body.style.backgroundColor = tg.themeParams.bg_color || '#0f0f0f';
    }
  }, []);

  useEffect(() => {
    // Сохранение монет в localStorage при их изменении
    localStorage.setItem('coins', coins.toFixed(2));
  }, [coins]);

  useEffect(() => {
    // Сохранение попыток и связанных данных в localStorage при их изменении
    localStorage.setItem('attempts', attempts);
    localStorage.setItem('maxAttempts', maxAttempts);
    localStorage.setItem('attemptRecoveryTime', attemptRecoveryTime);
  }, [attempts, maxAttempts, attemptRecoveryTime]);

  useEffect(() => {
    // Сохранение выполненных заданий в localStorage при их изменении
    localStorage.setItem('completedTasks', JSON.stringify(completedTasks));
  }, [completedTasks]);

  // Обработчик окончания рисования
  const onDrawEnd = (score, points, canvas, size) => {
    if (attempts > 0) {
      setScore(score);
      setDrawingData(canvas.toDataURL());
      setCoins(prevCoins => prevCoins + parseFloat((0.01 * score).toFixed(2)));
      setAttempts(prevAttempts => prevAttempts - 1);

      // Начинаем восстановление попытки
      setTimeout(() => {
        setAttempts(prevAttempts => prevAttempts + 1);
      }, attemptRecoveryTime * 1000);
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
      setCompletedTasks([...completedTasks, taskId]);
      setCoins(coins + tokens);
    }
  };

 return (
    <div className="App">
      {/* Отображение монет и попыток */}
      <div className="coins-display">
        <div className="banner-container">
          <img src={totalCoinsBanner} alt="Всего монет" className="banner-icon" />
          <span className="banner-text">{coins.toFixed(2)}</span>
        </div>
      </div>

      <div className="attempts-display">
        <div className="banner-container">
          <img src={totalAttemptsBanner} alt="Всего попыток" className="banner-icon" />
          <span className="banner-text">{attempts}/{maxAttempts}</span>
        </div>
      </div>

      {/* Основной контент */}
      <div className="main-content">
        {/* Условный рендеринг в зависимости от currentTab */}
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

      {/* TabBar внизу */}
      <TabBar currentTab={currentTab} setCurrentTab={setCurrentTab} />
    </div>
  );
}

export default App;
