(function() {
  document.addEventListener('DOMContentLoaded', function() {
    if (!window.authHelper) return;

    const user = window.authHelper.getUser();
    const insideHtml = window.location.pathname.includes('/HTML/');
    const profileHref = insideHtml ? './profile.html' : './HTML/profile.html';
    const authHref = insideHtml ? './auth.html' : './HTML/auth.html';

    document.querySelectorAll('[data-auth-link]').forEach((link) => {
      if (user) {
        link.href = profileHref;
        link.classList.add('logged-in');
        const img = link.querySelector('img');
        if (img) img.alt = `Профиль: ${user.name || 'пользователь'}`;
        else link.textContent = user.name || 'Профиль';
      } else {
        link.href = authHref;
        link.classList.remove('logged-in');
        const img = link.querySelector('img');
        if (!img) link.textContent = 'Войти';
      }
    });
  });
})();
