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
        <div className="tab-item-content">
          <img src={require('../assets/circle.png')} alt="Circle" className="tab-icon" />
          <div className="tab-item-dead-zone"></div> {/* Наша "дыра" */}
        </div>
      </div>

      {/* Вкладка "Tasks" */}
      <div
        className={`tab-item ${currentTab === 'tasks' ? 'active' : ''}`}
        onClick={() => setCurrentTab('tasks')}
      >
        <div className="tab-item-content">
          <img src={require('../assets/tasks.png')} alt="Tasks" className="tab-icon" />
          <div className="tab-item-dead-zone"></div>
        </div>
      </div>

      {/* Вкладка "Referrals" */}
      <div
        className={`tab-item ${currentTab === 'referrals' ? 'active' : ''}`}
        onClick={() => setCurrentTab('referrals')}
      >
        <div className="tab-item-content">
          <img src={require('../assets/referrals.png')} alt="Referrals" className="tab-icon" />
          <div className="tab-item-dead-zone"></div>
        </div>
      </div>

      {/* Вкладка "Leaderboards" */}
      <div
        className={`tab-item ${currentTab === 'leaderboards' ? 'active' : ''}`}
        onClick={() => setCurrentTab('leaderboards')}
      >
        <div className="tab-item-content">
          <img src={require('../assets/leaderboard.png')} alt="Leaderboards" className="tab-icon" />
          <div className="tab-item-dead-zone"></div>
        </div>
      </div>
    </div>
  );
};

export default TabBar;
