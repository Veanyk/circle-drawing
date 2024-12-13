import React, { useState, useEffect } from 'react';
import './Leaderboards.css';
import leaderboardText from '../assets/leaderboard_text.png';
import boardImage from '../assets/board.png';

const SERVER_URL = 'http://45.153.69.251';

const Leaderboards = () => {
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    fetch(`${SERVER_URL}/getLeaderboard`)
      .then(res => res.json())
      .then(data => {
        // data - массив объектов { user_id, coins }
        setLeaders(data);
      })
      .catch(err => console.error('Ошибка при получении таблицы лидеров:', err));
  }, []);

  return (
    <div className="leaderboards-container">
      <img
        src={leaderboardText}
        alt="Таблица лидеров"
        className="leaderboards-title-image"
      />
      <img
        src={boardImage}
        alt="Таблица результатов"
        className="leaderboards-board-image"
      />
      {leaders.length > 0 ? (
        <ul className="leaders-list">
          {leaders.map((leader, index) => (
            <li key={leader.user_id}>
              {index + 1}. Пользователь {leader.user_id}: {leader.coins} монет
            </li>
          ))}
        </ul>
      ) : (
        <p>Пока нет данных для отображения.</p>
      )}
    </div>
  );
};

export default Leaderboards;
