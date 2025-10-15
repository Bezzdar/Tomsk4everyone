const SESSION_KEY = 'tomsk4everyone_session';
const RESULTS_KEY = 'tomsk4everyone_quiz_results';

const quizData = {
  base: [
    {
      id: 'dracula-nickname',
      text: 'Какое название закрепилось за купеческим домом на Горького благодаря городской легенде?',
      options: ['Дом Дракулы', 'Дом путешественника', 'Дом золотых ворот', 'Дом старого инженера'],
      correct: 0,
      explanation: 'Особняк на улице Горького в народе прозвали «Домом Дракулы» из-за легенд о таинственных владельцах и мрачном облике.',
    },
    {
      id: 'main-park',
      text: 'Какое место считается главной прогулочной зоной Томска и упоминается в заданиях проекта?',
      options: ['Лагерный сад', 'Новособорная площадь', 'Ботанический сад ТГУ', 'Белое озеро'],
      correct: 0,
      explanation: 'Лагерный сад — исторический парк Томска, которому посвящены и статьи, и задания на платформе.',
    },
    {
      id: 'engineering-uni',
      text: 'Какой томский университет известен инженерными традициями и упоминается в материалах сайта?',
      options: ['ТУСУР', 'Томский государственный университет', 'СибГМУ', 'ТПУ'],
      correct: 0,
      explanation: 'ТУСУР выделяется инженерными направлениями и активной студенческой жизнью, поэтому входит в подборку материалов проекта.',
    },
    {
      id: 'photo-route',
      text: 'Где проходит маршрут задания «Фотоохота», если верить описанию на странице?',
      options: ['По улице Чехова', 'По набережной Томи', 'В Академгородке', 'На южной развязке'],
      correct: 0,
      explanation: 'Маршрут фотоохоты ведёт по улице Чехова, где нужно найти дома с кружевной резьбой.',
    },
    {
      id: 'after-tasks',
      text: 'Что необходимо сделать после завершения любого задания, чтобы получить баллы?',
      options: ['Загрузить отчёт и дождаться проверки куратора', 'Написать отзыв в соцсетях', 'Позвонить координатору проекта', 'Пройти повторный тест'],
      correct: 0,
      explanation: 'После выполнения задания результаты загружаются в личный кабинет и проходят проверку куратора.',
    },
  ],
  advanced: [
    {
      id: 'photo-detail',
      text: 'Какой элемент обязательно должен попасть в кадр при выполнении «Фотоохоты» на улице Чехова?',
      options: ['Табличка с адресом и резной наличник', 'Фонарь и мостовую', 'Фотографа вместе с группой', 'Соседний каменный дом'],
      correct: 0,
      explanation: 'Условия задания подчёркивают: в кадре должны быть табличка и резной наличник, чтобы подтвердить местоположение.',
    },
    {
      id: 'mini-review',
      text: 'Что получает участник после завершения каждого блока тестовых вопросов?',
      options: ['Мини-справку с разбором ответов', 'Баллы за скорость прохождения', 'Доступ к закрытому чату', 'Приглашение на экскурсию'],
      correct: 0,
      explanation: 'После каждого блока теста участник получает мини-справку, которая помогает закрепить материал.',
    },
    {
      id: 'quiz-points',
      text: 'Сколько баллов начисляется за прохождение тестовых заданий «Легенды Томска»?',
      options: ['25 баллов', '10 баллов', '40 баллов', '60 баллов'],
      correct: 0,
      explanation: 'Метаданные задания указывают награду — 25 баллов за прохождение теста.',
    },
    {
      id: 'adaptive-questions',
      text: 'Как подбираются вопросы в тесте о легендах Томска?',
      options: ['С учётом прочитанных пользователем статей', 'Случайным образом из общей базы', 'По времени суток', 'По рейтингу пользователя'],
      correct: 0,
      explanation: 'Тест адаптируется к интересам участника и формирует вопросы по прочитанным материалам.',
    },
    {
      id: 'profile-recommendations',
      text: 'Что открывается после сохранения результата теста в профиле?',
      options: ['Новые материалы и рекомендации куратора', 'Скидка на экскурсии выходного дня', 'Возможность пропустить фотозадание', 'Автоматическое повышение роли'],
      correct: 0,
      explanation: 'Сохранённый результат открывает доступ к дополнительным материалам и рекомендациям куратора.',
    },
  ],
};

