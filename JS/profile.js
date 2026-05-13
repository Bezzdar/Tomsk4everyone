/**
 * profile.js
 * Личный кабинет: пользователь видит свои статьи, модератор — панель модерации.
 */
(function () {
  'use strict';

  const API_BASE = window.APP_CONFIG?.API_BASE || 'http://77.222.43.106:5000/api';

  const STATUS_MAP = {
    draft:          { text: 'Черновик',           cls: 'status-draft' },
    submitted:      { text: 'На проверке',         cls: 'status-submitted' },
    needs_revision: { text: 'Требуется редактура', cls: 'status-needs-revision' },
    approved:       { text: 'Одобрено',            cls: 'status-approved' },
    published:      { text: 'Опубликовано',         cls: 'status-published' },
  };

  const ROLE_LABEL = {
    admin:   'Администратор',
    curator: 'Куратор',
    user:    'Пользователь',
  };

  let allModArticles = [];
  let activeFilter = 'all';

  document.addEventListener('DOMContentLoaded', async () => {
    if (!window.authHelper?.isLoggedIn()) return;

    const user = authHelper.getUser();
    _renderUserInfo(user);

    const isMod = ['curator', 'admin'].includes(user.role);

    document.getElementById('user-articles-section').hidden = isMod;
    document.getElementById('mod-panel-section').hidden = !isMod;
    document.querySelector('[data-profile-content]').removeAttribute('hidden');

    if (isMod) {
      await _loadModeratorArticles();
      _initModFilters();
    } else {
      await _loadUserArticles();
      _initEditorButton();
    }

    _initNameForm();
    _initLogout();
    _initArticleViewModal();
  });

  // ─── User info ────────────────────────────────────────────────────────────

  function _renderUserInfo(user) {
    const nameEl = document.querySelector('[data-profile-name]');
    if (nameEl) nameEl.value = user.name || '';

    const emailEl = document.querySelector('[data-profile-email]');
    if (emailEl) emailEl.textContent = user.email || '';

    const roleEl = document.querySelector('[data-profile-role]');
    if (roleEl) roleEl.textContent = ROLE_LABEL[user.role] || user.role;

    const taskCount = document.querySelector('[data-profile-tasks-count]');
    if (taskCount) taskCount.textContent = (user.completedTasks || []).length;
  }

  // ─── User articles ────────────────────────────────────────────────────────

  async function _loadUserArticles() {
    const token = authHelper.getToken();
    try {
      const res = await fetch(`${API_BASE}/user/articles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      _renderUserArticles(data.articles || []);
    } catch {
      _renderUserArticles([]);
    }
  }

  function _renderUserArticles(articles) {
    const list = document.getElementById('user-article-list');
    const empty = document.getElementById('user-articles-empty');
    const count = document.querySelector('[data-profile-articles-count]');

    if (count) count.textContent = articles.length;
    list.innerHTML = '';

    if (!articles.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    articles.forEach(a => {
      const st = STATUS_MAP[a.status] || { text: a.status, cls: '' };
      const li = document.createElement('li');
      li.className = 'profile-article-item';
      li.innerHTML = `
        <div class="profile-article-item__header">
          <h3 class="profile-article-item__title">${_esc(a.title)}</h3>
          <span class="profile-article-item__status ${st.cls}">${st.text}</span>
        </div>
        <p class="profile-article-item__description">${_esc(a.excerpt || '')}</p>
        ${a.moderatorComment ? `<div class="user-article-comment">💬 Комментарий модератора: ${_esc(a.moderatorComment)}</div>` : ''}
        <div class="profile-article-item__meta">
          <span class="profile-article-item__date">${_formatDate(a.createdAt)}</span>
          ${a.status === 'published' ? `<a href="${_esc(a.link)}" target="_blank" class="profile-article-item__link">Открыть →</a>` : ''}
        </div>`;
      list.appendChild(li);
    });
  }

  function _initEditorButton() {
    document.getElementById('open-editor-btn')?.addEventListener('click', () => {
      window.ArticleEditor?.open({ onSuccess: () => _loadUserArticles() });
    });
  }

  // ─── Moderator articles ───────────────────────────────────────────────────

  async function _loadModeratorArticles() {
    const token = authHelper.getToken();
    try {
      const res = await fetch(`${API_BASE}/moderator/articles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      allModArticles = data.articles || [];
      _renderModArticles();
      _updatePendingCount();
    } catch (err) {
      console.error('Ошибка загрузки статей:', err);
      document.getElementById('mod-articles-list').innerHTML =
        '<p style="color:#c00">Не удалось загрузить статьи</p>';
    }
  }

  function _updatePendingCount() {
    const pending = allModArticles.filter(a => a.status === 'submitted').length;
    const el = document.getElementById('mod-pending-count');
    if (el) el.textContent = pending;
  }

  function _initModFilters() {
    document.querySelectorAll('.mod-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mod-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        _renderModArticles();
      });
    });
  }

  function _renderModArticles() {
    const container = document.getElementById('mod-articles-list');
    const filtered = activeFilter === 'all'
      ? allModArticles
      : allModArticles.filter(a => a.status === activeFilter);

    if (!filtered.length) {
      container.innerHTML = '<p style="color:#888;padding:1rem 0">Статей нет.</p>';
      return;
    }

    container.innerHTML = filtered.map(a => _renderModCard(a)).join('');

    container.querySelectorAll('[data-mod-action]').forEach(btn => {
      btn.addEventListener('click', () => _handleModAction(btn));
    });

    container.querySelectorAll('[data-view-article]').forEach(btn => {
      btn.addEventListener('click', () => _openArticleView(btn.dataset.viewArticle));
    });
  }

  function _renderModCard(a) {
    const st = STATUS_MAP[a.status] || { text: a.status, cls: '' };
    const date = _formatDate(a.createdAt);

    return `
      <div class="mod-article-card" id="mod-card-${a.id}">
        <div class="mod-article-card__header">
          <h3>${_esc(a.title)}</h3>
          <span class="status-badge ${st.cls}">${st.text}</span>
        </div>
        <div class="mod-article-card__meta">
          Автор: <strong>${_esc(a.authorName || 'Аноним')}</strong> · ${date}
          ${a.templateType ? ` · Шаблон: ${_templateLabel(a.templateType)}` : ''}
        </div>
        <div class="mod-article-card__excerpt">${_esc(a.excerpt || '')}</div>
        ${a.moderatorComment ? `<div class="user-article-comment">💬 Предыдущий комментарий: ${_esc(a.moderatorComment)}</div>` : ''}
        <div class="mod-actions">
          <button class="mod-btn mod-btn--read" data-view-article="${a.id}">👁 Читать полностью</button>
          ${a.status !== 'needs_revision' ? `<button class="mod-btn mod-btn--revision" data-mod-action="needs_revision" data-article-id="${a.id}">✏️ Требуется редактура</button>` : ''}
          ${a.status !== 'approved' && a.status !== 'published' ? `<button class="mod-btn mod-btn--approved" data-mod-action="approved" data-article-id="${a.id}">👍 Хорошо (одобрить)</button>` : ''}
          ${a.status !== 'published' ? `<button class="mod-btn mod-btn--publish" data-mod-action="published" data-article-id="${a.id}">🚀 Готово к выкладке</button>` : ''}
        </div>
        <div class="mod-comment-row" id="mod-comment-${a.id}">
          <textarea placeholder="Комментарий для автора (необязательно)..."></textarea>
          <button>Отправить</button>
        </div>
      </div>`;
  }

  function _handleModAction(btn) {
    const action = btn.dataset.modAction;
    const articleId = btn.dataset.articleId;
    const commentRow = document.getElementById(`mod-comment-${articleId}`);

    commentRow.dataset.pendingAction = action;

    if (!commentRow.classList.contains('open')) {
      commentRow.classList.add('open');
      commentRow.querySelector('button').onclick = () => _confirmModAction(articleId);
      commentRow.querySelector('textarea').focus();
    } else if (commentRow.dataset.pendingAction === action) {
      _confirmModAction(articleId);
    } else {
      commentRow.dataset.pendingAction = action;
    }
  }

  async function _confirmModAction(articleId) {
    const commentRow = document.getElementById(`mod-comment-${articleId}`);
    const action = commentRow.dataset.pendingAction;
    const comment = (commentRow.querySelector('textarea')?.value || '').trim();
    const token = authHelper.getToken();
    const confirmBtn = commentRow.querySelector('button');
    if (confirmBtn) confirmBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/moderator/articles/${articleId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: action, comment }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Ошибка сервера');

      const idx = allModArticles.findIndex(a => a.id === parseInt(articleId));
      if (idx !== -1 && data.article) {
        allModArticles[idx] = { ...allModArticles[idx], ...data.article };
      }

      _renderModArticles();
      _updatePendingCount();

      const labels = {
        needs_revision: '✏️ Статья отправлена на доработку',
        approved: '👍 Статья одобрена',
        published: '🚀 Статья опубликована!',
      };
      _showFeedback(labels[action] || 'Статус обновлён');
    } catch (err) {
      alert(`Ошибка: ${err.message}`);
      if (confirmBtn) confirmBtn.disabled = false;
    }
  }

  // ─── Article full text view ───────────────────────────────────────────────

  async function _openArticleView(articleId) {
    const overlay = document.getElementById('article-view-overlay');
    const titleEl = document.getElementById('article-view-title');
    const metaEl  = document.getElementById('article-view-meta');
    const bodyEl  = document.getElementById('article-view-body');

    titleEl.textContent = 'Загрузка...';
    metaEl.textContent = '';
    bodyEl.innerHTML = '';
    overlay.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';

    try {
      const token = authHelper.getToken();
      const res = await fetch(`${API_BASE}/articles/${articleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const a = data.article;
      titleEl.textContent = a.title;
      metaEl.textContent = `Автор: ${a.authorName || 'Аноним'} · ${_formatDate(a.createdAt)} · Шаблон: ${_templateLabel(a.templateType)}`;
      bodyEl.innerHTML = a.content || '<em>Содержание отсутствует</em>';
    } catch (err) {
      bodyEl.innerHTML = `<p style="color:#c00">Ошибка: ${_esc(err.message)}</p>`;
    }
  }

  function _initArticleViewModal() {
    const overlay = document.getElementById('article-view-overlay');
    document.getElementById('article-view-close')?.addEventListener('click', _closeArticleView);
    overlay?.addEventListener('click', e => { if (e.target === overlay) _closeArticleView(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay && !overlay.hidden) _closeArticleView();
    });
  }

  function _closeArticleView() {
    document.getElementById('article-view-overlay')?.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  // ─── Name form ────────────────────────────────────────────────────────────

  function _initNameForm() {
    document.querySelector('[data-profile-name-form]')?.addEventListener('submit', async e => {
      e.preventDefault();
      const newName = document.querySelector('[data-profile-name]')?.value.trim();
      if (!newName) return;
      const token = authHelper.getToken();
      try {
        const res = await fetch(`${API_BASE}/user/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: newName }),
        });
        if (res.ok) {
          const u = authHelper.getUser();
          u.name = newName;
          localStorage.setItem('user_data', JSON.stringify(u));
          _showFeedback('Имя обновлено ✓');
        } else {
          const d = await res.json().catch(() => ({}));
          _showFeedback(d.error || 'Ошибка', true);
        }
      } catch {
        _showFeedback('Ошибка соединения', true);
      }
    });
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  function _initLogout() {
    document.querySelector('[data-profile-logout]')?.addEventListener('click', () => {
      if (confirm('Вы уверены, что хотите выйти?')) {
        authHelper.clearAuthData();
        window.location.href = './auth.html';
      }
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function _showFeedback(msg, isError = false) {
    const el = document.querySelector('[data-profile-feedback]');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? '#c00' : '#019934';
    setTimeout(() => { el.textContent = ''; }, 3500);
  }

  function _templateLabel(type) {
    return { classic: 'Классический', photoreport: 'Фоторепортаж', route: 'Маршрут/Гид' }[type] || type;
  }

  function _formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
