(function () {
  'use strict';

  const API_BASE = window.APP_CONFIG?.API_BASE || '/api';
  const list = document.getElementById('user-list');
  const search = document.getElementById('user-search');
  const message = document.getElementById('admin-message');
  let users = [];

  document.addEventListener('DOMContentLoaded', async () => {
    const currentUser = window.authHelper?.getUser?.();
    if (!window.authHelper?.isLoggedIn() || currentUser?.role !== 'admin') {
      window.location.href = './profile.html';
      return;
    }

    search?.addEventListener('input', renderUsers);
    await Promise.all([loadStats(), loadUsers()]);
  });

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${window.authHelper.getToken()}`,
        ...(options.headers || {}),
      },
    });

    if (window.authHelper.handleUnauthorized(response)) {
      throw new Error('Сессия истекла');
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Ошибка запроса');
    return payload;
  }

  async function loadStats() {
    try {
      const data = await api('/admin/stats');
      document.getElementById('stat-users').textContent = data.users ?? 0;
      document.getElementById('stat-articles').textContent = data.articles ?? 0;
      document.getElementById('stat-pending').textContent = data.pendingArticles ?? 0;
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  async function loadUsers() {
    try {
      const data = await api('/admin/users');
      users = data.users || [];
      renderUsers();
    } catch (error) {
      list.textContent = error.message;
      showMessage(error.message, true);
    }
  }

  function renderUsers() {
    if (!list) return;
    const term = (search?.value || '').trim().toLowerCase();
    const filtered = users.filter((user) => {
      if (!term) return true;
      return `${user.name} ${user.email}`.toLowerCase().includes(term);
    });

    if (!filtered.length) {
      list.innerHTML = '<p>Пользователи не найдены.</p>';
      return;
    }

    list.innerHTML = filtered.map((user) => `
      <article class="user-card" data-user-id="${user.id}">
        <div class="user-head">
          <div>
            <strong>${escapeHtml(user.name)}</strong>
            <div class="user-meta">${escapeHtml(user.email)}</div>
          </div>
          <div class="user-meta">Заданий: ${user.completedTasks} · Статей: ${user.articlesCount}</div>
        </div>
        <div class="user-controls">
          <label>Роль
            <select data-role>
              <option value="user" ${user.role === 'user' ? 'selected' : ''}>Пользователь</option>
              <option value="curator" ${user.role === 'curator' ? 'selected' : ''}>Модератор</option>
              <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
            </select>
          </label>
          <label>Кедрокоины
            <input data-balance type="number" min="0" step="1" value="${Number(user.balance || 0)}">
          </label>
          <button type="button" data-save>Сохранить</button>
        </div>
      </article>
    `).join('');

    list.querySelectorAll('[data-save]').forEach((button) => {
      button.addEventListener('click', () => saveUser(button.closest('[data-user-id]')));
    });
  }

  async function saveUser(card) {
    const userId = Number(card?.dataset.userId);
    if (!userId) return;

    const role = card.querySelector('[data-role]').value;
    const balance = Number(card.querySelector('[data-balance]').value);
    const button = card.querySelector('[data-save]');
    button.disabled = true;

    try {
      const data = await api(`/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role, balance }),
      });
      users = users.map((user) => user.id === userId ? { ...user, ...data.user } : user);
      showMessage('Пользователь обновлён');
      await loadStats();
      renderUsers();
    } catch (error) {
      showMessage(error.message, true);
    } finally {
      button.disabled = false;
    }
  }

  function showMessage(text, isError = false) {
    if (!message) return;
    message.textContent = text || '';
    message.classList.toggle('error', isError);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
