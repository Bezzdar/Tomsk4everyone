/**
 * articles-page.js
 * Загружает опубликованные статьи из БД и добавляет их в раздел страницы.
 * Статические статьи остаются в HTML как есть.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE = window.APP_CONFIG?.API_BASE || 'http://77.222.43.106:5000/api';
  const main = document.querySelector('main');
  if (!main) return;

  try {
    const res = await fetch(`${API_BASE}/articles/public`);
    if (!res.ok) return;
    const payload = await res.json();
    const articles = (payload.articles || []);
    if (!articles.length) return;

    const section = document.createElement('section');
    section.className = 'category';
    section.innerHTML = `
      <h2>От пользователей</h2>
      <div class="articles-row" id="db-articles-row"></div>`;
    main.insertBefore(section, main.firstChild);

    const row = section.querySelector('#db-articles-row');

    articles.forEach(article => {
      const excerpt = article.excerpt
        || article.content?.replace(/<[^>]+>/g, '').slice(0, 160) + '...'
        || '';

      const cover = article.coverImage
        ? `<div class="article-cover">
             <img src="${_serverBase(API_BASE)}${article.coverImage}" alt="${_esc(article.title)}" loading="lazy" />
           </div>`
        : '';

      const tags = article.tags
        ? article.tags.split(',').map(t => t.trim()).filter(Boolean)
            .map(t => `<span class="label">${_esc(t)}</span>`).join('')
        : '';

      const pubDate = article.publishedAt || article.createdAt;

      row.insertAdjacentHTML('beforeend', `
        <article class="article-card">
          <a class="article-link" href="/api/articles/public/${_esc(article.slug)}" data-db-article="${article.id}">
            ${cover}
            <div class="article-content">
              ${tags ? `<div class="article-labels" style="position:static;margin-bottom:.5rem">${tags}</div>` : ''}
              <p class="article-meta">${pubDate ? 'Опубликовано: ' + _formatDate(pubDate) : ''}</p>
              <h3>${_esc(article.title)}</h3>
              <p>${_esc(excerpt)}</p>
              ${article.authorName ? `<p style="font-size:.8rem;color:#888">Автор: ${_esc(article.authorName)}</p>` : ''}
              <span class="article-cta">Читать подробнее →</span>
            </div>
          </a>
        </article>`);
    });

    // Intercept clicks to open DB articles inline
    section.querySelectorAll('[data-db-article]').forEach(link => {
      link.addEventListener('click', async e => {
        e.preventDefault();
        const articleId = link.dataset.dbArticle;
        await _openDbArticle(articleId, API_BASE);
      });
    });
  } catch (err) {
    console.error('Не удалось загрузить статьи из БД:', err);
  }
});

async function _openDbArticle(articleId, apiBase) {
  let overlay = document.getElementById('db-article-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'db-article-overlay';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:800;
      display:flex;align-items:flex-start;justify-content:center;
      padding:2rem 1rem;overflow-y:auto;`;
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;width:100%;max-width:780px;
                  padding:2rem;box-shadow:0 24px 64px rgba(0,0,0,.2);position:relative;">
        <button id="db-article-close" style="position:absolute;top:1rem;right:1rem;
          background:none;border:none;font-size:1.5rem;cursor:pointer;color:#666">✕</button>
        <div id="db-article-content">Загрузка...</div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) _closeDbArticle(); });
    overlay.querySelector('#db-article-close').addEventListener('click', _closeDbArticle);
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { _closeDbArticle(); document.removeEventListener('keydown', onEsc); }
    });
  }

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  try {
    const res = await fetch(`${apiBase}/articles/public/${articleId}`);
    const data = await res.json();
    const a = data.article;
    const pubDate = a.publishedAt || a.createdAt;

    overlay.querySelector('#db-article-content').innerHTML = `
      ${a.coverImage ? `<img src="${_serverBase(apiBase)}${a.coverImage}" alt="${_esc(a.title)}"
        style="width:100%;max-height:300px;object-fit:cover;border-radius:10px;margin-bottom:1.5rem">` : ''}
      <h1 style="margin:0 0 .5rem;font-size:1.8rem">${_esc(a.title)}</h1>
      <p style="color:#888;font-size:.85rem;margin:0 0 2rem">
        ${pubDate ? _formatDate(pubDate) : ''}
        ${a.authorName ? ' · Автор: ' + _esc(a.authorName) : ''}
        ${a.templateType ? ' · ' + _templateLabel(a.templateType) : ''}
      </p>
      <div style="line-height:1.75;color:#333">${a.content || ''}</div>`;
  } catch {
    overlay.querySelector('#db-article-content').innerHTML =
      '<p style="color:#c00">Не удалось загрузить статью</p>';
  }
}

function _closeDbArticle() {
  const overlay = document.getElementById('db-article-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}

function _serverBase(apiBase) {
  return apiBase.replace('/api', '');
}

function _esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}

function _templateLabel(type) {
  return { classic: 'Классический', photoreport: 'Фоторепортаж', route: 'Маршрут/Гид' }[type] || type;
}
