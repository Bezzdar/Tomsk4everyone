import os
import re
from datetime import datetime, timedelta
from functools import wraps

import jwt
import psycopg2
import psycopg2.extras
from flask import Flask, jsonify, request
from flask_bcrypt import Bcrypt
from flask_cors import CORS

app = Flask(__name__)

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'change-me-secret-key')
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'change-me-jwt-secret')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=int(os.getenv('JWT_EXPIRES_HOURS', '24')))

allowed_origins = [origin.strip() for origin in os.getenv(
    'CORS_ORIGINS',
    'http://127.0.0.1:5500,http://localhost:5500,http://46.17.102.10'
).split(',') if origin.strip()]

CORS(app, resources={r"/api/*": {"origins": allowed_origins}}, supports_credentials=True)
bcrypt = Bcrypt(app)


DB_CONFIG = {
    'host': os.getenv('DB_HOST', '46.17.102.10'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'tomsk'),
    'user': os.getenv('DB_USER', 'tomsk_app'),
    'password': os.getenv('DB_PASSWORD', 'tomsk_app_password'),
    'client_encoding': 'utf-8',
}

ROLE_UI = {
    'site_user': 'user',
    'site_moderator': 'curator',
    'site_admin': 'admin',
}

ROLE_DB = {v: k for k, v in ROLE_UI.items()}


def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)


def create_jwt_token(user_id):
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + app.config['JWT_ACCESS_TOKEN_EXPIRES'],
    }
    return jwt.encode(payload, app.config['JWT_SECRET_KEY'], algorithm='HS256')


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Требуется авторизация'}), 401

        if token.startswith('Bearer '):
            token = token[7:]

        try:
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Токен истек'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Недействительный токен'}), 401

        return f(current_user_id, *args, **kwargs)

    return decorated


def get_user_role(cur, user_id):
    cur.execute('SELECT role FROM users WHERE id = %s', (user_id,))
    row = cur.fetchone()
    return row['role'] if row else None


def normalize_user_data(user_data):
    return {
        'id': user_data['id'],
        'name': user_data['username'] or user_data['email'],
        'email': user_data['email'],
        'role': ROLE_UI.get(user_data['role'], 'user'),
        'avatar': user_data.get('avatar_url') or '/Img/default-avatar.png',
        'completedTasks': [],
        'articles': [],
    }


def article_to_response(row):
    return {
        'id': row['id'],
        'title': row['title'],
        'slug': row['slug'],
        'link': f"/HTML/articles/{row['slug']}.html",
        'content': row['body'],
        'tags': row.get('tags') or '',
        'status': row.get('status') or 'draft',
        'rating': row.get('rating') or 0,
        'createdAt': row['created_at'].isoformat() if row.get('created_at') else None,
        'updatedAt': row['updated_at'].isoformat() if row.get('updated_at') else None,
        'authorId': row.get('author_id'),
        'authorName': row.get('author_name'),
    }


def create_slug(title):
    slug = re.sub(r'[^\w\s-]', '', title.lower())
    slug = re.sub(r'[-\s]+', '-', slug).strip('-')
    return slug[:70] or 'article'


