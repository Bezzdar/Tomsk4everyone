document.addEventListener('DOMContentLoaded', () => {
  const API_BASE = window.APP_CONFIG?.API_BASE || 'http://46.17.102.10:5000/api';

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const feedback = document.getElementById('authFeedback');


  const tabButtons = document.querySelectorAll('.tab-button');
  const forms = document.querySelectorAll('.auth-form');
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.view;
      tabButtons.forEach((btn) => btn.classList.toggle('active', btn === button));
      forms.forEach((form) => form.classList.toggle('active', form.id === `${view}Form`));
    });
  });

  const showFeedback = (message, isError = false) => {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.toggle('error', isError);
  };

  const apiRequest = async (path, options = {}) => {
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Ошибка запроса');
    }
    return payload;
  };

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(loginForm);
      const email = formData.get('email')?.trim().toLowerCase();
      const password = formData.get('password');

      if (!email || !password) {
        showFeedback('Введите email и пароль.', true);
        return;
      }

      try {
        showFeedback('Входим...');
        const data = await apiRequest('/login', { method: 'POST', body: { email, password } });
        authHelper.saveAuthData(data.token, data.user);
        localStorage.setItem('tomsk4everyone_token', data.token);
        localStorage.setItem('tomsk4everyone_session', JSON.stringify(data.user));

        showFeedback(`Добро пожаловать, ${data.user.name}!`);
        setTimeout(() => { window.location.href = './profile.html'; }, 700);
      } catch (error) {
        showFeedback(error.message || 'Ошибка при входе', true);
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const formData = new FormData(registerForm);
      const name = formData.get('name')?.trim();
      const email = formData.get('email')?.trim().toLowerCase();
      const password = formData.get('password');
      const passwordConfirm = formData.get('passwordConfirm');
      const acceptPolicy = document.getElementById('acceptPolicy')?.checked;

      if (!name || !email || !password || !passwordConfirm) return showFeedback('Заполните все поля.', true);
      if (password !== passwordConfirm) return showFeedback('Пароли не совпадают.', true);
      if (!acceptPolicy) return showFeedback('Примите политику конфиденциальности.', true);

      try {
        showFeedback('Регистрируем...');
        await apiRequest('/register', { method: 'POST', body: { name, email, password } });
        showFeedback('Регистрация прошла успешно! Теперь войдите в аккаунт.');
        registerForm.reset();
        document.querySelector('.tab-button[data-view="login"]')?.click();
      } catch (error) {
        showFeedback(error.message || 'Ошибка при регистрации', true);
      }
    });
  }
});
