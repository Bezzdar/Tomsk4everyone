(function() {
  const TOKEN_KEY = 'user_token';
  const USER_KEY = 'user_data';
  const LEGACY_SESSION_KEY = 'tomsk4everyone_session';

  const currentPage = window.location.pathname;
  const isAuthPage = currentPage.includes('auth.html');
  const isProfilePage = currentPage.includes('profile.html');

  const parseUser = () => {
    try {
      const data = localStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Не удалось прочитать данные пользователя:', error);
      return null;
    }
  };

  const syncLegacySession = (user) => {
    if (user) {
      localStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LEGACY_SESSION_KEY);
    }
  };

  window.authHelper = {
    isLoggedIn: () => Boolean(localStorage.getItem(TOKEN_KEY) && parseUser()),
    getToken: () => localStorage.getItem(TOKEN_KEY),
    getUser: parseUser,
    saveAuthData: (token, user) => {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      syncLegacySession(user);
    },
    updateUser: (user) => {
      if (!user) return;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      syncLegacySession(user);
    },
    clearAuthData: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem('tomsk4everyone_token');
      localStorage.removeItem(LEGACY_SESSION_KEY);
    },
    handleUnauthorized: (response) => {
      if (response?.status !== 401) return false;
      window.authHelper.clearAuthData();
      if (!window.location.pathname.includes('auth.html')) {
        const prefix = window.location.pathname.includes('/HTML/') ? './' : './HTML/';
        window.location.href = `${prefix}auth.html`;
      }
      return true;
    },
  };

  if (window.authHelper.isLoggedIn()) {
    syncLegacySession(window.authHelper.getUser());
  }

  if (isProfilePage && !window.authHelper.isLoggedIn()) {
    window.location.href = './auth.html';
    return;
  }

  if (isAuthPage && window.authHelper.isLoggedIn()) {
    window.location.href = './profile.html';
  }
})();
