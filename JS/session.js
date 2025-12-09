(function() {
  document.addEventListener('DOMContentLoaded', function() {
    if (!window.authHelper) {
      console.error('Auth helper not loaded!');
      return;
    }

    console.log('=== SESSION MANAGER START ===');
    const user = authHelper.getUser();
    console.log('Session user:', user);

    document.querySelectorAll('[data-auth-link]').forEach(link => {
  const user = authHelper.getUser();
  if (user) {
    link.href = './HTML/profile.html';
    link.classList.add('logged-in');

    // Если есть картинка внутри
    const img = link.querySelector('img');
    if (img) {
      img.alt = `Профиль: ${user.name}`; // меняем alt, оставляем картинку
    } else {
      // для обычных ссылок без картинки меняем текст
      link.textContent = user.name || 'Профиль';
    }
  } else {
    link.href = './HTML/auth.html';
    link.classList.remove('logged-in');

    const img = link.querySelector('img');
    if (!img) link.textContent = 'Войти';
  }
});


    console.log('=== SESSION MANAGER END ===');
  });
})();
