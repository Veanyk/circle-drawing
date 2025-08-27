import React, { useRef, useEffect, useState } from 'react';
import chalkImage from '../assets/chalk.png';
import drawCircleImage from '../assets/draw_the_circle.png';
import drawingFieldImage from '../assets/drawing_field.png';
import './Canvas.css';

const Canvas = ({ onDrawEnd, attempts }) => {
  const canvasRef = useRef(null);

  // Состояния
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState([]);
  const [chalkStyle, setChalkStyle] = useState({ display: 'none' });

  // Подгон размера канваса под CSS + фон
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const resizeCanvas = () => {
        const c = canvasRef.current;
        if (!c) return;
        const ctx = c.getContext('2d');

        const rect = c.getBoundingClientRect();
        const canvasWidth = Math.max(1, Math.round(rect.width));
        const canvasHeight = canvasWidth;

        if (c.width !== canvasWidth || c.height !== canvasHeight) {
          c.width = canvasWidth;
          c.height = canvasHeight;
        }

        // Очистка и настройки пера
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      };

      const observer = new ResizeObserver(resizeCanvas);
      if (canvas.parentElement) observer.observe(canvas.parentElement);
      resizeCanvas();

      return () => {
        if (canvas.parentElement) observer.unobserve(canvas.parentElement);
      };
    }, []);

  // Лочим прокрутку и гасим жесты, пока идёт рисование
  const scrollLockRef = useRef({ y: 0, locked: false });

  const lockScroll = () => {
    if (scrollLockRef.current.locked) return;
    const y = window.scrollY || window.pageYOffset || 0;
    scrollLockRef.current.y = y;
    document.body.style.top = `-${y}px`;
    document.body.classList.add('no-scroll');
    scrollLockRef.current.locked = true;
  };

  const unlockScroll = () => {
    if (!scrollLockRef.current.locked) return;
    document.body.classList.remove('no-scroll');
    document.body.style.top = '';
    const y = scrollLockRef.current.y || 0;
    scrollLockRef.current.locked = false;
    window.scrollTo(0, y);
  };

  useEffect(() => {
    const preventWhileDrawing = (e) => {
      if (isDrawing) e.preventDefault();
    };

    document.addEventListener('touchmove', preventWhileDrawing, { passive: false });
    document.addEventListener('wheel', preventWhileDrawing, { passive: false });
    document.addEventListener('gesturestart', preventWhileDrawing, { passive: false });
    document.addEventListener('gesturechange', preventWhileDrawing, { passive: false });
    document.addEventListener('gestureend', preventWhileDrawing, { passive: false });

    return () => {
      document.removeEventListener('touchmove', preventWhileDrawing, { passive: false });
      document.removeEventListener('wheel', preventWhileDrawing, { passive: false });
      document.removeEventListener('gesturestart', preventWhileDrawing, { passive: false });
      document.removeEventListener('gesturechange', preventWhileDrawing, { passive: false });
      document.removeEventListener('gestureend', preventWhileDrawing, { passive: false });
    };
  }, [isDrawing]);

  // Координаты события
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

  // Позиция мела (fixed относительно окна)
  const updateChalkPosition = (event) => {
    let clientX, clientY;

    if (event.touches && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    setChalkStyle({
      display: 'block',
      left: `${clientX}px`,
      top: `${clientY - 30}px`,
    });
  };

  // Начало рисования
  const startDrawing = (event) => {
    if (attempts <= 0) {
      alert('You are out of attempts!');
      return;
    }

    // Сразу фиксируем скролл страницы
    lockScroll();

    if (event.cancelable) event.preventDefault();

    const { x, y } = getEventPos(event);
    setIsDrawing(true);
    setPoints([{ x, y }]);

    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);

    updateChalkPosition(event);
  };

  // Рисование
  const draw = (event) => {
    if (!isDrawing) return;

    if (event.cancelable) event.preventDefault();

    const { x, y } = getEventPos(event);
    setPoints((prevPoints) => [...prevPoints, { x, y }]);

    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();

    updateChalkPosition(event);
  };

  // Завершение рисования
    const getBoardImage = (() => {
      let img = null;
      return () => {
        if (img && img.complete) return img;
        img = new Image();
        img.src = require('../assets/drawing_field.png');
        return img;
      };
    })();

    const drawBoardUnderStrokes = (canvas) => {
      const ctx = canvas.getContext('2d');
      const board = getBoardImage();

      ctx.save();
      ctx.globalCompositeOperation = 'destination-over'; // рисуем ПОД штрихами
      if (board.complete) {
        ctx.drawImage(board, 0, 0, canvas.width, canvas.height);
      } else {
        // фолбэк, если вдруг не успела загрузиться
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.restore();
    };

  // Очистка канваса
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

    const endDrawing = () => {
      if (!isDrawing) return;
      setIsDrawing(false);

      // Вернуть скролл
      unlockScroll();

      setChalkStyle({ display: 'none' });

      const canvas = canvasRef.current;

      // Подкладываем доску ПОД штрихи — чтобы снимок содержал фон
      drawBoardUnderStrokes(canvas);

      const score = calculateFinalScore(points);

      onDrawEnd(score, points, canvas, {
        width: canvas.width,
        height: canvas.height,
      });

      clearCanvas();
      setPoints([]);
    };
  return (
    <div className="canvas-container">
      {/* Мел */}
      <img
        src={chalkImage}
        alt="Мел"
        className="chalk-image"
        style={chalkStyle}
      />

      {/* Подсказка */}
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

// Главный результат
function calculateFinalScore(allPoints) {
  if (!allPoints || allPoints.length < 8) return 0;

  const dedup = [];
  for (let i = 0; i < allPoints.length; i++) {
    const p = allPoints[i];
    const q = allPoints[i - 1];
    if (!q || p.x !== q.x || p.y !== q.y) dedup.push(p);
  }
  if (dedup.length < 8) return 0;

  const target = clampInt(Math.round(dedup.length * 1.2), 120, 240);
  const resampled = resamplePolyline(dedup, target);
  const pts = smoothPolyline(resampled, 3);

  let fit = robustFitCircle(pts);
  if (!fit) fit = algebraicCircleFit(pts);
  if (!fit || !isFinite(fit.r) || fit.r <= 0) return 0;

  const acc = compositeCircleScore(pts, fit);
  const { cx, cy, r } = fit;
  const residuals = pts.map((p) => Math.hypot(p.x - cx, p.y - cy) - r);
  const rms = Math.sqrt(residuals.reduce((s, e) => s + e * e, 0) / pts.length);
  const closure = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
  const angleCov = angularCoverage(pts, cx, cy);
  const aspectOk = aspectScoreFromPoints(pts) > 0.98;
  const smoothOk = smoothness(pts) > 0.95;

  if (
    rms <= Math.max(0.004 * r, 0.6) &&
    closure <= Math.max(0.02 * r, 2) &&
    angleCov >= 0.98 &&
    aspectOk &&
    smoothOk
  ) {
    return 100;
  }

  return Math.round(acc);
}

// Композитная метрика
function compositeCircleScore(points, circle) {
  const { cx, cy, r } = circle;
  const N = points.length;

  const residuals = points.map((p) => Math.hypot(p.x - cx, p.y - cy) - r);
  const rms = Math.sqrt(residuals.reduce((s, e) => s + e * e, 0) / N);
  const radialScore = clamp01(1 - rms / (0.10 * r + 1));

  const start = points[0];
  const end = points[points.length - 1];
  const closureDist = Math.hypot(end.x - start.x, end.y - start.y);
  const closureScore = clamp01(1 - closureDist / (0.20 * r + 6));

  const angleCov = angularCoverage(points, cx, cy);
  const angleScore = Math.pow(clamp01(angleCov), 1.05);

  const smoothScore = smoothness(points);
  const aspectScore = aspectScoreFromPoints(points);

  const wRadial = 0.6;
  const wClosure = 0.12;
  const wAngle = 0.15;
  const wSmooth = 0.07;
  const wAspect = 0.06;

  let score =
    wRadial * radialScore +
    wClosure * closureScore +
    wAngle * angleScore +
    wSmooth * smoothScore +
    wAspect * aspectScore;

  if (angleCov < 0.6) score *= (0.8 + 0.2 * angleCov);
  if (radialScore < 0.35) score *= (0.7 + 0.3 * radialScore);

  return clamp01(score) * 100;
}

// Робастная подгонка круга
function robustFitCircle(points) {
  if (!points || points.length < 8) return null;

  let fit = taubinCircleFit(points);
  if (!fit) return null;

  let filtered = filterOutliersByMAD(points, fit, 2.5);
  if (filtered.length >= 8) {
    const refit = taubinCircleFit(filtered);
    if (refit) fit = refit;
  }

  filtered = filterOutliersByMAD(filtered, fit, 2.2);
  if (filtered.length >= 8) {
    const refit2 = taubinCircleFit(filtered);
    if (refit2) fit = refit2;
  }
  return fit;
}

function taubinCircleFit(points) {
  const N = points.length;
  if (N < 3) return null;

  let meanX = 0, meanY = 0;
  for (const p of points) { meanX += p.x; meanY += p.y; }
  meanX /= N; meanY /= N;

  let Suu = 0, Suv = 0, Svv = 0, Suuu = 0, Svvv = 0, Suvv = 0, Svuu = 0;
  for (const p of points) {
    const u = p.x - meanX;
    const v = p.y - meanY;
    const uu = u * u, vv = v * v, uv = u * v;
    Suu += uu; Svv += vv; Suv += uv;
    Suuu += uu * u; Svvv += vv * v;
    Suvv += u * vv; Svuu += v * uu;
  }

  const det = Suu * Svv - Suv * Suv;
  if (Math.abs(det) < 1e-9) return null;

  const a = 0.5 * ((Suuu + Suvv) * Svv - (Svvv + Svuu) * Suv) / det;
  const b = 0.5 * ((Svvv + Svuu) * Suu - (Suuu + Suvv) * Suv) / det;

  const cx = meanX + a;
  const cy = meanY + b;

  let r2mean = 0;
  for (const p of points) {
    const d2 = (p.x - cx) ** 2 + (p.y - cy) ** 2;
    r2mean += d2;
  }
  r2mean /= N;
  const r = Math.sqrt(r2mean);

  if (!isFinite(cx) || !isFinite(cy) || !isFinite(r) || r <= 0) return null;
  return { cx, cy, r };
}

function algebraicCircleFit(points) {
  let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumX3 = 0, sumY3 = 0, sumXY = 0, sumX1Y2 = 0, sumX2Y1 = 0;
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

  const denom = 2 * (C * G - D * D);
  if (Math.abs(denom) < 1e-9) return null;

  const a = (E * G - D * H) / denom;
  const b = (C * H - D * E) / denom;
  const c = -(sumX2 + sumY2 + a * sumX + b * sumY) / N;

  const cx = -a;
  const cy = -b;
  const r2 = cx * cx + cy * cy - c;
  if (r2 <= 0) return null;

  const r = Math.sqrt(r2);
  if (!isFinite(cx) || !isFinite(cy) || !isFinite(r)) return null;
  return { cx, cy, r };
}

function filterOutliersByMAD(points, fit, k = 2.5) {
  const { cx, cy, r } = fit;
  const residuals = points.map((p) => Math.abs(Math.hypot(p.x - cx, p.y - cy) - r));
  const med = median(residuals);
  const devs = residuals.map((e) => Math.abs(e - med));
  const mad = median(devs) || 1e-6;

  const absThresh = 0.10 * r;
  const madThresh = k * 1.4826 * mad;
  const thr = Math.min(absThresh, madThresh);

  const filtered = [];
  for (let i = 0; i < points.length; i++) {
    if (residuals[i] <= thr) filtered.push(points[i]);
  }
  return filtered;
}

// Метрики и утилиты
function angularCoverage(points, cx, cy) {
  if (points.length < 3) return 0;
  const angles = points.map((p) => Math.atan2(p.y - cy, p.x - cx));
  const unwrapped = [angles[0]];
  for (let i = 1; i < angles.length; i++) {
    let a = angles[i];
    let d = a - angles[i - 1];
    if (d > Math.PI) a -= 2 * Math.PI;
    else if (d < -Math.PI) a += 2 * Math.PI;
    const last = unwrapped[unwrapped.length - 1];
    unwrapped.push(last + (a - angles[i - 1]));
  }
  const span = max(unwrapped) - min(unwrapped);
  const cov = span / (2 * Math.PI);
  return clamp01(cov);
}

function smoothness(points) {
  if (points.length < 5) return 0.5;
  let sum = 0, cnt = 0;
  for (let i = 2; i < points.length; i++) {
    const a = angle(points[i - 2], points[i - 1]);
    const b = angle(points[i - 1], points[i]);
    let d = Math.abs(b - a);
    if (d > Math.PI) d = 2 * Math.PI - d;
    sum += d; cnt++;
  }
  const avg = sum / Math.max(1, cnt);
  return clamp01(1 - avg / (Math.PI * 0.9));
}

function aspectScoreFromPoints(points) {
  const { minX, maxX, minY, maxY } = bounds(points);
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const aspect = w / h;
  return clamp01(1 - Math.abs(aspect - 1) / 0.20);
}

function resamplePolyline(points, M) {
  if (points.length <= 2 || M <= 2) return points.slice();

  const segLen = [0];
  for (let i = 1; i < points.length; i++) {
    segLen.push(Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const cum = [0];
  for (let i = 1; i < segLen.length; i++) cum.push(cum[i - 1] + segLen[i]);

  const L = cum[cum.length - 1] || 1;
  const step = L / (M - 1);

  const res = [];
  let seg = 1;
  for (let t = 0; t < M; t++) {
    const s = t * step;
    while (seg < cum.length && cum[seg] < s) seg++;
    const s0 = cum[seg - 1];
    const s1 = cum[seg] ?? s0;
    const p0 = points[seg - 1];
    const p1 = points[Math.min(seg, points.length - 1)];
    const w = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
    res.push({
      x: p0.x + (p1.x - p0.x) * w,
      y: p0.y + (p1.y - p0.y) * w,
    });
  }
  return res;
}

function smoothPolyline(points, k = 3) {
  if (k < 2 || points.length <= k) return points.slice();
  const res = points.slice();
  const half = Math.floor(k / 2);
  for (let i = half; i < points.length - half; i++) {
    let sx = 0, sy = 0;
    for (let j = i - half; j <= i + half; j++) {
      sx += points[j].x; sy += points[j].y;
    }
    res[i] = { x: sx / k, y: sy / k };
  }
  return res;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const clampInt = (v, a, b) => Math.max(a, Math.min(b, v | 0));
const angle = (p, q) => Math.atan2(q.y - p.y, q.x - p.x);
const min = (arr) => arr.reduce((m, v) => (v < m ? v : m), arr[0]);
const max = (arr) => arr.reduce((m, v) => (v > m ? v : m), arr[0]);
function bounds(points) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}
function median(a) {
  if (!a.length) return 0;
  const b = a.slice().sort((x, y) => x - y);
  const mid = Math.floor(b.length / 2);
  return b.length % 2 ? b[mid] : 0.5 * (b[mid - 1] + b[mid]);
}

export default Canvas;
