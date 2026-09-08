from contextlib import contextmanager

import psycopg2
import psycopg2.extras


_db_config = None


def configure_db(config: dict) -> None:
    global _db_config
    _db_config = dict(config)


def get_connection():
    if _db_config is None:
        raise RuntimeError('Database is not configured')
    return psycopg2.connect(**_db_config)


@contextmanager
def cursor(*, commit: bool = False):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        yield cur
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()
