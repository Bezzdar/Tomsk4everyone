(() => {
  const STORAGE_KEY = 'tomsk4everyone_users';
  const SESSION_KEY = 'tomsk4everyone_session';
  const EVENT_NAME = 'profilestore:update';

  const TASK_DEFINITIONS = {
    'photohunt-chekhov': {
      title: 'Фотоохота: найди улицу Чехова',
      description: 'Соберите коллекцию снимков деревянных фасадов на улице Чехова.',
      link: './tasks-photohunt.html',
      points: 40,
    },
    'quiz-legends': {
      title: 'Тест «Легенды Томска»',
      description: 'Ответьте на вопросы о легендах города и получите разбор.',
      link: './tasks-quiz.html',
      points: 25,
    },
    'stories-open': {
      title: 'Истории жителей',
      description: 'Расскажите о любимых местах Томска в формате коротких эссе.',
      link: './tasks-stories.html',
      points: 35,
    },
  };

  const safeJsonParse = (value, fallback) => {
    try {
      return JSON.parse(value ?? '');
    } catch (error) {
      console.error('Не удалось разобрать сохранённые данные профиля:', error);
      return fallback;
    }
  };

  const readUsers = () => safeJsonParse(localStorage.getItem(STORAGE_KEY), []);
  const writeUsers = (users) => localStorage.setItem(STORAGE_KEY, JSON.stringify(users));

  const readSession = () => safeJsonParse(localStorage.getItem(SESSION_KEY), null);
  const writeSession = (session) => localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  const clearSession = () => localStorage.removeItem(SESSION_KEY);

  const normalizeRole = (role) => (['user', 'curator', 'admin'].includes(role) ? role : 'user');

  const normalizeArticles = (articles) => {
    if (!Array.isArray(articles)) {
      return [];
    }

    const seenIds = new Set();
    const normalized = articles
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

    return normalized.map((article, index) => {
      let id = article.id;
      while (seenIds.has(id)) {
        id = `${article.id}-${seenIds.size + index + 1}`;
      }
      seenIds.add(id);
      return { ...article, id };
    });
  };

  const applyUserDefaults = (user) => {
    const normalized = { ...user };
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

  const toSessionUser = (user) => {
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

  let currentUser = null;

  const notify = () => {
    document.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: { user: currentUser },
      }),
    );
  };

  const syncSession = () => {
    const session = readSession();
    if (!session || !session.email) {
      currentUser = null;
      return null;
    }

    const users = readUsers();
    const index = users.findIndex((item) => item.email === session.email);
    if (index === -1) {
      clearSession();
      currentUser = null;
      return null;
    }

    const storedUser = applyUserDefaults(users[index]);
    users[index] = storedUser;
    writeUsers(users);

    currentUser = toSessionUser(storedUser);
    writeSession(currentUser);
    return currentUser;
  };

  const ensureUser = () => currentUser ?? syncSession();

  const updateUser = (mutator) => {
    const sessionUser = ensureUser();
    if (!sessionUser || !sessionUser.email) {
      return null;
    }

    const users = readUsers();
    const index = users.findIndex((item) => item.email === sessionUser.email);
    if (index === -1) {
      clearSession();
      currentUser = null;
      notify();
      return null;
    }

    const updated = applyUserDefaults(users[index]);
    const draft = { ...updated };
    if (typeof mutator === 'function') {
      mutator(draft);
    }

    const finalUser = applyUserDefaults(draft);
    users[index] = finalUser;
    writeUsers(users);

    currentUser = toSessionUser(finalUser);
    writeSession(currentUser);
    notify();
    return currentUser;
  };

  const markTaskCompleted = (taskId) => {
    if (!TASK_DEFINITIONS[taskId]) {
      return false;
    }

    let added = false;
    const result = updateUser((user) => {
      user.completedTasks = Array.isArray(user.completedTasks) ? [...user.completedTasks] : [];
      if (!user.completedTasks.includes(taskId)) {
        user.completedTasks.push(taskId);
        added = true;
      }
    });

    return Boolean(result) && added;
  };

  const updateName = (name) => {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) {
      throw new Error('Имя не может быть пустым.');
    }
    if (trimmed.length < 2) {
      throw new Error('Имя должно содержать не менее двух символов.');
    }

    return updateUser((user) => {
      user.name = trimmed;
    });
  };

  const updateAvatar = (dataUrl) => {
    if (typeof dataUrl !== 'string' || !dataUrl.trim()) {
      throw new Error('Не удалось загрузить изображение.');
    }

    return updateUser((user) => {
      user.avatar = dataUrl;
    });
  };

  const addArticle = ({ title, link }) => {
    const trimmedTitle = typeof title === 'string' ? title.trim() : '';
    if (!trimmedTitle) {
      throw new Error('Введите название статьи.');
    }

    const sanitizedLink = typeof link === 'string' ? link.trim() : '';
    const id = `article-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const result = updateUser((user) => {
      const articles = Array.isArray(user.articles) ? [...user.articles] : [];
      articles.push({
        id,
        title: trimmedTitle,
        link: sanitizedLink,
        createdAt: new Date().toISOString(),
      });
      user.articles = articles;
    });

    if (!result) {
      return null;
    }

    return result.articles.find((article) => article.id === id) ?? null;
  };

  const removeArticle = (articleId) => {
    if (typeof articleId !== 'string') {
      return null;
    }

    return updateUser((user) => {
      if (!Array.isArray(user.articles)) {
        user.articles = [];
        return;
      }
      user.articles = user.articles.filter((article) => article.id !== articleId);
    });
  };

  const isTaskCompleted = (taskId) => {
    const user = ensureUser();
    if (!user) {
      return false;
    }
    return Array.isArray(user.completedTasks) && user.completedTasks.includes(taskId);
  };

  const logout = () => {
    clearSession();
    currentUser = null;
    notify();
  };

  const onChange = (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }
    const handler = (event) => {
      callback(event.detail?.user ?? null);
    };
    document.addEventListener(EVENT_NAME, handler);
    return () => {
      document.removeEventListener(EVENT_NAME, handler);
    };
  };

  syncSession();

  window.ProfileStore = {
    getCurrentUser: () => ensureUser(),
    getTaskDefinitions: () => ({ ...TASK_DEFINITIONS }),
    isTaskCompleted,
    markTaskCompleted,
    updateName,
    updateAvatar,
    addArticle,
    removeArticle,
    logout,
    onChange,
    sync: () => syncSession(),
  };
})();