const quizApp = document.getElementById('quizApp');
const startScreen = document.getElementById('quizStart');
const quizForm = document.getElementById('quizForm');
const quizQuestion = document.getElementById('quizQuestion');
const quizOptions = document.getElementById('quizOptions');
const quizProgress = document.getElementById('quizProgress');
const quizScore = document.getElementById('quizScore');
const quizExplanation = document.getElementById('quizExplanation');
const quizResultSection = document.getElementById('quizResult');
const quizResultSummary = document.getElementById('quizResultSummary');
const quizResultDetails = document.getElementById('quizResultDetails');
const quizRestart = document.getElementById('quizRestart');
const quizHistoryBlock = document.getElementById('quizHistory');
const quizHistoryText = document.getElementById('quizHistoryText');
const levelButtons = startScreen ? startScreen.querySelectorAll('[data-level]') : [];
const nextButton = document.getElementById('quizNext');

const state = {
  level: null,
  questions: [],
  index: 0,
  answers: [],
};

const readSession = () => {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (session && session.email) {
      return session;
    }
  } catch (error) {
    console.error('Ошибка чтения данных сессии:', error);
  }
  return null;
};

const loadResults = () => {
  try {
    return JSON.parse(localStorage.getItem(RESULTS_KEY)) ?? {};
  } catch (error) {
    console.error('Ошибка чтения результатов теста:', error);
    return {};
  }
};

const saveResults = (results) => {
  localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
};

const updateHistory = () => {
  if (!quizHistoryBlock || !quizHistoryText) {
    return;
  }

  const session = readSession();
  if (!session) {
    quizHistoryBlock.hidden = true;
    return;
  }

  const results = loadResults();
  const userResult = results[session.email];

  quizHistoryBlock.hidden = false;

  if (!userResult) {
    quizHistoryText.textContent = 'Вы ещё не проходили тест. Выберите уровень, чтобы начать.';
    return;
  }

  const formatter = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' });
  const percent = Math.round((userResult.correct / userResult.total) * 100);
  const levelTitle = userResult.level === 'advanced' ? 'продвинутый' : 'базовый';

  quizHistoryText.textContent = `Последний результат (${levelTitle} уровень): ${userResult.correct} из ${userResult.total} вопросов (${percent}%). Пройдено ${formatter.format(new Date(userResult.timestamp))}.`;
};

const updateProgress = () => {
  if (!quizProgress || !quizScore) {
    return;
  }

  const total = state.questions.length;
  const correct = state.answers.filter((item) => item?.isCorrect).length;
  quizProgress.textContent = `${state.index + 1} из ${total}`;
  quizScore.textContent = `Правильно: ${correct}/${total}`;
};

const renderQuestion = () => {
  const question = state.questions[state.index];
  if (!question) {
    return;
  }

  quizQuestion.textContent = question.text;
  quizOptions.innerHTML = '';
  quizExplanation.hidden = true;
  quizExplanation.textContent = '';
  quizForm.dataset.state = 'answer';

  question.options.forEach((option, index) => {
    const label = document.createElement('label');
    label.className = 'quiz__option';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'answer';
    input.value = String(index);

    const span = document.createElement('span');
    span.textContent = option;

    label.append(input, span);
    quizOptions.appendChild(label);
  });

  nextButton.textContent = 'Ответить';
};

const startQuiz = (level) => {
  state.level = level;
  state.questions = quizData[level] ?? [];
  state.index = 0;
  state.answers = new Array(state.questions.length);

  levelButtons.forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset.level === level ? 'true' : 'false');
  });

  startScreen.hidden = true;
  quizForm.hidden = false;
  quizResultSection.hidden = true;
  renderQuestion();
  updateProgress();
};

