import logging
import os
from functools import wraps

import bcrypt as password_bcrypt
from flask import Blueprint, jsonify, request

from app import get_user_role, token_required
from db import cursor


logger = logging.getLogger('tomsk4everyone.admin')
bp = Blueprint('admin_api', __name__)

ROLE_UI = {
    'site_user': 'user',
    'site_moderator': 'curator',
    'site_admin': 'admin',
}
UI_ROLE = {value: key for key, value in ROLE_UI.items()}


def admin_required(func):
    @wraps(func)
    @token_required
    def decorated(current_user_id, *args, **kwargs):
        with cursor() as cur:
            role = get_user_role(cur, current_user_id)
        if role != 'site_admin':
            return jsonify({'error': 'Требуются права администратора'}), 403
        return func(current_user_id, *args, **kwargs)

    return decorated


def ensure_bootstrap_admin():
    email = (os.getenv('BOOTSTRAP_ADMIN_EMAIL') or '').strip().lower()
    password = (os.getenv('BOOTSTRAP_ADMIN_PASSWORD') or '').strip()
    name = (os.getenv('BOOTSTRAP_ADMIN_NAME') or 'Администратор').strip()

    if not email or not password:
        logger.info('bootstrap_admin=disabled')
        return

    if password in {'replace-with-admin-password', 'change-me', 'password'}:
        logger.warning('bootstrap_admin=skipped reason=placeholder_password')
        return

    with cursor(commit=True) as cur:
        # Gunicorn starts multiple workers. Serialize bootstrap so two workers
        # cannot race while creating the same account.
        cur.execute('SELECT pg_advisory_xact_lock(%s)', (7426042026,))
        cur.execute(
            'SELECT id, role FROM users WHERE lower(email)=lower(%s)',
            (email,),
        )
        existing = cur.fetchone()
        if existing:
            if existing['role'] != 'site_admin':
                cur.execute(
                    "UPDATE users SET role='site_admin' WHERE id=%s",
                    (existing['id'],),
                )
                logger.info('bootstrap_admin=promoted user_id=%s', existing['id'])
            return

        password_hash = password_bcrypt.hashpw(
            password.encode('utf-8'),
            password_bcrypt.gensalt(),
        ).decode('utf-8')
        cur.execute(
            '''INSERT INTO users (username, email, password_hash, role, balance)
               VALUES (%s, %s, %s, 'site_admin', 0)
               RETURNING id''',
            (name, email, password_hash),
        )
        created = cur.fetchone()
        logger.info('bootstrap_admin=created user_id=%s', created['id'])


@bp.get('/api/admin/stats')
@admin_required
def admin_stats(_current_user_id):
    with cursor() as cur:
        cur.execute('SELECT COUNT(*) AS count FROM users')
        users = cur.fetchone()['count']
        cur.execute('SELECT COUNT(*) AS count FROM articles')
        articles = cur.fetchone()['count']
        cur.execute("SELECT COUNT(*) AS count FROM articles WHERE status='submitted'")
        pending = cur.fetchone()['count']
    return jsonify({'users': users, 'articles': articles, 'pendingArticles': pending})


@bp.get('/api/admin/users')
@admin_required
def admin_users(_current_user_id):
    with cursor() as cur:
        cur.execute(
            '''SELECT u.id, u.username, u.email, u.role, u.balance, u.created_at,
                      COUNT(DISTINCT utc.id) AS completed_tasks,
                      COUNT(DISTINCT a.id) AS articles_count
               FROM users u
               LEFT JOIN user_task_completions utc ON utc.user_id=u.id
               LEFT JOIN articles a ON a.author_id=u.id
               GROUP BY u.id
               ORDER BY u.created_at DESC, u.id DESC'''
        )
        users = [
            {
                'id': row['id'],
                'name': row['username'] or row['email'],
                'email': row['email'],
                'role': ROLE_UI.get(row['role'], 'user'),
                'balance': row['balance'] or 0,
                'completedTasks': row['completed_tasks'] or 0,
                'articlesCount': row['articles_count'] or 0,
                'createdAt': row['created_at'].isoformat() if row['created_at'] else None,
            }
            for row in cur.fetchall()
        ]
    return jsonify({'users': users})


@bp.patch('/api/admin/users/<int:user_id>')
@admin_required
def update_admin_user(current_user_id, user_id):
    data = request.get_json(silent=True) or {}
    requested_role = data.get('role')
    requested_balance = data.get('balance')

    updates = []
    values = []

    if requested_role is not None:
        db_role = UI_ROLE.get(str(requested_role))
        if not db_role:
            return jsonify({'error': 'Недопустимая роль'}), 400
        if user_id == current_user_id and db_role != 'site_admin':
            return jsonify({'error': 'Нельзя снять права администратора у текущего аккаунта'}), 409
        updates.append('role=%s')
        values.append(db_role)

    if requested_balance is not None:
        try:
            balance = int(requested_balance)
        except (TypeError, ValueError):
            return jsonify({'error': 'Баланс должен быть целым числом'}), 400
        if balance < 0:
            return jsonify({'error': 'Баланс не может быть отрицательным'}), 400
        updates.append('balance=%s')
        values.append(balance)

    if not updates:
        return jsonify({'error': 'Нет изменений'}), 400

    values.append(user_id)
    with cursor(commit=True) as cur:
        cur.execute(
            f'''UPDATE users SET {', '.join(updates)} WHERE id=%s
                RETURNING id, username, email, role, balance''',
            tuple(values),
        )
        row = cur.fetchone()
        if not row:
            return jsonify({'error': 'Пользователь не найден'}), 404

    return jsonify({
        'user': {
            'id': row['id'],
            'name': row['username'] or row['email'],
            'email': row['email'],
            'role': ROLE_UI.get(row['role'], 'user'),
            'balance': row['balance'] or 0,
        }
    })
