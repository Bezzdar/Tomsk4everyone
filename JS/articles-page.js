document.addEventListener('DOMContentLoaded', async () => {
  const API_BASE = window.APP_CONFIG?.API_BASE || 'http://46.17.102.10:5000/api';
  const main = document.querySelector('main');
  if (!main) return;

  try {
    const response = await fetch(`${API_BASE}/articles/public`);
    const payload = await response.json();
    const articles = payload.articles || [];

    if (articles.length === 0) return;

    main.innerHTML = `
      <section class="category">
        <h2>Статьи из базы данных</h2>
        <div class="articles-row" id="db-articles"></div>
      </section>
    `;

    const row = document.getElementById('db-articles');
    row.innerHTML = articles.map((article) => {
      const excerpt = (article.content || '').slice(0, 160);
      return `
        <article class="article-card">
          <a class="article-link" href="./articles/${article.slug}.html">
            <div class="article-content">
              <p class="article-meta">Опубликовано: ${new Date(article.createdAt).toLocaleDateString('ru-RU')}</p>
              <h3>${article.title}</h3>
              <p>${excerpt}${excerpt.length >= 160 ? '...' : ''}</p>
              <div class="article-rating"><span class="likes-count">${article.rating || 0}</span> 👍</div>
              <span class="article-cta">Читать подробнее →</span>
            </div>
          </a>
        </article>`;
    }).join('');
  } catch (e) {
    console.error('Не удалось загрузить статьи из БД', e);
  }
});
