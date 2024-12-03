import React from 'react';
import './Tasks.css';

const tasksData = [
  {
    id: 1,
    title: 'Подписаться на канал',
    description: 'Подпишитесь на наш Telegram-канал, чтобы получить 10 токенов.',
    link: 'https://t.me/durov',
    tokens: 10,
    icon: '📢',
    image: '3.png',
  },
  {
    id: 2,
    title: 'Приобрести буст',
    description: 'Купите любой буст в магазине и получите 20 токенов.',
    action: 'buyBoost',
    tokens: 20,
    icon: '🛒',
    image: '4.png',
  },
  {
    id: 3,
    title: 'Пригласить друга',
    description: 'Пригласите друга по реферальной ссылке и получите 30 токенов.',
    action: 'inviteFriend',
    tokens: 30,
    icon: '🤝',
    image: '5.png',
  },
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
        alert(`Вы получили ${task.tokens} токенов!`);
      }
    } else if (task.action === 'buyBoost') {
      // Переходим на вкладку Shop
      setCurrentTab('shop');
    } else if (task.action === 'inviteFriend') {
      // Переходим на вкладку Referrals
      setCurrentTab('referrals');
    }
  };


  return (
    <div className="tasks-container">
      <h3>Задания</h3>
      {tasksData.map((task) => (
        <div
          key={task.id}
          className={`task-card ${completedTasks.includes(task.id) ? 'completed' : ''}`}
        >
          <img
            src={process.env.PUBLIC_URL + `/assets/${task.image}`}
            alt={task.title}
            className="task-image"
            loading="lazy"
          />
          <div className="task-content">
            <h4>{task.title}</h4>
            <p>{task.description}</p>
            <p>Награда: {task.tokens} токенов</p>
          </div>
          <button
            onClick={() => handleTaskClick(task)}
            disabled={completedTasks.includes(task.id)}
            className={`task-button ${completedTasks.includes(task.id) ? 'completed' : ''}`}
          >
            {completedTasks.includes(task.id) ? 'Выполнено' : 'Выполнить'}
          </button>
        </div>
      ))}
    </div>
  );
});

export default Tasks;
