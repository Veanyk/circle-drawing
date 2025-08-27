# Circle Drawing Game

An engaging and interactive mini-game built with **React** and integrated with the **Telegram WebApp API**.  
Players draw circles on a canvas to earn coins, complete tasks for rewards, invite friends via referrals, and unlock up to three wallets once they reach certain thresholds.  
The project demonstrates modern frontend development with React, backend communication via REST API, and deep Telegram integration.

---

## Live Demo

You can access the live version of this project inside Telegram by opening the bot:  
👉 [@circle_drawing_bot](https://t.me/circle_drawing_bot)

(Note: If the bot or server is under maintenance, please try again later.)

---

## Features

- **Circle Drawing Game**  
  Players draw a circle on a canvas. The accuracy of the drawing determines how many coins are earned.  

- **Attempts System**  
  Each drawing consumes 1 attempt. Attempts regenerate automatically every 1 minute until the maximum limit is reached.  

- **Wallet Management**  
  Three separate wallet slots are available:  
  - Wallet #1: unlocks at **420 coins**  
  - Wallet #2: unlocks at **690 coins**  
  - Wallet #3: unlocks at **1000 coins**  
  Users can add or edit wallets once thresholds are reached.  

- **Tasks & Rewards**  
  Complete special tasks to earn additional coins.  

- **Referral Program**  
  Invite friends using a referral link or Telegram `start_param`. Earn bonuses when they join.  

- **Leaderboards**  
  Track the top players ranked by total earned coins.  

- **Telegram WebApp Integration**  
  - Reads user info via `initDataUnsafe.user`  
  - Supports referral links via `start_param`  
  - Provides seamless in-Telegram experience.  

- **Browser Fallback**  
  Outside Telegram, the app generates a persistent local user ID using `localStorage`, ensuring full functionality.

---

## Tech Stack

- **Frontend**: React 18, CSS3  
- **Backend**: Node.js 20, Express 4 (REST API)  
- **Database**: File-based JSON storage (`database.json`) with atomic write operations  
- **Bot**: Telegraf (Telegram Bot API) – handles `/start`, `/help`, admin commands (`/stats`, `/wallets`, `/settask3`)  
- **Integrations**: Telegram WebApp API (initData, referrals, wallet prompts)  
- **Deployment**:  
  - Backend & Bot: Node.js processes (managed with PM2 or systemd)  
  - Reverse proxy: Nginx  
  - Frontend: Static build deployed on Vercel / Nginx  

### Key Libraries and APIs

- **Frontend**: React, Browser `localStorage`, AbortController (fetch with timeout/retries)  
- **Backend**: Express, CORS, Crypto (Telegram signature validation), FS/Promises (JSON DB)  
- **Bot**: Telegraf  
- **Integrations**: Telegram WebApp API (user auth, referrals, wallet modal prompts)  

---

## Project Structure
```
circle-drawing-game/
├── public/ # Static files (favicon, index.html, etc.)
├── src/
│ ├── App.js # Main application component
│ ├── App.css # Global styles
│ ├── assets/ # Images and icons
│ ├── components/ # UI components
│ │ ├── Canvas.js # Drawing game logic
│ │ ├── Result.js # Result screen after drawing
│ │ ├── Tasks.js # Task system UI
│ │ ├── Referrals.js # Referral system UI
│ │ ├── Leaderboards.js# Leaderboards page
│ │ ├── TabBar.js # Navigation tabs
│ │ ├── WalletModal.js # Wallet management modal
│ │ └── ...css # Styles for components
│ └── index.js # React entry point
├── package.json
└── README.md
```

---

## Local Development Setup

To run this project locally, follow these steps:

### 1. Clone the repository
```bash
git clone https://github.com/your-username/circle-drawing-game.git
cd circle-drawing-game
```
2. Install dependencies
```bash

npm install
```
3. Create environment variables
Create a .env file in the root:

```bash
# Backend API
REACT_APP_SERVER_URL=http://localhost:8000

# Telegram bot username
REACT_APP_BOT_USERNAME=circle_drawing_bot
```

4. Start the development server
```bash
npm start
```

The app will be available at http://localhost:3000.

## Key Code Highlights
### Fetch with Timeout & Retries
The project includes a universal wrapper for safe API requests:
```bash
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
```

### Attempts Regeneration
Attempts regenerate automatically every minute until the max is reached:
```bash
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
}, 1000);
```
### Wallet Threshold Modals
When a player crosses a coin threshold, a modal is prompted automatically:

```bash
if (nextCoins >= WALLET1_THRESHOLD && !wallet420) {
  openCreateWalletModal('420');
} else if (nextCoins >= WALLET2_THRESHOLD && !wallet690) {
  openCreateWalletModal('690');
} else if (nextCoins >= WALLET3_THRESHOLD && !wallet1000) {
  openCreateWalletModal('1000');
}
```
### Deployment

- **Frontend**: deployed as a static React app (e.g., Netlify, Vercel, or served by Nginx).  
- **Backend**: Node.js + Express server that provides REST API endpoints  
  (`/getUserData`, `/updateUserData`, `/setWallet`, `/acceptReferral`).  
- **Bot**: Telegraf-based Telegram bot for onboarding and admin commands.  
- **Telegram Integration**: add the app URL in BotFather under *WebApp configuration*.  

### Contact
Created by Veanyk – feel free to reach out!