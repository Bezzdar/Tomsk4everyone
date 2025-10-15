(() => {
  const store = window.ProfileStore;
  if (!store) {
    return;
  }

  const blocks = Array.from(document.querySelectorAll('[data-task-progress]'));
  if (!blocks.length) {
    return;
  }

  const defaultMessages = {
    login: 'Войдите в личный кабинет, чтобы отслеживать выполнение задания.',
    manual: 'После выполнения отметьте задание, чтобы оно появилось в профиле.',
    auto: 'Пройдите задание, и результат автоматически появится в профиле.',
    completed: 'Отлично! Задание отмечено как выполненное.',
  };

  const updateBlock = (block, user) => {
    const taskId = block.dataset.taskProgress;
    if (!taskId) {
      return;
    }

    const status = block.querySelector('[data-task-status]');
    const button = block.querySelector('[data-task-complete]');
    const isCompleted = user ? store.isTaskCompleted(taskId) : false;
    const isManual = Boolean(button);

    block.classList.toggle('is-completed', Boolean(user) && isCompleted);

    if (!status) {
      return;
    }

    if (!user) {
      if (button) {
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
      }
      status.textContent = defaultMessages.login;
      return;
    }

    if (button) {
      button.disabled = isCompleted;
      button.setAttribute('aria-disabled', isCompleted ? 'true' : 'false');
      button.textContent = isCompleted ? 'Задание выполнено' : 'Отметить выполненным';
    }

    if (isCompleted) {
      status.textContent = defaultMessages.completed;
    } else if (isManual) {
      status.textContent = defaultMessages.manual;
    } else {
      status.textContent = defaultMessages.auto;
    }
  };

  const render = () => {
    const user = store.getCurrentUser();
    blocks.forEach((block) => updateBlock(block, user));
  };

  blocks.forEach((block) => {
    const button = block.querySelector('[data-task-complete]');
    if (!button) {
      return;
    }

    button.addEventListener('click', () => {
      const taskId = block.dataset.taskProgress;
      if (!taskId) {
        return;
      }

      const success = store.markTaskCompleted(taskId);
      if (!success) {
        block.classList.add('task-progress--error');
        setTimeout(() => {
          block.classList.remove('task-progress--error');
        }, 400);
      }
      render();
    });
  });

  store.onChange(render);
  render();
})();
