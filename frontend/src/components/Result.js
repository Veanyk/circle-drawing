import React, { useEffect, useRef } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import {
  TwitterShareButton,
  TelegramShareButton,
  TwitterIcon,
  TelegramIcon,
} from 'react-share';
import 'react-circular-progressbar/dist/styles.css';
import './Result.css';

const Result = ({ score, onReset, drawing }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    const image = new Image();
    image.src = drawing;
    image.onload = () => {
      canvas.width = image.width;
      canvas.height = image.height;

      const scale = window.devicePixelRatio || 1;
      if (scale > 1) {
        canvas.width = canvas.width * scale;
        canvas.height = canvas.height * scale;
        context.scale(scale, scale);
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image, 0, 0, canvas.width / scale, canvas.height / scale
      );
    };
  }, [drawing]);

  const shareUrl = 'https://t.me/circle_drawing_bot';
  const title = `Я нарисовал круг с точностью ${score}%! Попробуй и ты!`;

  return (
    <div className="result-container">
      <div className="progress-bar">
        <CircularProgressbar
          value={score}
          text={`${score}%`}
          styles={buildStyles({
            textColor: '#ffffff',
            pathColor:
              score > 90 ? '#00ff00' : score > 70 ? '#ff00ff' : '#ff0000',
            trailColor: '#444444',
          })}
        />
      </div>
      <h2 className="result-text">Ваш круг на {score}% точен!</h2>
      <p className="earned-coins">
        Вы заработали {(0.01 * score).toFixed(2)} токенов!
      </p>
      <canvas ref={canvasRef} className="result-canvas" />
      <div className="buttons">
        <button className="reset-button" onClick={onReset}>
          Попробовать ещё раз
        </button>
        <div className="share-buttons">
          <h3>Поделиться результатом:</h3>
          <div className="social-icons">
            <TwitterShareButton url={shareUrl} title={title}>
              <TwitterIcon size={48} round />
            </TwitterShareButton>
            <TelegramShareButton url={shareUrl} title={title}>
              <TelegramIcon size={48} round />
            </TelegramShareButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Result;
