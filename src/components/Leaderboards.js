import React from 'react';
import './Leaderboards.css';
import leaderboardText from '../assets/leaderboard_text.png';
import boardImage from '../assets/board.png';

const Leaderboards = () => {
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
    </div>
  );
};

export default Leaderboards;
