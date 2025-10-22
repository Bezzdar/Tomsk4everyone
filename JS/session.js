(() => {
  const SESSION_KEY = 'tomsk4everyone_session';

  const readSession = () => {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (session && session.email) {
        return session;
      }
    } catch (error) {
      console.error('Ошибка чтения сессии пользователя:', error);
    }
    return null;
  };

  const session = readSession();
  const shortName = session?.name?.split(' ')[0] ?? session?.email ?? '';

  document.querySelectorAll('[data-auth-link]').forEach((link) => {
    const defaultUrl = link.dataset.authUrl || link.getAttribute('href') || './HTML/auth.html';
    const dashboardUrl = link.dataset.authDashboard || `${defaultUrl}#dashboard`;

    if (session) {
      link.setAttribute('href', dashboardUrl);
      if (!('authKeepContent' in link.dataset)) {
        const template = link.dataset.authTextLoggedIn ?? 'Кабинет {name}';
        link.textContent = template.replace('{name}', shortName);
      }
      link.classList.add('is-authenticated');
    } else {
      link.setAttribute('href', defaultUrl);
      if (!('authKeepContent' in link.dataset)) {
        const template = link.dataset.authTextLoggedOut ?? 'Войти';
        link.textContent = template;
      }
      link.classList.remove('is-authenticated');
    }
  });

  document.querySelectorAll('[data-show-when-auth]').forEach((element) => {
    element.hidden = !session;
  });

  document.querySelectorAll('[data-hide-when-auth]').forEach((element) => {
    element.hidden = Boolean(session);
  });
})();
