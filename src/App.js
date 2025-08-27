import React, { useState, useEffect, useCallback } from 'react';
import WalletModal from './components/WalletModal';
import './components/WalletModal.css';
import Canvas from './components/Canvas';
import Result from './components/Result';
import Tasks from './components/Tasks';
import TabBar from './components/TabBar';
import Referrals from './components/Referrals';
import Leaderboards from './components/Leaderboards';
import './App.css';

const SERVER_URL = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '/api';
const ATTEMPT_REGEN_INTERVAL_MS = 1 * 60 * 1000;

// Пороговые значения для 3 кошельков
const WALLET1_THRESHOLD = 420;
const WALLET2_THRESHOLD = 690;
const WALLET3_THRESHOLD = 1000;

// Универсальная функция fetch с таймаутом и повторами
const fetchJSON = async (url, options = {}, { timeout = 10000, retries = 2, retryDelay = 300 } = {}) => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort('timeout'), timeout);
    try {
      const res = await fetch(url, { ...options, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      clearTimeout(t);
      if (attempt === retries) throw e;
      await new Promise(r => setTimeout(r, retryDelay * (attempt + 1)));
    }
  }
};

// Получение user_id
const initializeUserId = () => {
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (tgUser?.id) {
    return String(tgUser.id);
  }
  let userId = localStorage.getItem('circleGameUserId');
  if (!userId) {
    userId = `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('circleGameUserId', userId);
  }
  return userId;
};

const ScoreCircle = () => null;

function App() {
  const [score, setScore] = useState(null);
  const [currentTab, setCurrentTab] = useState('circle');
  const [drawingData, setDrawingData] = useState(null);

  // Модальное окно для кошелька
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletModalMode, setWalletModalMode] = useState('create'); // 'create' | 'edit' (оставлено для совместимости)
  const [walletModalSlot, setWalletModalSlot] = useState('420');    // '420' | '690' | '1000'

  // Состояние пользователя
  const [userId, setUserId] = useState(null);
  const [coins, setCoins] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(10);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [nextAttemptTimestamp, setNextAttemptTimestamp] = useState(null);
  const [timeToNextAttempt, setTimeToNextAttempt] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Три слота для кошельков
  const [wallet420, setWallet420] = useState(null);
  const [wallet690, setWallet690] = useState(null);
  const [wallet1000, setWallet1000] = useState(null);

  const DISMISS_420 = 'walletPromptDismissed_420';
  const DISMISS_690 = 'walletPromptDismissed_690';
  const DISMISS_1000 = 'walletPromptDismissed_1000';

  const isDismissed = (key) => localStorage.getItem(key) === '1';
  const dismiss = (key) => localStorage.setItem(key, '1');
  const undismiss = (key) => localStorage.removeItem(key);

  const keyForSlot = (slot) => {
    if (slot === '1000') return DISMISS_1000;
    if (slot === '690') return DISMISS_690;
    return DISMISS_420;
  };

  const openCreateWalletModal = (slot = '420') => {
    setWalletModalMode('create');
    setWalletModalSlot(slot);
    setWalletModalOpen(true);
  };

  const openEditWalletModal = (slot = '420') => {
    setWalletModalMode('edit');
    setWalletModalSlot(slot);
    setWalletModalOpen(true);
  };

  const closeWalletModal = () => setWalletModalOpen(false);

  // Флаги для отображения кнопок действий:
  const canAddWallet420 = coins >= WALLET1_THRESHOLD && !wallet420;
  const canAddWallet690 = coins >= WALLET2_THRESHOLD && !wallet690;
  const canAddWallet1000 = coins >= WALLET3_THRESHOLD && !wallet1000;

  const canEditWallet420 = coins >= WALLET1_THRESHOLD && !!wallet420;
  const canEditWallet690 = coins >= WALLET2_THRESHOLD && !!wallet690;
  const canEditWallet1000 = coins >= WALLET3_THRESHOLD && !!wallet1000;

  // Первая загрузка и инициализация пользователя
  useEffect(() => {
    let isMounted = true;

    const tg = window.Telegram?.WebApp;
    try { tg?.ready(); tg?.expand(); } catch {}
    try { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch {}

    const finalUserId = initializeUserId();
    setUserId(finalUserId);

    const tgUnsafe   = window.Telegram?.WebApp?.initDataUnsafe;
    const tgInitData = window.Telegram?.WebApp?.initData || '';
    const tgUser     = tgUnsafe?.user;

    const urlParams  = new URLSearchParams(window.location.search);
    const urlRef     = urlParams.get('ref');
    const startParam = tgUnsafe?.start_param;
    const startRef   = (typeof startParam === 'string' && startParam.startsWith('ref_'))
      ? startParam.slice(4)
      : null;

    let refId = urlRef || startRef || localStorage.getItem('referrerId') || null;
    if (refId) localStorage.setItem('referrerId', refId);

    (async () => {
      try {
        const data = await fetchJSON(`${SERVER_URL}/getUserData`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: finalUserId,
            ref_id: refId,
            username: tgUser?.username,
          }),
        }, { timeout: 10000, retries: 2 });

        if (!isMounted || !data) return;

        const nextCoins = Number(data.coins) || 0;
        setCoins(nextCoins);
        setAttempts(Number(data.attempts) || 0);
        setMaxAttempts(Number(data.max_attempts) || 10);
        setCompletedTasks(Array.isArray(data.completed_tasks) ? data.completed_tasks : []);
        setNextAttemptTimestamp(Number.isFinite(data.nextAttemptTimestamp) ? data.nextAttemptTimestamp : null);

        // Три отдельных кошелька
        const w420   = data.wallet_420 ?? data.wallet ?? null;
        const w690   = data.wallet_690 ?? null;
        const w1000  = data.wallet_1000 ?? null;
        setWallet420(w420);
        setWallet690(w690);
        setWallet1000(w1000);

        // Безопасная обработка рефералов
        const isTelegramUserId = /^\d+$/.test(String(finalUserId));
        const inviterNumeric   = /^\d+$/.test(String(refId || '')) ? String(refId) : null;
        const hasInitData      = typeof tgInitData === 'string' && tgInitData.length > 0;

        if (
          hasInitData &&
          isTelegramUserId &&
          inviterNumeric &&
          inviterNumeric !== String(finalUserId) &&
          (!data.referrer_id || !data.referral_processed)
        ) {
          try {
            const resp = await fetch(`${SERVER_URL}/acceptReferral`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ inviter_id: inviterNumeric, initData: tgInitData }),
            });
            if (resp.ok) {
              localStorage.removeItem('referrerId');
            }
          } catch (e) {
            console.warn('acceptReferral failed (ignored):', e);
          }
        }

        // Модалки для порогов
        if (nextCoins >= WALLET1_THRESHOLD && !w420 && !isDismissed(DISMISS_420)) {
          openCreateWalletModal('420');
        } else if (nextCoins >= WALLET2_THRESHOLD && !w690 && !isDismissed(DISMISS_690)) {
          openCreateWalletModal('690');
        } else if (nextCoins >= WALLET3_THRESHOLD && !w1000 && !isDismissed(DISMISS_1000)) {
          openCreateWalletModal('1000');
        }
      } catch (err) {
        console.error('getUserData failed:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => { isMounted = false; };
  }, []);

  // Таймер регенерации попыток
  useEffect(() => {
    if (!userId || attempts >= maxAttempts || !nextAttemptTimestamp) {
      setTimeToNextAttempt(null);
      return;
    }
    const timer = setInterval(() => {
      const now = Date.now();
      const timeLeftMs = Math.max(0, nextAttemptTimestamp - now);
      if (timeLeftMs <= 0) {
        setAttempts(prev => Math.min(maxAttempts, prev + 1));
        setNextAttemptTimestamp(now + ATTEMPT_REGEN_INTERVAL_MS);
      }
      const totalSec = Math.ceil(timeLeftMs / 1000);
      const minutes = Math.floor(totalSec / 60);
      const seconds = totalSec % 60;
      setTimeToNextAttempt(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [userId, attempts, maxAttempts, nextAttemptTimestamp]);

  // Обновление данных пользователя на сервере
  const updateUserDataOnServer = useCallback((newData) => {
    if (!userId) return;
    fetchJSON(`${SERVER_URL}/updateUserData`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, data: newData })
    }, { timeout: 8000, retries: 1 }).catch(err => {
      console.warn('updateUserData failed (ignored):', err);
    });
  }, [userId]);

  // Сохранение кошелька на сервере
  const saveWalletOnServer = useCallback(async (walletStr) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort('timeout'), 10000);

    try {
      const response = await fetch(`${SERVER_URL}/setWallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          wallet: walletStr,
          slot: walletModalSlot,
        }),
        signal: controller.signal
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = payload?.error || `HTTP_${response.status}`;
        throw new Error(code);
      }

      if (walletModalSlot === '1000') {
        setWallet1000(payload?.wallet_1000 ?? walletStr);
        undismiss(DISMISS_1000);
      } else if (walletModalSlot === '690') {
        setWallet690(payload?.wallet_690 ?? walletStr);
        undismiss(DISMISS_690);
      } else {
        setWallet420(payload?.wallet_420 ?? payload?.wallet ?? walletStr);
        undismiss(DISMISS_420);
      }

      closeWalletModal();
      try {
        window.Telegram?.WebApp?.showPopup?.({ title: 'Done', message: 'Wallet saved ✅' });
      } catch {}
    } finally {
      clearTimeout(timeoutId);
    }
  }, [userId, walletModalSlot]);

  // Проверка, пересекли ли новые монеты порог
  const promptIfCrossed = (prevCoins, newCoins) => {
    if (prevCoins < WALLET1_THRESHOLD && newCoins >= WALLET1_THRESHOLD && !wallet420) {
      undismiss(DISMISS_420);
      openCreateWalletModal('420');
      return;
    }
    if (prevCoins < WALLET2_THRESHOLD && newCoins >= WALLET2_THRESHOLD && !wallet690) {
      undismiss(DISMISS_690);
      openCreateWalletModal('690');
      return;
    }
    if (prevCoins < WALLET3_THRESHOLD && newCoins >= WALLET3_THRESHOLD && !wallet1000) {
      undismiss(DISMISS_1000);
      openCreateWalletModal('1000');
    }
  };

  // Завершение рисования
  const onDrawEnd = (circleAccuracy, points, canvas) => {
    if (attempts <= 0) return;
    const newAttempts = attempts - 1;
    const tokensEarned = parseFloat((0.01 * circleAccuracy).toFixed(2));
    const prevCoins = coins;
    const newCoins = prevCoins + tokensEarned;

    setScore(circleAccuracy);
    setDrawingData(canvas?.toDataURL?.() || null);
    setCoins(newCoins);
    setAttempts(newAttempts);
    if (newAttempts < maxAttempts && !nextAttemptTimestamp) {
      setNextAttemptTimestamp(Date.now() + ATTEMPT_REGEN_INTERVAL_MS);
    }
    updateUserDataOnServer({ coins: newCoins, attempts: newAttempts, score: circleAccuracy });

    promptIfCrossed(prevCoins, newCoins);
  };

  // Сброс результата
  const onReset = () => {
    setScore(null);
    setDrawingData(null);
  };

  // Завершение задачи
  const onTaskComplete = (taskId, tokens) => {
    if (completedTasks.includes(taskId)) return;
    const newCompletedTasks = [...completedTasks, taskId];
    const prevCoins = coins;
    const newCoins = prevCoins + tokens;

    setCompletedTasks(newCompletedTasks);
    setCoins(newCoins);
    updateUserDataOnServer({ coins: newCoins, completed_tasks: newCompletedTasks });

    promptIfCrossed(prevCoins, newCoins);
  };

  if (isLoading) {
    return <div className="App-loading">Loading...</div>;
  }

  return (
    <div className="App">
      {currentTab === 'circle' && (
        <div className="app-header">
          <div className="coins-display">
            <div className="banner-container">
              <img src={require('./assets/total_coins.png')} alt="Total coins" className="banner-icon" />
              <span className="banner-text">{coins >= WALLET3_THRESHOLD ? coins.toFixed(1) : coins.toFixed(2)}</span>
            </div>
          </div>

          <div className="attempts-display">
            <div className="banner-container">
              <img src={require('./assets/total_attempts.png')} alt="Total attempts" className="banner-icon" />
              <span className="banner-text">{attempts}/{maxAttempts}</span>
            </div>
            {timeToNextAttempt && (
              <div className="timer-display">
                <span className="timer-text">{timeToNextAttempt}</span>
              </div>
            )}
          </div>

          {(canAddWallet420 || canEditWallet420) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="wallet-button"
                style={{ fontFamily: "'Gloria Hallelujah', cursive" }}
                onClick={() => {
                  undismiss(DISMISS_420);
                  (canAddWallet420 ? openCreateWalletModal('420') : openEditWalletModal('420'));
                }}
              >
                <span className="dot" />
                {canAddWallet420 ? 'Add wallet' : '1'}
              </button>
            </div>
          )}

          {(canAddWallet690 || canEditWallet690) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="wallet-button"
                style={{ fontFamily: "'Gloria Hallelujah', cursive" }}
                onClick={() => {
                  undismiss(DISMISS_690);
                  (canAddWallet690 ? openCreateWalletModal('690') : openEditWalletModal('690'));
                }}
              >
                <span className="dot" />
                {canAddWallet690 ? 'Add second wallet' : '2'}
              </button>
            </div>
          )}

          {(canAddWallet1000 || canEditWallet1000) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="wallet-button"
                style={{ fontFamily: "'Gloria Hallelujah', cursive" }}
                onClick={() => {
                  undismiss(DISMISS_1000);
                  (canAddWallet1000 ? openCreateWalletModal('1000') : openEditWalletModal('1000'));
                }}
              >
                <span className="dot" />
                {canAddWallet1000 ? 'Add third wallet' : '3'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="main-content">
        <div className={`tab-pane ${currentTab === 'circle' ? 'active' : ''}`}>
          {score === null
            ? <Canvas onDrawEnd={onDrawEnd} attempts={attempts} />
            : <Result score={score} onReset={onReset} drawing={drawingData} userId={userId} />
          }
        </div>

        <div className={`tab-pane ${currentTab === 'tasks' ? 'active' : ''}`}>
          <Tasks onTaskComplete={onTaskComplete} completedTasks={completedTasks} setCurrentTab={setCurrentTab} />
        </div>

        <div className={`tab-pane ${currentTab === 'referrals' ? 'active' : ''}`}>
          <Referrals userId={userId} />
        </div>

        <div className={`tab-pane ${currentTab === 'leaderboards' ? 'active' : ''}`}>
          <Leaderboards userId={userId} />
        </div>
      </div>

      <TabBar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <WalletModal
        isOpen={walletModalOpen}
        initialWallet={
          walletModalSlot === '1000'
            ? (wallet1000 || '')
            : walletModalSlot === '690'
              ? (wallet690 || '')
              : (wallet420 || '')
        }
        onSave={saveWalletOnServer}
        onCancel={() => {
          if (walletModalSlot === '1000') dismiss(DISMISS_1000);
          else if (walletModalSlot === '690') dismiss(DISMISS_690);
          else dismiss(DISMISS_420);
          closeWalletModal();
        }}
        onRequestClose={closeWalletModal}
        slot={walletModalSlot}
        requiredCoins={walletModalSlot === '1000' ? 1000 : walletModalSlot === '690' ? 690 : 420}
      />
    </div>
  );
}

export default App;
