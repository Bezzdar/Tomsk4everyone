const API_BASE = 'http://127.0.0.1:5000/api';

(function() {
  console.log('=== PROFILE START ===');

  document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM loaded for profile');

    if (!window.authHelper || !authHelper.isLoggedIn()) {
      console.error('User not logged in!');
      return;
    }

    const user = authHelper.getUser();
    const token = authHelper.getToken();

    console.log('Profile user:', user);
    console.log('Profile token:', token ? 'exists' : 'missing');

    // Заполняем основную информацию
    document.querySelector('[data-profile-name]').value = user.name || '';
    document.querySelector('[data-profile-email]').textContent = user.email || '';

    const roleElement = document.querySelector('[data-profile-role]');
    if (roleElement) {
      const roleMap = {
        'admin': 'Администратор',
        'curator': 'Куратор',
        'moderator': 'Модератор',
        'user': 'Пользователь'
      };
      roleElement.textContent = roleMap[user.role] || user.role;
    }

    // Панель администратора для admin/curator
    const adminBtn = document.getElementById('openAdminPanel');
    if (adminBtn && (user.role === 'admin' || user.role === 'curator')) {
      adminBtn.hidden = false;
    }

    // Показываем или скрываем редакторы по роли
    const articleEditorBtn = document.querySelector('[data-open-article-editor]');
    const moderatorList = document.querySelector('[data-profile-user-article-list]');
    const moderatorControls = document.querySelector('[data-moderator-controls]');

    if(user.role === 'moderator' || user.role === 'curator') {
      if(articleEditorBtn) articleEditorBtn.hidden = true;
      if(moderatorList) moderatorList.hidden = false;
      if(moderatorControls) moderatorControls.hidden = false;
      await loadUserSubmittedArticles(); 
    } else {
      if(articleEditorBtn) articleEditorBtn.hidden = false;
      if(moderatorList) moderatorList.hidden = true;
      if(moderatorControls) moderatorControls.hidden = true;
      await loadUserArticles();
    }



    // Инициализация редактора статей
    initArticleEditor();
    initModeratorEditor();

    // Обработчики событий
    initEventHandlers();

    console.log('=== PROFILE INITIALIZED ===');
  });

  // ======== Загрузка статей пользователя ========
  async function loadUserArticles() {
    try {
      const token = authHelper.getToken();
      const response = await fetch(`${API_BASE}/user/articles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const text = await response.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch {}
      displayArticles(data.articles || []);
    } catch (err) {
      console.error('Error loading articles:', err);
      displayArticles([]);
    }
  }

  function displayArticles(articles) {
    const articlesList = document.querySelector('[data-profile-article-list]');
    const articlesEmpty = document.querySelector('[data-articles-empty]');
    const articlesCount = document.querySelector('[data-profile-articles-count]');

    if(!articlesList || !articlesEmpty) return;

    if(articlesCount) articlesCount.textContent = articles.length;

    if(articles.length === 0) {
      articlesEmpty.hidden = false;
      articlesList.hidden = true;
    } else {
      articlesEmpty.hidden = true;
      articlesList.hidden = false;
      articlesList.innerHTML = '';
      articles.forEach(article => articlesList.appendChild(createArticleElement(article)));
    }
  }

  function createArticleElement(article) {
    const li = document.createElement('li');
    li.className = 'profile-article-item';
    const statusMap = {
      'draft': { text: 'Черновик', class: 'status-draft' },
      'submitted': { text: 'На модерации', class: 'status-submitted' },
      'published': { text: 'Опубликовано', class: 'status-published' },
      'rejected': { text: 'Отклонено', class: 'status-rejected' }
    };
    const status = statusMap[article.status] || { text: article.status, class: '' };

    li.innerHTML = `
      <div class="profile-article-item__header">
        <h3 class="profile-article-item__title">${article.title}</h3>
        <span class="profile-article-item__status ${status.class}">${status.text}</span>
      </div>
      <p class="profile-article-item__description">${article.excerpt || ''}</p>
      <div class="profile-article-item__meta">
        <span class="profile-article-item__date">${new Date(article.createdAt).toLocaleDateString('ru-RU')}</span>
        ${article.link ? `<a href="${article.link}" target="_blank" class="profile-article-item__link">Открыть</a>` : ''}
      </div>
    `;
    return li;
  }

  // ======== Редактор для обычного пользователя ========
  function initArticleEditor() {
    const editorModal = document.getElementById('articleEditor');
    const openBtn = document.querySelector('[data-open-article-editor]');
    const closeBtns = document.querySelectorAll('[data-close-editor]');
    const form = document.querySelector('[data-article-form]');
    if(!editorModal || !openBtn) return;

    openBtn.addEventListener('click', e => {
      e.preventDefault();
      editorModal.hidden = false;
      document.body.classList.add('modal-open');
      document.getElementById('articleTitle')?.focus();
    });

    closeBtns.forEach(btn => btn.addEventListener('click', () => {
      editorModal.hidden = true;
      document.body.classList.remove('modal-open');
    }));

    editorModal.addEventListener('click', e => {
      if(e.target.classList.contains('article-editor__overlay')) {
        editorModal.hidden = true;
        document.body.classList.remove('modal-open');
      }
    });

    document.addEventListener('keydown', e => {
      if(e.key === 'Escape' && !editorModal.hidden) {
        editorModal.hidden = true;
        document.body.classList.remove('modal-open');
      }
    });

    if(!form) return;

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const formData = new FormData(form);
      const articleData = {
        title: formData.get('title') || '',
        content: formData.get('content') || '',
        tags: formData.get('tags') || '',
        link: formData.get('link') || ''
      };

      if(!articleData.title.trim()) return alert('Введите название статьи');
      if(!articleData.content.trim()) return alert('Введите текст статьи');
      if(articleData.content.length < 500) return alert('Текст статьи должен быть не менее 500 символов');

      try {
        const token = authHelper.getToken();
        const response = await fetch(`${API_BASE}/articles`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(articleData)
        });

        const text = await response.text();
        let result = {};
        try { result = text ? JSON.parse(text) : {}; } catch {}

        if(!response.ok) throw new Error(result.error || 'Ошибка отправки статьи');

        editorModal.hidden = true;
        document.body.classList.remove('modal-open');
        form.reset();
        await loadUserArticles();
        alert(result.message || 'Статья отправлена на модерацию!');
      } catch (error) {
        console.error('Error submitting article:', error);
        alert(error.message || 'Ошибка при отправке статьи');
      }
    });
  }

  // ======== Загрузка статей пользователей для модератора ========
  async function loadUserSubmittedArticles() {
    try {
      const token = authHelper.getToken();
      const response = await fetch(`${API_BASE}/moderator/articles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const text = await response.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch {}
      displayModeratorArticles(data.articles || []);
    } catch (err) {
      console.error('Ошибка загрузки статей для модератора:', err);
      displayModeratorArticles([]);
    }
  }

  function displayModeratorArticles(articles) {
    const list = document.querySelector('[data-profile-user-article-list]');
    if(!list) return;
    list.innerHTML = '';
    if(articles.length === 0) {
      list.innerHTML = '<li>Статей от пользователей пока нет.</li>';
      return;
    }

    articles.forEach(article => {
      const li = document.createElement('li');
      li.className = 'profile-article-item';
      li.innerHTML = `
        <h3>${article.title}</h3>
        <p>${article.excerpt || ''}</p>
        <button class="profile-button" data-edit-user-article data-article-id="${article.id}">
          Просмотр и редактирование
        </button>
      `;
      list.appendChild(li);
    });

    list.querySelectorAll('[data-edit-user-article]').forEach(btn => {
      btn.addEventListener('click', e => {
        const articleId = btn.getAttribute('data-article-id');
        openModeratorEditor(articleId);
      });
    });
  }

  // ======== Редактор для модератора ========
  function initModeratorEditor() {
  const modal = document.getElementById('moderatorArticleEditor');
  if (!modal) return;

  const form = modal.querySelector('[data-moderator-article-form]');
  if (!form) return;

  // Закрытие модалки
  modal.querySelector('[data-close-editor]')?.addEventListener('click', () => {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
  });
  modal.addEventListener('click', e => {
    if (e.target.classList.contains('article-editor__overlay')) {
      modal.hidden = true;
      document.body.classList.remove('modal-open');
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.hidden) {
      modal.hidden = true;
      document.body.classList.remove('modal-open');
    }
  });

  // Сохраняем изменения через сабмит формы
  form.addEventListener('submit', async e => {
    e.preventDefault(); // обязательно, чтобы не перезагрузилась страница

    const saveBtn = modal.querySelector('[data-save-article]');
    const articleId = saveBtn?.getAttribute('data-article-id');
    if (!articleId) return alert('Не удалось определить статью');

    const title = form.querySelector('[name="title"]').value.trim();
    const content = form.querySelector('[name="content"]').value.trim();
    const tags = form.querySelector('[name="tags"]').value.trim();
    const link = form.querySelector('[name="link"]').value.trim();

    try {
      const token = authHelper.getToken();
      const response = await fetch(`${API_BASE}/articles/${articleId}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ title, content, tags, link, status: 'submitted' })
      });

      if (!response.ok) throw new Error('Ошибка при сохранении статьи');

      modal.hidden = true;
      document.body.classList.remove('modal-open');
      await loadUserSubmittedArticles();
      alert('Статья успешно проверена и обновлена!');
    } catch (err) {
      console.error(err);
      alert('Ошибка при сохранении статьи');
    }
  });
}


  function openModeratorEditor(articleId) {
  const modal = document.getElementById('moderatorArticleEditor');
  if (!modal) return;

  modal.hidden = false;
  document.body.classList.add('modal-open');

  fetch(`${API_BASE}/articles/${articleId}`, {
    headers: { 'Authorization': `Bearer ${authHelper.getToken()}` }
  })
    .then(res => res.json())
    .then(result => {
      const article = result.article; // правильно достаем объект article
      console.log('Loaded article:', article);

      modal.querySelector('[name="title"]').value = article.title || '';
      modal.querySelector('[name="content"]').value = article.content || '';
      modal.querySelector('[name="tags"]').value = article.tags || '';
      modal.querySelector('[name="link"]').value = article.link || '';
      modal.querySelector('[data-save-article]').setAttribute('data-article-id', article.id);
    })
    .catch(err => {
      console.error('Ошибка загрузки статьи для редактирования:', err);
      alert('Не удалось загрузить статью для редактирования');
    });
}

  // ======== Другие обработчики ========
  function initEventHandlers() {
    const logoutBtn = document.querySelector('[data-profile-logout]');
    if(logoutBtn) {
      logoutBtn.addEventListener('click', e => {
        e.preventDefault();
        if(confirm('Вы уверены, что хотите выйти?')) {
          authHelper.clearAuthData();
          window.location.href = './auth.html';
        }
      });
    }

    const nameForm = document.querySelector('[data-profile-name-form]');
    if(nameForm) {
      nameForm.addEventListener('submit', async e => {
        e.preventDefault();
        const nameInput = document.querySelector('[data-profile-name]');
        const newName = nameInput.value.trim();
        if(!newName) return alert('Введите имя');

        try {
          const token = authHelper.getToken();
          const response = await fetch(`${API_BASE}/user/profile`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
          });

          if(response.ok) {
            const user = authHelper.getUser();
            user.name = newName;
            localStorage.setItem('user_data', JSON.stringify(user));
            alert('Имя успешно обновлено');
          } else {
            const text = await response.text();
            let result = {};
            try { result = text ? JSON.parse(text) : {}; } catch {}
            alert(result.error || 'Ошибка обновления имени');
          }
        } catch(error) {
          console.error('Error updating name:', error);
          alert('Ошибка обновления имени');
        }
      });
    }
  }

})();
