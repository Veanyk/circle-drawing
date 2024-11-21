import React from 'react';
import './TabBar.css';

const TabBar = ({ currentTab, setCurrentTab }) => {
  return (
    <div className="tab-bar">
      <div
        className={`tab-item ${currentTab === 'circle' ? 'active' : ''}`}
        onClick={() => setCurrentTab('circle')}
      >
        🖌️ Круг
      </div>
      <div
        className={`tab-item ${currentTab === 'tasks' ? 'active' : ''}`}
        onClick={() => setCurrentTab('tasks')}
      >
        📋 Задания
      </div>
      <div
        className={`tab-item ${currentTab === 'shop' ? 'active' : ''}`}
        onClick={() => setCurrentTab('shop')}
      >
        🛒 Магазин
      </div>
      <div
        className={`tab-item ${currentTab === 'referrals' ? 'active' : ''}`}
        onClick={() => setCurrentTab('referrals')}
      >
        🤝 Рефералы
      </div>
    </div>
  );
};

export default TabBar;
