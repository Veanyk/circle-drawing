from telegram import Update, KeyboardButton, ReplyKeyboardMarkup, WebAppInfo
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)
import json

TOKEN = '7672739920:AAFC6KkmnunNRbEQUU-6NtC4XeAnUZZa6mQ'

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    web_app = WebAppInfo(url='https://circle-drawing.vercel.app')
    keyboard = [
        [KeyboardButton(text='🌀 Запустить приложение', web_app=web_app)]
    ]
    reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True)
    await update.message.reply_text(
        'Добро пожаловать! Нажмите кнопку ниже, чтобы начать.',
        reply_markup=reply_markup
    )

async def handle_web_app_data(update: Update, context: ContextTypes.DEFAULT_TYPE):
    data = update.message.web_app_data.data  # Получение данных из мини-приложения
    data_dict = json.loads(data)
    score = data_dict.get('score')
    await update.message.reply_text(f"Ваш результат: {score}!")

def main():
    app = ApplicationBuilder().token(TOKEN).build()
    app.add_handler(CommandHandler('start', start))
    app.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, handle_web_app_data))
    app.run_polling()

if __name__ == '__main__':
    main()
