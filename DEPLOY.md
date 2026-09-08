# Развёртывание Tomsk4everyone

Тестовая версия разворачивается единым Docker Compose-стеком: nginx раздаёт frontend и проксирует `/api` в Flask, PostgreSQL доступен только локально, загруженные изображения и данные БД лежат в Docker volumes.

## 1. Установить зависимости

На сервере нужны Docker с Compose plugin, Git и curl.

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git curl
sudo systemctl enable --now docker
```

## 2. Получить код

```bash
cd /opt
git clone https://github.com/Bezzdar/Tomsk4everyone.git
cd Tomsk4everyone
```

Для проверки интеграционной версии до её слияния:

```bash
git checkout user-test-ready-integration
```

## 3. Создать конфигурацию

```bash
cp tomsk-db/.env.example tomsk-db/.env
nano tomsk-db/.env
```

Обязательно заменить значения:

- `POSTGRES_PASSWORD`;
- `DB_PASSWORD`;
- `SECRET_KEY`;
- `JWT_SECRET_KEY`;
- при необходимости `PGADMIN_PASSWORD`.

Секреты должны быть независимыми случайными значениями. Production-backend завершит запуск с ошибкой, если получить пустые значения или известные заглушки.

## 4. Первый запуск

```bash
cd /opt/Tomsk4everyone/tomsk-db
docker compose --env-file .env up -d --build
```

Инициализация чистой БД выполняется в фиксированном порядке:

1. `000_bootstrap.sh` — создаёт и настраивает технического пользователя `tomsk_app` с паролем из окружения;
2. `init.sql` — базовая схема;
3. `002_articles_v2.sql` — жизненный цикл статей и медиа-поля;
4. `003_task_completions.sql` — сохранение выполненных заданий;
5. `004_user_test_ready.sql` — задания первой тестовой версии и дополнительные ограничения.

Проверка:

```bash
docker compose ps
curl -fsS http://127.0.0.1/api/health
```

Ожидаемый ответ:

```json
{"database":"ok","status":"ok"}
```

## 5. Адреса

По умолчанию:

```text
Browser
  |
  v
:80 nginx/frontend
  |-- /HTML, /JS, /CSS, /Sourse
  `-- /api/* -> Flask/Gunicorn :5000
                    |
                    v
                PostgreSQL :5432
```

Порт Flask наружу не публикуется. PostgreSQL опубликован только на `127.0.0.1:5432`.

Для изменения HTTP-порта задайте в `tomsk-db/.env`:

```env
HTTP_PORT=8080
```

## 6. Назначение модератора

Пользователь сначала регистрируется через сайт. После этого роль можно назначить администратором БД:

```bash
docker compose exec postgres \
  psql -U postgres -d tomsk \
  -c "UPDATE users SET role='site_moderator' WHERE email='moderator@example.com';"
```

После изменения роли повторный вход не обязателен: backend проверяет актуальную роль в БД при каждом модераторском запросе.

## 7. Обновление тестового стенда

Перед обновлением сделать резервную копию БД:

```bash
docker compose exec -T postgres \
  pg_dump -U postgres -d tomsk > ../backup-$(date +%Y%m%d-%H%M%S).sql
```

Затем:

```bash
cd /opt/Tomsk4everyone
git pull
cd tomsk-db
docker compose --env-file .env up -d --build
```

Обычное обновление не удаляет volumes.

**Не использовать `docker compose down -v` на стенде с нужными данными.** Флаг `-v` предназначен только для чистого тестового развёртывания и CI.

## 8. Проверка после обновления

```bash
curl -fsS http://127.0.0.1/api/health
docker compose ps
docker compose logs --tail=100 backend
```

После этого пройти `USER_TEST_CHECKLIST.md`.

## 9. pgAdmin

pgAdmin исключён из обычного запуска и включается только отдельным профилем:

```bash
docker compose --profile admin --env-file .env up -d pgadmin
```

Он слушает только `127.0.0.1:8080`. Для удалённого доступа используйте SSH-туннель.

## 10. Загруженные изображения

Изображения сохраняются в volume `uploads`. API принимает только файлы, которые проходят проверку реального формата изображения; имя генерирует backend.

Публичный путь имеет вид:

```text
/api/uploads/<generated-name>
```

Размер запроса ограничивается `MAX_CONTENT_LENGTH`.

## 11. Чистая проверка воспроизводимости

Только на тестовой машине или в CI:

```bash
cd tomsk-db
docker compose down -v --remove-orphans
docker compose --env-file .env up -d --build
cd ..
SMOKE_API_BASE=http://127.0.0.1/api python3 tests/smoke_api.py
```

Этот сценарий удаляет тестовые volumes и затем проверяет полный пользовательский цикл. На рабочей БД его запускать нельзя.
