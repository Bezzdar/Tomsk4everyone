const RESULTS_KEY = 'tomsk4everyone_quiz_results';

const quizData = {
  base: [
    { id:'dracula-nickname', text:'Какое название закрепилось за купеческим домом на Горького благодаря городской легенде?', options:['Дом Дракулы','Дом путешественника','Дом золотых ворот','Дом старого инженера'], correct:0, explanation:'Особняк в городской традиции называют «Домом Дракулы».' },
    { id:'main-park', text:'Какое место считается главной прогулочной зоной Томска и упоминается в заданиях проекта?', options:['Лагерный сад','Новособорная площадь','Ботанический сад ТГУ','Белое озеро'], correct:0, explanation:'Лагерному саду посвящены материалы и задания платформы.' },
    { id:'engineering-uni', text:'Какой томский университет известен инженерными традициями и упоминается в материалах сайта?', options:['ТУСУР','Томский государственный университет','СибГМУ','ТПУ'], correct:0, explanation:'В материалах проекта отдельно представлен ТУСУР.' },
    { id:'photo-route', text:'Где проходит маршрут задания «Фотоохота»?', options:['По улице Чехова','По набережной Томи','В Академгородке','На южной развязке'], correct:0, explanation:'Маршрут фотоохоты проходит по улице Чехова.' },
    { id:'after-tasks', text:'Что предусмотрено после выполнения задания, требующего проверки?', options:['Проверка результата перед начислением награды','Автоматическое начисление за открытие страницы','Звонок координатору','Повторная регистрация'], correct:0, explanation:'Для заданий, которые нельзя проверить автоматически, награда не должна начисляться только по нажатию кнопки.' },
  ],
  advanced: [
    { id:'photo-detail', text:'Какой элемент должен попасть в кадр в задании «Фотоохота» на улице Чехова?', options:['Табличка с адресом и резной наличник','Фонарь и мостовая','Фотограф с группой','Соседний каменный дом'], correct:0, explanation:'Условия задания требуют зафиксировать адрес и характерную деталь фасада.' },
    { id:'mini-review', text:'Что получает участник после блока вопросов?', options:['Разбор ответов','Баллы за скорость','Закрытый чат','Билет на экскурсию'], correct:0, explanation:'После вопросов показывается разбор выбранных и правильных ответов.' },
    { id:'quiz-points', text:'Сколько кедрокоинов начисляется за тест «Легенды Томска»?', options:['25','10','40','60'], correct:0, explanation:'Награда за quiz-legends хранится в базе и составляет 25.' },
    { id:'article-draft', text:'Какой статус должна иметь статья после команды «Сохранить черновик»?', options:['draft','submitted','approved','published'], correct:0, explanation:'Черновик не отправляется модератору до отдельной отправки.' },
    { id:'revision-cycle', text:'Что происходит после того, как автор исправил статью со статусом «Требуется доработка»?', options:['Автор повторно отправляет её на модерацию','Она автоматически публикуется','Она удаляется','Роль автора меняется'], correct:0, explanation:'После правок статья снова переходит в submitted только по явной отправке автора.' },
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
const nextButton = document.getElementById('quizNext');
const levelButtons = startScreen ? startScreen.querySelectorAll('[data-level]') : [];

const state = { level:null, questions:[], index:0, answers:[] };
const readSession = () => window.authHelper?.getUser?.() || null;

function loadResults() {
  try { return JSON.parse(localStorage.getItem(RESULTS_KEY)) || {}; }
  catch { return {}; }
}
function saveResults(results) { localStorage.setItem(RESULTS_KEY, JSON.stringify(results)); }

function updateHistory() {
  if (!quizHistoryBlock || !quizHistoryText) return;
  const user = readSession();
  if (!user) { quizHistoryBlock.hidden = true; return; }
  quizHistoryBlock.hidden = false;
  const result = loadResults()[user.email];
  if (!result) { quizHistoryText.textContent = 'Вы ещё не проходили тест.'; return; }
  const percent = Math.round((result.correct / result.total) * 100);
  quizHistoryText.textContent = `Последний результат: ${result.correct} из ${result.total} (${percent}%).`;
}

function updateProgress() {
  const total = state.questions.length;
  const correct = state.answers.filter((answer) => answer?.isCorrect).length;
  if (quizProgress) quizProgress.textContent = `${state.index + 1} из ${total}`;
  if (quizScore) quizScore.textContent = `Правильно: ${correct}/${total}`;
}

function renderQuestion() {
  const question = state.questions[state.index];
  if (!question || !quizQuestion || !quizOptions || !quizForm || !nextButton) return;
  quizQuestion.textContent = question.text;
  quizOptions.innerHTML = '';
  quizExplanation.hidden = true;
  quizExplanation.textContent = '';
  quizForm.dataset.state = 'answer';

  question.options.forEach((option, index) => {
    const label = document.createElement('label');
    label.className = 'quiz__option';
    const input = document.createElement('input');
    input.type = 'radio'; input.name = 'answer'; input.value = String(index);
    const span = document.createElement('span'); span.textContent = option;
    label.append(input, span); quizOptions.appendChild(label);
  });
  nextButton.textContent = 'Ответить';
}

function startQuiz(level) {
  state.level = level;
  state.questions = quizData[level] || [];
  state.index = 0;
  state.answers = new Array(state.questions.length);
  startScreen.hidden = true;
  quizForm.hidden = false;
  quizResultSection.hidden = true;
  levelButtons.forEach((button) => button.setAttribute('aria-pressed', button.dataset.level === level ? 'true' : 'false'));
  renderQuestion(); updateProgress();
}

function revealAnswer() {
  const answerValue = new FormData(quizForm).get('answer');
  if (answerValue === null) return;
  const question = state.questions[state.index];
  const selectedIndex = Number(answerValue);
  const isCorrect = selectedIndex === question.correct;
  state.answers[state.index] = { answerIndex:selectedIndex, isCorrect };

  quizOptions.querySelectorAll('input[type="radio"]').forEach((input, index) => {
    input.disabled = true;
    const option = input.closest('.quiz__option');
    if (index === question.correct) option.classList.add('quiz__option--correct');
    if (index === selectedIndex) option.classList.add(isCorrect ? 'quiz__option--selected' : 'quiz__option--incorrect');
  });
  quizExplanation.textContent = question.explanation;
  quizExplanation.hidden = false;
  quizForm.dataset.state = 'next';
  nextButton.textContent = state.index === state.questions.length - 1 ? 'Показать результат' : 'Следующий вопрос';
  updateProgress();
}

async function showResults() {
  const total = state.questions.length;
  const correct = state.answers.filter((answer) => answer?.isCorrect).length;
  const user = readSession();
  quizForm.hidden = true;
  quizResultSection.hidden = false;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  quizResultSummary.textContent = `Вы ответили правильно на ${correct} из ${total} вопросов (${percent}%).`;
  quizResultDetails.innerHTML = '';

  state.questions.forEach((question, index) => {
    const answer = state.answers[index];
    const item = document.createElement('li');
    item.className = `quiz__result-item ${answer?.isCorrect ? 'quiz__result-item--correct' : 'quiz__result-item--incorrect'}`;
    const title = document.createElement('h4'); title.textContent = question.text;
    const correctAnswer = document.createElement('p'); correctAnswer.textContent = `Правильный ответ: ${question.options[question.correct]}`;
    item.append(title, correctAnswer);
    if (answer && !answer.isCorrect) {
      const userAnswer = document.createElement('p'); userAnswer.textContent = `Ваш ответ: ${question.options[answer.answerIndex]}`; item.appendChild(userAnswer);
    }
    const detail = document.createElement('p'); detail.textContent = question.explanation; item.appendChild(detail);
    quizResultDetails.appendChild(item);
  });

  if (user) {
    const results = loadResults();
    results[user.email] = { level:state.level, correct, total, timestamp:new Date().toISOString() };
    saveResults(results);
    updateHistory();
    await window.ProfileStore?.markTaskCompleted('quiz-legends');
  }
}

function nextStep() {
  if (quizForm.dataset.state === 'answer') { revealAnswer(); return; }
  if (state.index < state.questions.length - 1) {
    state.index += 1; renderQuestion(); updateProgress();
  } else {
    showResults();
  }
}

function resetQuiz() {
  startScreen.hidden = false;
  quizForm.hidden = true;
  quizResultSection.hidden = true;
  quizForm.dataset.state = 'answer';
  quizOptions.innerHTML = '';
  quizExplanation.hidden = true;
  quizResultSummary.textContent = '';
  quizResultDetails.innerHTML = '';
  levelButtons.forEach((button) => button.setAttribute('aria-pressed', 'false'));
  updateHistory();
}

if (quizApp && startScreen && quizForm && quizQuestion && quizOptions && quizProgress && quizScore && quizExplanation && quizResultSection && quizResultSummary && quizResultDetails && quizRestart && nextButton) {
  levelButtons.forEach((button) => button.addEventListener('click', () => startQuiz(button.dataset.level)));
  quizForm.addEventListener('submit', (event) => { event.preventDefault(); nextStep(); });
  quizRestart.addEventListener('click', resetQuiz);
  updateHistory();
}
