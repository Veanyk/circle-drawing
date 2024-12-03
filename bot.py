# bot.py

import logging
import os
import json
from telegram import Update, KeyboardButton, ReplyKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters
from database import get_user_data, update_user_data  # Импортируем функции из database.py

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

    # Запуск бота
    application.run_polling()

if __name__ == "__main__":
    main()
