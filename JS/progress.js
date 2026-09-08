(() => {
  const EVENT_NAME = 'profilestore:update';
  const API_BASE = window.APP_CONFIG?.API_BASE || '/api';

  const FALLBACK_LINKS = {
    'photohunt-chekhov': './tasks-photohunt.html',
    'quiz-legends': './tasks-quiz.html',
    'stories-open': './tasks-stories.html',
  };

  let taskDefinitions = {};

  const notify = (user) => {
    document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { user } }));
  };

  const getCurrentUser = () => window.authHelper?.getUser?.() || null;

  const syncTaskCopy = () => {
    const legends = taskDefinitions['quiz-legends'];
    if (legends) {
      const meta = document.querySelector('#test-legends .task-meta');
      const reward = meta ? [...meta.querySelectorAll('span')].find((span) => span.textContent.includes('кедрокоин')) : null;
      if (reward) reward.textContent = `⭐ ${legends.points} кедрокоинов`;
    }
  };

  const loadDefinitions = async () => {
    try {
      const response = await fetch(`${API_BASE}/tasks`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Ошибка загрузки заданий');
      taskDefinitions = Object.fromEntries((payload.tasks || []).map((task) => [task.slug, {
        title: task.title,
        description: task.description,
        points: task.points,
        taskType: task.task_type,
        link: FALLBACK_LINKS[task.slug] || './tasks.html',
      }]));
      syncTaskCopy();
      notify(getCurrentUser());
    } catch (error) {
      console.error('Не удалось загрузить описание заданий:', error);
    }
    return taskDefinitions;
  };

  const isTaskCompleted = (taskId) => {
    const user = getCurrentUser();
    return Boolean(user && Array.isArray(user.completedTasks) && user.completedTasks.includes(taskId));
  };

  const markTaskCompleted = async (taskId) => {
    if (isTaskCompleted(taskId)) return false;
    if (!window.authHelper?.isLoggedIn()) return false;

    try {
      const response = await fetch(`${API_BASE}/tasks/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${window.authHelper.getToken()}`,
        },
        body: JSON.stringify({ taskId }),
      });
      if (window.authHelper.handleUnauthorized(response)) return false;
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status !== 409) console.error(payload.error || 'Ошибка сохранения задания');
        return false;
      }

      const currentUser = getCurrentUser();
      if (currentUser) {
        window.authHelper.updateUser({
          ...currentUser,
          completedTasks: payload.completedTasks || currentUser.completedTasks,
          balance: payload.balance ?? currentUser.balance,
        });
      }
      notify(getCurrentUser());
      return true;
    } catch (error) {
      console.error('Ошибка при сохранении задания:', error);
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
    getTaskDefinitions: () => ({ ...taskDefinitions }),
    loadTaskDefinitions: loadDefinitions,
    isTaskCompleted,
    markTaskCompleted,
    onChange,
    sync: () => notify(getCurrentUser()),
  };

  // Transitional bridge for the legacy inline quiz page. That page still writes
  // results to localStorage; when the Legends quiz is completed we persist the
  // real task completion through the backend exactly once.
  if (!window.__tomskQuizStorageBridgeInstalled) {
    window.__tomskQuizStorageBridgeInstalled = true;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      originalSetItem.call(this, key, value);
      if (this !== localStorage || key !== 'tomsk4everyone_quiz_results') return;

      try {
        const results = JSON.parse(String(value || '{}'));
        if (results && results.legends && window.authHelper?.isLoggedIn()) {
          queueMicrotask(() => markTaskCompleted('quiz-legends'));
        }
      } catch (error) {
        console.error('Не удалось синхронизировать результат теста:', error);
      }
    };
  }

  loadDefinitions();
})();
