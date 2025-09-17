# Как поднять проект локально

1. Установить Docker и Docker Compose
2. Клонировать папку tomsk-db
3. Выполнить:
   docker-compose up -d
4. Открыть pgAdmin: http://localhost:8081/
   Email: admin@example.com
   Password: admin123
5. В pgAdmin добавить сервер:
   - Host: postgres
   - Port: 5432
   - User: tomsk
   - Password: secret
