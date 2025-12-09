// Простая проверка авторизации для всех страниц
(function() {
  console.log('=== AUTH CHECK START ===');

  const TOKEN_KEY = 'user_token';
  const USER_KEY = 'user_data';

  // Проверяем текущую страницу
  const currentPage = window.location.pathname;
  const isAuthPage = currentPage.includes('auth.html');
  const isProfilePage = currentPage.includes('profile.html');

  console.log('Current page:', currentPage);
  console.log('Is auth page:', isAuthPage);
  console.log('Is profile page:', isProfilePage);

  // Экспортируем helper, который всегда берёт актуальные данные
  window.authHelper = {
    isLoggedIn: () => !!(localStorage.getItem(TOKEN_KEY) && localStorage.getItem(USER_KEY)),
    getToken: () => localStorage.getItem(TOKEN_KEY),
    getUser: () => {
      try {
        const data = localStorage.getItem(USER_KEY);
        return data ? JSON.parse(data) : null;
      } catch (e) {
        console.error('Error parsing user data:', e);
        return null;
      }
    },
    saveAuthData: (token, user) => {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    clearAuthData: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  };

  // Редиректы
  if (isProfilePage && !authHelper.isLoggedIn()) {
    console.log('Not logged in on profile page, redirecting to auth');
    window.location.href = './auth.html';
    return;
  }

  if (isAuthPage && authHelper.isLoggedIn()) {
    console.log('Already logged in on auth page, redirecting to profile');
    window.location.href = './profile.html';
    return;
  }

  console.log('=== AUTH CHECK END ===');
})();
