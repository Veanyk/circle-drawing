// src/components/Canvas.js

import React, { useRef, useEffect, useState } from 'react';
import chalkImage from '../assets/chalk.png';
import drawCircleImage from '../assets/draw_the_circle.png';
import drawingFieldImage from '../assets/drawing_field.png';
import './Canvas.css';

const Canvas = ({ onDrawEnd, attempts }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState([]);
  const [chalkPosition, setChalkPosition] = useState({ x: -100, y: -100 });
  const backgroundRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Загружаем фоновое изображение
    const background = new Image();
    background.src = drawingFieldImage;
    background.onload = () => {
      backgroundRef.current = background;
      resizeCanvas();

      // Добавляем слушатель события изменения размера окна после загрузки фона
      window.addEventListener('resize', resizeCanvas);
    };

    // Функция для изменения размера канваса и перерисовки фона
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      const computedStyle = getComputedStyle(container);
      const width = parseInt(computedStyle.getPropertyValue('width'), 10);
      const maxWidth = 500; // Максимальная ширина, как на странице результатов
      const canvasWidth = Math.min(width * 0.8, maxWidth);
      const canvasHeight = canvasWidth; // Делаем канвас квадратным

      // Устанавливаем размеры канваса
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // Устанавливаем отображаемые размеры через стиль
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;

      // Очищаем канвас и рисуем фон
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (backgroundRef.current) {
        context.drawImage(
          backgroundRef.current,
          0,
          0,
          canvas.width,
          canvas.height
        );
      }

      // Настройки для рисования
      context.lineWidth = 3;
      context.strokeStyle = '#ffffff';
      context.lineCap = 'round';
      context.lineJoin = 'round';
    };

    // Предотвращаем стандартные действия для сенсорных событий
    const preventDefault = (e) => {
      e.preventDefault();
    };

    canvas.addEventListener('touchstart', preventDefault, { passive: false });
    canvas.addEventListener('touchmove', preventDefault, { passive: false });

    return () => {
      // Удаляем слушатели при размонтировании компонента
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('touchstart', preventDefault);
      canvas.removeEventListener('touchmove', preventDefault);
    };
  }, []);

  // Функция для получения позиции события относительно канваса
  const getEventPos = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    let x, y;

    if (event.touches && event.touches.length > 0) {
      x = event.touches[0].clientX - rect.left;
      y = event.touches[0].clientY - rect.top;
    } else {
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
    }

    return { x, y };
  };

  // Начало рисования
  const startDrawing = (event) => {
    if (attempts <= 0) {
      alert('У вас закончились попытки!');
      return;
    }

    const { x, y } = getEventPos(event);
    setIsDrawing(true);
    setPoints([{ x, y }]);

    const context = canvasRef.current.getContext('2d');
    context.beginPath();
    context.moveTo(x, y);

    setChalkPosition({ x: event.clientX, y: event.clientY });
  };

  // Рисование
  const draw = (event) => {
    if (!isDrawing) return;

    const { x, y } = getEventPos(event);
    setPoints((prevPoints) => [...prevPoints, { x, y }]);

    const context = canvasRef.current.getContext('2d');
    context.lineTo(x, y);
    context.stroke();

    // Обновляем позицию мелка
    setChalkPosition({ x: event.clientX, y: event.clientY });
  };

  // Конец рисования
  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    // Скрываем мелок
    setChalkPosition({ x: -100, y: -100 });

    const canvas = canvasRef.current;
    const score = calculateFinalScore(points);
    onDrawEnd(score, points, canvas, {
      width: canvas.width,
      height: canvas.height,
    });

    clearCanvas();
    setPoints([]);
  };

  // Стили для мелка
  const chalkStyle = {
    position: 'fixed',
    left: chalkPosition.x - 15, // Центрируем мелок по горизонтали
    top: chalkPosition.y - 15, // Центрируем мелок по вертикали
    width: '30px',
    height: '30px',
    pointerEvents: 'none',
    zIndex: 10,
    transform: 'rotate(45deg)',
  };

  // Функция для расчёта финального процента точности
  const calculateFinalScore = (allPoints) => {
    if (allPoints.length < 10) return 0;
    const accuracy = calculateAccuracy(allPoints);
    return Math.round(accuracy);
  };

  // Функция для расчёта точности нарисованного круга
  const calculateAccuracy = (currentPoints) => {
    if (currentPoints.length < 10) return 0;
    const circle = fitCircle(currentPoints);
    if (!circle || isNaN(circle.radius)) return 0;

    const { centerX, centerY, radius } = circle;
    const N = currentPoints.length;

    // Замкнутость фигуры
    const startPoint = currentPoints[0];
    const endPoint = currentPoints[currentPoints.length - 1];
    const distanceStartEnd = Math.hypot(
      endPoint.x - startPoint.x,
      endPoint.y - startPoint.y
    );
    const closureThreshold = 0.05 * radius;

    // Оцениваем замкнутость от 0 до 1
    let closureScore = 1 - Math.min(distanceStartEnd / closureThreshold, 1);

    // Общее изменение угла
    let totalAngleChange = 0;
    for (let i = 1; i < currentPoints.length - 1; i++) {
      const p0 = currentPoints[i - 1];
      const p1 = currentPoints[i];
      const p2 = currentPoints[i + 1];

      const angle1 = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      const angle2 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      let angleChange = angle2 - angle1;

      if (angleChange > Math.PI) {
        angleChange -= 2 * Math.PI;
      } else if (angleChange < -Math.PI) {
        angleChange += 2 * Math.PI;
      }

      totalAngleChange += angleChange;
    }

    const angleCoverage = Math.abs(totalAngleChange) / (2 * Math.PI);
    const angleCoverageScore = Math.min(angleCoverage / 1, 1);

    // Равномерность радиусов
    const radii = currentPoints.map((point) =>
      Math.hypot(point.x - centerX, point.y - centerY)
    );
    const avgRadius =
      radii.reduce((sum, r) => sum + r, 0) / radii.length;
    const radiusVariance =
      radii.reduce((sum, r) => sum + Math.pow(r - avgRadius, 2), 0) /
      radii.length;
    const radiusStdDev = Math.sqrt(radiusVariance);
    const radiusUniformity = Math.max(
      0,
      Math.min(1, 1 - radiusStdDev / avgRadius)
    );

    // Отношение ширины к высоте
    const xValues = currentPoints.map((p) => p.x);
    const yValues = currentPoints.map((p) => p.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    const width = maxX - minX;
    const height = maxY - minY;
    const aspectRatio = width / height;
    const aspectRatioScore = Math.max(
      0,
      Math.min(1, 1 - Math.abs(aspectRatio - 1))
    );

    // Плавность кривой
    let smoothnessScore = 1;
    for (let i = 2; i < currentPoints.length; i++) {
      const dx1 = currentPoints[i - 1].x - currentPoints[i - 2].x;
      const dy1 = currentPoints[i - 1].y - currentPoints[i - 2].y;
      const dx2 = currentPoints[i].x - currentPoints[i - 1].x;
      const dy2 = currentPoints[i].y - currentPoints[i - 1].y;
      const angle1 = Math.atan2(dy1, dx1);
      const angle2 = Math.atan2(dy2, dx2);
      let angleDiff = Math.abs(angle2 - angle1);
      if (angleDiff > Math.PI) {
        angleDiff = 2 * Math.PI - angleDiff;
      }
      smoothnessScore -= angleDiff / (Math.PI * N);
    }
    smoothnessScore = Math.max(0, smoothnessScore);

    // Итоговая точность
    const accuracy =
      radiusUniformity * 0.3 +
      aspectRatioScore * 0.2 +
      angleCoverageScore * 0.2 +
      closureScore * 0.2 +
      smoothnessScore * 0.1;

    return accuracy * 100;
  };

  // Функция для подгонки круга к точкам (метод наименьших квадратов)
  const fitCircle = (points) => {
    let sumX = 0,
      sumY = 0,
      sumX2 = 0,
      sumY2 = 0,
      sumX3 = 0,
      sumY3 = 0,
      sumXY = 0,
      sumX1Y2 = 0,
      sumX2Y1 = 0;
    const N = points.length;

    for (let i = 0; i < N; i++) {
      const xi = points[i].x;
      const yi = points[i].y;
      const xi2 = xi * xi;
      const yi2 = yi * yi;
      sumX += xi;
      sumY += yi;
      sumX2 += xi2;
      sumY2 += yi2;
      sumX3 += xi2 * xi;
      sumY3 += yi2 * yi;
      sumXY += xi * yi;
      sumX1Y2 += xi * yi2;
      sumX2Y1 += xi2 * yi;
    }

    const C = N * sumX2 - sumX * sumX;
    const D = N * sumXY - sumX * sumY;
    const E = N * sumX3 + N * sumX1Y2 - (sumX2 + sumY2) * sumX;
    const G = N * sumY2 - sumY * sumY;
    const H = N * sumX2Y1 + N * sumY3 - (sumX2 + sumY2) * sumY;

    const denominator = 2 * (C * G - D * D);
    if (denominator === 0) {
      return null;
    }

    const a = (E * G - D * H) / denominator;
    const b = (C * H - D * E) / denominator;
    const c = -(sumX2 + sumY2 + a * sumX + b * sumY) / N;

    const centerX = -a;
    const centerY = -b;
    const radius = Math.sqrt(centerX * centerX + centerY * centerY - c);

    return { centerX, centerY, radius };
  };

  // Функция для очистки канваса и перерисовки фона
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем фоновое изображение, если оно загружено
    if (backgroundRef.current) {
      context.drawImage(
        backgroundRef.current,
        0,
        0,
        canvas.width,
        canvas.height
      );
    }
  };

  return (
    <div className="canvas-container">
      <img
        src={chalkImage}
        alt="Мел"
        className="chalk-image"
        style={chalkStyle}
      />
      <img
        src={drawCircleImage}
        alt="Нарисуйте круг"
        className="draw-circle-image"
      />
      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={endDrawing}
      />
    </div>
  );
};

export default Canvas;
