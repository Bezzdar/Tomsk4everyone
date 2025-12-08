const API_BASE = 'http://127.0.0.1:5000/api';

(function() {
  console.log('=== PROFILE START ===');

  document.addEventListener('DOMContentLoaded', function() {
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
        'user': 'Пользователь'
      };
      roleElement.textContent = roleMap[user.role] || user.role;
    }

    // Загружаем статьи
    loadUserArticles();

    // Инициализация редактора статей
    initArticleEditor();

    // Обработчики событий
    initEventHandlers();

    console.log('=== PROFILE INITIALIZED ===');
  });

  // ======== Загрузка статей пользователя ========
  async function loadUserArticles() {
    try {
      const token = authHelper.getToken();
      const response = await fetch(`${API_BASE}/user/articles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (err) {
        console.warn('Ошибка парсинга JSON статей:', text);
      }

      displayArticles(data.articles || []);
    } catch (error) {
      console.error('Error loading articles:', error);
      displayArticles([]);
    }
  }

  function displayArticles(articles) {
    const articlesList = document.querySelector('[data-profile-article-list]');
    const articlesEmpty = document.querySelector('[data-articles-empty]');
    const articlesCount = document.querySelector('[data-profile-articles-count]');

    if (!articlesList || !articlesEmpty) return;

    if (articlesCount) articlesCount.textContent = articles.length;

    if (articles.length === 0) {
      articlesEmpty.hidden = false;
      articlesList.hidden = true;
    } else {
      articlesEmpty.hidden = true;
      articlesList.hidden = false;
      articlesList.innerHTML = '';
      articles.forEach(article => {
        articlesList.appendChild(createArticleElement(article));
      });
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

  // ======== Редактор статьи ========
  function initArticleEditor() {
    const editorModal = document.getElementById('articleEditor');
    const openBtn = document.querySelector('[data-open-article-editor]');
    const closeBtns = document.querySelectorAll('[data-close-editor]');
    const form = document.querySelector('[data-article-form]');

    if (!editorModal || !openBtn) return;

    openBtn.addEventListener('click', e => {
      e.preventDefault();
      editorModal.hidden = false;
      document.body.classList.add('modal-open');
      document.getElementById('articleTitle')?.focus();
    });

    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        editorModal.hidden = true;
        document.body.classList.remove('modal-open');
      });
    });

    editorModal.addEventListener('click', e => {
      if (e.target.classList.contains('article-editor__overlay')) {
        editorModal.hidden = true;
        document.body.classList.remove('modal-open');
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !editorModal.hidden) {
        editorModal.hidden = true;
        document.body.classList.remove('modal-open');
      }
    });

    if (!form) return;

    form.addEventListener('submit', async e => {
      e.preventDefault();

      const formData = new FormData(form);
      const articleData = {
        title: formData.get('title') || '',
        content: formData.get('content') || '',
        tags: formData.get('tags') || '',
        link: formData.get('link') || ''
      };

      if (!articleData.title.trim()) return alert('Введите название статьи');
      if (!articleData.content.trim()) return alert('Введите текст статьи');
      if (articleData.content.length < 500) return alert('Текст статьи должен быть не менее 500 символов');

      try {
        const token = authHelper.getToken();

        const response = await fetch(`${API_BASE}/articles`, { // <- исправленный URL
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(articleData)
        });

        const text = await response.text();
        let result = {};
        try {
          result = text ? JSON.parse(text) : {};
        } catch (err) {
          console.warn('Ошибка парсинга JSON при отправке статьи:', text);
        }

        if (!response.ok) throw new Error(result.error || 'Ошибка отправки статьи');

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

  // ======== Другие обработчики ========
  function initEventHandlers() {
    const logoutBtn = document.querySelector('[data-profile-logout]');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', e => {
        e.preventDefault();
        if (confirm('Вы уверены, что хотите выйти?')) {
          authHelper.clearAuthData();
          window.location.href = './auth.html';
        }
      });
    }

    const nameForm = document.querySelector('[data-profile-name-form]');
    if (nameForm) {
      nameForm.addEventListener('submit', async e => {
        e.preventDefault();
        const nameInput = document.querySelector('[data-profile-name]');
        const newName = nameInput.value.trim();
        if (!newName) return alert('Введите имя');

        try {
          const token = authHelper.getToken();
          const response = await fetch(`${API_BASE}/user/profile`, { // <- исправленный URL
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: newName })
          });

          if (response.ok) {
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
        } catch (error) {
          console.error('Error updating name:', error);
          alert('Ошибка обновления имени');
        }
      });
    }
  }

})();
