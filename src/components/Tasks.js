// src/components/Tasks.js
import React, { useEffect, useState, memo } from 'react';
import './Tasks.css';

// Изображения
import allTasksHeader from '../assets/all_tasks.png';
import task1Desc from '../assets/task_1.png';
import task2Desc from '../assets/task_2.png';
import task1Icon from '../assets/1.png';
import task2Icon from '../assets/2.png';
import completeBtn from '../assets/complete.png';
import task3Icon from '../assets/3.png';
import task3Desc from '../assets/task_3.png';

const DEFAULT_TASK3_LINK =
  'https://twitter.com/intent/tweet?text=Check%20out%20this%20awesome%20circle%20drawing%20game!&url=https%3A%2F%2Fdraw-a-circle.chickenkiller.com';

const SERVER_BASE =
  process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '/api';

const Tasks = memo(function Tasks({ onTaskComplete, completedTasks, setCurrentTab }) {
  const [task3Link, setTask3Link] = useState(DEFAULT_TASK3_LINK);

  // Подтягиваем актуальную ссылку для задания №3 с бэкенда (GET /getTask3 -> { link })
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${SERVER_BASE}/getTask3`, {
          method: 'GET',
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (alive && data && typeof data.link === 'string' && data.link.trim()) {
          setTask3Link(data.link.trim());
        }
      } catch {
        // Если не удалось — остаёмся на дефолтной ссылке
      }
    })();

    return () => {
      alive = false;
      ctrl.abort();
    };
  }, []);

  // --- ИЗМЕНЕНИЕ ЗДЕСЬ ---
  // Второе и третье задания поменялись местами
  const tasksData = [
    {
      id: 1,
      title: 'Subscribe to Telegram Channel',
      descriptionImage: task1Desc,
      link: 'https://t.me/durov', // замените на ваш канал
      tokens: 30,
      image: task1Icon,
      requires_verification: true,
    },
    {
      id: 3, // Раньше был 2
      title: 'Share on X (Twitter)',
      descriptionImage: task3Desc,
      link: task3Link, // динамическая ссылка
      tokens: 20,
      image: task3Icon,
    },
    {
      id: 2, // Раньше был 3
      title: 'Invite a Friend',
      descriptionImage: task2Desc,
      action: 'inviteFriend',
      tokens: 10,
      image: task2Icon,
    },
  ];

  const handleTaskClick = (task) => {
    if (completedTasks.includes(task.id)) {
      alert('This task has already been completed.');
      return;
    }

    if (task.link) {
      window.open(task.link, '_blank', 'noopener,noreferrer');
      onTaskComplete(task.id, task.tokens);
    } else if (task.action === 'inviteFriend') {
      setCurrentTab('referrals');
    }
  };

  return (
    <div className="tasks-container">
      <img src={allTasksHeader} alt="All tasks" className="tasks-title-image" />
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
                className={[
                  'task-image',
                  task.id === 2 ? 'task2-image' : '',
                  task.id === 3 ? 'task3-image' : '',
                ].join(' ')}
                loading="lazy"
              />
              <img
                src={task.descriptionImage}
                alt={task.title}
                className={[
                  'task-description-image',
                  task.id === 1 ? 'task1-description-image' : '',
                  task.id === 3 ? 'task3-description-image' : '',
                ].join(' ')}
                loading="lazy"
              />
              <button
                onClick={() => handleTaskClick(task)}
                disabled={completedTasks.includes(task.id)}
                className={`task-button ${completedTasks.includes(task.id) ? 'completed' : ''}`}
                aria-label={completedTasks.includes(task.id) ? 'Completed' : 'Complete task'}
              >
                <img
                  src={completeBtn}
                  alt={completedTasks.includes(task.id) ? 'Completed' : 'Complete'}
                  className={`complete-button-image ${completedTasks.includes(task.id) ? 'completed' : ''}`}
                  loading="lazy"
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