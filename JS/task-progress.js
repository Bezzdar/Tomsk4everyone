(() => {
  const store = window.ProfileStore;
  if (!store) return;

  const blocks = Array.from(document.querySelectorAll('[data-task-progress]'));
  if (!blocks.length) return;

  const defaultMessages = {
    login:     'Войдите в личный кабинет, чтобы отслеживать выполнение задания.',
    manual:    'После выполнения отметьте задание, чтобы оно появилось в профиле.',
    auto:      'Пройдите задание, и результат автоматически появится в профиле.',
    completed: 'Отлично! Задание выполнено, баллы начислены.',
  };

  const updateBlock = (block, user) => {
    const taskId = block.dataset.taskProgress;
    if (!taskId) return;

    const status = block.querySelector('[data-task-status]');
    const button = block.querySelector('[data-task-complete]');
    const isCompleted = user ? store.isTaskCompleted(taskId) : false;

    block.classList.toggle('is-completed', Boolean(user) && isCompleted);

    if (!status) return;

    if (!user) {
      if (button) {
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
        button.textContent = 'Отметить выполненным';
      }
      status.textContent = defaultMessages.login;
      return;
    }

    if (button) {
      button.disabled = isCompleted;
      button.setAttribute('aria-disabled', isCompleted ? 'true' : 'false');
      button.textContent = isCompleted ? 'Задание выполнено ✓' : 'Отметить выполненным';
    }

    status.textContent = isCompleted
      ? defaultMessages.completed
      : button
        ? defaultMessages.manual
        : defaultMessages.auto;
  };

  const render = () => {
    const user = store.getCurrentUser();
    blocks.forEach((block) => updateBlock(block, user));
  };

  blocks.forEach((block) => {
    const button = block.querySelector('[data-task-complete]');
    if (!button) return;

    button.addEventListener('click', async () => {
      const taskId = block.dataset.taskProgress;
      if (!taskId) return;

      button.disabled = true;
      button.textContent = 'Сохранение...';

      const success = await store.markTaskCompleted(taskId);

      if (!success) {
        block.classList.add('task-progress--error');
        setTimeout(() => block.classList.remove('task-progress--error'), 400);
        // Re-enable if not actually completed
        if (!store.isTaskCompleted(taskId)) {
          button.disabled = false;
          button.textContent = 'Отметить выполненным';
        }
      }

      render();
    });
  });

  store.onChange(render);
  render();
})();
