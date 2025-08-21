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

// Единый источник для URL сервера
const SERVER_URL = process.env.NODE_ENV === 'development' ? 'http://localhost:8000' : '/api';
const ATTEMPT_REGEN_INTERVAL_MS = 1 * 60 * 1000;

// Порог №1 — первый ввод кошелька
const WALLET_CREATE_THRESHOLD = 420;
// Порог №2 — повторный ввод (изменение) кошелька
const WALLET_EDIT_THRESHOLD = 1000;

// Универсальный fetch с таймаутом и ретраями (чтобы UI не «вис»)
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

// Функция для получения ID пользователя
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

  // Wallet
  const [wallet, setWallet] = useState(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletModalMode, setWalletModalMode] = useState('create'); // 'create' | 'edit'

  // Состояния пользователя
  const [userId, setUserId] = useState(null);
  const [coins, setCoins] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(10);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [nextAttemptTimestamp, setNextAttemptTimestamp] = useState(null);
  const [timeToNextAttempt, setTimeToNextAttempt] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [wallet420, setWallet420] = useState(null);
  const [wallet1000, setWallet1000] = useState(null);
  const [walletModalSlot, setWalletModalSlot] = useState('420'); // '420' | '1000'

  // Ключи для "не надоедать" по этапам
  const DISMISS_CREATE = 'walletPromptDismissed_create';
  const DISMISS_EDIT = 'walletPromptDismissed_edit';

  const isDismissed = (key) => localStorage.getItem(key) === '1';
  const dismiss = (key) => localStorage.setItem(key, '1');
  const undismiss = (key) => localStorage.removeItem(key);

    const openCreateWalletModal = (slot = '420') => {
      setWalletModalMode('create');
      setWalletModalSlot(slot);     // '420' или '1000'
      setWalletModalOpen(true);
    };

    const openEditWalletModal = (slot = '1000') => {
      setWalletModalMode('edit');
      setWalletModalSlot(slot);     // '420' или '1000'
      setWalletModalOpen(true);
    };

    const closeWalletModal = () => setWalletModalOpen(false);

  const canAddWallet = coins >= WALLET_CREATE_THRESHOLD && !wallet;
  const canEditWallet = coins >= WALLET_EDIT_THRESHOLD && !!wallet;

  // 1) Инициализация пользователя при первом запуске
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

          // два отдельных кошелька (с бэком на старое поле wallet)
          const w420  = data.wallet_420 ?? data.wallet ?? null;
          const w1000 = data.wallet_1000 ?? null;
          setWallet420(w420);
          setWallet1000(w1000);

          // безопасная привязка рефералки
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

          // Пороговые модалки: сначала 420 (если нет wallet420), затем 1000 (если нет wallet1000)
          if (nextCoins >= WALLET_CREATE_THRESHOLD && !w420 && !isDismissed(DISMISS_CREATE)) {
            openCreateWalletModal('420');
          }
          if (nextCoins >= WALLET_EDIT_THRESHOLD && !w1000 && !isDismissed(DISMISS_EDIT)) {
            openCreateWalletModal('1000'); // для второго кошелька используем режим create
          }
        } catch (err) {
          console.error('getUserData failed:', err);
        } finally {
          if (isMounted) setIsLoading(false);
        }
      })();

      return () => { isMounted = false; };
    }, []);

  // 2) Таймер восстановления попыток (без «залипания»)
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

  // 3) Обновление данных на сервере
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

  // 4) Сохранение кошелька на сервере (тот же эндпоинт — перезаписывает адрес при режиме 'edit')
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
            slot: walletModalSlot, // '420' | '1000'
          }),
          signal: controller.signal
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const code = payload?.error || `HTTP_${response.status}`;
          throw new Error(code);
        }

        if (walletModalSlot === '1000') {
          setWallet1000(payload?.wallet_1000 || walletStr);
          undismiss(DISMISS_EDIT);
        } else {
          setWallet420(payload?.wallet_420 || walletStr);
          undismiss(DISMISS_CREATE);
        }

        closeWalletModal();
        try {
          window.Telegram?.WebApp?.showPopup?.({ title: 'Готово', message: 'Кошелёк сохранён ✅' });
        } catch {}
      } finally {
        clearTimeout(timeoutId);
      }
    }, [userId, walletModalSlot]);

    const onDrawEnd = (circleAccuracy, points, canvas) => {
      if (attempts <= 0) return;
      const newAttempts = attempts - 1;
      const tokensEarned = parseFloat((0.01 * circleAccuracy).toFixed(2));
      const newCoins = coins + tokensEarned;

      setScore(circleAccuracy);
      setDrawingData(canvas?.toDataURL?.() || null);
      setCoins(newCoins);
      setAttempts(newAttempts);
      if (newAttempts < maxAttempts && !nextAttemptTimestamp) {
        setNextAttemptTimestamp(Date.now() + ATTEMPT_REGEN_INTERVAL_MS);
      }
      updateUserDataOnServer({ coins: newCoins, attempts: newAttempts, score: circleAccuracy });

      // 420+: если ещё нет первого кошелька — предложим добавить
      if (coins < WALLET_CREATE_THRESHOLD && newCoins >= WALLET_CREATE_THRESHOLD && !wallet420) {
        undismiss(DISMISS_CREATE);
        openCreateWalletModal('420');
      }
      // 1000+: если ещё нет второго кошелька — предложим добавить
      if (coins < WALLET_EDIT_THRESHOLD && newCoins >= WALLET_EDIT_THRESHOLD && !wallet1000) {
        undismiss(DISMISS_EDIT);
        openCreateWalletModal('1000');
      }
    };

  const onReset = () => {
    setScore(null);
    setDrawingData(null);
  };

    const onTaskComplete = (taskId, tokens) => {
      if (completedTasks.includes(taskId)) return;
      const newCompletedTasks = [...completedTasks, taskId];
      const newCoins = coins + tokens;

      setCompletedTasks(newCompletedTasks);
      setCoins(newCoins);
      updateUserDataOnServer({ coins: newCoins, completed_tasks: newCompletedTasks });

      if (coins < WALLET_CREATE_THRESHOLD && newCoins >= WALLET_CREATE_THRESHOLD && !wallet420) {
        undismiss(DISMISS_CREATE);
        openCreateWalletModal('420');
      }
      if (coins < WALLET_EDIT_THRESHOLD && newCoins >= WALLET_EDIT_THRESHOLD && !wallet1000) {
        undismiss(DISMISS_EDIT);
        openCreateWalletModal('1000');
      }
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
              <img src={require('./assets/total_coins.png')} alt="Total coins" className="banner-icon"/>
              <span className="banner-text">{coins.toFixed(2)}</span>
            </div>
          </div>

          <div className="attempts-display">
            <div className="banner-container">
              <img src={require('./assets/total_attempts.png')} alt="Total attempts" className="banner-icon"/>
              <span className="banner-text">{attempts}/{maxAttempts}</span>
            </div>
            {timeToNextAttempt && (
              <div className="timer-display">
                <span className="timer-text">{timeToNextAttempt}</span>
              </div>
            )}
          </div>

          {/* Кнопка появляется только когда доступно действие */}
          {canAddWallet && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="wallet-button"
                onClick={() => { undismiss(DISMISS_CREATE); openCreateWalletModal(); }}
              >
                <span className="dot" />
                Добавить кошелёк
              </button>
            </div>
          )}

          {canEditWallet && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="wallet-button"
                onClick={() => { undismiss(DISMISS_EDIT); openEditWalletModal(); }}
              >
                <span className="dot" />
                Изменить кошелёк
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
        initialWallet={walletModalSlot === '1000' ? (wallet1000 || '') : (wallet420 || '')}
        onSave={saveWalletOnServer}
        onCancel={() => {
          // Разные "не надоедать" для разных этапов
          if (walletModalSlot === '1000') dismiss(DISMISS_EDIT); else dismiss(DISMISS_CREATE);
          closeWalletModal();
        }}
        onRequestClose={closeWalletModal}
      />
    </div>
  );
}

export default App;
