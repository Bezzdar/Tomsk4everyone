import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

import jwt
from flask import Flask, g, jsonify, request, send_from_directory
from flask_bcrypt import Bcrypt
from flask_cors import CORS

from config import load_config
from db import configure_db, cursor
from security import sanitize_article_html, validate_image_bytes


ROLE_UI = {
    'site_user': 'user',
    'site_moderator': 'curator',
    'site_admin': 'admin',
}

VALID_STATUSES = {'draft', 'submitted', 'needs_revision', 'approved', 'published'}
CREATE_STATUSES = {'draft', 'submitted'}
TEMPLATE_TYPES = {'classic'}
MODERATOR_TRANSITIONS = {
    'submitted': {'needs_revision', 'approved'},
    'approved': {'published'},
}

settings = load_config()
configure_db(settings['DB_CONFIG'])

app = Flask(__name__)
app.config['SECRET_KEY'] = settings['SECRET_KEY']
app.config['JWT_SECRET_KEY'] = settings['JWT_SECRET_KEY']
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=settings['JWT_EXPIRES_HOURS'])
app.config['UPLOAD_FOLDER'] = settings['UPLOAD_FOLDER']
app.config['MAX_CONTENT_LENGTH'] = settings['MAX_CONTENT_LENGTH']

if settings['CORS_ORIGINS']:
    CORS(
        app,
        resources={r'/api/*': {'origins': list(settings['CORS_ORIGINS'])}},
        supports_credentials=False,
    )

bcrypt = Bcrypt(app)
logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format='%(asctime)s %(levelname)s %(message)s',
)
logger = logging.getLogger('tomsk4everyone')


@app.before_request
def assign_request_id():
    g.request_id = request.headers.get('X-Request-ID') or uuid.uuid4().hex


@app.after_request
def add_request_metadata(response):
    response.headers['X-Request-ID'] = g.get('request_id', '')
    logger.info(
        'request_id=%s method=%s path=%s status=%s user_id=%s',
        g.get('request_id'),
        request.method,
        request.path,
        response.status_code,
        g.get('current_user_id'),
    )
    return response


@app.errorhandler(413)
def payload_too_large(_error):
    return jsonify({'error': 'Файл слишком большой', 'requestId': g.get('request_id')}), 413


@app.errorhandler(Exception)
def unhandled_error(error):
    logger.exception('request_id=%s unhandled_error=%s', g.get('request_id'), error)
    return jsonify({
        'error': 'Внутренняя ошибка сервера',
        'requestId': g.get('request_id'),
    }), 500


def create_jwt_token(user_id):
    now = datetime.now(timezone.utc)
    payload = {
        'user_id': user_id,
        'iat': now,
        'exp': now + app.config['JWT_ACCESS_TOKEN_EXPIRES'],
    }
    return jwt.encode(payload, app.config['JWT_SECRET_KEY'], algorithm='HS256')


def token_required(func):
    @wraps(func)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Требуется авторизация'}), 401

        token = auth_header[7:].strip()
        try:
            payload = jwt.decode(
                token,
                app.config['JWT_SECRET_KEY'],
                algorithms=['HS256'],
                options={'require': ['exp', 'user_id']},
            )
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Сессия истекла'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Недействительный токен'}), 401

        g.current_user_id = int(payload['user_id'])
        return func(g.current_user_id, *args, **kwargs)

    return decorated


def get_user_role(cur, user_id):
    cur.execute('SELECT role FROM users WHERE id=%s', (user_id,))
    row = cur.fetchone()
    return row['role'] if row else None


def is_moderator_role(role):
    return role in {'site_moderator', 'site_admin'}


def moderator_required(func):
    @wraps(func)
    @token_required
    def decorated(current_user_id, *args, **kwargs):
        with cursor() as cur:
            role = get_user_role(cur, current_user_id)
        if not is_moderator_role(role):
            return jsonify({'error': 'Недостаточно прав'}), 403
        return func(current_user_id, *args, **kwargs)

    return decorated


