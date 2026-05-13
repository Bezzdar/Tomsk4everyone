(() => {
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

  const notify = (user) => {
    document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { user } }));
  };

  const getCurrentUser = () => {
    if (!window.authHelper) return null;
    return window.authHelper.getUser();
  };

  const isTaskCompleted = (taskId) => {
    const user = getCurrentUser();
    if (!user) return false;
    return Array.isArray(user.completedTasks) && user.completedTasks.includes(taskId);
  };

  const markTaskCompleted = async (taskId) => {
    if (!TASK_DEFINITIONS[taskId]) return false;
    if (isTaskCompleted(taskId)) return false;
    if (!window.authHelper || !window.authHelper.isLoggedIn()) return false;

    const token = window.authHelper.getToken();
    const API_BASE = window.APP_CONFIG?.API_BASE || '';

    try {
      const res = await fetch(`${API_BASE}/tasks/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ taskId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сервера');

      // Update user_data in localStorage so all other components see the change
      const currentUser = getCurrentUser();
      if (currentUser) {
        const updated = {
          ...currentUser,
          completedTasks: data.completedTasks || currentUser.completedTasks,
          balance: data.balance ?? currentUser.balance,
        };
        localStorage.setItem('user_data', JSON.stringify(updated));
      }

      notify(getCurrentUser());
      return true;
    } catch (err) {
      console.error('Ошибка при отметке задания:', err);
      return false;
    }
  };

  const onChange = (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = (event) => callback(event.detail?.user ?? null);
    document.addEventListener(EVENT_NAME, handler);
    return () => document.removeEventListener(EVENT_NAME, handler);
  };

  window.ProfileStore = {
    getCurrentUser,
    getTaskDefinitions: () => ({ ...TASK_DEFINITIONS }),
    isTaskCompleted,
    markTaskCompleted,
    onChange,
    sync: () => notify(getCurrentUser()),
  };
})();
