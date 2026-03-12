from sqlalchemy import String, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class Item(Base):
    __tablename__ = "item_master"

    item_code: Mapped[str] = mapped_column(String(50), primary_key=True, index=True)
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)

    units: Mapped[str] = mapped_column(String(50), nullable=True)

    opening_balance: Mapped[float] = mapped_column(Numeric(14, 3), nullable=True)
    cost_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=True)
    selling_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=True)
