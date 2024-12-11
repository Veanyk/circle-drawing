# bot.py
import logging
import os
import json
from telegram import Update, KeyboardButton, ReplyKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters
from database import get_user_data, update_user_data
from flask import Flask, request, jsonify
from threading import Thread
from flask_cors import CORS

# Настройка логирования
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

# URL вашего веб-приложения
WEB_APP_URL = 'https://circle-drawing.vercel.app'

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик команды /start."""
    user_id = update.effective_user.id

    # Проверяем, есть ли реферер
    args = context.args
    if args:
        referrer_id = args[0]
        # Добавляем реферера в данные пользователя
        user_data = get_user_data(user_id)
        referrals = user_data.get('referrals', [])
        if referrer_id not in referrals:
            referrals.append(referrer_id)
            update_user_data(user_id, {'referrals': referrals})

    web_app_url = f"{WEB_APP_URL}?user_id={user_id}"
    web_app = WebAppInfo(url=web_app_url)
    keyboard = [
        [KeyboardButton(text='🌀 Запустить приложение', web_app=web_app)]
    ]
    reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True)
    await update.message.reply_text(
        'Добро пожаловать! Нажмите кнопку ниже, чтобы начать.',
        reply_markup=reply_markup
    )

async def handle_web_app_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик данных из веб-приложения."""
    data = update.message.web_app_data.data  # Получение данных из мини-приложения
    data_dict = json.loads(data)
    user_id = update.effective_user.id

    # Получаем текущие данные пользователя из базы данных
    user_data = get_user_data(user_id)

    # Обновляем данные на основе полученных из веб-приложения
    updated_data = {
        'coins': data_dict.get('coins', user_data['coins']),
        'attempts': data_dict.get('attempts', user_data['attempts']),
        'max_attempts': data_dict.get('maxAttempts', user_data['max_attempts']),
        'attempt_recovery_time': data_dict.get('attemptRecoveryTime', user_data['attempt_recovery_time']),
        'completed_tasks': data_dict.get('completedTasks', user_data['completed_tasks']),
        'referrals': data_dict.get('referrals', user_data['referrals']),
    }

    update_user_data(user_id, updated_data)

    await update.message.reply_text(f"Ваши данные успешно сохранены!")

# Создание Flask-приложения
app = Flask(__name__)
CORS(app)

@app.route('/getUserData', methods=['POST'])
def get_user_data_route():
    user_id = request.json.get('user_id')
    user_data = get_user_data(user_id)
    return jsonify(user_data)

@app.route('/updateUserData', methods=['POST'])
def update_user_data_route():
    user_id = request.json.get('user_id')
    data = request.json.get('data')
    update_user_data(user_id, data)
    return 'User data updated successfully'

@app.route('/getReferrals', methods=['POST'])
def get_referrals_route():
    user_id = request.json.get('user_id')
    user_data = get_user_data(user_id)
    referrals = user_data.get('referrals', [])
    referral_data_list = []
    for rid in referrals:
        rdata = get_user_data(rid)
        referral_data_list.append({
            'user_id': rdata['user_id'],
            'coins': rdata['coins']
        })
    return jsonify(referral_data_list)

@app.route('/getLeaderboard', methods=['GET'])
def get_leaderboard_route():
    # Получаем топ-10 пользователей по количеству монет (или измените по своему усмотрению)
    leaderboard = get_top_users_by_coins(10)
    return jsonify(leaderboard)

def run_flask_app():
    app.run(host='0.0.0.0', port=8000)

def main():
    """Запуск бота."""
    # Получение токена бота из переменных окружения
    TOKEN = os.environ.get("TOKEN")
    if not TOKEN:
        logger.error("Необходимо установить переменную окружения TOKEN.")
        return

    # Создание приложения и регистрация обработчиков
    application = Application.builder().token(TOKEN).build()

    application.add_handler(CommandHandler('start', start))
    application.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, handle_web_app_data))

    # Запуск Flask-приложения в отдельном потоке
    flask_thread = Thread(target=run_flask_app)
    flask_thread.start()

    # Запуск бота
    application.run_polling()

if __name__ == "__main__":
    main()