def normalize_user_data(row, completed_tasks=None, articles=None):
    return {
        'id': row['id'],
        'name': row.get('username') or row['email'],
        'email': row['email'],
        'role': ROLE_UI.get(row['role'], 'user'),
        'avatar': row.get('avatar_url') or '/Sourse/Icons/userIco.png',
        'balance': row.get('balance') or 0,
        'completedTasks': completed_tasks or [],
        'articles': articles or [],
    }


def article_to_response(row):
    return {
        'id': row['id'],
        'title': row['title'],
        'slug': row['slug'],
        'link': f"/HTML/article-view.html?slug={row['slug']}",
        'content': row['body'],
        'excerpt': row.get('excerpt') or '',
        'tags': row.get('tags') or '',
        'status': row.get('status') or 'draft',
        'templateType': row.get('template_type') or 'classic',
        'coverImage': row.get('cover_image') or '',
        'moderatorComment': row.get('moderator_comment') or '',
        'rating': row.get('rating') or 0,
        'createdAt': row['created_at'].isoformat() if row.get('created_at') else None,
        'updatedAt': row['updated_at'].isoformat() if row.get('updated_at') else None,
        'publishedAt': row['published_at'].isoformat() if row.get('published_at') else None,
        'authorId': row.get('author_id'),
        'authorName': row.get('author_name') or '',
    }


def create_slug(title):
    slug = re.sub(r'[^\w\s-]', '', title.lower(), flags=re.UNICODE)
    slug = re.sub(r'[-\s]+', '-', slug).strip('-')
    return slug[:70] or 'article'


def plain_text(html):
    return re.sub(r'<[^>]+>', '', html or '').strip()


def unique_slug(cur, title, article_id=None):
    base_slug = create_slug(title)
    slug = base_slug
    suffix = 1
    while True:
        if article_id is None:
            cur.execute('SELECT 1 FROM articles WHERE slug=%s', (slug,))
        else:
            cur.execute('SELECT 1 FROM articles WHERE slug=%s AND id<>%s', (slug, article_id))
        if not cur.fetchone():
            return slug
        slug = f'{base_slug}-{suffix}'
        suffix += 1


def serialize_user_state(cur, user_id):
    cur.execute(
        '''SELECT id, username, email, role, avatar_url, balance
           FROM users WHERE id=%s''',
        (user_id,),
    )
    user = cur.fetchone()
    if not user:
        return None

    cur.execute(
        '''SELECT task_slug FROM user_task_completions
           WHERE user_id=%s ORDER BY completed_at''',
        (user_id,),
    )
    completed = [row['task_slug'] for row in cur.fetchall()]

    cur.execute(
        '''SELECT id, title, slug, status, created_at
           FROM articles WHERE author_id=%s ORDER BY created_at DESC''',
        (user_id,),
    )
    articles = [
        {
            'id': row['id'],
            'title': row['title'],
            'slug': row['slug'],
            'link': f"/HTML/article-view.html?slug={row['slug']}",
            'status': row['status'],
            'createdAt': row['created_at'].isoformat(),
        }
        for row in cur.fetchall()
    ]
    return normalize_user_data(user, completed, articles)


@app.get('/api/health')
def health():
    try:
        with cursor() as cur:
            cur.execute('SELECT 1 AS ok')
            cur.fetchone()
        return jsonify({'status': 'ok', 'database': 'ok'})
    except Exception:
        logger.exception('healthcheck database failure')
        return jsonify({'status': 'error', 'database': 'error'}), 503


@app.post('/api/register')
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not name or not email or not password:
        return jsonify({'error': 'Заполните все обязательные поля'}), 400
    if len(password) < 8:
        return jsonify({'error': 'Пароль должен содержать не менее 8 символов'}), 400

    with cursor(commit=True) as cur:
        cur.execute('SELECT id FROM users WHERE lower(email)=%s', (email,))
        if cur.fetchone():
            return jsonify({'error': 'Пользователь с таким email уже зарегистрирован'}), 409

        password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
        cur.execute(
            '''INSERT INTO users (username, email, password_hash, role, avatar_url, balance)
               VALUES (%s, %s, %s, 'site_user', NULL, 0)
               RETURNING id''',
            (name, email, password_hash),
        )
        user_id = cur.fetchone()['id']

    with cursor() as cur:
        user = serialize_user_state(cur, user_id)
    return jsonify({
        'message': 'Аккаунт создан',
        'user': user,
        'token': create_jwt_token(user_id),
    }), 201


