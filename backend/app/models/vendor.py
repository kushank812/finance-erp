from sqlalchemy import String, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Vendor(Base):
    __tablename__ = "vendor_master"

    vendor_code: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        index=True,
    )

    vendor_name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        index=True,
    )

    vendor_address_line1: Mapped[str | None] = mapped_column(String(200))
    vendor_address_line2: Mapped[str | None] = mapped_column(String(200))
    vendor_address_line3: Mapped[str | None] = mapped_column(String(200))

    city: Mapped[str | None] = mapped_column(String(100), index=True)
    state: Mapped[str | None] = mapped_column(String(100), index=True)
    pincode: Mapped[str | None] = mapped_column(String(20))

    mobile_no: Mapped[str | None] = mapped_column(String(30), index=True)
    ph_no: Mapped[str | None] = mapped_column(String(30))

    email_id: Mapped[str | None] = mapped_column(String(200), index=True)

    gst_no: Mapped[str | None] = mapped_column(
        String(30),
        unique=True,
        index=True,
    )

    __table_args__ = (
        Index("ix_vendor_name_city", "vendor_name", "city"),
    )