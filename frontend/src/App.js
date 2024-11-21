useEffect(() => {
  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.expand(); // Развернуть приложение на весь экран
    const user = tg.initDataUnsafe.user;
    setUser(user);
    console.log('Пользователь:', user);
    document.body.style.backgroundColor = tg.themeParams.bg_color || '#0f0f0f';
  }
}, []);