@app.post('/api/login')
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Введите email и пароль'}), 400

    with cursor() as cur:
        cur.execute(
            '''SELECT id, password_hash FROM users WHERE lower(email)=%s''',
            (email,),
        )
        auth_row = cur.fetchone()
        if not auth_row or not bcrypt.check_password_hash(auth_row['password_hash'], password):
            return jsonify({'error': 'Неверная пара логина и пароля'}), 401
        user = serialize_user_state(cur, auth_row['id'])

    return jsonify({
        'message': 'Вход выполнен',
        'user': user,
        'token': create_jwt_token(auth_row['id']),
    })


@app.get('/api/user/profile')
@token_required
def get_profile(current_user_id):
    with cursor() as cur:
        user = serialize_user_state(cur, current_user_id)
    if not user:
        return jsonify({'error': 'Пользователь не найден'}), 404
    return jsonify({'user': user})


@app.put('/api/user/profile')
@token_required
def update_profile(current_user_id):
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Имя не может быть пустым'}), 400

    with cursor(commit=True) as cur:
        cur.execute('UPDATE users SET username=%s WHERE id=%s RETURNING id', (name, current_user_id))
        if not cur.fetchone():
            return jsonify({'error': 'Пользователь не найден'}), 404

    with cursor() as cur:
        user = serialize_user_state(cur, current_user_id)
    return jsonify({'message': 'Профиль обновлён', 'user': user})


@app.get('/api/tasks')
def get_tasks():
    with cursor() as cur:
        cur.execute(
            '''SELECT slug, title, description, cost AS points, task_type
               FROM tasks WHERE active=true AND slug IS NOT NULL ORDER BY id'''
        )
        tasks = [dict(row) for row in cur.fetchall()]
    return jsonify({'tasks': tasks})


@app.post('/api/tasks/complete')
@token_required
def complete_task(current_user_id):
    data = request.get_json(silent=True) or {}
    task_slug = (data.get('taskId') or '').strip()
    if not task_slug:
        return jsonify({'error': 'Не указано задание'}), 400

    with cursor(commit=True) as cur:
        cur.execute(
            '''SELECT slug, cost, task_type FROM tasks
               WHERE slug=%s AND active=true''',
            (task_slug,),
        )
        task = cur.fetchone()
        if not task:
            return jsonify({'error': 'Неизвестное или отключённое задание'}), 404

        # In the first user test only the quiz is awarded automatically.
        # Manual/photo tasks require a moderator workflow that is not ready yet.
        if task['task_type'] != 'quiz':
            return jsonify({
                'error': 'Автоматическое подтверждение этого задания пока отключено'
            }), 409

        cur.execute(
            '''INSERT INTO user_task_completions (user_id, task_slug, points_awarded)
               VALUES (%s, %s, %s)
               ON CONFLICT (user_id, task_slug) DO NOTHING
               RETURNING id''',
            (current_user_id, task_slug, task['cost']),
        )
        if not cur.fetchone():
            return jsonify({'error': 'Задание уже выполнено'}), 409

        cur.execute(
            '''UPDATE users SET balance=COALESCE(balance, 0)+%s
               WHERE id=%s RETURNING balance''',
            (task['cost'], current_user_id),
        )
        balance = cur.fetchone()['balance']
        cur.execute(
            'SELECT task_slug FROM user_task_completions WHERE user_id=%s ORDER BY completed_at',
            (current_user_id,),
        )
        completed = [row['task_slug'] for row in cur.fetchall()]

    return jsonify({
        'message': f"Начислено {task['cost']} кедрокоинов",
        'completedTasks': completed,
        'balance': balance,
        'pointsAwarded': task['cost'],
    })


