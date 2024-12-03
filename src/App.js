import React, { useState, useEffect } from 'react';
import Canvas from './components/Canvas';
import Result from './components/Result';
import Tasks from './components/Tasks';
import TabBar from './components/TabBar';
import Shop from './components/Shop';
import Referrals from './components/Referrals';
import './App.css';
import totalCoinsBanner from './assets/total_coins.png';
import totalAttemptsBanner from './assets/total_attempts.png';

function App() {
  const [score, setScore] = useState(null);
  const [currentTab, setCurrentTab] = useState('circle');
  const [drawingData, setDrawingData] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

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
      // setUser(tg.initDataUnsafe.user);
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

  // Восстановление попыток со временем
  useEffect(() => {
    const interval = setInterval(() => {
      setAttempts((prevAttempts) => {
        if (prevAttempts < maxAttempts) {
          return prevAttempts + 1;
        }
        return prevAttempts;
      });
    }, attemptRecoveryTime * 1000);

    return () => clearInterval(interval);
  }, [attemptRecoveryTime, maxAttempts]);

  const handleDrawEnd = (score, points, canvas, size) => {
    if (attempts > 0) {
      setAttempts(attempts - 1);
      setScore(score);

      // Получение данных изображения
      const drawing = canvas.toDataURL();
      setDrawingData(drawing);
      setCanvasSize({ width: size.width, height: size.height });

      // Вычисление заработанных монет
      const earnedCoins = 0.01 * score;
      setCoins((prevCoins) => prevCoins + earnedCoins);
    } else {
      alert('У вас закончились попытки! Пожалуйста, подождите восстановления или приобретите буст.');
    }
  };

  const reset = () => {
    setScore(null);
    setDrawingData(null);
  };

  // Функция для обработки выполнения задания
  const handleTaskCompletion = (taskId, tokens) => {
    if (!completedTasks.includes(taskId)) {
      setCoins((prevCoins) => prevCoins + tokens);
      setCompletedTasks((prevTasks) => [...prevTasks, taskId]);
    }
  };

  return (
        <div className="coins-display">
          <img src={totalCoinsBanner} alt="Всего монет" className="banner-icon" />
          <span>{coins.toFixed(2)}</span>
        </div>
        <div className="attempts-display">
          <img src={totalAttemptsBanner} alt="Всего попыток" className="banner-icon" />
          <span>{attempts}/{maxAttempts}</span>
        </div>

      {currentTab === 'circle' && (
        score === null ? (
          <Canvas
            onDrawEnd={handleDrawEnd}
            attempts={attempts}
          />
        ) : (
          <Result
            score={score}
            onReset={reset}
            drawing={drawingData}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
          />
        )
      )}
     {currentTab === 'tasks' && (
        <Tasks
          onTaskComplete={handleTaskCompletion}
          completedTasks={completedTasks}
          setCurrentTab={setCurrentTab}
        />
      )}
    {currentTab === 'shop' && (
        <Shop
          coins={coins}
          setCoins={setCoins}
          maxAttempts={maxAttempts}
          setMaxAttempts={setMaxAttempts}
          attemptRecoveryTime={attemptRecoveryTime}
          setAttemptRecoveryTime={setAttemptRecoveryTime}
          onTaskComplete={handleTaskCompletion}
          completedTasks={completedTasks}
        />
      )}
      {currentTab === 'referrals' && (
        <Referrals
          coins={coins}
          onTaskComplete={handleTaskCompletion}
          completedTasks={completedTasks}
        />
      )}
      <TabBar currentTab={currentTab} setCurrentTab={setCurrentTab} />
    </div>
  );
}

export default App;