const revealAnswer = () => {
  const formData = new FormData(quizForm);
  const answerValue = formData.get('answer');

  if (answerValue === null) {
    quizOptions.dataset.error = 'true';
    setTimeout(() => {
      delete quizOptions.dataset.error;
    }, 400);
    return;
  }

  const question = state.questions[state.index];
  const selectedIndex = Number(answerValue);
  const isCorrect = selectedIndex === question.correct;

  state.answers[state.index] = {
    answerIndex: selectedIndex,
    isCorrect,
  };

  quizOptions.querySelectorAll('input[type="radio"]').forEach((input, index) => {
    input.disabled = true;
    const option = input.closest('.quiz__option');

    if (index === question.correct) {
      option.classList.add('quiz__option--correct');
    }

    if (index === selectedIndex) {
      option.classList.add(isCorrect ? 'quiz__option--selected' : 'quiz__option--incorrect');
    }
  });

  quizExplanation.textContent = question.explanation;
  quizExplanation.hidden = false;
  quizForm.dataset.state = 'next';
  nextButton.textContent = state.index === state.questions.length - 1 ? 'Показать результат' : 'Следующий вопрос';
  updateProgress();
};

const showResults = () => {
  const total = state.questions.length;
  const correct = state.answers.filter((item) => item?.isCorrect).length;
  const session = readSession();

  quizForm.hidden = true;
  quizResultSection.hidden = false;

  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  quizResultSummary.textContent = `Вы ответили правильно на ${correct} из ${total} вопросов (${percent}%).`;

  quizResultDetails.innerHTML = '';

  state.questions.forEach((question, index) => {
    const answer = state.answers[index];
    const item = document.createElement('li');
    item.className = `quiz__result-item ${answer?.isCorrect ? 'quiz__result-item--correct' : 'quiz__result-item--incorrect'}`;

    const title = document.createElement('h4');
    title.textContent = question.text;

    const correctAnswer = document.createElement('p');
    correctAnswer.innerHTML = `<strong>Правильный ответ:</strong> ${question.options[question.correct]}`;

    item.append(title, correctAnswer);

    if (answer && !answer.isCorrect) {
      const userAnswer = document.createElement('p');
      userAnswer.innerHTML = `<strong>Ваш ответ:</strong> ${question.options[answer.answerIndex]}`;
      item.appendChild(userAnswer);
    }

    const detail = document.createElement('p');
    detail.textContent = question.explanation;
    item.appendChild(detail);

    quizResultDetails.appendChild(item);
  });

  if (session) {
    const results = loadResults();
    results[session.email] = {
      level: state.level,
      correct,
      total,
      timestamp: new Date().toISOString(),
    };
    saveResults(results);
    updateHistory();
  }
};

const goToNextStep = () => {
  if (quizForm.dataset.state === 'answer') {
    revealAnswer();
    return;
  }

  if (state.index < state.questions.length - 1) {
    state.index += 1;
    renderQuestion();
    updateProgress();
  } else {
    showResults();
  }
};

const resetQuiz = () => {
  startScreen.hidden = false;
  quizForm.hidden = true;
  quizResultSection.hidden = true;
  quizForm.dataset.state = 'answer';
  quizOptions.innerHTML = '';
  quizExplanation.hidden = true;
  levelButtons.forEach((button) => button.setAttribute('aria-pressed', 'false'));
  if (quizProgress) {
    quizProgress.textContent = '';
  }
  if (quizScore) {
    quizScore.textContent = '';
  }
  if (quizResultSummary) {
    quizResultSummary.textContent = '';
  }
  if (quizResultDetails) {
    quizResultDetails.innerHTML = '';
  }
  updateHistory();
};

if (
  quizApp &&
  startScreen &&
  quizForm &&
  quizQuestion &&
  quizOptions &&
  quizProgress &&
  quizScore &&
  quizExplanation &&
  quizResultSection &&
  quizResultSummary &&
  quizResultDetails &&
  quizRestart &&
  nextButton
) {
  levelButtons.forEach((button) => {
    button.addEventListener('click', () => {
      startQuiz(button.dataset.level);
    });
  });

  quizForm.addEventListener('submit', (event) => {
    event.preventDefault();
    goToNextStep();
  });

  quizRestart.addEventListener('click', () => {
    resetQuiz();
  });

  updateHistory();
}
