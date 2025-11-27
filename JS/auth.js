const API_BASE_URL = 'http://localhost:5000/api';

const STORAGE_KEY = 'tomsk4everyone_users';
const SESSION_KEY = 'tomsk4everyone_session';
const REMEMBER_KEY = 'tomsk4everyone_remembered_email';

const roleConfig = {
  user: {
    title: 'Пользователь',
    description: 'Изучает материалы платформы и может делиться собственными статьями.',
    actions: ['Просмотр и чтение статей', 'Публикация собственных материалов', 'Участие в обсуждениях и обратной связи'],
  },
  curator: {
    title: 'Куратор',
    description: 'Утверждает материалы авторов и следит за качеством контента.',
    actions: ['Модерация публикаций', 'Назначение тегов и направлений', 'Работа с жалобами пользователей'],
  },
  admin: {
    title: 'Администратор',
    description: 'Управляет всеми ресурсами платформы и правами пользователей.',
    actions: ['Настройка ролей и доступов', 'Управление партнёрскими программами', 'Просмотр аналитики и мониторинг системы'],
  },
};

// DOM элементы
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const feedback = document.getElementById('authFeedback');
const tabs = document.querySelectorAll('.tab-button');
const roleDashboard = document.getElementById('roleDashboard');
const roleDashboardTitle = document.getElementById('roleDashboardTitle');
const roleDashboardDescription = document.getElementById('roleDashboardDescription');
const roleDashboardActions = document.getElementById('roleDashboardActions');
const roleDashboardName = document.getElementById('roleDashboardName');
const roleDashboardEmail = document.getElementById('roleDashboardEmail');
const roleDashboardRole = document.getElementById('roleDashboardRole');
const logoutButton = document.getElementById('logout');
const adminPanelTrigger = document.getElementById('openAdminPanel');
const adminPanel = document.getElementById('adminPanel');
const adminPanelDialog = adminPanel?.querySelector('.admin-panel__dialog');
const adminSearchInput = document.getElementById('adminSearch');
const adminUsersList = document.getElementById('adminUsersList');
const adminEmptyState = document.getElementById('adminEmptyState');
const adminStats = document.getElementById('adminStats');
const loginEmailInput = document.getElementById('loginEmail');
const rememberMeCheckbox = document.getElementById('rememberMe');

let lastFocusedElement = null;

// Token management
const saveToken = (token) => {
  localStorage.setItem('auth_token', token);
};

const getToken = () => {
  return localStorage.getItem('auth_token');
};

const removeToken = () => {
  localStorage.removeItem('auth_token');
};

// API functions
const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Ошибка сервера');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Session management
const saveSession = (session) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const loadSession = () => {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (session && session.email) {
      return session;
    }
  } catch (error) {
    console.error('Ошибка чтения сессии:', error);
  }
  return null;
};

const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
  removeToken();
};

// UI functions
const showFeedback = (message, isError = false) => {
  if (!feedback) {
    return;
  }
  feedback.textContent = message;
  feedback.classList.toggle('error', isError);
};

const switchView = (view, { clearFeedback = true } = {}) => {
  console.log('Переключение на:', view);
  
  // Убрать активные классы
  tabs.forEach((tab) => {
    tab.classList.remove('active');
    tab.setAttribute('aria-selected', 'false');
  });
  
  [loginForm, registerForm].forEach((form) => {
    if (form) form.classList.remove('active');
  });
  
  // Добавить активные классы
  const activeTab = Array.from(tabs).find(tab => tab.dataset.view === view);
  const activeForm = document.getElementById(`${view}Form`);
  
  if (activeTab) {
    activeTab.classList.add('active');
    activeTab.setAttribute('aria-selected', 'true');
  }
  
  if (activeForm) {
    activeForm.classList.add('active');
  }
  
  if (clearFeedback) {
    showFeedback('');
  }
};