@app.post('/api/upload')
@token_required
def upload_file(_current_user_id):
    file = request.files.get('file')
    if not file or not file.filename:
        return jsonify({'error': 'Файл не выбран'}), 400

    data = file.read()
    try:
        extension = validate_image_bytes(data)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    filename = f'{uuid.uuid4().hex}.{extension}'
    upload_dir = Path(app.config['UPLOAD_FOLDER'])
    upload_dir.mkdir(parents=True, exist_ok=True)
    (upload_dir / filename).write_bytes(data)
    return jsonify({'url': f'/api/uploads/{filename}', 'filename': filename}), 201


@app.get('/api/uploads/<path:filename>')
def serve_upload(filename):
    if '/' in filename or '\\' in filename:
        return jsonify({'error': 'Недопустимое имя файла'}), 400
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


@app.get('/api/articles/public')
def get_public_articles():
    with cursor() as cur:
        cur.execute(
            '''SELECT a.id, a.title, a.slug, a.body, a.excerpt, a.tags, a.status,
                      a.template_type, a.cover_image, a.rating,
                      a.created_at, a.updated_at, a.published_at, a.author_id,
                      COALESCE(u.username, u.email) AS author_name
               FROM articles a
               LEFT JOIN users u ON u.id=a.author_id
               WHERE a.status='published'
               ORDER BY a.published_at DESC NULLS LAST, a.created_at DESC'''
        )
        articles = [article_to_response(row) for row in cur.fetchall()]
    return jsonify({'articles': articles})


@app.get('/api/articles/public/<slug>')
def get_public_article_by_slug(slug):
    with cursor() as cur:
        cur.execute(
            '''SELECT a.id, a.title, a.slug, a.body, a.excerpt, a.tags, a.status,
                      a.template_type, a.cover_image, a.rating,
                      a.created_at, a.updated_at, a.published_at, a.author_id,
                      COALESCE(u.username, u.email) AS author_name
               FROM articles a
               LEFT JOIN users u ON u.id=a.author_id
               WHERE a.slug=%s AND a.status='published' ''',
            (slug,),
        )
        row = cur.fetchone()
    if not row:
        return jsonify({'error': 'Статья не найдена'}), 404
    return jsonify({'article': article_to_response(row)})


@app.get('/api/user/articles')
@token_required
def get_user_articles(current_user_id):
    with cursor() as cur:
        cur.execute(
            '''SELECT id, title, slug, body, excerpt, tags, status, template_type,
                      cover_image, moderator_comment, rating,
                      created_at, updated_at, published_at, author_id
               FROM articles WHERE author_id=%s ORDER BY created_at DESC''',
            (current_user_id,),
        )
        articles = [article_to_response(row) for row in cur.fetchall()]
    return jsonify({'articles': articles})


@app.post('/api/articles')
@token_required
def create_article(current_user_id):
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    requested_status = (data.get('status') or 'draft').strip()
    raw_body = (data.get('body') or data.get('content') or '').strip()
    excerpt = (data.get('excerpt') or '').strip()
    tags = (data.get('tags') or '').strip()
    template_type = (data.get('templateType') or 'classic').strip()
    cover_image = (data.get('coverImage') or '').strip()

    if requested_status not in CREATE_STATUSES:
        return jsonify({'error': 'При создании доступны только черновик и отправка на модерацию'}), 400
    if template_type not in TEMPLATE_TYPES:
        return jsonify({'error': 'В тестовой версии доступен только классический формат статьи'}), 400
    if not title:
        return jsonify({'error': 'Заголовок статьи обязателен'}), 400

    body = sanitize_article_html(raw_body)
    body_text = plain_text(body)
    if len(body_text) < 200:
        return jsonify({'error': 'Текст статьи должен быть не менее 200 символов'}), 400
    if not excerpt:
        excerpt = body_text[:200] + ('...' if len(body_text) > 200 else '')

    with cursor(commit=True) as cur:
        slug = unique_slug(cur, title)
        cur.execute(
            '''INSERT INTO articles
               (title, slug, author_id, body, excerpt, tags, template_type,
                cover_image, status, created_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
               RETURNING id, title, slug, author_id, body, excerpt, tags,
                         template_type, cover_image, moderator_comment, status,
                         rating, created_at, updated_at, published_at''',
            (
                title, slug, current_user_id, body, excerpt, tags,
                template_type, cover_image, requested_status,
            ),
        )
        article = article_to_response(cur.fetchone())

    message = 'Черновик сохранён' if requested_status == 'draft' else 'Статья отправлена на модерацию'
    return jsonify({'message': message, 'article': article}), 201


