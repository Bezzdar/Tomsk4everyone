(function() {
  'use strict';

  const TOKEN_KEY = 'user_token';
  const USER_KEY = 'user_data';
  const LEGACY_SESSION_KEY = 'tomsk4everyone_session';
  const API_BASE = window.APP_CONFIG?.API_BASE || '/api';
  let refreshPromise = null;
  let lastRefreshAt = 0;

  function getStoredUser() {
    if (window.authHelper?.getUser) {
      return window.authHelper.getUser();
    }

    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const rawUser = localStorage.getItem(USER_KEY);
      return token && rawUser ? JSON.parse(rawUser) : null;
    } catch (error) {
      console.error('Не удалось прочитать пользовательскую сессию:', error);
      return null;
    }
  }

  function getToken() {
    return window.authHelper?.getToken?.() || localStorage.getItem(TOKEN_KEY);
  }

  function storeUser(user) {
    if (!user) return;
    if (window.authHelper?.updateUser) {
      window.authHelper.updateUser(user);
      return;
    }
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify(user));
  }

  function clearStoredSession() {
    if (window.authHelper?.clearAuthData) {
      window.authHelper.clearAuthData();
      return;
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('tomsk4everyone_token');
    localStorage.removeItem(LEGACY_SESSION_KEY);
  }

  function applyAuthLinks(user) {
    const insideHtml = window.location.pathname.includes('/HTML/');
    const profileHref = insideHtml ? './profile.html' : './HTML/profile.html';
    const authHref = insideHtml ? './auth.html' : './HTML/auth.html';

    document.querySelectorAll('[data-auth-link]').forEach((link) => {
      if (user) {
        link.href = profileHref;
        link.classList.add('logged-in');
        const img = link.querySelector('img');
        if (img) {
          img.alt = `Профиль: ${user.name || 'пользователь'}`;
        } else {
          link.textContent = user.name || 'Профиль';
        }
      } else {
        link.href = authHref;
        link.classList.remove('logged-in');
        const img = link.querySelector('img');
        if (!img) link.textContent = 'Войти';
      }
    });
  }

  function applyProfileState(user) {
    if (!user) return;
    const balance = document.querySelector('[data-profile-balance]');
    if (balance) balance.textContent = Number(user.balance || 0);
    const tasks = document.querySelector('[data-profile-tasks-count]');
    if (tasks) tasks.textContent = Array.isArray(user.completedTasks) ? user.completedTasks.length : 0;
  }

  function emitUserUpdated(user) {
    document.dispatchEvent(new CustomEvent('auth:user-updated', { detail: { user } }));
    document.dispatchEvent(new CustomEvent('profilestore:update', { detail: { user } }));
  }

  async function refreshUserFromServer(force = false) {
    const token = getToken();
    if (!token) {
      applyAuthLinks(null);
      return null;
    }

    const now = Date.now();
    if (!force && now - lastRefreshAt < 2000) return getStoredUser();
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE}/user/profile`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });

        if (response.status === 401) {
          clearStoredSession();
          applyAuthLinks(null);
          emitUserUpdated(null);
          return null;
        }
        if (!response.ok) return getStoredUser();

        const payload = await response.json();
        const user = payload.user || null;
        if (user) {
          storeUser(user);
          applyAuthLinks(user);
          applyProfileState(user);
          emitUserUpdated(user);
        }
        lastRefreshAt = Date.now();
        return user;
      } catch (error) {
        console.warn('Не удалось синхронизировать пользовательскую сессию:', error);
        return getStoredUser();
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  function applyLegacyHeroCompatibility() {
    if (!document.querySelector('.hero-banner')) return;
    if (document.getElementById('legacy-hero-compat')) return;

    const style = document.createElement('style');
    style.id = 'legacy-hero-compat';
    style.textContent = `
      .hero-banner {
        padding: 0 !important;
        display: block !important;
        border-bottom: 0 !important;
      }
      .hero-banner .navBar {
        flex-wrap: nowrap !important;
        gap: 0 !important;
      }
      .hero-banner > img {
        width: 100% !important;
        max-width: 100% !important;
      }
      @media (min-width: 769px) {
        .hero-banner .mobile-user { display: none !important; }
      }
      @media (max-width: 768px) {
        .hero-banner .desktop-user { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function initializeSessionUi() {
    const user = getStoredUser();
    applyAuthLinks(user);
    applyProfileState(user);
    applyLegacyHeroCompatibility();
    refreshUserFromServer(true);

    window.addEventListener('focus', () => refreshUserFromServer());
    window.addEventListener('pageshow', () => refreshUserFromServer());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshUserFromServer();
    });

    if (document.querySelector('[data-profile-content]')) {
      window.setInterval(() => refreshUserFromServer(), 10000);
    }
  }

  window.tomskSession = {
    refresh: () => refreshUserFromServer(true),
    applyAuthLinks,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSessionUi, { once: true });
  } else {
    initializeSessionUi();
  }
})();
