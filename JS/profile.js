(() => {
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

  // Получаем элементы DOM
  const content = document.querySelector('[data-profile-content]');
  const emptyState = document.querySelector('[data-profile-empty]');
  const avatarImage = document.querySelector('[data-profile-avatar-image]');
  const nameInput = document.querySelector('[data-profile-name]');
  const emailElement = document.querySelector('[data-profile-email]');
  const roleElement = document.querySelector('[data-profile-role]');
  const tasksCountElement = document.querySelector('[data-profile-tasks-count]');
  const quizzesCountElement = document.querySelector('[data-profile-quizzes-count]');
  const articlesCountElement = document.querySelector('[data-profile-articles-count]');
  const totalPointsElement = document.querySelector('[data-profile-total-points]');
  const quizListElement = document.querySelector('[data-profile-quiz-list]');
  const taskListElement = document.querySelector('[data-profile-task-list]');
  const articleListElement = document.querySelector('[data-profile-article-list]');
  const feedbackElement = document.querySelector('[data-profile-feedback]');

  // Функция для получения текущего пользователя
  function getCurrentUser() {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (!session || !session.email) return null;

      const users = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const user = users.find(u => u.email === session.email);
      return user || null;
    } catch (error) {
      console.error('Ошибка получения пользователя:', error);
      return null;
    }
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

  // Функция для отладки - показывает все результаты тестов
function debugQuizResults() {
  const quizResults = getQuizResults();
  const user = getCurrentUser();
  console.log('=== ДЕБАГ РЕЗУЛЬТАТОВ ТЕСТОВ ===');
  console.log('Текущий пользователь:', user?.email);
  console.log('Все результаты:', quizResults);
  
  if (user) {
    const userResults = Object.entries(quizResults)
      .filter(([key, result]) => result.userEmail === user.email)
      .map(([key, result]) => result);
    console.log('Результаты пользователя:', userResults);
  }
}

// Вызывайте эту функцию для отладки
// debugQuizResults();

  // Функция для получения статистики по тестам текущего пользователя
  f// Функция для получения статистики по тестам текущего пользователя
function getUserQuizStats(user) {
  const quizResults = getQuizResults();
  const userEmail = user?.email;
  const stats = {
    completed: 0,
    totalPoints: 0,
    details: []
  };
  
  if (!userEmail) return stats;
  
  // Собираем все результаты текущего пользователя
  Object.entries(quizResults).forEach(([key, result]) => {
    // Проверяем, что результат принадлежит текущему пользователю
    if (result.userEmail === userEmail && result.percentage >= 70) {
      stats.completed++;
      stats.totalPoints += result.points || 0;
      stats.details.push({
        quizId: result.quizId,
        name: getQuizName(result.quizId),
        score: result.score,
        total: result.total,
        percentage: result.percentage,
        points: result.points || 0,
        date: result.date
      });
    }
  });
  
  console.log('Статистика тестов:', stats);
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

  // Функция для расчета общего количества баллов
  function calculateTotalPoints(user, quizStats) {
    let totalPoints = quizStats.totalPoints;
    
    // Баллы за выполненные задания (если есть такая система)
    if (Array.isArray(user?.completedTasks)) {
      // Здесь можно добавить логику для заданий, если она есть
      // totalPoints += pointsFromTasks;
    }
    
    return totalPoints;
  }

  // Функция для отображения обратной связи
  function setFeedback(message, isError = false) {
    if (!feedbackElement) return;
    
    if (!message) {
      feedbackElement.textContent = '';
      feedbackElement.className = 'profile-feedback';
      return;
    }
    
    feedbackElement.textContent = message;
    feedbackElement.className = `profile-feedback ${isError ? 'profile-feedback--error' : 'profile-feedback--success'}`;
  }

  // Функция для отображения пройденных тестов
  function renderQuizzes(quizStats) {
    if (!quizListElement) return;

    quizListElement.innerHTML = '';

    if (quizStats.details.length === 0) {
      const placeholder = document.createElement('li');
      placeholder.className = 'profile-quiz profile-quiz--empty';
      placeholder.textContent = 'Вы ещё не прошли ни одного теста.';
      quizListElement.appendChild(placeholder);
      return;
    }

    // Сортируем тесты по дате (новые сверху)
    quizStats.details.sort((a, b) => new Date(b.date) - new Date(a.date));

    quizStats.details.forEach(quiz => {
      const item = document.createElement('li');
      item.className = 'profile-quiz';

      const header = document.createElement('div');
      header.className = 'profile-quiz__header';

      const title = document.createElement('h3');
      title.className = 'profile-quiz__title';
      title.textContent = quiz.name;

      const score = document.createElement('span');
      score.className = 'profile-quiz__score';
      score.textContent = `${quiz.score}/${quiz.total}`;

      header.append(title, score);

      const details = document.createElement('div');
      details.className = 'profile-quiz__details';

      const percentage = document.createElement('span');
      percentage.className = 'profile-quiz__percentage';
      percentage.textContent = `${quiz.percentage}% правильных ответов`;

      const points = document.createElement('span');
      points.className = 'profile-quiz__points';
      points.textContent = `${quiz.points} баллов`;

      const date = document.createElement('span');
      date.className = 'profile-quiz__date';
      date.textContent = new Date(quiz.date).toLocaleDateString('ru-RU');

      details.append(percentage, points, date);

      const actions = document.createElement('div');
      actions.className = 'profile-quiz__actions';

      const retryLink = document.createElement('a');
      retryLink.className = 'profile-quiz__link';
      retryLink.href = `./tests.html#test-${quiz.quizId}`;
      retryLink.textContent = 'Пройти ещё раз';

      actions.appendChild(retryLink);

      item.append(header, details, actions);
      quizListElement.appendChild(item);
    });
  }

  // Функция для отображения выполненных заданий
  function renderTasks(user) {
    if (!taskListElement) return;

    taskListElement.innerHTML = '';

    // Если у вас есть система заданий, добавьте её рендеринг здесь
    const completedTasks = Array.isArray(user?.completedTasks) ? user.completedTasks : [];
    
    if (completedTasks.length === 0) {
      const placeholder = document.createElement('li');
      placeholder.className = 'profile-task profile-task--empty';
      placeholder.textContent = 'Вы ещё не выполнили ни одного задания.';
      taskListElement.appendChild(placeholder);
      return;
    }

    // Пример рендеринга заданий (адаптируйте под вашу систему)
    completedTasks.forEach(taskId => {
      const item = document.createElement('li');
      item.className = 'profile-task';

      const title = document.createElement('p');
      title.className = 'profile-task__title';
      title.textContent = `Задание: ${taskId}`;

      const status = document.createElement('span');
      status.className = 'profile-task__status';
      status.textContent = 'Выполнено';

      item.append(title, status);
      taskListElement.appendChild(item);
    });
  }

  // Функция для отображения статей
  function renderArticles(user) {
    if (!articleListElement) return;

    articleListElement.innerHTML = '';
    const articles = Array.isArray(user?.articles) ? user.articles : [];

    if (articles.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'profile-article profile-article--empty';
      emptyItem.textContent = 'Вы ещё не добавили материалы.';
      articleListElement.appendChild(emptyItem);
      return;
    }

    articles.forEach(article => {
      const item = document.createElement('li');
      item.className = 'profile-article';

      const title = document.createElement('h3');
      title.className = 'profile-article__title';
      title.textContent = article.title || 'Без названия';

      if (article.link) {
        const link = document.createElement('a');
        link.className = 'profile-article__link';
        link.href = article.link;
        link.target = '_blank';
        link.textContent = 'Открыть';
        item.append(title, link);
      } else {
        item.appendChild(title);
      }

      articleListElement.appendChild(item);
    });
  }

  // Основная функция рендеринга профиля
  function renderProfile() {
    const user = getCurrentUser();

    if (!user) {
      if (content) content.hidden = true;
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (content) content.hidden = false;
    if (emptyState) emptyState.hidden = true;

    // Основная информация
    if (avatarImage) {
      avatarImage.src = user.avatar || '../Sourse/Icons/userIco.png';
    }

    if (nameInput) {
      nameInput.value = user.name || user.email;
    }

    if (emailElement) {
      emailElement.textContent = user.email;
    }

    if (roleElement) {
      roleElement.textContent = user.role === 'admin' ? 'Администратор' : 
                               user.role === 'curator' ? 'Куратор' : 'Пользователь';
    }

    // Статистика
    const quizStats = getUserQuizStats(user);
    const completedTasks = Array.isArray(user.completedTasks) ? user.completedTasks.length : 0;
    const articlesCount = Array.isArray(user.articles) ? user.articles.length : 0;
    const totalPoints = calculateTotalPoints(user, quizStats);

    if (tasksCountElement) {
      tasksCountElement.textContent = completedTasks;
    }

    if (quizzesCountElement) {
      quizzesCountElement.textContent = quizStats.completed;
    }

    if (articlesCountElement) {
      articlesCountElement.textContent = articlesCount;
    }

    if (totalPointsElement) {
      totalPointsElement.textContent = totalPoints;
    }

    // Рендерим списки
    renderQuizzes(quizStats);
    renderTasks(user);
    renderArticles(user);
  }

  // Обработчики событий
  function initEventListeners() {
    // Форма изменения имени
    const nameForm = document.querySelector('[data-profile-name-form]');
    if (nameForm) {
      nameForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const user = getCurrentUser();
        if (user && nameInput) {
          // Обновляем имя в localStorage
          const users = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
          const userIndex = users.findIndex(u => u.email === user.email);
          if (userIndex !== -1) {
            users[userIndex].name = nameInput.value;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
            
            // Обновляем сессию
            const session = JSON.parse(localStorage.getItem(SESSION_KEY));
            if (session) {
              session.name = nameInput.value;
              localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            }
            
            setFeedback('Имя успешно обновлено');
            renderProfile();
          }
        }
      });
    }

    // Загрузка аватара
    const avatarInput = document.querySelector('[data-profile-avatar-input]');
    if (avatarInput) {
      avatarInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const user = getCurrentUser();
            if (user) {
              // Сохраняем аватар в localStorage
              const users = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
              const userIndex = users.findIndex(u => u.email === user.email);
              if (userIndex !== -1) {
                users[userIndex].avatar = e.target.result;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
                
                // Обновляем сессию
                const session = JSON.parse(localStorage.getItem(SESSION_KEY));
                if (session) {
                  session.avatar = e.target.result;
                  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
                }
                
                setFeedback('Аватар успешно обновлен');
                renderProfile();
              }
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }

    // Выход из аккаунта
    const logoutButton = document.querySelector('[data-profile-logout]');
    if (logoutButton) {
      logoutButton.addEventListener('click', () => {
        localStorage.removeItem(SESSION_KEY);
        window.location.href = './auth.html';
      });
    }
  }

  // Инициализация
  function init() {
    initEventListeners();
    renderProfile();

    // Обновляем профиль при изменении localStorage
    window.addEventListener('storage', () => {
      renderProfile();
    });

    // Периодическое обновление (каждые 3 секунды)
    setInterval(renderProfile, 3000);
  }

  // Запускаем при загрузке
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();