from io import BytesIO

import bleach
from PIL import Image, UnidentifiedImageError


ALLOWED_TAGS = {
    'p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u',
    'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'figure', 'figcaption',
}

ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title', 'target', 'rel'],
    'img': ['src', 'alt', 'title', 'width', 'height'],
}

ALLOWED_PROTOCOLS = {'http', 'https'}

ALLOWED_IMAGE_FORMATS = {
    'PNG': 'png',
    'JPEG': 'jpg',
    'GIF': 'gif',
    'WEBP': 'webp',
}


def sanitize_article_html(value: str) -> str:
    cleaned = bleach.clean(
        value or '',
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,
        strip_comments=True,
    )
    return bleach.linkifier.Linker(callbacks=[bleach.callbacks.nofollow]).linkify(cleaned)


def validate_image_bytes(data: bytes) -> str:
    """Validate actual image bytes and return a normalized extension."""
    try:
        with Image.open(BytesIO(data)) as image:
            image.verify()
            image_format = image.format
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ValueError('Файл не является корректным изображением') from exc

    extension = ALLOWED_IMAGE_FORMATS.get(image_format)
    if not extension:
        raise ValueError('Формат изображения не поддерживается')
    return extension
