// Legacy compatibility facade.
// Comments and ratings were previously stored per-browser in localStorage, which
// made users see different platform state. They are intentionally disabled for
// the first external test until a server-backed implementation is enabled.
class LocalStorageAPI {
  initSampleData() {}

  async getArticle(articleId) {
    return { id: Number(articleId) || 0, rating: 0 };
  }

  async getArticleComments() {
    return [];
  }

  async getUserVote() {
    return { vote: 0 };
  }

  async rateArticle() {
    throw new Error('Оценки временно отключены в тестовой версии.');
  }

  async addComment() {
    throw new Error('Комментарии временно отключены в тестовой версии.');
  }
}

window.localStorageAPI = new LocalStorageAPI();

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.feedback').forEach((section) => {
    if (section.querySelector('#rating, .rating, #comments-list, .comments-list, .comment-form')) {
      section.innerHTML = '<p style="color:#777">Комментарии и оценки временно отключены на период первого пользовательского теста.</p>';
    }
  });
  document.querySelectorAll('.comments').forEach((section) => {
    section.innerHTML = '<p style="color:#777;font-size:.9rem">Комментарии временно отключены.</p>';
  });
});
