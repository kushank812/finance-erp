from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class NumberSequence(Base):
    __tablename__ = "number_sequence"

    key_name: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
    )

    prefix: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    last_value: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    padding: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=4,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
    )