'use strict';

require('dotenv').config();
const { Telegraf } = require('telegraf');
const fsp = require('fs/promises');
const path = require('path');

// Ключи и базовый URL мини-приложения берутся из .env
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL;

// Список админов из .env (через запятую)
const ADMIN_IDS = process.env.ADMIN_IDS;
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Путь к JSON-базе бекэнда
const DB_PATH = path.join(__dirname, '..', 'backend', 'database.json');

// Резервный интервал, если потребуется плановый скан
const SCAN_INTERVAL_MS = Number(process.env.SCAN_INTERVAL_MS);

if (!BOT_TOKEN || !WEB_APP_URL) {
  console.error('Error: BOT_TOKEN or WEB_APP_URL is not set in the .env file!');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Утилиты/работа с БД
const values = obj => Object.values(obj || {}).filter(v => v && typeof v === 'object');
const isNumericId = id => /^\d+$/.test(String(id || ''));

async function ensureDbFile() {
  try {
    await fsp.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fsp.access(DB_PATH).catch(async () => {
      await fsp.writeFile(DB_PATH, '{}', 'utf8');
    });
  } catch (e) {
    console.error('ensureDbFile error:', e);
  }
}

async function readDb() {
  try {
    await ensureDbFile();
    const raw = await fsp.readFile(DB_PATH, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    console.error('DB read error:', e);
    return {};
  }
}

async function writeDb(db) {
  try {
    const tmp = DB_PATH + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
    await fsp.rename(tmp, DB_PATH); // атомарная замена файла
  } catch (e) {
    console.error('DB write error:', e);
  }
}

// Нормализуем пользователя и сохраняем ВСЕ типы кошельков (легаси + новые)
function normalizeUser(u) {
  const n = { ...u };
  n.user_id = String(n.user_id);
  n.username = typeof n.username === 'string' ? n.username : null;
  n.coins = Number.isFinite(n.coins) ? n.coins : 0;

  n.wallet = typeof n.wallet === 'string' && n.wallet.trim() ? n.wallet.trim() : null;
  n.wallet_updated_at = n.wallet_updated_at || null;

  n.wallet_420 = typeof n.wallet_420 === 'string' && n.wallet_420.trim() ? n.wallet_420.trim() : null;
  n.wallet_690 = typeof n.wallet_690 === 'string' && n.wallet_690.trim() ? n.wallet_690.trim() : null;
  n.wallet_1000 = typeof n.wallet_1000 === 'string' && n.wallet_1000.trim() ? n.wallet_1000.trim() : null;

  n.wallet_420_updated_at = n.wallet_420_updated_at || null;
  n.wallet_690_updated_at = n.wallet_690_updated_at || null;
  n.wallet_1000_updated_at = n.wallet_1000_updated_at || null;

  return n;
}

// Мидлвар для защиты админ-команд
const requireAdmin = (ctx, next) => {
  const userId = String(ctx.from.id);
  if (ADMIN_IDS.includes(userId)) return next();
  return ctx.reply('This command is available to admins only.');
};

// Команды
bot.start(async (ctx) => {
  const firstName = ctx.from.first_name || 'friend';
  const text =
    `👋 *Hi, ${firstName}! Welcome to Circle Drawing Game!* 🎨\n\n` +
    `Draw the most perfect circle you can, earn tokens, and compete with friends.\n\n` +
    `▶️ To get started, tap *Menu* or the clip icon (📎) and open our mini app.\n\n` +
    `📖 For help, use /help.`;

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: { remove_keyboard: true }
  });
});

bot.command('help', async (ctx) => {
  const userId = String(ctx.from.id);
  let helpText =
`📖 *Commands*

*/start* — Show the welcome message.
*/help* — Show this help.
`;

  if (ADMIN_IDS.includes(userId)) {
    helpText += `\n🔒 *Admin commands*\n` +
      `*/stats* — Get overall stats (wallet, wallet_420, wallet_690, wallet_1000).\n` +
      `*/wallets* — Export a CSV with all wallet columns.\n` +
      `*/settask3 <text>* — Set the text for "Task #3: Share on X".`;
  }

  await ctx.reply(helpText, { parse_mode: 'Markdown' });
});

