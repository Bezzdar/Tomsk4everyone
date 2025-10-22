# Как поднять проект локально

1. Установить Docker и Docker Compose
2. Перейти в папку `tomsk-db`
3. Запустить базы данных командой `docker-compose up -d`
4. Открыть pgAdmin: http://localhost:8080/
   Email: glebkatrenko67@gmail.com
   Password: admin
5. В pgAdmin добавить сервер:
   - Host: localhost
   - Port: 5432
   - Database: tomsk
   - User: site_admin
   - Password: site_admin_password

Дополнительные роли создаются автоматически:

- `site_user` / `site_user_password`
- `site_moderator` / `site_moderator_password`
- `tomsk_app` / `tomsk_app_password`

Для подключения приложений можно использовать, например, строку подключения:

```
postgresql://site_admin:site_admin_password@localhost:5432/tomsk
```

## Прототип страницы аутентификации

- Готовая верстка доступна по пути `/HTML/auth.html` и использует стили `/CSS/auth.css`.
- На странице реализованы формы входа и регистрации с выбором уровня доступа (экскурсант, автор, куратор, администратор).
- Текущая логика хранит пользователей в `localStorage` для демонстрации. Точки интеграции с backend помечены в `JS/auth.js` и могут быть заменены на реальные запросы к API.
