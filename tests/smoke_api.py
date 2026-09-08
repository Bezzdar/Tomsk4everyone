#!/usr/bin/env python3
import json
import os
import subprocess
import time
import urllib.error
import urllib.request


BASE = os.getenv('SMOKE_API_BASE', 'http://127.0.0.1:8088/api').rstrip('/')
COMPOSE = ['docker', 'compose', '-f', 'tomsk-db/docker-compose.yml']


def request(method, path, body=None, token=None, expected=(200,)):
    data = None if body is None else json.dumps(body).encode('utf-8')
    headers = {'Accept': 'application/json'}
    if body is not None:
        headers['Content-Type'] = 'application/json'
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(f'{BASE}{path}', data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            status = response.status
            payload = json.loads(response.read().decode('utf-8') or '{}')
    except urllib.error.HTTPError as error:
        status = error.code
        payload = json.loads(error.read().decode('utf-8') or '{}')
    if status not in expected:
        raise AssertionError(f'{method} {path}: expected {expected}, got {status}: {payload}')
    return status, payload


def wait_health(timeout=60):
    deadline = time.time() + timeout
    last_error = None
    while time.time() < deadline:
        try:
            _, payload = request('GET', '/health', expected=(200,))
            if payload.get('status') == 'ok' and payload.get('database') == 'ok':
                return
        except Exception as error:  # noqa: BLE001 - diagnostic polling
            last_error = error
        time.sleep(1)
    raise RuntimeError(f'healthcheck did not become ready: {last_error}')


def promote_to_moderator(email):
    sql = f"UPDATE users SET role='site_moderator' WHERE email='{email}';"
    subprocess.run(
        COMPOSE + ['exec', '-T', 'postgres', 'psql', '-U', 'postgres', '-d', os.getenv('DB_NAME', 'tomsk'), '-v', 'ON_ERROR_STOP=1', '-c', sql],
        check=True,
    )


def main():
    wait_health()

    author_email = 'smoke-author@example.test'
    moderator_email = 'smoke-moderator@example.test'
    intruder_email = 'smoke-intruder@example.test'
    password = 'SmokePass123!'

    _, author_registration = request('POST', '/register', {
        'name': 'Smoke Author', 'email': author_email, 'password': password,
    }, expected=(201,))
    author_token = author_registration['token']

    malicious_body = (
        '<h2>Проверка пользовательской статьи</h2>'
        '<script>alert("xss")</script>'
        '<img src="https://example.com/photo.jpg" onerror="alert(1)" alt="Фото">'
        '<p>' + ('Томск — город, который удобно проверять шаг за шагом. ' * 8) + '</p>'
    )
    _, created = request('POST', '/articles', {
        'title': 'Smoke test article',
        'body': malicious_body,
        'excerpt': 'Проверка полного жизненного цикла.',
        'tags': 'smoke, test',
        'templateType': 'classic',
        'status': 'draft',
    }, author_token, expected=(201,))
    article = created['article']
    article_id = article['id']
    assert article['status'] == 'draft'
    assert '<script' not in article['content'].lower()
    assert 'onerror' not in article['content'].lower()

    request('POST', f'/articles/{article_id}/submit', {}, author_token)

    _, moderator_registration = request('POST', '/register', {
        'name': 'Smoke Moderator', 'email': moderator_email, 'password': password,
    }, expected=(201,))
    moderator_token = moderator_registration['token']
    promote_to_moderator(moderator_email)

    _, moderator_articles = request('GET', '/moderator/articles', token=moderator_token)
    assert any(item['id'] == article_id and item['status'] == 'submitted' for item in moderator_articles['articles'])

    request('POST', f'/moderator/articles/{article_id}/status', {
        'status': 'needs_revision', 'comment': 'Добавьте уточнение в основной текст.',
    }, moderator_token)

    revised_body = '<h2>Исправленная статья</h2><p>' + ('Исправленный материал о Томске после замечания модератора. ' * 8) + '</p>'
    _, revised = request('PUT', f'/articles/{article_id}', {
        'title': 'Smoke test article', 'body': revised_body,
        'excerpt': 'Исправленная версия.', 'tags': 'smoke, revised', 'coverImage': '',
    }, author_token)
    assert revised['article']['status'] == 'needs_revision'

    request('POST', f'/articles/{article_id}/submit', {}, author_token)
    request('POST', f'/moderator/articles/{article_id}/status', {'status': 'approved', 'comment': ''}, moderator_token)
    _, published = request('POST', f'/moderator/articles/{article_id}/status', {'status': 'published', 'comment': ''}, moderator_token)
    slug = published['article']['slug']

    _, public_article = request('GET', f'/articles/public/{slug}')
    assert public_article['article']['status'] == 'published'

    _, intruder = request('POST', '/register', {
        'name': 'Smoke Intruder', 'email': intruder_email, 'password': password,
    }, expected=(201,))
    request('PUT', f'/articles/{article_id}', {
        'title': 'Stolen', 'body': revised_body, 'excerpt': '', 'tags': '', 'coverImage': '',
    }, intruder['token'], expected=(403,))

    _, task_result = request('POST', '/tasks/complete', {'taskId': 'quiz-legends'}, author_token)
    assert task_result['pointsAwarded'] == 25
    request('POST', '/tasks/complete', {'taskId': 'quiz-legends'}, author_token, expected=(409,))
    request('POST', '/tasks/complete', {'taskId': 'photohunt-chekhov'}, author_token, expected=(409,))

    # A restart must not erase DB state or published content.
    subprocess.run(COMPOSE + ['restart', 'backend', 'frontend'], check=True)
    wait_health()
    _, after_restart = request('GET', f'/articles/public/{slug}')
    assert after_restart['article']['id'] == article_id

    print('USER TEST READY smoke flow passed')


if __name__ == '__main__':
    main()
