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

  const defaultAvatar = '../Sourse/Icons/userIco.png';
  const roleLabels = {
    user: 'Пользователь',
    curator: 'Куратор',
    admin: 'Администратор',
  };

  const tasksData = store.getTaskDefinitions ? store.getTaskDefinitions() : {};
  store.sync?.();

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
      content.hidden = true;
      emptyState.hidden = false;
      if (feedbackElement) {
        setFeedback('');
      }
      return;
    }

    content.hidden = false;
    emptyState.hidden = true;

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

  store.onChange(renderUser);
  renderUser(store.getCurrentUser());
})();
