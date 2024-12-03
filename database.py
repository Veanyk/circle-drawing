# database.py

import sqlite3
import json

conn = sqlite3.connect('users.db', check_same_thread=False)
cursor = conn.cursor()

# Создаем таблицу пользователей, если она не существует
cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        coins REAL DEFAULT 0,
        attempts INTEGER DEFAULT 25,
        max_attempts INTEGER DEFAULT 25,
        attempt_recovery_time INTEGER DEFAULT 60,
        completed_tasks TEXT DEFAULT '',
        referrals TEXT DEFAULT ''
    )
''')

conn.commit()

def get_user_data(user_id):
    cursor.execute('SELECT * FROM users WHERE user_id = ?', (user_id,))
    result = cursor.fetchone()
    if result:
        return {
            'user_id': result[0],
            'coins': result[1],
            'attempts': result[2],
            'max_attempts': result[3],
            'attempt_recovery_time': result[4],
            'completed_tasks': json.loads(result[5]) if result[5] else [],
            'referrals': json.loads(result[6]) if result[6] else []
        }
    else:
        # Если пользователя нет в базе, создаем запись
        cursor.execute('INSERT INTO users (user_id) VALUES (?)', (user_id,))
        conn.commit()
        return {
            'user_id': user_id,
            'coins': 0,
            'attempts': 25,
            'max_attempts': 25,
            'attempt_recovery_time': 60,
            'completed_tasks': [],
            'referrals': []
        }

def update_user_data(user_id, data):
    # Обновляем данные пользователя в базе
    cursor.execute('''
        UPDATE users
        SET coins = ?,
            attempts = ?,
            max_attempts = ?,
            attempt_recovery_time = ?,
            completed_tasks = ?,
            referrals = ?
        WHERE user_id = ?
    ''', (
        data.get('coins', 0),
        data.get('attempts', 25),
        data.get('max_attempts', 25),
        data.get('attempt_recovery_time', 60),
        json.dumps(data.get('completed_tasks', [])),
        json.dumps(data.get('referrals', [])),
        user_id
    ))
    conn.commit()
