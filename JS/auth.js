document.addEventListener('DOMContentLoaded', () => {
  const BASE_URL = 'http://127.0.0.1:5000'; // <-- порт Flask

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const feedback = document.getElementById('authFeedback');

  const showFeedback = (message, isError = false) => {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.toggle('error', isError);
  };

  // Универсальная функция для API-запроса
  const apiRequest = async (url, options = {}) => {
    const fetchOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    };

    try {
      const response = await fetch(url, fetchOptions);
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      if (!response.ok) {
        throw new Error(data?.message || data || 'Ошибка запроса');
      }

      return data;
    } catch (err) {
      console.error('API request failed:', err);
      throw err;
    }
  };

  // Обработчик логина
  const handleLogin = async (event) => {
    event.preventDefault();

    const formData = new FormData(loginForm);
    const email = formData.get('email')?.trim().toLowerCase();
    const password = formData.get('password');

    if (!email || !password) {
      showFeedback('Введите email и пароль.', true);
      return;
    }

    try {
      showFeedback('Входим...', false);

      const data = await apiRequest(`${BASE_URL}/api/login`, {
        method: 'POST',
        body: { email, password },
      });

      if (!data?.token || !data?.user) {
        throw new Error('Некорректный ответ сервера');
      }

      // Сохраняем данные
      localStorage.setItem('user_token', data.token);
      localStorage.setItem('user_data', JSON.stringify(data.user));
      localStorage.setItem('tomsk4everyone_token', data.token);
      localStorage.setItem('tomsk4everyone_session', JSON.stringify(data.user));

      showFeedback(`Добро пожаловать, ${data.user.name}!`, false);

      // Перенаправление на профиль
      setTimeout(() => {
        window.location.href = './profile.html';
      }, 1000);
    } catch (error) {
      console.error('Login error:', error);
      showFeedback(error.message || 'Ошибка при входе', true);
    }
  };

  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  // Обработчик регистрации
  const handleRegister = async (event) => {
    event.preventDefault();

    const formData = new FormData(registerForm);
    const name = formData.get('name')?.trim();
    const email = formData.get('email')?.trim().toLowerCase();
    const password = formData.get('password');
    const passwordConfirm = formData.get('passwordConfirm');
    const acceptPolicy = formData.get('acceptPolicy');

    if (!name || !email || !password || !passwordConfirm) {
      showFeedback('Заполните все поля.', true);
      return;
    }

    if (password !== passwordConfirm) {
      showFeedback('Пароли не совпадают.', true);
      return;
    }

    if (!acceptPolicy) {
      showFeedback('Примите политику конфиденциальности.', true);
      return;
    }

    try {
      showFeedback('Регистрируем...', false);

      const data = await apiRequest(`${BASE_URL}/api/register`, {
        method: 'POST',
        body: { name, email, password },
      });

      showFeedback('Регистрация прошла успешно! Войдите в аккаунт.', false);
      registerForm.reset();
      document.querySelector('.tab-button[data-view="login"]').click();
    } catch (error) {
      console.error('Register error:', error);
      showFeedback(error.message || 'Ошибка при регистрации', true);
    }
  };

  if (registerForm) registerForm.addEventListener('submit', handleRegister);
});