const toggleAuthForms = (isLoggedIn) => {
  console.log('Переключение режима авторизации:', isLoggedIn ? 'вошел' : 'не вошел');
  
  if (isLoggedIn) {
    // Пользователь вошел - скрываем все формы
    if (loginForm) loginForm.classList.remove('active');
    if (registerForm) registerForm.classList.remove('active');
    
    tabs.forEach((tab) => {
      tab.classList.remove('active');
      tab.setAttribute('aria-selected', 'false');
      tab.setAttribute('disabled', 'true');
    });
  } else {
    // Пользователь не вошел - показываем формы
    tabs.forEach((tab) => {
      tab.removeAttribute('disabled');
    });
    switchView('login', { clearFeedback: false });
  }
};

const renderRoleDashboard = (role, user) => {
  if (!roleDashboard) {
    return;
  }

  const config = roleConfig[role];
  if (!config) {
    roleDashboard.hidden = true;
    return;
  }

  roleDashboard.hidden = false;
  roleDashboardTitle.textContent = config.title;
  roleDashboardDescription.textContent = config.description;

  if (roleDashboardName) {
    roleDashboardName.textContent = user?.name ?? '—';
  }

  if (roleDashboardEmail) {
    roleDashboardEmail.textContent = user?.email ?? '—';
  }

  if (roleDashboardRole) {
    roleDashboardRole.textContent = config.title;
  }

  if (roleDashboardActions) {
    roleDashboardActions.innerHTML = '';
    config.actions.forEach((action) => {
      const li = document.createElement('li');
      li.textContent = action;
      roleDashboardActions.appendChild(li);
    });
  }

  if (adminPanelTrigger) {
    const isAdmin = role === 'admin';
    adminPanelTrigger.hidden = !isAdmin;
    adminPanelTrigger.setAttribute('aria-expanded', isAdmin && !adminPanel?.hidden ? 'true' : 'false');
  }
};

const applySession = (sessionUser) => {
  const isLoggedIn = Boolean(sessionUser);
  toggleAuthForms(isLoggedIn);

  if (isLoggedIn) {
    renderRoleDashboard(sessionUser.role, sessionUser);
  } else if (roleDashboard) {
    roleDashboard.hidden = true;
  }
};

const applyRememberedEmail = () => {
  if (!loginEmailInput || !rememberMeCheckbox) {
    return;
  }

  const rememberedEmail = localStorage.getItem(REMEMBER_KEY);
  if (rememberedEmail) {
    loginEmailInput.value = rememberedEmail;
    rememberMeCheckbox.checked = true;
  } else {
    loginEmailInput.value = '';
    rememberMeCheckbox.checked = false;
  }
};

// Auth handlers
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
    const data = await apiRequest('/login', {
      method: 'POST',
      body: { email, password }
    });

    saveToken(data.token);
    saveSession(data.user);
    
    if (rememberMeCheckbox?.checked) {
      localStorage.setItem(REMEMBER_KEY, email);
    } else {
      localStorage.removeItem(REMEMBER_KEY);
    }
    
    applySession(data.user);
    showFeedback(`Добро пожаловать, ${data.user.name}! Уровень доступа: ${roleConfig[data.user.role].title}.`);
  } catch (error) {
    showFeedback(error.message, true);
  }
};

const handleRegister = async (event) => {
  event.preventDefault();

  const formData = new FormData(registerForm);
  const name = formData.get('name')?.trim();
  const email = formData.get('email')?.trim().toLowerCase();
  const password = formData.get('password');
  const passwordConfirm = formData.get('passwordConfirm');
  const policyAccepted = document.getElementById('acceptPolicy')?.checked;

  if (!name || !email || !password || !passwordConfirm) {
    showFeedback('Заполните все обязательные поля.', true);
    return;
  }

  if (password.length < 6) {
    showFeedback('Пароль должен содержать не менее 6 символов.', true);
    return;
  }

  if (password !== passwordConfirm) {
    showFeedback('Пароли не совпадают.', true);
    return;
  }

  if (!policyAccepted) {
    showFeedback('Чтобы продолжить, подтвердите согласие с политикой конфиденциальности.', true);
    return;
  }

  try {
    const data = await apiRequest('/register', {
      method: 'POST',
      body: { name, email, password }
    });

    registerForm.reset();
    switchView('login');
    showFeedback('Аккаунт создан! Теперь можно войти с указанными данными.');
  } catch (error) {
    showFeedback(error.message, true);
  }
};

