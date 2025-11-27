from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_bcrypt import Bcrypt
import psycopg2
import psycopg2.extras
import os
from datetime import datetime, timedelta
import jwt
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['JWT_SECRET_KEY'] = 'jwt-secret-key-here'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

CORS(app)
bcrypt = Bcrypt(app)

def get_db_connection():
    try:
        conn = psycopg2.connect(
            host='80.93.61.75',
            database='glebkatren',
            user='tomsk_app',
            password='tomsk_app_password',
            client_encoding='utf-8'  
        )
        print("Database connection successful")
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        raise

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'error': 'Требуется авторизация'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            
            data = jwt.decode(token, app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            current_user_id = data['user_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Токен истек'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Недействительный токен'}), 401
        
        return f(current_user_id, *args, **kwargs)
    
    return decorated

def create_jwt_token(user_id):
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + app.config['JWT_ACCESS_TOKEN_EXPIRES']
    }
    return jwt.encode(payload, app.config['JWT_SECRET_KEY'], algorithm='HS256')

def normalize_user_data(user_data):
    """Normalize user data to match frontend expectations"""
    role_mapping = {
        'site_user': 'user',
        'site_moderator': 'curator', 
        'site_admin': 'admin'
    }
    
    return {
        'id': user_data['id'],
        'name': user_data['username'] or user_data['email'],
        'email': user_data['email'],
        'role': role_mapping.get(user_data['role'], 'user'),
        'avatar': user_data['avatar_url'] or '/Img/default-avatar.png',
        'completedTasks': [],  
        'articles': []  
    }

@app.route('/api/register', methods=['POST'])
def register():
    try:
        print("=== REGISTER REQUEST ===")
        data = request.get_json()
        print("Received data:", data)
        
        if not data:
            print("No JSON data received")
            return jsonify({'error': 'No data received'}), 400
            
        name = data.get('name', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        print(f"Name: '{name}', Email: '{email}', Password: '{password}'")
        
        if not name or not email or not password:
            print("Missing required fields")
            return jsonify({'error': 'Заполните все обязательные поля'}), 400
        
        if len(password) < 6:
            return jsonify({'error': 'Пароль должен содержать не менее 6 символов'}), 400
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        print("Checking if user exists...")
        cur.execute('SELECT id FROM users WHERE email = %s', (email,))
        existing_user = cur.fetchone()
        
        if existing_user:
            print("User already exists")
            cur.close()
            conn.close()
            return jsonify({'error': 'Пользователь с таким email уже зарегистрирован'}), 400
        
        print("Hashing password...")
        try:
            password_str = str(password) if not isinstance(password, str) else password
            hashed_password = bcrypt.generate_password_hash(password_str).decode('utf-8')
            print("Password hashed successfully")
        except Exception as hash_error:
            print(f"Password hashing error: {hash_error}")
            print(f"Password type: {type(password)}, value: {password}")
            cur.close()
            conn.close()
            return jsonify({'error': 'Ошибка обработки пароля'}), 500
        
        print("Creating user...")
        cur.execute(
            '''INSERT INTO users (username, email, password_hash, role, avatar_url, balance) 
               VALUES (%s, %s, %s, 'site_user', '/Img/default-avatar.png', 0) 
               RETURNING id, username, email, role, avatar_url''',
            (name, email, hashed_password)
        )
        
        user_data = cur.fetchone()
        print("User created:", user_data)
        conn.commit()
        
        user = normalize_user_data(user_data)
        user['articles'] = []
        user['completedTasks'] = []
        
        token = create_jwt_token(user_data['id'])
        
        cur.close()
        conn.close()
        
        print("Registration successful!")
        return jsonify({
            'message': 'Аккаунт создан успешно!',
            'user': user,
            'token': token
        }), 201
        
    except Exception as e:
        print(f"Registration error: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({'error': 'Ошибка сервера при регистрации'}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        
        if not email or not password:
            return jsonify({'error': 'Введите email и пароль'}), 400
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        cur.execute(
            'SELECT id, username, email, password_hash, role, avatar_url FROM users WHERE email = %s',
            (email,)
        )
        
        user_data = cur.fetchone()
        
        if not user_data or not bcrypt.check_password_hash(user_data['password_hash'], password):
            cur.close()
            conn.close()
            return jsonify({'error': 'Неверная пара логина и пароля'}), 401
        
        # Get user's articles and tasks
        cur.execute('SELECT id, title, slug, created_at FROM articles WHERE author_id = %s', (user_data['id'],))
        articles = [{
            'id': str(row['id']),
            'title': row['title'],
            'link': f"/articles/{row['slug']}",
            'createdAt': row['created_at'].isoformat()
        } for row in cur.fetchall()]
        
        cur.execute('SELECT task_id FROM user_tasks WHERE user_id = %s', (user_data['id'],))
        completed_tasks = [str(row['task_id']) for row in cur.fetchall()]
        
        user = normalize_user_data(user_data)
        user['articles'] = articles
        user['completedTasks'] = completed_tasks
        
        # Create JWT token
        token = create_jwt_token(user_data['id'])
        
        cur.close()
        conn.close()
        
        return jsonify({
            'message': 'Вход выполнен успешно!',
            'user': user,
            'token': token
        })
        
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({'error': 'Ошибка сервера при входе'}), 500

@app.route('/api/user/profile', methods=['GET'])
@token_required
def get_profile(current_user_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        cur.execute(
            'SELECT id, username, email, role, avatar_url FROM users WHERE id = %s',
            (current_user_id,)
        )
        
        user_data = cur.fetchone()
        if not user_data:
            return jsonify({'error': 'Пользователь не найден'}), 404
        
        # Get user's articles and tasks
        cur.execute('SELECT id, title, slug, created_at FROM articles WHERE author_id = %s', (current_user_id,))
        articles = [{
            'id': str(row['id']),
            'title': row['title'],
            'link': f"/articles/{row['slug']}",
            'createdAt': row['created_at'].isoformat()
        } for row in cur.fetchall()]
        
        cur.execute('SELECT task_id FROM user_tasks WHERE user_id = %s', (current_user_id,))
        completed_tasks = [str(row['task_id']) for row in cur.fetchall()]
        
        user = normalize_user_data(user_data)
        user['articles'] = articles
        user['completedTasks'] = completed_tasks
        
        cur.close()
        conn.close()
        
        return jsonify({'user': user})
        
    except Exception as e:
        print(f"Profile error: {e}")
        return jsonify({'error': 'Ошибка сервера'}), 500

@app.route('/api/admin/users', methods=['GET'])
@token_required
def get_all_users(current_user_id):
    try:
        # Check if user is admin
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        cur.execute('SELECT role FROM users WHERE id = %s', (current_user_id,))
        user_role = cur.fetchone()['role']
        
        if user_role != 'site_admin':
            return jsonify({'error': 'Недостаточно прав'}), 403
        
        # Get all users
        cur.execute('SELECT id, username, email, role, avatar_url FROM users ORDER BY username')
        users_data = cur.fetchall()
        
        users = []
        for user_data in users_data:
            user = normalize_user_data(user_data)
            
            # Get article count
            cur.execute('SELECT COUNT(*) FROM articles WHERE author_id = %s', (user_data['id'],))
            article_count = cur.fetchone()[0]
            
            # Get completed tasks count
            cur.execute('SELECT COUNT(*) FROM user_tasks WHERE user_id = %s', (user_data['id'],))
            tasks_count = cur.fetchone()[0]
            
            user['stats'] = {
                'articles': article_count,
                'completedTasks': tasks_count
            }
            
            users.append(user)
        
        cur.close()
        conn.close()
        
        return jsonify({'users': users})
        
    except Exception as e:
        print(f"Admin users error: {e}")
        return jsonify({'error': 'Ошибка сервера'}), 500

@app.route('/api/admin/users/<int:user_id>/role', methods=['PUT'])
@token_required
def update_user_role(current_user_id, user_id):
    try:
        # Check if current user is admin
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        
        cur.execute('SELECT role FROM users WHERE id = %s', (current_user_id,))
        current_user_role = cur.fetchone()['role']
        
        if current_user_role != 'site_admin':
            return jsonify({'error': 'Недостаточно прав'}), 403
        
        data = request.get_json()
        new_role = data.get('role')
        
        # Map frontend roles to database roles
        role_mapping = {
            'user': 'site_user',
            'curator': 'site_moderator',
            'admin': 'site_admin'
        }
        
        db_role = role_mapping.get(new_role)
        if not db_role:
            return jsonify({'error': 'Неверная роль'}), 400
        
        # Update user role
        cur.execute(
            'UPDATE users SET role = %s WHERE id = %s RETURNING id, username, email, role, avatar_url',
            (db_role, user_id)
        )
        
        updated_user = cur.fetchone()
        if not updated_user:
            return jsonify({'error': 'Пользователь не найден'}), 404
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({
            'message': f'Роль пользователя обновлена на {new_role}',
            'user': normalize_user_data(updated_user)
        })
        
    except Exception as e:
        print(f"Update role error: {e}")
        return jsonify({'error': 'Ошибка сервера'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)