@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not name or not email or not password:
        return jsonify({'error': 'Заполните все обязательные поля'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Пароль должен содержать не менее 6 символов'}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    try:
        cur.execute('SELECT id FROM users WHERE lower(email) = %s', (email,))
        if cur.fetchone():
            return jsonify({'error': 'Пользователь с таким email уже зарегистрирован'}), 400

        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
        cur.execute(
            '''INSERT INTO users (username, email, password_hash, role, avatar_url, balance)
               VALUES (%s, %s, %s, 'site_user', '/Img/default-avatar.png', 0)
               RETURNING id, username, email, role, avatar_url''',
            (name, email, hashed_password),
        )
        user_data = cur.fetchone()
        conn.commit()

        user = normalize_user_data(user_data)
        token = create_jwt_token(user_data['id'])
        return jsonify({'message': 'Аккаунт создан успешно!', 'user': user, 'token': token}), 201
    finally:
        cur.close()
        conn.close()


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Введите email и пароль'}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    try:
        cur.execute(
            'SELECT id, username, email, password_hash, role, avatar_url FROM users WHERE lower(email) = %s',
            (email,),
        )
        user_data = cur.fetchone()

        if not user_data or not bcrypt.check_password_hash(user_data['password_hash'], password):
            return jsonify({'error': 'Неверная пара логина и пароля'}), 401

        cur.execute('''
            SELECT id, title, slug, created_at, status
            FROM articles
            WHERE author_id = %s
            ORDER BY created_at DESC
        ''', (user_data['id'],))
        articles = [{
            'id': row['id'],
            'title': row['title'],
            'link': f"/HTML/articles/{row['slug']}.html",
            'status': row['status'],
            'createdAt': row['created_at'].isoformat(),
        } for row in cur.fetchall()]

        cur.execute('SELECT task_id FROM user_tasks WHERE user_id = %s', (user_data['id'],))
        completed_tasks = [str(row['task_id']) for row in cur.fetchall()]

        user = normalize_user_data(user_data)
        user['articles'] = articles
        user['completedTasks'] = completed_tasks
        token = create_jwt_token(user_data['id'])

        return jsonify({'message': 'Вход выполнен успешно!', 'user': user, 'token': token})
    finally:
        cur.close()
        conn.close()


@app.route('/api/user/profile', methods=['GET'])
@token_required
def get_profile(current_user_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute('SELECT id, username, email, role, avatar_url FROM users WHERE id = %s', (current_user_id,))
        user_data = cur.fetchone()
        if not user_data:
            return jsonify({'error': 'Пользователь не найден'}), 404

        user = normalize_user_data(user_data)
        return jsonify({'user': user})
    finally:
        cur.close()
        conn.close()


@app.route('/api/user/profile', methods=['PUT'])
@token_required
def update_profile(current_user_id):
    data = request.get_json(silent=True) or {}
    new_name = (data.get('name') or '').strip()
    if not new_name:
        return jsonify({'error': 'Имя не может быть пустым'}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute(
            'UPDATE users SET username=%s WHERE id=%s RETURNING id, username, email, role, avatar_url',
            (new_name, current_user_id),
        )
        row = cur.fetchone()
        if not row:
            return jsonify({'error': 'Пользователь не найден'}), 404
        conn.commit()
        return jsonify({'message': 'Профиль обновлен', 'user': normalize_user_data(row)})
    finally:
        cur.close()
        conn.close()


@app.route('/api/articles/public', methods=['GET'])
def get_public_articles():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute('''
            SELECT a.id, a.title, a.slug, a.body, a.tags, a.status, a.rating, a.created_at, a.updated_at,
                   a.author_id, COALESCE(u.username, u.email) AS author_name
            FROM articles a
            LEFT JOIN users u ON u.id = a.author_id
            WHERE a.status = 'published'
            ORDER BY a.created_at DESC
        ''')
        return jsonify({'articles': [article_to_response(row) for row in cur.fetchall()]})
    finally:
        cur.close()
        conn.close()


@app.route('/api/articles', methods=['POST'])
@token_required
def create_article(current_user_id):
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    body = (data.get('content') or '').strip()
    tags = (data.get('tags') or '').strip()
    link = (data.get('link') or '').strip()

    if not title:
        return jsonify({'error': 'Заголовок статьи обязателен'}), 400
    if not body:
        return jsonify({'error': 'Текст статьи обязателен'}), 400
    if len(body) < 200:
        return jsonify({'error': 'Текст статьи должен быть не менее 200 символов'}), 400

    if link:
        body = f"Источник: {link}\n\n{body}"

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute('SELECT id FROM users WHERE id = %s', (current_user_id,))
        if not cur.fetchone():
            return jsonify({'error': 'Пользователь не найден'}), 404

        base_slug = create_slug(title)
        slug = base_slug
        suffix = 1
        while True:
            cur.execute('SELECT 1 FROM articles WHERE slug = %s', (slug,))
            if not cur.fetchone():
                break
            slug = f"{base_slug}-{suffix}"
            suffix += 1

        cur.execute('''
            INSERT INTO articles (title, slug, author_id, body, tags, status, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, 'submitted', NOW(), NOW())
            RETURNING id, title, slug, author_id, body, tags, status, rating, created_at, updated_at
        ''', (title, slug, current_user_id, body, tags))

        row = cur.fetchone()
        conn.commit()
        return jsonify({'message': 'Статья успешно отправлена на модерацию!', 'article': article_to_response(row)}), 201
    finally:
        cur.close()
        conn.close()


@app.route('/api/articles/<int:article_id>', methods=['GET'])
@token_required
def get_article(current_user_id, article_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    try:
        cur.execute('''
            SELECT id, title, slug, body, tags, status, rating, author_id, created_at, updated_at
            FROM articles
            WHERE id = %s
        ''', (article_id,))
        row = cur.fetchone()
        if not row:
            return jsonify({'error': 'Статья не найдена'}), 404

        role = get_user_role(cur, current_user_id)
        if current_user_id != row['author_id'] and role not in ['site_moderator', 'site_admin']:
            return jsonify({'error': 'Недостаточно прав'}), 403

        return jsonify({'article': article_to_response(row)})
    finally:
        cur.close()
        conn.close()


@app.route('/api/articles/<int:article_id>', methods=['PUT'])
@token_required
def update_article(current_user_id, article_id):
    data = request.get_json(silent=True) or {}
    new_title = (data.get('title') or '').strip()
    new_body = (data.get('content') or '').strip()
    new_tags = (data.get('tags') or '').strip()
    requested_status = (data.get('status') or '').strip()

    if not new_title or not new_body:
        return jsonify({'error': 'Заголовок и текст статьи обязательны'}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    try:
        cur.execute('SELECT id, author_id, status FROM articles WHERE id = %s', (article_id,))
        article = cur.fetchone()
        if not article:
            return jsonify({'error': 'Статья не найдена'}), 404

        role = get_user_role(cur, current_user_id)
        is_owner = article['author_id'] == current_user_id
        is_moderator = role in ['site_moderator', 'site_admin']

        if not is_owner and not is_moderator:
            return jsonify({'error': 'Недостаточно прав'}), 403

        new_status = article['status']
        if is_moderator and requested_status in ['submitted', 'published', 'rejected', 'draft']:
            new_status = requested_status
        elif is_owner and requested_status and requested_status != article['status']:
            return jsonify({'error': 'Пользователь не может менять статус статьи'}), 403

        cur.execute('''
            UPDATE articles
            SET title=%s, body=%s, tags=%s, status=%s, updated_at=NOW()
            WHERE id=%s
            RETURNING id, title, slug, author_id, body, tags, status, rating, created_at, updated_at
        ''', (new_title, new_body, new_tags, new_status, article_id))

        updated = cur.fetchone()
        conn.commit()
        return jsonify({'message': 'Статья обновлена', 'article': article_to_response(updated)})
    finally:
        cur.close()
        conn.close()


@app.route('/api/articles/<int:article_id>', methods=['DELETE'])
@token_required
def delete_article(current_user_id, article_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    try:
        cur.execute('SELECT author_id FROM articles WHERE id=%s', (article_id,))
        article = cur.fetchone()
        if not article:
            return jsonify({'error': 'Статья не найдена'}), 404

        role = get_user_role(cur, current_user_id)
        if current_user_id != article['author_id'] and role not in ['site_moderator', 'site_admin']:
            return jsonify({'error': 'Недостаточно прав'}), 403

        cur.execute('DELETE FROM articles WHERE id=%s', (article_id,))
        conn.commit()
        return jsonify({'message': 'Статья успешно удалена'})
    finally:
        cur.close()
        conn.close()


@app.route('/api/user/articles', methods=['GET'])
@token_required
def get_user_articles(current_user_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        cur.execute('''
            SELECT id, title, slug, body, tags, status, rating, created_at, updated_at
            FROM articles
            WHERE author_id = %s
            ORDER BY created_at DESC
        ''', (current_user_id,))
        rows = cur.fetchall()

        articles = []
        for row in rows:
            entry = article_to_response(row)
            entry['excerpt'] = f"{row['body'][:200]}..." if len(row['body']) > 200 else row['body']
            articles.append(entry)

        return jsonify({'articles': articles})
    finally:
        cur.close()
        conn.close()


@app.route('/api/moderator/articles', methods=['GET'])
@token_required
def get_moderator_articles(current_user_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    try:
        role = get_user_role(cur, current_user_id)
        if role not in ['site_moderator', 'site_admin']:
            return jsonify({'error': 'Недостаточно прав'}), 403

        cur.execute('''
            SELECT a.id, a.title, a.slug, a.body, a.tags, a.status, a.rating, a.created_at, a.updated_at,
                   a.author_id, COALESCE(u.username, u.email) AS author_name
            FROM articles a
            LEFT JOIN users u ON a.author_id = u.id
            WHERE a.status IN ('submitted', 'published', 'rejected')
            ORDER BY a.created_at DESC
        ''')
        rows = cur.fetchall()

        articles = []
        for row in rows:
            entry = article_to_response(row)
            entry['excerpt'] = f"{row['body'][:180]}..." if len(row['body']) > 180 else row['body']
            articles.append(entry)

        return jsonify({'articles': articles})
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.getenv('PORT', '5000')))
