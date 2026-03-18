from decimal import Decimal

from sqlalchemy import String, Numeric, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Item(Base):
    __tablename__ = "item_master"

    item_code: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        index=True,
    )

    item_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        index=True,
    )

    units: Mapped[str | None] = mapped_column(
        String(50),
        index=True,
    )

    opening_balance: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 3),
        default=0,
    )

    cost_price: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        default=0,
    )

    selling_price: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2),
        default=0,
    )

    __table_args__ = (
        Index("ix_item_name_units", "item_name", "units"),
    )