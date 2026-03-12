from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings

# ------------------------------------------------
# Database Engine
# ------------------------------------------------

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,      # prevents stale connection crashes
    pool_recycle=3600,       # refresh connections periodically
    future=True,
)

# ------------------------------------------------
# Session Factory
# ------------------------------------------------

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


# ------------------------------------------------
# Dependency for FastAPI
# ------------------------------------------------

def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ------------------------------------------------
# Health Check
# ------------------------------------------------

def test_db_connection() -> None:
    """
    Simple DB ping used by /health/db
    """
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))