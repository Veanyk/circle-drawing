import React from 'react';
import './TabBar.css';

const TabBar = ({ currentTab, setCurrentTab }) => {
  return (
    <div className="tab-bar">
      {/* Вкладка "Circle" */}
      <div className={`tab-item ${currentTab === 'circle' ? 'active' : ''}`}>
        <img
          src={require('../assets/circle.png')}
          alt="Circle"
          className="tab-icon"
          role="button"
          tabIndex="0"
          onClick={() => setCurrentTab('circle')}
          onKeyDown={(e) => e.key === 'Enter' && setCurrentTab('circle')}
        />
      </div>

      {/* Вкладка "Tasks" */}
      <div className={`tab-item ${currentTab === 'tasks' ? 'active' : ''}`}>
        <img
          src={require('../assets/tasks.png')}
          alt="Tasks"
          className="tab-icon"
          role="button"
          tabIndex="0"
          onClick={() => setCurrentTab('tasks')}
          onKeyDown={(e) => e.key === 'Enter' && setCurrentTab('tasks')}
        />
      </div>

      {/* Вкладка "Referrals" */}
      <div className={`tab-item ${currentTab === 'referrals' ? 'active' : ''}`}>
        <img
          src={require('../assets/referrals.png')}
          alt="Referrals"
          className="tab-icon"
          role="button"
          tabIndex="0"
          onClick={() => setCurrentTab('referrals')}
          onKeyDown={(e) => e.key === 'Enter' && setCurrentTab('referrals')}
        />
      </div>

      {/* Вкладка "Leaderboards" */}
      <div className={`tab-item ${currentTab === 'leaderboards' ? 'active' : ''}`}>
        <img
          src={require('../assets/leaderboard.png')}
          alt="Leaderboards"
          className="tab-icon"
          role="button"
          tabIndex="0"
          onClick={() => setCurrentTab('leaderboards')}
          onKeyDown={(e) => e.key === 'Enter' && setCurrentTab('leaderboards')}
        />
      </div>
    </div>
  );
};

export default TabBar;