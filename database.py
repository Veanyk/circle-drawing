import time
import json
import sqlite3

conn = sqlite3.connect('users.db', check_same_thread=False)
cursor = conn.cursor()

# Предполагаем, что таблица уже содержит столбец last_attempt_update INTEGER
cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        coins REAL DEFAULT 0,
        attempts INTEGER DEFAULT 25,
        max_attempts INTEGER DEFAULT 25,
        attempt_recovery_time INTEGER DEFAULT 60,
        completed_tasks TEXT DEFAULT '',
        referrals TEXT DEFAULT '',
        last_attempt_update INTEGER DEFAULT (strftime('%s','now'))
    )
''')
conn.commit()

def get_user_data(user_id):
    cursor.execute('SELECT user_id, coins, attempts, max_attempts, attempt_recovery_time, completed_tasks, referrals, last_attempt_update FROM users WHERE user_id = ?', (user_id,))
    result = cursor.fetchone()

    if not result:
        # Пользователь новый – создаём запись
        # Изначально 0 монет, 25/25 попыток, время восстановления 60 секунд
        initial_coins = 0
        initial_attempts = 25
        initial_max_attempts = 25
        initial_recovery_time = 60
        cursor.execute('''
            INSERT INTO users (user_id, coins, attempts, max_attempts, attempt_recovery_time, completed_tasks, referrals, last_attempt_update)
            VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))
        ''', (user_id, initial_coins, initial_attempts, initial_max_attempts, initial_recovery_time, json.dumps([]), json.dumps([])))
        conn.commit()

        return {
            'user_id': user_id,
            'coins': initial_coins,
            'attempts': initial_attempts,
            'max_attempts': initial_max_attempts,
            'attempt_recovery_time': initial_recovery_time,
            'completed_tasks': [],
            'referrals': []
        }
    else:
        user_data = {
            'user_id': result[0],
            'coins': result[1],
            'attempts': result[2],
            'max_attempts': result[3],
            'attempt_recovery_time': result[4],
            'completed_tasks': json.loads(result[5]) if result[5] else [],
            'referrals': json.loads(result[6]) if result[6] else [],
            'last_attempt_update': result[7]
        }

        # Попытки могли восстановиться
        current_time = int(time.time())
        attempts = user_data['attempts']
        max_attempts = user_data['max_attempts']
        attempt_recovery_time = user_data['attempt_recovery_time']
        last_update = user_data['last_attempt_update']

        if attempts < max_attempts:
            elapsed = current_time - last_update
            # Сколько попыток можно восстановить
            attempts_to_restore = elapsed // attempt_recovery_time
            if attempts_to_restore > 0:
                new_attempts = min(max_attempts, attempts + attempts_to_restore)
                # Обновляем время последнего обновления относительно восстановленных попыток
                if new_attempts == max_attempts:
                    # Если вышли в максимум, то next update time должен быть текущее время
                    new_last_update = current_time
                else:
                    # Иначе пересчитаем новое время последнего обновления на основании использованных "тактов"
                    new_last_update = last_update + attempts_to_restore * attempt_recovery_time

                user_data['attempts'] = new_attempts
                user_data['last_attempt_update'] = new_last_update

                # Сохраняем изменения
                cursor.execute('''
                    UPDATE users
                    SET attempts = ?, last_attempt_update = ?
                    WHERE user_id = ?
                ''', (new_attempts, new_last_update, user_data['user_id']))
                conn.commit()

        # Удаляем last_attempt_update перед возвратом, если не нужна на фронте
        del user_data['last_attempt_update']
        return user_data

def update_user_data(user_id, data):
    # Если пользователь уменьшает попытку (например, потратил её на рисование),
    # и при этом attempts < max_attempts, тогда обновляем last_attempt_update на текущий момент,
    # чтобы с этого момента начать отсчитывать восстановление.
    # Если увеличиваем монеты, меняем completed_tasks и т.д., просто обновляем.

    # Сначала получим текущие данные
    current_data = get_user_data(user_id)
    # current_data уже могло обновиться (увеличиться attempts), так что берём оттуда актуальные значения
    new_coins = data.get('coins', current_data['coins'])
    new_attempts = data.get('attempts', current_data['attempts'])
    new_max_attempts = data.get('max_attempts', current_data['max_attempts'])
    new_attempt_recovery_time = data.get('attempt_recovery_time', current_data['attempt_recovery_time'])
    new_completed_tasks = data.get('completed_tasks', current_data['completed_tasks'])
    new_referrals = data.get('referrals', current_data['referrals'])

    new_last_attempt_update = int(time.time())  # по умолчанию если что-то изменится
    # Если попытки уменьшились и стали меньше максимума, значит нужно обновить time
    # Если попытки остались те же или увеличились до максимума - обновляем логично.
    if new_attempts < current_data['attempts']:
        # Пользователь потратил попытку, значит запускаем таймер восстановления с этого момента
        new_last_attempt_update = int(time.time())
    else:
        # Если мы не меняли attempts или довели их до максимума, оставляем last_attempt_update как было
        # Для этого нам нужно снова получить last_attempt_update из базы напрямую
        cursor.execute('SELECT last_attempt_update FROM users WHERE user_id = ?', (user_id,))
        stored_last_update = cursor.fetchone()[0]
        if new_attempts == new_max_attempts:
            # Если попытки на максимуме, устанавливаем время на сейчас, т.к. при следующем запросе
            # мы хотим считать восстановление с момента достижения максимума.
            new_last_attempt_update = int(time.time())
        else:
            # Иначе оставляем всё как есть
            new_last_attempt_update = stored_last_update

    cursor.execute('''
        UPDATE users
        SET coins = ?,
            attempts = ?,
            max_attempts = ?,
            attempt_recovery_time = ?,
            completed_tasks = ?,
            referrals = ?,
            last_attempt_update = ?
        WHERE user_id = ?
    ''', (
        new_coins,
        new_attempts,
        new_max_attempts,
        new_attempt_recovery_time,
        json.dumps(new_completed_tasks),
        json.dumps(new_referrals),
        new_last_attempt_update,
        user_id
    ))
    conn.commit()

def get_top_users_by_coins(limit):
    cursor.execute('SELECT user_id, coins FROM users ORDER BY coins DESC LIMIT ?', (limit,))
    rows = cursor.fetchall()
    leaderboard = []
    for r in rows:
        leaderboard.append({
            'user_id': r[0],
            'coins': r[1]
        })
    return leaderboard
