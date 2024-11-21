import logging
import os
import json
from telegram import Update, KeyboardButton, ReplyKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters

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
    web_app = WebAppInfo(url=WEB_APP_URL)
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
    score = data_dict.get('score')
    await update.message.reply_text(f"Ваш результат: {score}!")

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
