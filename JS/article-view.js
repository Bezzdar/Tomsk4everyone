document.addEventListener('DOMContentLoaded', async () => {
  const state = document.getElementById('public-article-state');
  const articleElement = document.getElementById('public-article');
  const slug = new URLSearchParams(window.location.search).get('slug');
  const API_BASE = window.APP_CONFIG?.API_BASE || '/api';

  if (!slug) {
    showError('Не указан идентификатор статьи.');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/articles/public/${encodeURIComponent(slug)}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Статья не найдена');

    const article = payload.article;
    document.title = `${article.title} — Tomsk4everyone`;
    document.getElementById('public-article-title').textContent = article.title;
    document.getElementById('public-article-body').innerHTML = article.content || '';

    const meta = [];
    if (article.authorName) meta.push(`Автор: ${article.authorName}`);
    if (article.publishedAt) {
      meta.push(`Опубликовано: ${new Date(article.publishedAt).toLocaleDateString('ru-RU', {
        day: '2-digit', month: 'long', year: 'numeric',
      })}`);
    }
    document.getElementById('public-article-meta').textContent = meta.join(' · ');

    const cover = document.getElementById('public-article-cover');
    if (article.coverImage) {
      cover.src = article.coverImage;
      cover.alt = `Обложка статьи «${article.title}»`;
      cover.hidden = false;
    }

    state.hidden = true;
    articleElement.hidden = false;
  } catch (error) {
    showError(error.message);
  }

  function showError(message) {
    state.hidden = false;
    state.className = 'public-article__error';
    state.textContent = message;
    articleElement.hidden = true;
  }
});
