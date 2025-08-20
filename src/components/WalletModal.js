import React, { useEffect, useState, useCallback } from 'react';
import './WalletModal.css';

const MIN_LEN = 6;
const MAX_LEN = 120;

export default function WalletModal({
  isOpen,
  initialWallet,
  onSave,         // async (wallet) => Promise<void> — вызывает /setWallet
  onCancel,       // пользователь нажал «Потом»
  onRequestClose, // закрыть окно (крестик/оверлей/escape)
}) {
  const [wallet, setWallet] = useState(initialWallet || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setWallet(initialWallet || '');
      setError('');
      setSaving(false);
      // Фокус на инпут
      setTimeout(() => {
        const el = document.getElementById('wallet-input');
        if (el) el.focus();
      }, 0);
    }
  }, [isOpen, initialWallet]);

  const escHandler = useCallback((e) => {
    if (e.key === 'Escape' && isOpen) onRequestClose?.();
  }, [isOpen, onRequestClose]);

  useEffect(() => {
    window.addEventListener('keydown', escHandler);
    return () => window.removeEventListener('keydown', escHandler);
  }, [escHandler]);

  if (!isOpen) return null;

  const tooShort = wallet.trim().length < MIN_LEN;
  const tooLong  = wallet.trim().length > MAX_LEN;

  const save = async () => {
    setError('');
    const w = wallet.trim();

    if (!w || tooShort || tooLong) {
      setError(`Адрес должен быть от ${MIN_LEN} до ${MAX_LEN} символов.`);
      return;
    }

    try {
      setSaving(true);
      await onSave(w);
    } catch (e) {
      const msg = String(e?.message || e);
      // Маппим типовые ответы бэка
      if (/not_eligible/.test(msg)) {
        setError('Недостаточно монет для привязки кошелька (нужно 100+).');
      } else if (/invalid_wallet/.test(msg)) {
        setError('Неверный формат кошелька. Попробуй другой.');
      } else if (/telegram_only/.test(msg)) {
        setError('Привязка доступна только внутри Telegram Mini App.');
      } else {
        setError('Не удалось сохранить. Повтори позже.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wm-backdrop" onClick={onRequestClose}>
      <div className="wm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="wm-close" onClick={onRequestClose} aria-label="Закрыть">×</button>

        <h2 className="wm-title">🎉 Поздравляем! 100+ монет набрано</h2>
        <p className="wm-subtitle">
          Введи адрес криптокошелька для будущих выплат. Его всегда можно изменить позже.
        </p>

        <label className="wm-label" htmlFor="wallet-input">Адрес кошелька</label>
        <input
          id="wallet-input"
          className="wm-input"
          placeholder="Например: 0x... или TON..."
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          disabled={saving}
          maxLength={MAX_LEN + 2}
        />

        {error && <div className="wm-error">{error}</div>}

        <div className="wm-actions">
          <button className="wm-btn wm-btn-secondary" onClick={onCancel} disabled={saving}>
            Потом
          </button>
          <button className="wm-btn wm-btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>

        <div className="wm-hint">
          Советы: копируй адрес из своего кошелька без пробелов. Поддержка форматов зависит от выплат.
        </div>
      </div>
    </div>
  );
}
