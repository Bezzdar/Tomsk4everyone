/**
 * Profile UI for user-test-ready flows.
 */
(function () {
  'use strict';

  const API_BASE = window.APP_CONFIG?.API_BASE || '/api';
  const STATUS_MAP = {
    draft:          { text: 'Черновик',            cls: 'status-draft' },
    submitted:      { text: 'На проверке',          cls: 'status-submitted' },
    needs_revision: { text: 'Требуется доработка', cls: 'status-needs-revision' },
    approved:       { text: 'Одобрено',             cls: 'status-approved' },
    published:      { text: 'Опубликовано',          cls: 'status-published' },
  };
  const ROLE_LABEL = {
    admin: 'Администратор',
    curator: 'Модератор',
    user: 'Пользователь',
  };

  let allModArticles = [];
  let activeFilter = 'all';
  let userArticles = [];

  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.authHelper?.isLoggedIn()) return;
    await refreshProfile();

    const user = authHelper.getUser();
    const isModerator = ['curator', 'admin'].includes(user.role);
    document.getElementById('user-articles-section').hidden = isModerator;
    document.getElementById('mod-panel-section').hidden = !isModerator;
    document.querySelector('[data-profile-content]')?.removeAttribute('hidden');

    if (isModerator) {
      await loadModeratorArticles();
      initModFilters();
    } else {
      await loadUserArticles();
      document.getElementById('open-editor-btn')?.addEventListener('click', () => {
        window.ArticleEditor?.open({ onSuccess: loadUserArticles });
      });
    }

    initNameForm();
    initLogout();
    initArticleViewModal();
  });

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${authHelper.getToken() || ''}`,
        ...(options.headers || {}),
      },
    });
    if (authHelper.handleUnauthorized(response)) throw new Error('Сессия истекла');
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const suffix = payload.requestId ? ` Код обращения: ${payload.requestId}` : '';
      throw new Error((payload.error || 'Ошибка запроса') + suffix);
    }
    return payload;
  }

  async function refreshProfile() {
    try {
      const data = await api('/user/profile');
      authHelper.updateUser(data.user);
      renderUserInfo(data.user);
    } catch (error) {
      showFeedback(error.message, true);
    }
  }

  function renderUserInfo(user) {
    const name = document.querySelector('[data-profile-name]');
    if (name) name.value = user.name || '';
    const email = document.querySelector('[data-profile-email]');
    if (email) email.textContent = user.email || '';
    const role = document.querySelector('[data-profile-role]');
    if (role) role.textContent = ROLE_LABEL[user.role] || user.role;
    const tasks = document.querySelector('[data-profile-tasks-count]');
    if (tasks) tasks.textContent = (user.completedTasks || []).length;
  }

  async function loadUserArticles() {
    const list = document.getElementById('user-article-list');
    try {
      const data = await api('/user/articles');
      userArticles = data.articles || [];
      renderUserArticles();
    } catch (error) {
      if (list) list.innerHTML = `<li>${escapeHtml(error.message)}</li>`;
    }
  }

  function renderUserArticles() {
    const list = document.getElementById('user-article-list');
    const empty = document.getElementById('user-articles-empty');
    const count = document.querySelector('[data-profile-articles-count]');
    if (!list || !empty) return;

    if (count) count.textContent = userArticles.length;
    list.innerHTML = '';
    empty.hidden = userArticles.length > 0;

    userArticles.forEach((article) => {
      const status = STATUS_MAP[article.status] || { text: article.status, cls: '' };
      const canEdit = ['draft', 'needs_revision'].includes(article.status);
      const item = document.createElement('li');
      item.className = 'profile-article-item';
      item.innerHTML = `
        <div class="profile-article-item__header">
          <h3 class="profile-article-item__title">${escapeHtml(article.title)}</h3>
          <span class="profile-article-item__status ${status.cls}">${status.text}</span>
        </div>
        <p class="profile-article-item__description">${escapeHtml(article.excerpt || '')}</p>
        ${article.moderatorComment ? `<div class="user-article-comment">Комментарий модератора: ${escapeHtml(article.moderatorComment)}</div>` : ''}
        <div class="profile-article-item__meta">
          <span class="profile-article-item__date">${formatDate(article.updatedAt || article.createdAt)}</span>
          <span style="display:flex;gap:.5rem;flex-wrap:wrap">
            ${canEdit ? `<button type="button" class="profile-button" data-edit-article="${article.id}">Редактировать</button>` : ''}
            ${article.status === 'published' ? `<a href="${escapeHtml(article.link)}" class="profile-article-item__link">Открыть →</a>` : ''}
          </span>
        </div>`;
      list.appendChild(item);
    });

    list.querySelectorAll('[data-edit-article]').forEach((button) => {
      button.addEventListener('click', () => {
        const article = userArticles.find((entry) => entry.id === Number(button.dataset.editArticle));
        if (!article) return;
        window.ArticleEditor?.open({ article, onSuccess: loadUserArticles });
      });
    });
  }

  async function loadModeratorArticles() {
    const container = document.getElementById('mod-articles-list');
    try {
      const data = await api('/moderator/articles');
      allModArticles = data.articles || [];
      renderModArticles();
      updatePendingCount();
    } catch (error) {
      if (container) container.innerHTML = `<p style="color:#c00">${escapeHtml(error.message)}</p>`;
    }
  }

  function updatePendingCount() {
    const element = document.getElementById('mod-pending-count');
    if (element) element.textContent = allModArticles.filter((a) => a.status === 'submitted').length;
  }

  function initModFilters() {
    document.querySelectorAll('.mod-filter-btn').forEach((button) => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.mod-filter-btn').forEach((b) => b.classList.remove('active'));
        button.classList.add('active');
        activeFilter = button.dataset.filter;
        renderModArticles();
      });
    });
  }

  function renderModArticles() {
    const container = document.getElementById('mod-articles-list');
    if (!container) return;
    const articles = activeFilter === 'all'
      ? allModArticles
      : allModArticles.filter((article) => article.status === activeFilter);

    if (!articles.length) {
      container.innerHTML = '<p style="color:#888;padding:1rem 0">Статей нет.</p>';
      return;
    }

    container.innerHTML = articles.map(renderModCard).join('');
    container.querySelectorAll('[data-mod-action]').forEach((button) => {
      button.addEventListener('click', () => openModerationAction(button));
    });
    container.querySelectorAll('[data-view-article]').forEach((button) => {
      button.addEventListener('click', () => openArticleView(button.dataset.viewArticle));
    });
  }

  function renderModCard(article) {
    const status = STATUS_MAP[article.status] || { text: article.status, cls: '' };
    let actions = '';
    if (article.status === 'submitted') {
      actions = `
        <button class="mod-btn mod-btn--revision" data-mod-action="needs_revision" data-article-id="${article.id}">Вернуть на доработку</button>
        <button class="mod-btn mod-btn--approved" data-mod-action="approved" data-article-id="${article.id}">Одобрить</button>`;
    } else if (article.status === 'approved') {
      actions = `<button class="mod-btn mod-btn--publish" data-mod-action="published" data-article-id="${article.id}">Опубликовать</button>`;
    } else if (article.status === 'needs_revision') {
      actions = '<span style="color:#777;font-size:.85rem">Ожидается повторная отправка автора.</span>';
    }

    return `
      <div class="mod-article-card" id="mod-card-${article.id}">
        <div class="mod-article-card__header">
          <h3>${escapeHtml(article.title)}</h3>
          <span class="status-badge ${status.cls}">${status.text}</span>
        </div>
        <div class="mod-article-card__meta">Автор: <strong>${escapeHtml(article.authorName || 'Аноним')}</strong> · ${formatDate(article.updatedAt || article.createdAt)}</div>
        <div class="mod-article-card__excerpt">${escapeHtml(article.excerpt || '')}</div>
        ${article.moderatorComment ? `<div class="user-article-comment">Предыдущий комментарий: ${escapeHtml(article.moderatorComment)}</div>` : ''}
        <div class="mod-actions">
          <button class="mod-btn mod-btn--read" data-view-article="${article.id}">Читать полностью</button>
          ${actions}
        </div>
        <div class="mod-comment-row" id="mod-comment-${article.id}">
          <textarea placeholder="Комментарий для автора..."></textarea>
          <button type="button">Подтвердить</button>
        </div>
      </div>`;
  }

  function openModerationAction(button) {
    const row = document.getElementById(`mod-comment-${button.dataset.articleId}`);
    if (!row) return;
    row.dataset.pendingAction = button.dataset.modAction;
    row.classList.add('open');
    const textarea = row.querySelector('textarea');
    if (button.dataset.modAction === 'needs_revision') {
      textarea.placeholder = 'Укажите, что нужно исправить (обязательно)';
    } else {
      textarea.placeholder = 'Комментарий для автора (необязательно)';
    }
    row.querySelector('button').onclick = () => confirmModAction(button.dataset.articleId);
    textarea.focus();
  }

  async function confirmModAction(articleId) {
    const row = document.getElementById(`mod-comment-${articleId}`);
    const action = row?.dataset.pendingAction;
    const comment = row?.querySelector('textarea')?.value.trim() || '';
    if (!action) return;
    if (action === 'needs_revision' && !comment) {
      alert('Укажите, что автору нужно исправить.');
      return;
    }

    try {
      const data = await api(`/moderator/articles/${articleId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: action, comment }),
      });
      showFeedback(data.message || 'Статус обновлён');
      await loadModeratorArticles();
    } catch (error) {
      alert(error.message);
    }
  }

  async function openArticleView(articleId) {
    const overlay = document.getElementById('article-view-overlay');
    const title = document.getElementById('article-view-title');
    const meta = document.getElementById('article-view-meta');
    const body = document.getElementById('article-view-body');
    if (!overlay || !title || !body) return;

    overlay.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    title.textContent = 'Загрузка...';
    body.textContent = '';

    try {
      const data = await api(`/articles/${articleId}`);
      const article = data.article;
      title.textContent = article.title;
      meta.textContent = `Автор: ${article.authorName || 'Аноним'} · ${formatDate(article.updatedAt || article.createdAt)}`;
      body.innerHTML = article.content || '<em>Содержание отсутствует</em>';
    } catch (error) {
      body.textContent = error.message;
    }
  }

  function initArticleViewModal() {
    const overlay = document.getElementById('article-view-overlay');
    document.getElementById('article-view-close')?.addEventListener('click', closeArticleView);
    overlay?.addEventListener('click', (event) => {
      if (event.target === overlay) closeArticleView();
    });
  }

  function closeArticleView() {
    document.getElementById('article-view-overlay')?.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  function initNameForm() {
    document.querySelector('[data-profile-name-form]')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = document.querySelector('[data-profile-name]')?.value.trim();
      if (!name) return;
      try {
        const data = await api('/user/profile', {
          method: 'PUT',
          body: JSON.stringify({ name }),
        });
        authHelper.updateUser(data.user);
        renderUserInfo(data.user);
        showFeedback('Имя сохранено');
      } catch (error) {
        showFeedback(error.message, true);
      }
    });
  }

  function initLogout() {
    document.querySelector('[data-profile-logout]')?.addEventListener('click', () => {
      authHelper.clearAuthData();
      window.location.href = './auth.html';
    });
  }

  function showFeedback(message, isError = false) {
    const element = document.querySelector('[data-profile-feedback]');
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('error', isError);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  }
})();
