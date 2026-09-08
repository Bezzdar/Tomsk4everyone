(() => {
  const store = window.ProfileStore;
  if (!store) return;

  const blocks = Array.from(document.querySelectorAll('[data-task-progress]'));
  if (!blocks.length) return;

  const updateBlock = (block, user) => {
    const taskId = block.dataset.taskProgress;
    const definition = store.getTaskDefinitions()[taskId];
    const status = block.querySelector('[data-task-status]');
    const button = block.querySelector('[data-task-complete]');
    if (!taskId || !status) return;

    const isCompleted = user ? store.isTaskCompleted(taskId) : false;
    block.classList.toggle('is-completed', Boolean(user) && isCompleted);

    if (!user) {
      if (button) { button.disabled = true; button.textContent = 'Требуется вход'; }
      status.textContent = 'Войдите в личный кабинет, чтобы сохранять прогресс.';
      return;
    }

    if (!definition) {
      if (button) { button.disabled = true; button.textContent = 'Недоступно'; }
      status.textContent = 'Задание временно недоступно.';
      return;
    }

    if (isCompleted) {
      if (button) { button.disabled = true; button.textContent = 'Задание выполнено ✓'; }
      status.textContent = 'Задание выполнено, награда сохранена.';
      return;
    }

    if (definition.taskType !== 'quiz') {
      if (button) { button.disabled = true; button.textContent = 'Проверка скоро'; }
      status.textContent = 'Результаты этого задания требуют проверки. В первой тестовой версии начисление пока отключено.';
      return;
    }

    // Quiz completion is triggered by the quiz page after showing the result.
    if (button) { button.disabled = true; button.textContent = 'Пройдите тест'; }
    status.textContent = 'Пройдите тест до конца — результат сохранится автоматически.';
  };

  const render = () => {
    const user = store.getCurrentUser();
    blocks.forEach((block) => updateBlock(block, user));
  };

  store.onChange(render);
  store.loadTaskDefinitions?.().finally(render);
  render();
})();
