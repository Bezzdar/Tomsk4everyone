(() => {
  const store = window.ProfileStore;
  const content = document.querySelector('[data-profile-content]');
  const emptyState = document.querySelector('[data-profile-empty]');

  if (!content || !emptyState) {
    return;
  }

  if (!store) {
    content.hidden = true;
    emptyState.hidden = false;
    return;
  }

  const STORAGE_KEY = 'tomsk4everyone_users';
  const SESSION_KEY = 'tomsk4everyone_session';

  const roleConfig = {
    user: {
      title: 'Пользователь',
      description: 'Изучает материалы платформы и может делиться собственными статьями.',
    },
    curator: {
      title: 'Куратор',
      description: 'Утверждает материалы авторов и следит за качеством контента.',
    },
    admin: {
      title: 'Администратор',
      description: 'Управляет ресурсами платформы и доступами пользователей.',
    },
  };

  const roleLabels = Object.fromEntries(
    Object.entries(roleConfig).map(([role, config]) => [role, config.title]),
  );

  const defaultAvatar = '../Sourse/Icons/userIco.png';
  const tasksData = store.getTaskDefinitions ? store.getTaskDefinitions() : {};
  store.sync?.();

  const adminPanelTrigger = document.getElementById('openAdminPanel');
  const adminPanel = document.getElementById('adminPanel');
  const adminPanelDialog = adminPanel?.querySelector('.admin-panel__dialog');
  const adminSearchInput = document.getElementById('adminSearch');
  const adminUsersList = document.getElementById('adminUsersList');
  const adminEmptyState = document.getElementById('adminEmptyState');
  const adminStats = document.getElementById('adminStats');

  let lastFocusedElement = null;

  function closeAdminPanel() {
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

    if (
      lastFocusedElement?.isConnected &&
      (!(lastFocusedElement instanceof HTMLElement) || !lastFocusedElement.hidden)
    ) {
      lastFocusedElement.focus({ preventScroll: true });
    } else if (adminPanelTrigger && !adminPanelTrigger.hidden) {
      adminPanelTrigger.focus({ preventScroll: true });
    }

    lastFocusedElement = null;
  }

  const avatarImage = content.querySelector('[data-profile-avatar-image]');
  const avatarInput = content.querySelector('[data-profile-avatar-input]');
  const nameForm = content.querySelector('[data-profile-name-form]');
  const nameInput = content.querySelector('[data-profile-name]');
  const emailElement = content.querySelector('[data-profile-email]');
  const roleElement = content.querySelector('[data-profile-role]');
  const tasksCountElement = content.querySelector('[data-profile-tasks-count]');
  const articlesCountElement = content.querySelector('[data-profile-articles-count]');
  const taskListElement = content.querySelector('[data-profile-task-list]');
  const articleListElement = content.querySelector('[data-profile-article-list]');
  const articleForm = content.querySelector('[data-article-form]');
  const feedbackElement = content.querySelector('[data-profile-feedback]');
  const logoutButton = content.querySelector('[data-profile-logout]');

  const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const safeJsonParse = (value, fallback) => {
    try {
      return JSON.parse(value ?? '');
    } catch (error) {
      console.error('Ошибка чтения данных администратора:', error);
      return fallback;
    }
  };

  const loadUsers = () => safeJsonParse(localStorage.getItem(STORAGE_KEY), []);
  const saveUsers = (users) => localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  const loadSession = () => safeJsonParse(localStorage.getItem(SESSION_KEY), null);
  const saveSession = (session) => localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  const normalizeRole = (role) => (roleConfig[role] ? role : 'user');

  const normalizeArticles = (articles) => {
    if (!Array.isArray(articles)) {
      return [];
    }

    return articles
      .map((article, index) => {
        if (!article) {
          return null;
        }

        if (typeof article === 'string') {
          const title = article.trim();
          if (!title) {
            return null;
          }

          return {
            id: `article-${index}`,
            title,
            link: '',
            createdAt: new Date().toISOString(),
          };
        }

        if (typeof article === 'object') {
          const title = typeof article.title === 'string' ? article.title.trim() : '';
          if (!title) {
            return null;
          }

          return {
            id: typeof article.id === 'string' && article.id.trim() ? article.id : `article-${index}`,
            title,
            link: typeof article.link === 'string' ? article.link : '',
            createdAt:
              typeof article.createdAt === 'string' && article.createdAt
                ? article.createdAt
                : new Date().toISOString(),
          };
        }

        return null;
      })
      .filter(Boolean);
  };

  const applyUserDefaults = (user) => {
    const normalized = { ...user };
    normalized.name =
      typeof normalized.name === 'string' && normalized.name.trim()
        ? normalized.name.trim()
        : normalized.email;
    normalized.email = typeof normalized.email === 'string' ? normalized.email.trim().toLowerCase() : '';
    normalized.role = normalizeRole(normalized.role);
    normalized.avatar = typeof normalized.avatar === 'string' ? normalized.avatar : '';
    if (!Array.isArray(normalized.completedTasks)) {
      normalized.completedTasks = [];
    }
    normalized.completedTasks = Array.from(
      new Set(normalized.completedTasks.filter((taskId) => typeof taskId === 'string')),
    );
    normalized.articles = normalizeArticles(normalized.articles);
    return normalized;
  };

  const normalizeUser = (user) => {
    const normalized = applyUserDefaults(user);
    return {
      name: normalized.name || normalized.email,
      email: normalized.email,
      role: normalized.role,
      avatar: normalized.avatar,
      completedTasks: normalized.completedTasks,
      articles: normalized.articles,
    };
  };

  const getNormalizedUsers = () => loadUsers().map(applyUserDefaults);

  const setFeedback = (message, isError = false) => {
    if (!feedbackElement) {
      return;
    }

    if (!message) {
      feedbackElement.textContent = '';
      feedbackElement.removeAttribute('data-state');
      return;
    }

    feedbackElement.textContent = message;
    feedbackElement.setAttribute('data-state', isError ? 'error' : 'success');
  };

  const renderTasks = (user) => {
    if (!taskListElement) {
      return;
    }

    taskListElement.innerHTML = '';

    const entries = Object.entries(tasksData);
    if (!entries.length) {
      const placeholder = document.createElement('li');
      placeholder.className = 'profile-task profile-task--empty';
      placeholder.textContent = 'Список заданий пока пуст.';
      taskListElement.appendChild(placeholder);
      return;
    }

    const completedIds = new Set(Array.isArray(user?.completedTasks) ? user.completedTasks : []);

    entries.forEach(([taskId, task]) => {
      const item = document.createElement('li');
      item.className = 'profile-task';

      const isCompleted = completedIds.has(taskId);
      if (isCompleted) {
        item.classList.add('profile-task--done');
      }

      const title = document.createElement('p');
      title.className = 'profile-task__title';
      title.textContent = task.title;

      const description = document.createElement('p');
      description.className = 'profile-task__meta';
      const details = [];
      if (task.description) {
        details.push(task.description);
      }
      if (typeof task.points === 'number') {
        details.push(`${task.points} баллов`);
      }
      description.textContent = details.join(' · ');

      const actions = document.createElement('div');
      actions.className = 'profile-task__actions';

      const link = document.createElement('a');
      link.className = 'profile-task__link';
      link.href = task.link;
      link.textContent = 'Открыть задание';

      const status = document.createElement('span');
      status.className = 'profile-task__status';
      status.textContent = isCompleted ? 'Выполнено' : 'В ожидании';

      actions.append(link, status);
      item.append(title, description, actions);
      taskListElement.appendChild(item);
    });
  };

  const renderArticles = (user) => {
    if (!articleListElement) {
      return;
    }

    articleListElement.innerHTML = '';
    const articles = Array.isArray(user?.articles) ? [...user.articles] : [];

    if (!articles.length) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'profile-article profile-article--empty';
      emptyItem.textContent = 'Вы ещё не добавили материалы.';
      articleListElement.appendChild(emptyItem);
      return;
    }

    articles
      .sort((a, b) => {
        const dateA = a?.createdAt ? Date.parse(a.createdAt) : 0;
        const dateB = b?.createdAt ? Date.parse(b.createdAt) : 0;
        return dateB - dateA;
      })
      .forEach((article) => {
        const item = document.createElement('li');
        item.className = 'profile-article';

        const header = document.createElement('div');
        header.className = 'profile-article__header';

        const title = document.createElement('h3');
        title.className = 'profile-article__title';
        title.textContent = article.title;
        header.appendChild(title);

        if (article.link) {
          const link = document.createElement('a');
          link.className = 'profile-article__link';
          link.href = article.link;
          link.target = '_blank';
          link.rel = 'noopener';
          link.textContent = 'Открыть';
          header.appendChild(link);
        }

        const meta = document.createElement('p');
        meta.className = 'profile-article__meta';
        if (article.createdAt) {
          try {
            meta.textContent = `Добавлено ${dateFormatter.format(new Date(article.createdAt))}`;
          } catch (error) {
            meta.textContent = 'Дата добавления неизвестна';
          }
        } else {
          meta.textContent = 'Дата добавления неизвестна';
        }

        const actions = document.createElement('div');
        actions.className = 'profile-article__actions';

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'profile-article__remove';
        removeButton.dataset.articleRemove = article.id;
        removeButton.textContent = 'Удалить';
        actions.appendChild(removeButton);

        item.append(header, meta, actions);
        articleListElement.appendChild(item);
      });
  };

  const renderUser = (user) => {
    if (!user) {
      closeAdminPanel();
      if (adminPanelTrigger) {
        adminPanelTrigger.hidden = true;
        adminPanelTrigger.setAttribute('aria-expanded', 'false');
      }

      content.hidden = true;
      emptyState.hidden = false;
      if (feedbackElement) {
        setFeedback('');
      }
      return;
    }

    content.hidden = false;
    emptyState.hidden = true;

    const isAdmin = user.role === 'admin';
    if (adminPanelTrigger) {
      adminPanelTrigger.hidden = !isAdmin;
      adminPanelTrigger.setAttribute(
        'aria-expanded',
        isAdmin && adminPanel && !adminPanel.hidden ? 'true' : 'false',
      );
    }
    if (!isAdmin) {
      closeAdminPanel();
    }

    if (avatarImage) {
      avatarImage.src = user.avatar || defaultAvatar;
    }

    if (nameInput) {
      nameInput.value = user.name ?? '';
    }

    if (avatarInput) {
      avatarInput.value = '';
    }

    if (emailElement) {
      emailElement.textContent = user.email ?? '—';
    }

    if (roleElement) {
      roleElement.textContent = roleLabels[user.role] ?? 'Пользователь';
    }

    if (tasksCountElement) {
      const knownIds = Object.keys(tasksData);
      const count = Array.isArray(user.completedTasks)
        ? user.completedTasks.filter((taskId) => knownIds.includes(taskId)).length
        : 0;
      tasksCountElement.textContent = String(count);
    }

    if (articlesCountElement) {
      const count = Array.isArray(user.articles) ? user.articles.length : 0;
      articlesCountElement.textContent = String(count);
    }

    renderTasks(user);
    renderArticles(user);
  };

  function renderAdminStats(users) {
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
      const count = users.filter((userItem) => userItem.role === role).length;
      const badge = document.createElement('span');
      badge.className = 'admin-panel__stat';
      badge.textContent = `${config.title}: ${count}`;
      adminStats.appendChild(badge);
    });
  }

  function renderAdminPanel(query = '') {
    if (!adminUsersList) {
      return;
    }

    const users = getNormalizedUsers();
    renderAdminStats(users);

    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? users.filter(
          (userItem) =>
            userItem.name.toLowerCase().includes(normalizedQuery) ||
            userItem.email.toLowerCase().includes(normalizedQuery),
        )
      : users;

    adminUsersList.innerHTML = '';

    if (!filtered.length) {
      adminEmptyState?.removeAttribute('hidden');
      return;
    }

    adminEmptyState?.setAttribute('hidden', 'true');

    const storedSession = loadSession();
    const sessionUser =
      store.getCurrentUser() ?? (storedSession ? normalizeUser(storedSession) : null);

    filtered
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }))
      .forEach((userItem) => {
        adminUsersList.appendChild(createAdminUserItem(userItem, sessionUser));
      });
  }

  function updateUserRole(email, newRole) {
    const normalizedRole = normalizeRole(newRole);
    const users = loadUsers();
    const index = users.findIndex((item) => item.email === email);

    if (index === -1) {
      return;
    }

    const previous = normalizeUser(users[index]);
    if (previous.role === normalizedRole) {
      return;
    }

    users[index] = { ...users[index], role: normalizedRole };
    saveUsers(users);

    const updatedUser = normalizeUser(users[index]);
    const session = loadSession();

    if (session?.email === email) {
      saveSession(updatedUser);
      const synced = store.sync?.();
      renderUser(synced ?? store.getCurrentUser());
      setFeedback(
        `Ваш уровень доступа обновлён на «${roleConfig[normalizedRole].title}».`,
      );
    } else {
      if (session) {
        const sessionIndex = users.findIndex((item) => item.email === session.email);
        if (sessionIndex !== -1) {
          const normalizedSession = normalizeUser(users[sessionIndex]);
          saveSession(normalizedSession);
        }
      }

      const synced = store.sync?.();
      renderUser(synced ?? store.getCurrentUser());
      setFeedback(
        `Роль пользователя ${updatedUser.name} обновлена на «${roleConfig[normalizedRole].title}».`,
      );
    }

    renderAdminPanel(adminSearchInput?.value ?? '');
  }

  function createAdminUserItem(user, sessionUser) {
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
  }

  function openAdminPanel() {
    const sessionUser = store.getCurrentUser();
    if (!sessionUser || sessionUser.role !== 'admin') {
      setFeedback('Для доступа к панели администратора необходимы права администратора.', true);
      return;
    }

    lastFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (adminSearchInput) {
      adminSearchInput.value = '';
    }

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
      setTimeout(() => adminSearchInput.focus(), 0);
    }
  }

  if (nameForm) {
    nameForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!nameInput) {
        return;
      }

      try {
        store.updateName(nameInput.value);
        setFeedback('Имя успешно обновлено.');
      } catch (error) {
        setFeedback(error?.message ?? 'Не удалось обновить имя.', true);
      }
    });
  }

  if (avatarInput) {
    avatarInput.addEventListener('change', () => {
      const [file] = avatarInput.files ?? [];
      if (!file) {
        return;
      }

      if (!file.type.startsWith('image/')) {
        setFeedback('Выберите файл изображения.', true);
        avatarInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.addEventListener('load', () => {
        try {
          store.updateAvatar(String(reader.result));
          setFeedback('Фотография обновлена.');
        } catch (error) {
          setFeedback(error?.message ?? 'Не удалось обновить фотографию.', true);
        }
      });
      reader.addEventListener('error', () => {
        setFeedback('Не удалось прочитать файл изображения.', true);
      });
      reader.readAsDataURL(file);
    });
  }

  if (articleForm) {
    articleForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(articleForm);
      const title = formData.get('title');
      const link = formData.get('link');

      try {
        store.addArticle({ title, link });
        articleForm.reset();
        setFeedback('Запись о материале сохранена.');
      } catch (error) {
        setFeedback(error?.message ?? 'Не удалось сохранить материал.', true);
      }
    });
  }

  if (articleListElement) {
    articleListElement.addEventListener('click', (event) => {
      const button = event.target.closest('[data-article-remove]');
      if (!button) {
        return;
      }

      const articleId = button.dataset.articleRemove;
      if (!articleId) {
        return;
      }

      store.removeArticle(articleId);
      setFeedback('Запись удалена.');
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      store.logout();
      setFeedback('');
      window.location.href = './auth.html';
    });
  }

  if (adminPanelTrigger) {
    adminPanelTrigger.hidden = true;
    adminPanelTrigger.addEventListener('click', openAdminPanel);
    adminPanelTrigger.setAttribute('aria-expanded', 'false');
  }

  if (adminPanel) {
    const closeElements = adminPanel.querySelectorAll('[data-admin-close]');
    closeElements.forEach((element) => {
      element.addEventListener('click', () => {
        closeAdminPanel();
      });
    });
  }

  if (adminSearchInput) {
    adminSearchInput.addEventListener('input', (event) => {
      renderAdminPanel(event.target.value);
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !adminPanel?.hidden) {
      closeAdminPanel();
    }
  });

  store.onChange(renderUser);
  renderUser(store.getCurrentUser());
})();
