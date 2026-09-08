(function() {
  function getStoredUser() {
    if (window.authHelper?.getUser) {
      return window.authHelper.getUser();
    }

    try {
      const token = localStorage.getItem('user_token');
      const rawUser = localStorage.getItem('user_data');
      return token && rawUser ? JSON.parse(rawUser) : null;
    } catch (error) {
      console.error('Не удалось прочитать пользовательскую сессию:', error);
      return null;
    }
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

  document.addEventListener('DOMContentLoaded', function() {
    const user = getStoredUser();
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

    applyLegacyHeroCompatibility();
  });
})();
