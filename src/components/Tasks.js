// src/components/Tasks.js
import React from 'react';
import './Tasks.css';

const tasksData = [
  {
    id: 1,
    title: 'Подписаться на канал',
    descriptionImage: 'task_1.png',
    link: 'https://t.me/durov',
    tokens: 10,
    image: '1.png',
  },
  {
    id: 2,
    title: 'Пригласить друга',
    descriptionImage: 'task_3.png',
    action: 'inviteFriend',
    tokens: 30,
    image: '2.png',
  }
];

const Tasks = React.memo(({ onTaskComplete, completedTasks, setCurrentTab }) => {
  const handleTaskClick = (task) => {
    if (completedTasks.includes(task.id)) {
      alert('Это задание уже выполнено.');
      return;
    }

    if (task.link) {
      const confirmAction = window.confirm('Вы уверены, что хотите выполнить это задание?');
      if (confirmAction) {
        window.open(task.link, '_blank');
        onTaskComplete(task.id, task.tokens);
      }
    } else if (task.action === 'inviteFriend') {
      setCurrentTab('referrals');
    }
  };

  return (
    <div className="tasks-container">
      <img
        src={process.env.PUBLIC_URL + '/assets/all_tasks.png'}
        alt="Все задания"
        className="tasks-header-image"
      />

      <div className="tasks-list">
        {tasksData.map((task) => (
          <div
            key={task.id}
            className={`task-card ${completedTasks.includes(task.id) ? 'completed' : ''}`}
          >
            <div className="task-content">
              <img
                src={process.env.PUBLIC_URL + `/assets/${task.image}`}
                alt={task.title}
                className="task-image"
                loading="lazy"
              />
              <img
                src={process.env.PUBLIC_URL + `/assets/${task.descriptionImage}`}
                alt={task.title}
                className="task-description-image"
                loading="lazy"
              />
              <button
                onClick={() => handleTaskClick(task)}
                disabled={completedTasks.includes(task.id)}
                className={`task-button ${completedTasks.includes(task.id) ? 'completed' : ''}`}
              >
                <img
                  src={
                    completedTasks.includes(task.id)
                      ? process.env.PUBLIC_URL + '/assets/completed.png'
                      : process.env.PUBLIC_URL + '/assets/complete.png'
                  }
                  alt={completedTasks.includes(task.id) ? 'Выполнено' : 'Выполнить'}
                  className="complete-button-image"
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
