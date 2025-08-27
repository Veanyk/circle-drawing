import React, { useEffect, useState, useCallback, useRef } from 'react';
import './WalletModal.css';

const MIN_LEN = 6;
const MAX_LEN = 120;

const SLOT_THRESHOLDS = { '420': 420, '690': 690, '1000': 1000 };
const normalizeSlot = (s) => (['420', '690', '1000'].includes(String(s)) ? String(s) : '420');

export default function WalletModal({
  isOpen,
  initialWallet,
  onSave,
  onCancel,
  onRequestClose,
  slot = '420',
  requiredCoins,
}) {
  const [wallet, setWallet] = useState(initialWallet || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const s = normalizeSlot(slot);
  const need = Number.isFinite(requiredCoins)
    ? Number(requiredCoins)
    : SLOT_THRESHOLDS[s];

  useEffect(() => {
    if (isOpen) {
      setWallet(initialWallet || '');
      setError('');
      setSaving(false);
      setTimeout(() => inputRef.current?.focus(), 0);
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
      setError(`Address must be between ${MIN_LEN} and ${MAX_LEN} characters.`);
      return;
    }

    try {
      setSaving(true);
      await onSave(w);
    } catch (e) {
      const msg = String(e?.message || e);
      if (/not_eligible/.test(msg)) {
        setError(`Not enough coins to link this wallet (need ${need}+).`);
      } else if (/invalid_wallet/.test(msg)) {
        setError('Invalid wallet format. Please try another one.');
      } else if (/telegram_only/.test(msg)) {
        setError('Linking is only available inside the Telegram Mini App.');
      } else {
        setError('Could not save. Please try again later.');
      }
    } finally {
      setSaving(false);
    }
  };

  const onInputKeyDown = (e) => {
    if (e.key === 'Enter' && !saving) {
      e.preventDefault();
      save();
    }
  };

  const slotName = s === '1000' ? 'Wallet #3' : s === '690' ? 'Wallet #2' : 'Wallet #1';

  return (
    <div className="wm-backdrop" onClick={onRequestClose}>
      <div
        className="wm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="wm-close" onClick={onRequestClose} aria-label="Close">×</button>

        <h2 id="wm-title" className="wm-title">
          🎉 Congrats! You’ve reached {need} coins
        </h2>

        <p className="wm-subtitle">
          {slotName} unlocks at <strong>{need}</strong> coins. Enter your crypto wallet address for future payouts.
          You can always change it later.
        </p>

        <label className="wm-label" htmlFor="wallet-input">Wallet address</label>
        <input
          id="wallet-input"
          ref={inputRef}
          className="wm-input"
          placeholder="e.g., 0x... or TON..."
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          onKeyDown={onInputKeyDown}
          disabled={saving}
          maxLength={MAX_LEN + 2}
          inputMode="text"
          autoComplete="off"
          spellCheck="false"
        />

        {error && <div className="wm-error" role="alert">{error}</div>}

        <div className="wm-actions">
          <button className="wm-btn wm-btn-secondary" onClick={onCancel} disabled={saving}>
            Later
          </button>
          <button className="wm-btn wm-btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div className="wm-hint">
          Tips: copy the address from your wallet without spaces. Supported formats depend on payouts.
        </div>
      </div>
    </div>
  );
}