const handleLogout = () => {
  clearSession();
  closeAdminPanel();
  loginForm?.reset();
  registerForm?.reset();
  applyRememberedEmail();
  applySession(null);
  showFeedback('Вы вышли из аккаунта.');
};

// Admin panel functions
const renderAdminStats = (users) => {
  if (!adminStats) {
    return;
  }

  adminStats.innerHTML = '';

  if (!users.length) {
    const empty = document.createElement('span');
    empty.className = 'admin-panel__stat';
    empty.textContent = 'Пока нет пользователей';
    adminStats.appendChild(empty);
    return;
  }

  Object.entries(roleConfig).forEach(([role, config]) => {
    const count = users.filter((user) => user.role === role).length;
    const badge = document.createElement('span');
    badge.className = 'admin-panel__stat';
    badge.textContent = `${config.title}: ${count}`;
    adminStats.appendChild(badge);
  });
};

const createAdminUserItem = (user, sessionUser) => {
  const item = document.createElement('li');
  item.className = 'admin-panel__user';

  const header = document.createElement('div');
  header.className = 'admin-panel__user-header';

  const name = document.createElement('strong');
  name.textContent = user.name;

  const email = document.createElement('span');
  email.textContent = user.email;

  header.append(name, email);
  item.appendChild(header);

  const controls = document.createElement('div');
  controls.className = 'admin-panel__controls-inline';

  const badge = document.createElement('span');
  badge.className = 'admin-panel__badge';
  badge.textContent = roleConfig[user.role]?.title ?? user.role;

  if (sessionUser?.id === user.id) {
    badge.classList.add('admin-panel__badge--current');
    badge.textContent = `${badge.textContent} · вы`;
  }

  const roleSelect = document.createElement('select');
  roleSelect.className = 'admin-panel__role-select';
  roleSelect.setAttribute('aria-label', `Назначить роль для ${user.name}`);

  Object.entries(roleConfig).forEach(([role, config]) => {
    const option = document.createElement('option');
    option.value = role;
    option.textContent = config.title;
    roleSelect.appendChild(option);
  });

  roleSelect.value = user.role;
  roleSelect.addEventListener('change', (event) => {
    updateUserRole(user.id, event.target.value);
  });

  controls.append(badge, roleSelect);
  item.appendChild(controls);

  const description = document.createElement('p');
  description.className = 'admin-panel__user-description';
  description.textContent = roleConfig[user.role]?.description ?? '';
  item.appendChild(description);

  return item;
};

const renderAdminPanel = async (query = '') => {
  try {
    const data = await apiRequest('/admin/users');
    const users = data.users;

    // Фильтрация по запросу
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? users.filter(user => 
          user.name.toLowerCase().includes(normalizedQuery) || 
          user.email.toLowerCase().includes(normalizedQuery)
        )
      : users;

    // Отрисовка
    renderAdminStats(filtered);
    
    if (!filtered.length) {
      adminEmptyState?.removeAttribute('hidden');
      return;
    }

    adminEmptyState?.setAttribute('hidden', 'true');

    const sessionUser = loadSession();
    adminUsersList.innerHTML = '';

    filtered
      .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }))
      .forEach(user => {
        adminUsersList.appendChild(createAdminUserItem(user, sessionUser));
      });

  } catch (error) {
    showFeedback('Ошибка загрузки пользователей', true);
  }
};

