from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import String, Date, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class VendorPayment(Base):
    __tablename__ = "vendor_payment"

    payment_no: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        index=True,
    )

    payment_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    bill_no: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("purchase_invoice_hdr.bill_no"),
        nullable=False,
        index=True,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=0,
    )

    remark: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    bill = relationship(
        "app.models.purchase_invoice.PurchaseInvoiceHdr",
        back_populates="payments",
    )