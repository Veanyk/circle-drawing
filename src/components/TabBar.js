import React from 'react';
import './TabBar.css';

const TabBar = ({ currentTab, setCurrentTab }) => {
  return (
    <div className="tab-bar">
      {/* Вкладка "Circle" */}
      <div
        className={`tab-item ${currentTab === 'circle' ? 'active' : ''}`}
        onClick={() => setCurrentTab('circle')}
      >
        <img src={require('../assets/circle.png')} alt="Круг" className="tab-icon" />
      </div>

      {/* Вкладка "Tasks" */}
      <div
        className={`tab-item ${currentTab === 'tasks' ? 'active' : ''}`}
        onClick={() => setCurrentTab('tasks')}
      >
        <img src={require('../assets/tasks.png')} alt="Задания" className="tab-icon" />
      </div>

      {/* Вкладка "Referrals" */}
      <div
        className={`tab-item ${currentTab === 'referrals' ? 'active' : ''}`}
        onClick={() => setCurrentTab('referrals')}
      >
        <img src={require('../assets/referrals.png')} alt="Рефералы" className="tab-icon" />
      </div>

      {/* Вкладка "Leaderboards" */}
      <div
        className={`tab-item ${currentTab === 'leaderboards' ? 'active' : ''}`}
        onClick={() => setCurrentTab('leaderboards')}
      >
        <img src={require('../assets/leaderboard.png')} alt="Лидерборды" className="tab-icon" />
      </div>
    </div>
  );
};

export default TabBar;
