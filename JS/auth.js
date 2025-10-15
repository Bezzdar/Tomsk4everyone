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

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const feedback = document.getElementById('authFeedback');
const tabs = document.querySelectorAll('.tab-button');
const roleList = document.getElementById('roleList');
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

const loadUsers = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch (error) {
    console.error('Ошибка чтения пользователей:', error);
    return [];
  }
};

const saveUsers = (users) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
};

const normalizeRole = (role) => (roleConfig[role] ? role : 'user');

const normalizeUser = (user) => ({
  name: user.name || user.email,
  email: user.email,
  role: normalizeRole(user.role),
});

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

const saveSession = (session) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

const syncSessionWithUsers = () => {
  const session = loadSession();
  if (!session) {
    return null;
  }

  const users = loadUsers();
  const storedUser = users.find((item) => item.email === session.email);
  if (!storedUser) {
    clearSession();
    return null;
  }

  const normalizedUser = normalizeUser(storedUser);
  saveSession(normalizedUser);
  return normalizedUser;
};

const showFeedback = (message, isError = false) => {
  if (!feedback) {
    return;
  }
  feedback.textContent = message;
  feedback.classList.toggle('error', isError);
};

const switchView = (view, { clearFeedback = true } = {}) => {
  tabs.forEach((tab) => {
    const isActive = tab.dataset.view === view;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  [loginForm, registerForm].forEach((form) => {
    if (form) {
      form.classList.toggle('active', form.id === `${view}Form`);
    }
  });

  if (clearFeedback) {
    showFeedback('');
  }
};

const toggleAuthForms = (isLoggedIn) => {
  if (!loginForm || !registerForm) {
    return;
  }

  if (isLoggedIn) {
    loginForm.classList.remove('active');
    registerForm.classList.remove('active');
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    tabs.forEach((tab) => {
      tab.classList.remove('active');
      tab.setAttribute('aria-selected', 'false');
      tab.setAttribute('disabled', 'true');
    });
  } else {
    loginForm.classList.remove('hidden');
    registerForm.classList.remove('hidden');
    tabs.forEach((tab) => {
      tab.removeAttribute('disabled');
    });
    switchView('login', { clearFeedback: false });
  }
};

const renderRoles = () => {
  if (!roleList) {
    return;
  }

  const fragment = document.createDocumentFragment();

  Object.entries(roleConfig).forEach(([role, { title, description }]) => {
    const item = document.createElement('li');
    item.innerHTML = `<strong>${title}</strong><span>${description}</span>`;
    fragment.appendChild(item);
  });

  roleList.appendChild(fragment);
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

const handleLogin = (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const email = formData.get('email')?.trim().toLowerCase();
  const password = formData.get('password');

  if (!email || !password) {
    showFeedback('Введите email и пароль.', true);
    return;
  }

  const users = loadUsers();
  const user = users.find((item) => item.email === email);

  if (!user || user.password !== password) {
    showFeedback('Неверная пара логина и пароля.', true);
    return;
  }

  const normalizedUser = normalizeUser(user);

  if (rememberMeCheckbox?.checked) {
    localStorage.setItem(REMEMBER_KEY, email);
  } else {
    localStorage.removeItem(REMEMBER_KEY);
  }

  saveSession(normalizedUser);
  applySession(normalizedUser);
  showFeedback(`Добро пожаловать, ${normalizedUser.name}! Уровень доступа: ${roleConfig[normalizedUser.role].title}.`);
};

const handleRegister = (event) => {
  event.preventDefault();

  const formData = new FormData(registerForm);
  const name = formData.get('name')?.trim();
  const email = formData.get('email')?.trim().toLowerCase();
  const password = formData.get('password');
  const passwordConfirm = formData.get('passwordConfirm');
  const role = normalizeRole(formData.get('role'));
  const policyAccepted = document.getElementById('acceptPolicy')?.checked;

  if (!name || !email || !password || !passwordConfirm || !role) {
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

  const users = loadUsers();
  const userExists = users.some((item) => item.email === email);

  if (userExists) {
    showFeedback('Пользователь с таким email уже зарегистрирован.', true);
    return;
  }

  const newUser = { name, email, password, role };
  users.push(newUser);
  saveUsers(users);

  registerForm.reset();
  switchView('login');
  showFeedback('Аккаунт создан! Теперь можно войти с указанными данными.');

  if (adminPanel && !adminPanel.hidden) {
    renderAdminPanel(adminSearchInput?.value ?? '');
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

const getNormalizedUsers = () => loadUsers().map((user) => ({ ...user, role: normalizeRole(user.role) }));

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

  if (sessionUser?.email === user.email) {
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
    updateUserRole(user.email, event.target.value);
  });

  controls.append(badge, roleSelect);
  item.appendChild(controls);

  const description = document.createElement('p');
  description.className = 'admin-panel__user-description';
  description.textContent = roleConfig[user.role]?.description ?? '';
  item.appendChild(description);

  return item;
};

const renderAdminPanel = (query = '') => {
  if (!adminUsersList) {
    return;
  }

  const users = getNormalizedUsers();
  renderAdminStats(users);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? users.filter((user) => user.name.toLowerCase().includes(normalizedQuery) || user.email.toLowerCase().includes(normalizedQuery))
    : users;

  adminUsersList.innerHTML = '';

  if (!filtered.length) {
    adminEmptyState?.removeAttribute('hidden');
    return;
  }

  adminEmptyState?.setAttribute('hidden', 'true');

  const sessionUser = loadSession();

  filtered
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }))
    .forEach((user) => {
      adminUsersList.appendChild(createAdminUserItem(user, sessionUser));
    });
};

const updateUserRole = (email, newRole) => {
  const normalizedRole = normalizeRole(newRole);
  const users = loadUsers();
  const index = users.findIndex((item) => item.email === email);

  if (index === -1) {
    return;
  }

  users[index].role = normalizedRole;
  saveUsers(users);

  const updatedUser = normalizeUser(users[index]);
  const session = loadSession();

  if (session?.email === email) {
    saveSession(updatedUser);
    applySession(updatedUser);
    showFeedback(`Ваш уровень доступа обновлён на «${roleConfig[normalizedRole].title}».`);
  } else {
    if (session) {
      const storedSessionUser = users.find((item) => item.email === session.email);
      if (storedSessionUser) {
        const normalizedSession = normalizeUser(storedSessionUser);
        saveSession(normalizedSession);
        applySession(normalizedSession);
      }
    }
    showFeedback(`Роль пользователя ${updatedUser.name} обновлена на «${roleConfig[normalizedRole].title}».`);
  }

  renderAdminPanel(adminSearchInput?.value ?? '');
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

const init = () => {
  renderRoles();

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.hasAttribute('disabled')) {
        return;
      }
      switchView(tab.dataset.view);
    });
  });

  loginForm?.addEventListener('submit', handleLogin);
  registerForm?.addEventListener('submit', handleRegister);
  logoutButton?.addEventListener('click', handleLogout);

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

  applyRememberedEmail();

  const sessionUser = syncSessionWithUsers();
  if (sessionUser) {
    applySession(sessionUser);
    showFeedback(`С возвращением, ${sessionUser.name}!`);
  } else {
    applySession(null);
  }
};

init();
