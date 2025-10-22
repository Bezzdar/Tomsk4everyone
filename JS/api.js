// api.js - Эмуляция API для работы с localStorage
class LocalStorageAPI {
    constructor() {
        this.STORAGE_KEY = 'tomsk4everyone_users';
        this.SESSION_KEY = 'tomsk4everyone_session';
        this.ARTICLES_KEY = 'tomsk4everyone_articles';
        this.COMMENTS_KEY = 'tomsk4everyone_comments';
        this.RATINGS_KEY = 'tomsk4everyone_ratings';
        
        this.initStorage();
    }

    initStorage() {
        // Инициализируем хранилища если их нет
        if (!localStorage.getItem(this.ARTICLES_KEY)) {
            localStorage.setItem(this.ARTICLES_KEY, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.COMMENTS_KEY)) {
            localStorage.setItem(this.COMMENTS_KEY, JSON.stringify([]));
        }
        if (!localStorage.getItem(this.RATINGS_KEY)) {
            localStorage.setItem(this.RATINGS_KEY, JSON.stringify([]));
        }
    }

    // Вспомогательные методы
    getCurrentUser() {
        try {
            return JSON.parse(localStorage.getItem(this.SESSION_KEY));
        } catch {
            return null;
        }
    }

    getUsers() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
        } catch {
            return [];
        }
    }

    getArticles() {
        try {
            return JSON.parse(localStorage.getItem(this.ARTICLES_KEY)) || [];
        } catch {
            return [];
        }
    }

    getComments() {
        try {
            return JSON.parse(localStorage.getItem(this.COMMENTS_KEY)) || [];
        } catch {
            return [];
        }
    }

    getRatings() {
        try {
            return JSON.parse(localStorage.getItem(this.RATINGS_KEY)) || [];
        } catch {
            return [];
        }
    }

    saveData(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    // API Methods
    async getArticle(articleId) {
        const articles = this.getArticles();
        const article = articles.find(a => a.id == articleId);
        
        if (!article) {
            throw new Error('Статья не найдена');
        }

        // Добавляем рейтинг
        const ratings = this.getRatings();
        const articleRatings = ratings.filter(r => r.article_id == articleId);
        article.rating = articleRatings.reduce((sum, r) => sum + r.value, 0);

        return article;
    }

    async getArticleComments(articleId) {
        const comments = this.getComments();
        const articleComments = comments.filter(c => c.article_id == articleId);
        
        // Добавляем информацию о пользователях
        const users = this.getUsers();
        return articleComments.map(comment => {
            const user = users.find(u => u.email === comment.user_email) || {};
            return {
                ...comment,
                username: user.name || user.email,
                avatar_url: user.avatar || '/Img/default-avatar.png'
            };
        }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    async rateArticle(articleId, userEmail, value) {
        if (!userEmail) {
            throw new Error('Требуется авторизация');
        }

        const ratings = this.getRatings();
        const existingRatingIndex = ratings.findIndex(
            r => r.article_id == articleId && r.user_email === userEmail
        );

        if (existingRatingIndex !== -1) {
            // Обновляем существующую оценку
            ratings[existingRatingIndex].value = value;
            ratings[existingRatingIndex].updated_at = new Date().toISOString();
        } else {
            // Добавляем новую оценку
            ratings.push({
                id: Date.now(),
                article_id: parseInt(articleId),
                user_email: userEmail,
                value: value,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        }

        this.saveData(this.RATINGS_KEY, ratings);

        // Пересчитываем рейтинг статьи
        const articleRatings = ratings.filter(r => r.article_id == articleId);
        const newRating = articleRatings.reduce((sum, r) => sum + r.value, 0);

        return {
            new_rating: newRating,
            user_vote: value
        };
    }

    async addComment(articleId, userEmail, body) {
        if (!userEmail) {
            throw new Error('Требуется авторизация');
        }

        if (!body || body.trim().length === 0) {
            throw new Error('Комментарий не может быть пустым');
        }

        const comments = this.getComments();
        const users = this.getUsers();
        const user = users.find(u => u.email === userEmail) || {};

        const newComment = {
            id: Date.now(),
            article_id: parseInt(articleId),
            user_email: userEmail,
            body: body.trim(),
            created_at: new Date().toISOString(),
            username: user.name || userEmail,
            avatar_url: user.avatar || '/Img/default-avatar.png'
        };

        comments.push(newComment);
        this.saveData(this.COMMENTS_KEY, comments);

        return newComment;
    }

    async getUserVote(articleId, userEmail) {
        if (!userEmail) {
            return { vote: 0 };
        }

        const ratings = this.getRatings();
        const userRating = ratings.find(
            r => r.article_id == articleId && r.user_email === userEmail
        );

        return { vote: userRating ? userRating.value : 0 };
    }

    // Инициализация тестовых данных
    initSampleData() {
        const articles = this.getArticles();
        if (articles.length === 0) {
            const sampleArticles = [
                {
                    id: 1,
                    title: "Лагерный сад: парк памяти и свиданий",
                    slug: "lagernyi-sad",
                    author_id: 1,
                    body: "Парк с лучшей панорамой на Томь...",
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    rating: 0
                },
                {
                    id: 2,
                    title: "ТУСУР: университет инженеров будущего",
                    slug: "tusur-univer", 
                    author_id: 1,
                    body: "Технологический драйвер Томска...",
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    rating: 0
                }
            ];
            this.saveData(this.ARTICLES_KEY, sampleArticles);
        }
    }
}

// Создаем глобальный экземпляр API
window.localStorageAPI = new LocalStorageAPI();