@app.get('/api/articles/<int:article_id>')
@token_required
def get_article(current_user_id, article_id):
    with cursor() as cur:
        cur.execute(
            '''SELECT a.id, a.title, a.slug, a.body, a.excerpt, a.tags, a.status,
                      a.template_type, a.cover_image, a.moderator_comment,
                      a.rating, a.author_id, a.created_at, a.updated_at,
                      a.published_at, COALESCE(u.username, u.email) AS author_name
               FROM articles a LEFT JOIN users u ON u.id=a.author_id
               WHERE a.id=%s''',
            (article_id,),
        )
        row = cur.fetchone()
        if not row:
            return jsonify({'error': 'Статья не найдена'}), 404
        role = get_user_role(cur, current_user_id)
        if row['author_id'] != current_user_id and not is_moderator_role(role):
            return jsonify({'error': 'Недостаточно прав'}), 403
    return jsonify({'article': article_to_response(row)})


@app.put('/api/articles/<int:article_id>')
@token_required
def update_article(current_user_id, article_id):
    data = request.get_json(silent=True) or {}
    title = (data.get('title') or '').strip()
    raw_body = (data.get('body') or data.get('content') or '').strip()
    excerpt = (data.get('excerpt') or '').strip()
    tags = (data.get('tags') or '').strip()
    cover_image = (data.get('coverImage') or '').strip()

    if not title or not raw_body:
        return jsonify({'error': 'Заголовок и текст статьи обязательны'}), 400

    body = sanitize_article_html(raw_body)
    body_text = plain_text(body)
    if len(body_text) < 200:
        return jsonify({'error': 'Текст статьи должен быть не менее 200 символов'}), 400
    if not excerpt:
        excerpt = body_text[:200] + ('...' if len(body_text) > 200 else '')

    with cursor(commit=True) as cur:
        cur.execute('SELECT author_id, status FROM articles WHERE id=%s', (article_id,))
        existing = cur.fetchone()
        if not existing:
            return jsonify({'error': 'Статья не найдена'}), 404
        if existing['author_id'] != current_user_id:
            return jsonify({'error': 'Редактировать статью может только автор'}), 403
        if existing['status'] not in {'draft', 'needs_revision'}:
            return jsonify({'error': 'Статья недоступна для редактирования в текущем статусе'}), 409

        slug = unique_slug(cur, title, article_id)
        cur.execute(
            '''UPDATE articles
               SET title=%s, slug=%s, body=%s, excerpt=%s, tags=%s,
                   template_type='classic', cover_image=%s, updated_at=NOW()
               WHERE id=%s
               RETURNING id, title, slug, author_id, body, excerpt, tags,
                         template_type, cover_image, moderator_comment, status,
                         rating, created_at, updated_at, published_at''',
            (title, slug, body, excerpt, tags, cover_image, article_id),
        )
        article = article_to_response(cur.fetchone())
    return jsonify({'message': 'Статья обновлена', 'article': article})