// /settask3 формирует ссылку Twitter Intent с заданным текстом + ссылкой на мини-приложение
bot.command('settask3', requireAdmin, async (ctx) => {
  const postText = (ctx.message?.text || '').replace(/^\/settask3(@\w+)?/i, '').trim();
  if (!postText) {
    return ctx.reply(
      'Please provide the tweet text after the command.\n\n' +
      'Example:\n' +
      '/settask3 Join the best circle-drawing game!',
      { parse_mode: 'Markdown' }
    );
  }
  try {
    const appUrl = WEB_APP_URL;
    const qs = new URLSearchParams();
    qs.set('text', postText);
    qs.set('url', appUrl);
    const intentLink = `https://twitter.com/intent/tweet?${qs.toString()}`;

    const db = await readDb();
    db.__config = db.__config || {};
    db.__config.task3_link = intentLink;
    await writeDb(db);

    await ctx.reply(
      `✅ Link for "Task #3" (Share on X) updated.\n\n*Post text:*\n${postText}\n\n*Final link:*\n${intentLink}`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    console.error('settask3 error:', e);
    await ctx.reply('Failed to save the link.');
  }
});

// Админ-статистика
bot.command('stats', requireAdmin, async (ctx) => {
  try {
    const db = await readDb();
    const tgUsers = values(db)
      .map(normalizeUser)
      .filter(u => isNumericId(u.user_id));

    const total = tgUsers.length;
    if (total === 0) {
      return ctx.reply('📊 No users in the database yet.');
    }

    const withReferrer = tgUsers.filter(u => !!u.referrer_id).length;
    const totalReferralsMade = tgUsers.reduce((sum, u) => sum + (Array.isArray(u.referrals) ? u.referrals.length : 0), 0);

    const hasWallet420 = tgUsers.filter(u => !!u.wallet_420).length;
    const hasWallet690 = tgUsers.filter(u => !!u.wallet_690).length;
    const hasWallet1000 = tgUsers.filter(u => !!u.wallet_1000).length;

    const totalCoins = tgUsers.reduce((sum, u) => sum + (u.coins || 0), 0);
    const totalBestScore = tgUsers.reduce((sum, u) => sum + (u.best_score || 0), 0);

    // Защита от деления на ноль
    const avgCoins = total > 0 ? (totalCoins / total) : 0;
    const avgBestScore = total > 0 ? (totalBestScore / total) : 0;

    const msg =
`📊 *Game Stats*

👥 *Total users:* \`${total}\`
🔗 *Came via invite:* \`${withReferrer}\`

💰 *Average coins per player:* \`${avgCoins.toFixed(2)}\`
🏆 *Average best score:* \`${avgBestScore.toFixed(2)}\`

🟠 *Wallet 420 submitted:* \`${hasWallet420}\`
🟡 *Wallet 690 submitted:* \`${hasWallet690}\`
🟣 *Wallet 1000 submitted:* \`${hasWallet1000}\`
`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (e) {
    console.error('Error in /stats:', e);
    await ctx.reply('❌ Failed to retrieve stats.');
  }
});

// Экспорт CSV только по пользователям, у которых есть хотя бы один кошелек
bot.command('wallets', requireAdmin, async (ctx) => {
  try {
    const db = await readDb();
    const users = values(db)
      .map(normalizeUser)
      .filter(u => isNumericId(u.user_id));

    const usersWithAnyWallet = users.filter(u =>
      u.wallet || u.wallet_420 || u.wallet_690 || u.wallet_1000
    );

    if (usersWithAnyWallet.length === 0) {
      return ctx.reply('There are no users with wallets yet.');
    }

    const csvHeader = [
      'user_id',
      'username',
      'coins',
      'wallet_420',
      'wallet_420_updated_at',
      'wallet_690',
      'wallet_690_updated_at',
      'wallet_1000',
      'wallet_1000_updated_at'
    ].join(';');

    // JSON.stringify для безопасного экранирования значений в CSV
    const toCsv = (v) => JSON.stringify(v ?? '');

    const csvRows = usersWithAnyWallet.map(u =>
      [
        toCsv(u.user_id),
        toCsv(u.username || ''),
        (Number(u.coins) || 0).toFixed(2),
        toCsv(u.wallet_420),
        toCsv(u.wallet_420_updated_at),
        toCsv(u.wallet_690),
        toCsv(u.wallet_690_updated_at),
        toCsv(u.wallet_1000),
        toCsv(u.wallet_1000_updated_at)
      ].join(';')
    );
    const csvContent = [csvHeader, ...csvRows].join('\n');

    await ctx.replyWithDocument(
      { source: Buffer.from(csvContent, 'utf-8'), filename: 'wallets.csv' },
      { caption: `Total users with any wallet: ${usersWithAnyWallet.length}` }
    );
  } catch (e) {
    console.error('Error in /wallets:', e);
    await ctx.reply('Failed to generate CSV.');
  }
});

// Запуск бота и корректное завершение по сигналам
bot.launch();
console.log('Bot started: supports wallet_420 / wallet_690 / wallet_1000; CSV & stats updated; English UI enabled.');
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
