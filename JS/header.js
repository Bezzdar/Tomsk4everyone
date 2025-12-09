// header.js
document.addEventListener('DOMContentLoaded', () => {
  const profileButton = document.querySelector('[data-auth-link]');
  if (!profileButton) return;

  // Получаем данные пользователя из localStorage
  const userData = JSON.parse(localStorage.getItem('user_data') || 'null');

  if (userData && userData.name) {
    // Пользователь залогинен — подменяем текст и ссылку
    profileButton.textContent = `Кабинет ${userData.name}`;
    profileButton.href = './profile.html';
    profileButton.classList.remove('login'); // на случай, если есть CSS для "Войти"
  } else {
    // Пользователь не залогинен — показываем "Войти"
    profileButton.textContent = 'Войти';
    profileButton.href = './auth.html';
  }

  // Обработчик выхода, если пользователь нажимает кнопку на странице профиля
  if (profileButton.textContent.startsWith('Кабинет')) {
    profileButton.addEventListener('click', (e) => {
      // Если хотим сделать выход при клике на кнопку в header, раскомментировать:
      // e.preventDefault();
      // if (confirm('Вы уверены, что хотите выйти?')) {
      //   localStorage.removeItem('user_data');
      //   window.location.href = './auth.html';
      // }
    });
  }
});