@app.post('/api/articles/<int:article_id>/submit')
@token_required
def submit_article(current_user_id, article_id):
    with cursor(commit=True) as cur:
        cur.execute('SELECT author_id, status FROM articles WHERE id=%s', (article_id,))
        article = cur.fetchone()
        if not article:
            return jsonify({'error': 'Статья не найдена'}), 404
        if article['author_id'] != current_user_id:
            return jsonify({'error': 'Недостаточно прав'}), 403
        if article['status'] not in {'draft', 'needs_revision'}:
            return jsonify({'error': 'Статью нельзя отправить из текущего статуса'}), 409

        cur.execute(
            '''UPDATE articles
               SET status='submitted', moderator_comment='', updated_at=NOW()
               WHERE id=%s
               RETURNING id, title, slug, author_id, body, excerpt, tags,
                         template_type, cover_image, moderator_comment, status,
                         rating, created_at, updated_at, published_at''',
            (article_id,),
        )
        updated = article_to_response(cur.fetchone())
    return jsonify({'message': 'Статья отправлена на модерацию', 'article': updated})


@app.delete('/api/articles/<int:article_id>')
@token_required
def delete_article(current_user_id, article_id):
    with cursor(commit=True) as cur:
        cur.execute('SELECT author_id, status FROM articles WHERE id=%s', (article_id,))
        article = cur.fetchone()
        if not article:
            return jsonify({'error': 'Статья не найдена'}), 404
        role = get_user_role(cur, current_user_id)
        if article['author_id'] != current_user_id and not is_moderator_role(role):
            return jsonify({'error': 'Недостаточно прав'}), 403
        if article['status'] == 'published' and not is_moderator_role(role):
            return jsonify({'error': 'Опубликованную статью удаляет только модератор'}), 403
        cur.execute('DELETE FROM articles WHERE id=%s', (article_id,))
    return jsonify({'message': 'Статья удалена'})


@app.get('/api/moderator/articles')
@moderator_required
def get_moderator_articles(_current_user_id):
    with cursor() as cur:
        cur.execute(
            '''SELECT a.id, a.title, a.slug, a.body, a.excerpt, a.tags, a.status,
                      a.template_type, a.cover_image, a.moderator_comment,
                      a.rating, a.created_at, a.updated_at, a.published_at,
                      a.author_id, COALESCE(u.username, u.email) AS author_name
               FROM articles a LEFT JOIN users u ON u.id=a.author_id
               WHERE a.status IN ('submitted','needs_revision','approved','published')
               ORDER BY CASE a.status
                   WHEN 'submitted' THEN 1
                   WHEN 'approved' THEN 2
                   WHEN 'needs_revision' THEN 3
                   ELSE 4 END,
                   a.updated_at DESC'''
        )
        articles = [article_to_response(row) for row in cur.fetchall()]
    return jsonify({'articles': articles})


@app.post('/api/moderator/articles/<int:article_id>/status')
@moderator_required
def moderate_article(current_user_id, article_id):
    data = request.get_json(silent=True) or {}
    new_status = (data.get('status') or '').strip()
    comment = (data.get('comment') or '').strip()

    with cursor(commit=True) as cur:
        cur.execute('SELECT status FROM articles WHERE id=%s FOR UPDATE', (article_id,))
        article = cur.fetchone()
        if not article:
            return jsonify({'error': 'Статья не найдена'}), 404

        allowed = MODERATOR_TRANSITIONS.get(article['status'], set())
        if new_status not in allowed:
            return jsonify({
                'error': f"Переход {article['status']} -> {new_status or '?'} запрещён"
            }), 409
        if new_status == 'needs_revision' and not comment:
            return jsonify({'error': 'При возврате на доработку укажите комментарий'}), 400

        published_at = 'NOW()' if new_status == 'published' else 'published_at'
        cur.execute(
            f'''UPDATE articles
                SET status=%s, moderator_comment=%s, moderated_by=%s,
                    moderated_at=NOW(), published_at={published_at}, updated_at=NOW()
                WHERE id=%s
                RETURNING id, title, slug, author_id, body, excerpt, tags,
                          template_type, cover_image, moderator_comment, status,
                          rating, created_at, updated_at, published_at''',
            (new_status, comment, current_user_id, article_id),
        )
        updated = article_to_response(cur.fetchone())

    labels = {
        'needs_revision': 'Статья возвращена на доработку',
        'approved': 'Статья одобрена',
        'published': 'Статья опубликована',
    }
    return jsonify({'message': labels[new_status], 'article': updated})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', '5000')), debug=False)
