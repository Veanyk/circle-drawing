// TabBar.js
import React from 'react';
import './TabBar.css';
import circleIcon from '../assets/circle.png';
import tasksIcon from '../assets/tasks.png';
import shopIcon from '../assets/shop.png';
import referralsIcon from '../assets/referrals.png';

const TabBar = ({ currentTab, setCurrentTab }) => {
  return (
    <div className="tab-bar">
      <div
        className={`tab-item ${currentTab === 'circle' ? 'active' : ''}`}
        onClick={() => setCurrentTab('circle')}
      >
        <img src={circleIcon} alt="Круг" className="tab-icon" />
      </div>
      <div
        className={`tab-item ${currentTab === 'tasks' ? 'active' : ''}`}
        onClick={() => setCurrentTab('tasks')}
      >
        <img src={tasksIcon} alt="Задания" className="tab-icon" />
      </div>
      <div
        className={`tab-item ${currentTab === 'shop' ? 'active' : ''}`}
        onClick={() => setCurrentTab('shop')}
      >
        <img src={shopIcon} alt="Магазин" className="tab-icon" />
      </div>
      <div
        className={`tab-item ${currentTab === 'referrals' ? 'active' : ''}`}
        onClick={() => setCurrentTab('referrals')}
      >
        <img src={referralsIcon} alt="Рефералы" className="tab-icon" />
      </div>
    </div>
  );
};

export default TabBar;
