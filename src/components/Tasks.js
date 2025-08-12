// src/components/Tasks.js
import React from 'react';
import './Tasks.css';

// Импортируем все необходимые изображения
import allTasksHeader from '../assets/all_tasks.png';
import task1Desc from '../assets/task_1.png';
import task2Desc from '../assets/task_3.png';
import task1Icon from '../assets/1.png';
import task2Icon from '../assets/2.png';
import completeBtn from '../assets/complete.png';

const tasksData = [
  {
    id: 1,
    title: 'Подписаться на канал',
    descriptionImage: task1Desc,
    link: 'https://t.me/durov',
    tokens: 10,
    image: task1Icon,
  },
  {
    id: 2,
    title: 'Пригласить друга',
    descriptionImage: task2Desc,
    action: 'inviteFriend',
    tokens: 30,
    image: task2Icon,
  }
];

const Tasks = React.memo(({ onTaskComplete, completedTasks, setCurrentTab }) => {
  const handleTaskClick = (task) => {
    if (completedTasks.includes(task.id)) {
      alert('Это задание уже выполнено.');
      return;
    }

      if (task.link) {
        // We can remove the confirm for better user experience
        window.open(task.link, '_blank');
        onTaskComplete(task.id, task.tokens);
    } else if (task.action === 'inviteFriend') {
      setCurrentTab('referrals');
    }
  };

 return (
    <div className="tasks-container">
      {/* Используем импортированные изображения */}
      <img src={allTasksHeader} alt="Все задания" className="tasks-header-image" />
      <div className="tasks-list">
        {tasksData.map((task) => (
          <div
            key={task.id}
            className={`task-card ${completedTasks.includes(task.id) ? 'completed' : ''}`}
          >
                <div className="task-content">
                  <img
                    src={task.image}
                    alt={task.title}
                    className="task-image"
                    loading="lazy"
                  />
                  <img
                    src={task.descriptionImage}
                    alt={task.title}
                    className="task-description-image"
                    loading="lazy"
                  />
                <button
                  onClick={() => handleTaskClick(task)}
                  disabled={completedTasks.includes(task.id)}
                  // Мы уже добавляем класс 'completed' на саму кнопку, это идеально
                  className={`task-button ${completedTasks.includes(task.id) ? 'completed' : ''}`}
                >
                  <img
                      src={completeBtn}
                      alt={completedTasks.includes(task.id) ? 'Completed' : 'Complete'}
                      className={`complete-button-image ${completedTasks.includes(task.id) ? 'completed' : ''}`}
                    />
                </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default Tasks;
