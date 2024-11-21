import React, { useState } from 'react';
import './Shop.css';

const Shop = React.memo(({
  coins,
  setCoins,
  maxAttempts,
  setMaxAttempts,
  attemptRecoveryTime,
  setAttemptRecoveryTime,
  onTaskComplete,
  completedTasks,
}) => {
  // Данные для бустов лимита попыток
  const attemptBoostsData = [
    { id: 1, value: 50, price: 10, name: 'Буст 50 попыток', description: 'Увеличивает лимит попыток до 50.', image: '1.png' },
    { id: 2, value: 75, price: 20, name: 'Буст 75 попыток', description: 'Увеличивает лимит попыток до 75.', image: '1.png' },
    { id: 3, value: 100, price: 30, name: 'Буст 100 попыток', description: 'Увеличивает лимит попыток до 100.', image: '1.png' },
  ];

  const recoveryBoostsData = [
    { id: 4, value: 30, price: 15, name: 'Буст восстановления 30с', description: 'Сокращает время восстановления попыток до 30 секунд.', image: '2.png' },
    { id: 5, value: 20, price: 25, name: 'Буст восстановления 20с', description: 'Сокращает время восстановления попыток до 20 секунд.', image: '2.png' },
    { id: 6, value: 10, price: 35, name: 'Буст восстановления 10с', description: 'Сокращает время восстановления попыток до 10 секунд.', image: '2.png' },
  ];

  // Состояния для отслеживания текущего доступного буста в каждой категории
  const [currentAttemptBoostIndex, setCurrentAttemptBoostIndex] = useState(() => {
    const savedIndex = localStorage.getItem('currentAttemptBoostIndex');
    return savedIndex ? parseInt(savedIndex, 10) : 0;
  });

  const [currentRecoveryBoostIndex, setCurrentRecoveryBoostIndex] = useState(() => {
    const savedIndex = localStorage.getItem('currentRecoveryBoostIndex');
    return savedIndex ? parseInt(savedIndex, 10) : 0;
  });

  // Функция покупки буста лимита попыток
  const purchaseAttemptBoost = (boost) => {
    if (coins >= boost.price) {
      if (maxAttempts < boost.value) {
        setCoins(coins - boost.price);
        setMaxAttempts(boost.value);
        alert(`Лимит попыток увеличен до ${boost.value}!`);

        // Обновление индекса буста и сохранение в localStorage
        const nextIndex = currentAttemptBoostIndex + 1;
        setCurrentAttemptBoostIndex(nextIndex);
        localStorage.setItem('currentAttemptBoostIndex', nextIndex);

        // Отмечаем задание как выполненное
        if (!completedTasks.includes(2)) {
          onTaskComplete(2, 20);
          alert(`Вы получили 20 токенов за выполнение задания!`);
        }
      } else {
        alert('Вы уже приобрели этот или более высокий буст.');
      }
    } else {
      alert('Недостаточно монет для покупки этого буста.');
    }
  };

  // Функция покупки буста ускорения восстановления попыток
  const purchaseRecoveryBoost = (boost) => {
    if (coins >= boost.price) {
      if (attemptRecoveryTime > boost.value) {
        setCoins(coins - boost.price);
        setAttemptRecoveryTime(boost.value);
        alert(`Время восстановления попыток сокращено до ${boost.value} секунд!`);

        // Обновление индекса буста и сохранение в localStorage
        const nextIndex = currentRecoveryBoostIndex + 1;
        setCurrentRecoveryBoostIndex(nextIndex);
        localStorage.setItem('currentRecoveryBoostIndex', nextIndex);

        // Отмечаем задание как выполненное
        if (!completedTasks.includes(2)) {
          onTaskComplete(2, 20);
          alert(`Вы получили 20 токенов за выполнение задания!`);
        }
      } else {
        alert('Вы уже приобрели этот или более быстрый буст.');
      }
    } else {
      alert('Недостаточно монет для покупки этого буста.');
    }
  };

  // Получение текущих доступных бустов
  const currentAttemptBoost = attemptBoostsData[currentAttemptBoostIndex];
  const currentRecoveryBoost = recoveryBoostsData[currentRecoveryBoostIndex];

  return (
    <div className="shop-container">
      <h3>Магазин бустов</h3>

      {/* Бусты лимита попыток */}
      <div className="boost-section">
        <h4>Бусты лимита попыток</h4>
        {currentAttemptBoost ? (
          <div className="boost-card">
            <img
              src={process.env.PUBLIC_URL + `/assets/${currentAttemptBoost.image}`}
              alt={currentAttemptBoost.name}
              className="boost-image"
              loading="lazy"
            />
            <div className="boost-info">
              <h5>{currentAttemptBoost.name}</h5>
              <p>{currentAttemptBoost.description}</p>
            </div>
            <div className="boost-actions">
              <button onClick={() => purchaseAttemptBoost(currentAttemptBoost)}>Купить</button>
              <span className="boost-price">{currentAttemptBoost.price} монет</span>
            </div>
          </div>
        ) : (
          <p>Все бусты лимита попыток куплены!</p>
        )}
      </div>

      {/* Бусты ускорения восстановления попыток */}
      <div className="boost-section">
        <h4>Ускорение восстановления попыток</h4>
        {currentRecoveryBoost ? (
          <div className="boost-card">
            <img
              src={process.env.PUBLIC_URL + `/assets/${currentRecoveryBoost.image}`}
              alt={currentRecoveryBoost.name}
              className="boost-image"
              loading="lazy"
            />
            <div className="boost-info">
              <h5>{currentRecoveryBoost.name}</h5>
              <p>{currentRecoveryBoost.description}</p>
            </div>
            <div className="boost-actions">
              <button onClick={() => purchaseRecoveryBoost(currentRecoveryBoost)}>Купить</button>
              <span className="boost-price">{currentRecoveryBoost.price} монет</span>
            </div>
          </div>
        ) : (
          <p>Все бусты ускорения восстановления куплены!</p>
        )}
      </div>
    </div>
  );
});

export default Shop;