const updateUserRole = async (userId, newRole) => {
  try {
    await apiRequest(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: { role: newRole }
    });

    // Обновите интерфейс
    const sessionUser = loadSession();
    if (sessionUser?.id === userId) {
      // Если обновили свою роль - перезагрузите данные
      const profileData = await apiRequest('/user/profile');
      saveSession(profileData.user);
      applySession(profileData.user);
    }

    // Перезагрузите админ-панель
    renderAdminPanel(adminSearchInput?.value ?? '');
    showFeedback(`Роль пользователя обновлена на «${roleConfig[newRole].title}».`);
  } catch (error) {
    showFeedback(error.message, true);
  }
};

const openAdminPanel = () => {
  const session = loadSession();
  if (!session || session.role !== 'admin') {
    showFeedback('Для доступа к панели администратора необходимы права администратора.', true);
    return;
  }

  lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  renderAdminPanel('');
  if (adminPanel) {
    adminPanel.hidden = false;
    adminPanel.setAttribute('aria-hidden', 'false');
  }
  adminPanelTrigger?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('modal-open');
  if (adminPanelDialog) {
    adminPanelDialog.focus({ preventScroll: true });
  }
  if (adminSearchInput) {
    adminSearchInput.value = '';
    setTimeout(() => adminSearchInput.focus(), 0);
  }
};

const closeAdminPanel = () => {
  if (!adminPanel || adminPanel.hidden) {
    return;
  }

  adminPanel.hidden = true;
  adminPanel.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  adminPanelTrigger?.setAttribute('aria-expanded', 'false');
  if (adminUsersList) {
    adminUsersList.innerHTML = '';
  }
  adminEmptyState?.setAttribute('hidden', 'true');
  if (lastFocusedElement?.isConnected) {
    lastFocusedElement.focus({ preventScroll: true });
  } else {
    adminPanelTrigger?.focus({ preventScroll: true });
  }
  lastFocusedElement = null;
};

// Migration from localStorage to API
const migrateToAPI = () => {
  const oldKeys = [
    'tomsk4everyone_users',
    'tomsk4everyone_session', 
    'tomsk4everyone_remembered_email'
  ];
  
  let migrated = false;
  oldKeys.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      migrated = true;
      console.log(`Удалены старые данные: ${key}`);
    }
  });
  
  if (migrated) {
    console.log('Миграция на API завершена. Старые данные удалены.');
    showFeedback('Система обновлена! Пожалуйста, войдите заново.');
  }
};

// Initialization
const init = () => {
  console.log('Инициализация приложения...');
  
  // Миграция с localStorage на API
  migrateToAPI();
  
  // Обработчики вкладок
  tabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      console.log('Клик по вкладке:', tab.dataset.view);
      
      if (tab.hasAttribute('disabled')) {
        console.log('Вкладка заблокирована');
        return;
      }
      
      switchView(tab.dataset.view);
    });
  });

  // Обработчики форм
  loginForm?.addEventListener('submit', handleLogin);
  registerForm?.addEventListener('submit', handleRegister);
  logoutButton?.addEventListener('click', handleLogout);

  // Админ-панель
  if (adminPanelTrigger) {
    adminPanelTrigger.addEventListener('click', openAdminPanel);
    adminPanelTrigger.setAttribute('aria-expanded', 'false');
  }

  if (adminPanel) {
    const closeElements = adminPanel.querySelectorAll('[data-admin-close]');
    for (let index = 0; index < closeElements.length; index += 1) {
      const element = closeElements[index];
      element.addEventListener('click', closeAdminPanel);
    }
  }

  adminSearchInput?.addEventListener('input', (event) => {
    renderAdminPanel(event.target.value);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !adminPanel?.hidden) {
      closeAdminPanel();
    }
  });

  // Инициализация
  applyRememberedEmail();

  const sessionUser = loadSession();
  if (sessionUser) {
    console.log('Найдена сессия:', sessionUser);
    applySession(sessionUser);
    showFeedback(`С возвращением, ${sessionUser.name}!`);
  } else {
    console.log('Сессия не найдена');
    applySession(null);
  }
  
  console.log('Инициализация завершена');
};

// Запуск приложения
init();