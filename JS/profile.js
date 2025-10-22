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
  const QUIZ_RESULTS_KEY = 'tomsk4everyone_quiz_results';

  // Конфигурация баллов за тесты
  const quizPointsConfig = {
    'legends': 20,
    'architecture': 15,
    'universities': 12,
    'famous-people': 10
  };

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
  
  // Инициализируем store
  if (store.sync) {
    store.sync();
  }

  // Функция для получения результатов тестов
  function getQuizResults() {
    try {
      return JSON.parse(localStorage.getItem(QUIZ_RESULTS_KEY) || '{}');
    } catch (error) {
      console.error('Ошибка чтения результатов тестов:', error);
      return {};
    }
  }

  // Функция для расчета общего количества баллов
  function calculateTotalPoints(user) {
    let totalPoints = 0;
    
    // Баллы за выполненные задания
    if (Array.isArray(user?.completedTasks)) {
      user.completedTasks.forEach(taskId => {
        const task = tasksData[taskId];
        if (task && typeof task.points === 'number') {
          totalPoints += task.points;
        }
      });
    }
    
    // Баллы за пройденные тесты
    const quizResults = getQuizResults();
    const userEmail = user?.email;
    
    if (userEmail) {
      Object.entries(quizResults).forEach(([quizId, result]) => {
        // Проверяем, что результат принадлежит текущему пользователю
        if (result.userEmail === userEmail && result.percentage >= 70) {
          totalPoints += quizPointsConfig[quizId] || 0;
        }
      });
    }
    
    return totalPoints;
  }

  // Функция для получения статистики по тестам текущего пользователя
  function getUserQuizStats(user) {
    const quizResults = getQuizResults();
    const userEmail = user?.email;
    const stats = {
      completed: 0,
      totalPoints: 0,
      details: []
    };
    
    if (!userEmail) return stats;
    
    Object.entries(quizResults).forEach(([quizId, result]) => {
      // Проверяем, что результат принадлежит текущему пользователю
      if (result.userEmail === userEmail && result.percentage >= 70) {
        stats.completed++;
        const points = quizPointsConfig[quizId] || 0;
        stats.totalPoints += points;
        stats.details.push({
          quizId: quizId,
          name: getQuizName(quizId),
          score: result.score,
          total: result.total,
          percentage: result.percentage,
          points: points,
          date: result.date
        });
      }
    });
    
    return stats;
  }

  // Функция для получения названия теста
  function getQuizName(quizId) {
    const quizNames = {
      'legends': 'Легенды Томска',
      'architecture': 'Архитектура Томска',
      'universities': 'Университеты Томска',
      'famous-people': 'Известные люди Томска'
    };
    return quizNames[quizId] || quizId;
  }

  // Элементы DOM
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

  // Функция для отображения обратной связи
  const setFeedback = (message, isError = false) => {
    if (!feedbackElement) return;
    
    if (!message) {
      feedbackElement.textContent = '';
      feedbackElement.className = 'profile-feedback';
      return;
    }
    
    feedbackElement.textContent = message;
    feedbackElement.className = `profile-feedback ${isError ? 'profile-feedback--error' : 'profile-feedback--success'}`;
  };

  // Обновляем рендеринг профиля для отображения баллов
  const renderUser = (user) => {
    if (!user) {
      content.hidden = true;
      emptyState.hidden = false;
      setFeedback('');
      return;
    }

    content.hidden = false;
    emptyState.hidden = true;

    // Основная информация пользователя
    if (avatarImage) {
      avatarImage.src = user.avatar || defaultAvatar;
    }

    if (nameInput) {
      nameInput.value = user.name || '';
    }

    if (emailElement) {
      emailElement.textContent = user.email || '—';
    }

    if (roleElement) {
      roleElement.textContent = roleLabels[user.role] || 'Пользователь';
    }

    // Статистика
    const quizStats = getUserQuizStats(user);
    const completedTasks = Array.isArray(user.completedTasks) ? user.completedTasks.length : 0;
    const totalCompleted = completedTasks + quizStats.completed;
    const totalPoints = calculateTotalPoints(user);

    if (tasksCountElement) {
      tasksCountElement.textContent = String(totalCompleted);
    }

    if (articlesCountElement) {
      const articlesCount = Array.isArray(user.articles) ? user.articles.length : 0;
      articlesCountElement.textContent = String(articlesCount);
    }

    // Рендерим дополнительные блоки статистики
    renderQuizStats(quizStats, totalPoints);
    renderTasks(user, quizStats);
    renderArticles(user);
  };

  // Функция для отображения статистики по тестам
  function renderQuizStats(quizStats, totalPoints) {
    // Находим или создаем контейнер для статистики тестов
    let statsContainer = document.querySelector('.profile-stats');
    if (!statsContainer) {
      statsContainer = document.createElement('div');
      statsContainer.className = 'profile-stats';
      
      const profileCard = document.querySelector('.profile-card__footer');
      if (profileCard) {
        profileCard.insertBefore(statsContainer, profileCard.firstChild);
      }
    }

    // Обновляем содержимое статистики
    statsContainer.innerHTML = `
      <div class="profile-stat">
        <span class="profile-stat__label">Выполнено заданий</span>
        <span class="profile-stat__value" data-profile-tasks-count>${quizStats.completed}</span>
      </div>
      <div class="profile-stat">
        <span class="profile-stat__label">Написано статей</span>
        <span class="profile-stat__value" data-profile-articles-count>0</span>
      </div>
      <div class="profile-stat">
        <span class="profile-stat__label">Общие баллы</span>
        <span class="profile-stat__value">${totalPoints}</span>
      </div>
    `;

    // Обновляем счетчики в основном интерфейсе
    if (tasksCountElement) {
      tasksCountElement.textContent = quizStats.completed;
    }
  }

  // Функция для отображения заданий (включая тесты)
  const renderTasks = (user, quizStats) => {
    if (!taskListElement) return;

    taskListElement.innerHTML = '';

    // Если нет заданий и тестов
    if (quizStats.details.length === 0) {
      const placeholder = document.createElement('li');
      placeholder.className = 'profile-task profile-task--empty';
      placeholder.textContent = 'Вы ещё не выполнили ни одного задания или теста.';
      taskListElement.appendChild(placeholder);
      return;
    }

    // Рендерим пройденные тесты
    quizStats.details.forEach(quiz => {
      const item = document.createElement('li');
      item.className = 'profile-task profile-task--done';

      const title = document.createElement('p');
      title.className = 'profile-task__title';
      title.textContent = quiz.name;

      const description = document.createElement('p');
      description.className = 'profile-task__meta';
      description.textContent = `Тест · ${quiz.score}/${quiz.total} правильных ответов · ${quiz.points} баллов`;

      const actions = document.createElement('div');
      actions.className = 'profile-task__actions';

      const link = document.createElement('a');
      link.className = 'profile-task__link';
      link.href = `./tests.html#test-${quiz.quizId}`;
      link.textContent = 'Пройти ещё раз';

      const status = document.createElement('span');
      status.className = 'profile-task__status';
      status.textContent = 'Пройдено';

      actions.append(link, status);
      item.append(title, description, actions);
      taskListElement.appendChild(item);
    });
  };

  // Функция для отображения статей (оставляем без изменений)
  const renderArticles = (user) => {
    if (!articleListElement) return;

    articleListElement.innerHTML = '';
    const articles = Array.isArray(user?.articles) ? [...user.articles] : [];

    if (!articles.length) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'profile-article profile-article--empty';
      emptyItem.textContent = 'Вы ещё не добавили материалы.';
      articleListElement.appendChild(emptyItem);
      return;
    }

    articles.forEach((article) => {
      const item = document.createElement('li');
      item.className = 'profile-article';

      const header = document.createElement('div');
      header.className = 'profile-article__header';

      const title = document.createElement('h3');
      title.className = 'profile-article__title';
      title.textContent = article.title || 'Без названия';
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
      removeButton.textContent = 'Удалить';
      removeButton.addEventListener('click', () => {
        if (article.id && store.removeArticle) {
          store.removeArticle(article.id);
          setFeedback('Статья удалена');
        }
      });
      actions.appendChild(removeButton);

      item.append(header, meta, actions);
      articleListElement.appendChild(item);
    });
  };

  // Обработчики событий
  if (nameForm && nameInput) {
    nameForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (store.updateName) {
        store.updateName(nameInput.value);
        setFeedback('Имя успешно обновлено');
      }
    });
  }

  if (avatarInput) {
    avatarInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file && store.updateAvatar) {
        const reader = new FileReader();
        reader.onload = (e) => {
          store.updateAvatar(e.target.result);
          setFeedback('Аватар обновлен');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (articleForm) {
    articleForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const formData = new FormData(articleForm);
      const title = formData.get('title');
      const link = formData.get('link');

      if (title && store.addArticle) {
        store.addArticle({ title, link });
        articleForm.reset();
        setFeedback('Статья добавлена');
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      if (store.logout) {
        store.logout();
      }
      window.location.href = './auth.html';
    });
  }

  // Инициализация
  if (store.onChange) {
    store.onChange(renderUser);
  }
  renderUser(store.getCurrentUser());

  // Добавляем обработчик для обновления статистики при изменении localStorage
  window.addEventListener('storage', (event) => {
    if (event.key === QUIZ_RESULTS_KEY) {
      renderUser(store.getCurrentUser());
    }
  });

  // Периодическая проверка обновлений (каждые 2 секунды)
  setInterval(() => {
    renderUser(store.getCurrentUser());
  }, 2000);

})();