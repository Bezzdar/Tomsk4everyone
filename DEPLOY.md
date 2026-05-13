# Развёртывание на сервере 77.222.43.106

## Что нужно установить на сервере

### 1. Системные зависимости

```bash
# Обновляем пакеты
apt update && apt upgrade -y

# Устанавливаем Docker и docker-compose
apt install -y docker.io docker-compose-plugin git curl

# Запускаем Docker
systemctl enable docker && systemctl start docker
```

### 2. Клонируем репозиторий

```bash
cd /opt
git clone https://github.com/bezzdar/tomsk4everyone.git
cd tomsk4everyone
```

### 3. Создаём .env для бэкенда

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Заполняем:
```
SECRET_KEY=<случайная_строка_32_символа>
JWT_SECRET_KEY=<другая_случайная_строка>
JWT_EXPIRES_HOURS=24

DB_HOST=postgres          # имя сервиса в docker-compose
DB_PORT=5432
DB_NAME=tomsk
DB_USER=tomsk_app
DB_PASSWORD=<надёжный_пароль>

CORS_ORIGINS=http://localhost:5500,http://127.0.0.1:5500,<адрес_фронтенда_если_нужен>

PORT=5000
UPLOAD_FOLDER=/var/www/tomsk/uploads
MAX_CONTENT_LENGTH=10485760
```

### 4. Создаём .env для docker-compose

```bash
cat > tomsk-db/.env << 'EOF'
POSTGRES_PASSWORD=<тот_же_пароль_что_в_DB_PASSWORD>
PGADMIN_EMAIL=admin@tomsk.local
PGADMIN_PASSWORD=<пароль_для_pgadmin>
EOF
```

### 5. Инициализируем базу данных

При первом запуске Docker автоматически выполнит SQL-скрипты из `tomsk-db/init/`:
- `init.sql` — базовая схема
- `002_articles_v2.sql` — расширения для статей (шаблоны, модерация)

### 6. Запускаем всё через docker-compose

```bash
cd tomsk-db
docker compose --env-file .env up -d
```

Проверяем статус:
```bash
docker compose ps
docker compose logs backend --tail=50
```

### 7. Создаём пользователя-модератора в БД

```bash
docker exec -it tomsk_postgres psql -U postgres -d tomsk
```

```sql
-- Меняем роль нужному пользователю (после регистрации через сайт)
UPDATE users SET role = 'site_moderator' WHERE email = 'moderator@example.com';
-- Для администратора:
UPDATE users SET role = 'site_admin' WHERE email = 'admin@example.com';
```

---

## Архитектура на сервере

```
77.222.43.106
│
├── :5000  → Flask backend (tomsk_backend контейнер)
│            обслуживает /api/* и /api/uploads/*
│
├── :5432  → PostgreSQL (только localhost, не снаружи)
│
└── :8080  → pgAdmin (только localhost)
             Для доступа снаружи используйте SSH-туннель:
             ssh -L 8080:localhost:8080 user@77.222.43.106
```

## Фронтенд (остаётся локально)

Фронтенд открывается через Live Server (VS Code) или любой статический сервер.
Все запросы к API идут на `http://77.222.43.106:5000/api`.

CORS уже настроен для `localhost:5500` и `127.0.0.1:5500`.
Если фронтенд на другом порту — добавьте его в `CORS_ORIGINS` в `.env`.

---

## Обновление после изменений в коде

```bash
cd /opt/tomsk4everyone
git pull origin claude/refactor-backend-setup-JKRXC

# Пересобираем только бэкенд
cd tomsk-db
docker compose up -d --build backend
```

## Применение миграций БД (если добавлены новые SQL-файлы)

```bash
docker exec -i tomsk_postgres psql -U postgres -d tomsk < /opt/tomsk4everyone/tomsk-db/init/002_articles_v2.sql
```

---

## Загрузка изображений

Загруженные файлы хранятся в Docker volume `uploads` → `/var/www/tomsk/uploads` внутри контейнера.
Доступны через бэкенд: `http://77.222.43.106:5000/api/uploads/<filename>`.

Для резервного копирования:
```bash
docker run --rm -v tomsk-db_uploads:/data -v $(pwd):/backup alpine \
  tar czf /backup/uploads-backup.tar.gz -C /data .
```
