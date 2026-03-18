from sqlalchemy import String, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Customer(Base):
    __tablename__ = "customer_master"

    # Primary key
    customer_code: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        index=True,
    )

    # Basic info
    customer_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        index=True,
    )

    # Address
    customer_address_line1: Mapped[str | None] = mapped_column(String(200))
    customer_address_line2: Mapped[str | None] = mapped_column(String(200))
    customer_address_line3: Mapped[str | None] = mapped_column(String(200))

    city: Mapped[str | None] = mapped_column(String(100), index=True)
    state: Mapped[str | None] = mapped_column(String(100), index=True)
    pincode: Mapped[str | None] = mapped_column(String(20))

    # Contact
    mobile_no: Mapped[str | None] = mapped_column(String(30), index=True)
    ph_no: Mapped[str | None] = mapped_column(String(30))

    email_id: Mapped[str | None] = mapped_column(String(200), index=True)

    # Tax
    gst_no: Mapped[str | None] = mapped_column(
        String(30),
        unique=True,   # 🔥 important
        index=True,
    )

    # Optional composite index for search
    __table_args__ = (
        Index("ix_customer_name_city", "customer_name", "city"),
    )