import os
from pathlib import Path


PLACEHOLDERS = {
    '',
    'change-me-secret-key',
    'change-me-jwt-secret',
    'change-me-to-random-string',
    'change-me-to-another-random-string',
    'tomsk_app_password',
}


class ConfigurationError(RuntimeError):
    """Raised when a required runtime setting is missing or unsafe."""


def _is_production() -> bool:
    return os.getenv('APP_ENV', 'development').strip().lower() in {'prod', 'production'}


def _secret(name: str, development_default: str) -> str:
    value = (os.getenv(name) or '').strip()
    if _is_production() and value in PLACEHOLDERS:
        raise ConfigurationError(
            f'{name} must be explicitly configured with a non-placeholder value in production'
        )
    return value or development_default


def _db_password() -> str:
    value = (os.getenv('DB_PASSWORD') or '').strip()
    if _is_production() and value in PLACEHOLDERS:
        raise ConfigurationError('DB_PASSWORD must be explicitly configured in production')
    return value or 'tomsk_app_password'


def load_config() -> dict:
    upload_folder = os.getenv(
        'UPLOAD_FOLDER',
        str(Path(__file__).resolve().parent / 'uploads'),
    )
    cors_origins = tuple(
        origin.strip()
        for origin in os.getenv('CORS_ORIGINS', '').split(',')
        if origin.strip()
    )

    return {
        'APP_ENV': os.getenv('APP_ENV', 'development').strip().lower(),
        'SECRET_KEY': _secret('SECRET_KEY', 'dev-only-flask-secret'),
        'JWT_SECRET_KEY': _secret('JWT_SECRET_KEY', 'dev-only-jwt-secret'),
        'JWT_EXPIRES_HOURS': int(os.getenv('JWT_EXPIRES_HOURS', '24')),
        'UPLOAD_FOLDER': upload_folder,
        'MAX_CONTENT_LENGTH': int(os.getenv('MAX_CONTENT_LENGTH', str(10 * 1024 * 1024))),
        'CORS_ORIGINS': cors_origins,
        'DB_CONFIG': {
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': int(os.getenv('DB_PORT', '5432')),
            'database': os.getenv('DB_NAME', 'tomsk'),
            'user': os.getenv('DB_USER', 'tomsk_app'),
            'password': _db_password(),
            'client_encoding': 'utf-8',
            'connect_timeout': int(os.getenv('DB_CONNECT_TIMEOUT', '5')),
        },
    }
