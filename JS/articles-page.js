/**
 * Adds published user articles to the catalogue and keeps the catalogue header
 * in sync with the canonical login session.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE = window.APP_CONFIG?.API_BASE || '/api';
  syncAuthLink();

  const main = document.querySelector('main');
  if (!main) return;

  try {
    const response = await fetch(`${API_BASE}/articles/public`);
    if (!response.ok) throw new Error('Не удалось загрузить пользовательские статьи');
    const payload = await response.json();
    const articles = payload.articles || [];
    if (!articles.length) return;

    const section = document.createElement('section');
    section.className = 'category';
    section.innerHTML = `
      <h2>От пользователей</h2>
      <div class="articles-row" id="db-articles-row"></div>`;
    main.insertBefore(section, main.firstChild);

    const row = section.querySelector('#db-articles-row');
    articles.forEach((article) => {
      const excerpt = article.excerpt || stripHtml(article.content).slice(0, 160);
      const cover = article.coverImage
        ? `<div class="article-cover"><img src="${escapeHtml(article.coverImage)}" alt="${escapeHtml(article.title)}" loading="lazy"></div>`
        : '';
      const tags = String(article.tags || '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => `<span class="label">${escapeHtml(tag)}</span>`)
        .join('');
      const publicUrl = article.link || `/HTML/article-view.html?slug=${encodeURIComponent(article.slug)}`;

      row.insertAdjacentHTML('beforeend', `
        <article class="article-card">
          <a class="article-link" href="${escapeHtml(publicUrl)}">
            ${cover}
            <div class="article-content">
              ${tags ? `<div class="article-labels" style="position:static;margin-bottom:.5rem">${tags}</div>` : ''}
              <p class="article-meta">${article.publishedAt ? `Опубликовано: ${formatDate(article.publishedAt)}` : ''}</p>
              <h3>${escapeHtml(article.title)}</h3>
              <p>${escapeHtml(excerpt)}${excerpt.length >= 160 ? '…' : ''}</p>
              ${article.authorName ? `<p style="font-size:.8rem;color:#888">Автор: ${escapeHtml(article.authorName)}</p>` : ''}
              <span class="article-cta">Читать подробнее →</span>
            </div>
          </a>
        </article>`);
    });
  } catch (error) {
    console.error(error);
  }
});

function syncAuthLink() {
  let user = null;
  try {
    const token = localStorage.getItem('user_token');
    const rawUser = localStorage.getItem('user_data');
    user = token && rawUser ? JSON.parse(rawUser) : null;
  } catch (error) {
    console.error('Не удалось прочитать пользовательскую сессию:', error);
  }

  document.querySelectorAll('header .cta-link').forEach((link) => {
    if (user) {
      link.href = './profile.html';
      link.textContent = user.name || 'Профиль';
      link.classList.add('logged-in');
    } else {
      link.href = './auth.html';
      link.textContent = 'Войти';
      link.classList.remove('logged-in');
    }
  });
}

function stripHtml(value) {
  const documentFragment = new DOMParser().parseFromString(String(value || ''), 'text/html');
  return documentFragment.body.textContent || '';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}
