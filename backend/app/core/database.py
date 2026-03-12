from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=3600,
    future=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_db_connection() -> None:
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))