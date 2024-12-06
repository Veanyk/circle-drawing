// src/components/Result.js

import React, { useEffect, useRef } from 'react';
import { TwitterShareButton, TelegramShareButton } from 'react-share';
import './Result.css';

import resultCircleImage from '../assets/result_circle.png';
import tryAgainIcon from '../assets/try_again.png';
import twitterIcon from '../assets/twitter_icon.png';
import telegramIcon from '../assets/telegram_icon.png';
import shareResultsImage from '../assets/share_results.png'; // Вернули импорт PNG для "Поделиться результатом"

const Result = ({ score, onReset, drawing }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Загружаем рисунок пользователя
    const userDrawing = new Image();
    userDrawing.src = drawing;
    userDrawing.onload = () => {
      // Устанавливаем размеры канваса в соответствии с размерами рисунка пользователя
      canvas.width = userDrawing.width;
      canvas.height = userDrawing.height;

      // Очищаем канвас
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Рисуем рисунок пользователя
      context.drawImage(userDrawing, 0, 0, canvas.width, canvas.height);
    };
  }, [drawing]);

  const shareUrl = 'https://t.me/circle_drawing_bot';
  const title = `Я нарисовал круг с точностью ${score}%! Попробуй и ты!`;

  // Вычисляем десятичное значение заработанных токенов
  const decimalTokens = (score / 100).toFixed(2);

  return (
    <div className="result-container">
      {/* Уменьшаем размер круга и переносим его вверх */}
      <div className="result-image">
        <img src={resultCircleImage} alt="Результат" className="result-circle" />
        <div className="result-text-overlay">
          {score}%
        </div>
      </div>

      {/* Текст под кругом с новым шрифтом и черным цветом */}
      <p className="circle-accuracy-text">
        your circle is {score}% accurate
      </p>
      <p className="earned-tokens-text">
        you've earned {decimalTokens} tokens
      </p>

      {/* Канвас с рисунком пользователя */}
      <canvas ref={canvasRef} className="result-canvas" />

      <div className="buttons">
        <button className="reset-button" onClick={onReset}>
          <img src={tryAgainIcon} alt="Попробовать ещё раз" className="button-icon" />
        </button>
        <div className="share-buttons">
          {/* Вернули PNG для "Поделиться результатом" */}
          <img src={shareResultsImage} alt="Поделиться результатом" className="share-results-image" />
          <div className="social-icons">
            <TwitterShareButton url={shareUrl} title={title}>
              <img src={twitterIcon} alt="Twitter" className="social-icon" />
            </TwitterShareButton>
            <TelegramShareButton url={shareUrl} title={title}>
              <img src={telegramIcon} alt="Telegram" className="social-icon" />
            </TelegramShareButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Result;
