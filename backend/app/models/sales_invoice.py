from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import String, Integer, Date, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SalesInvoiceHdr(Base):
    __tablename__ = "sales_invoice_hdr"

    invoice_no: Mapped[str] = mapped_column(String(50), primary_key=True, index=True)

    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    customer_code: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("customer_master.customer_code"),
        nullable=False,
        index=True,
    )

    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=0,
    )
    tax_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        default=0,
    )
    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=0,
    )
    grand_total: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=0,
    )

    amount_received: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=0,
    )

    adjusted_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=0,
    )

    balance: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=0,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="PENDING",
    )
    remark: Mapped[str | None] = mapped_column(String(200), nullable=True)

    lines = relationship(
        "SalesInvoiceDtl",
        back_populates="hdr",
        cascade="all, delete-orphan",
    )

    receipts = relationship(
        "SalesReceipt",
        back_populates="invoice",
        cascade="all, delete-orphan",
    )


class SalesInvoiceDtl(Base):
    __tablename__ = "sales_invoice_dtl"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    invoice_no: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("sales_invoice_hdr.invoice_no"),
        nullable=False,
        index=True,
    )

    item_code: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("item_master.item_code"),
        nullable=False,
        index=True,
    )

    qty: Mapped[Decimal] = mapped_column(
        Numeric(14, 3),
        nullable=False,
        default=1,
    )
    rate: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=0,
    )
    line_total: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=0,
    )

    hdr = relationship("SalesInvoiceHdr", back_populates="lines")


class SalesReceipt(Base):
    __tablename__ = "sales_receipt"

    receipt_no: Mapped[str] = mapped_column(String(50), primary_key=True, index=True)

    invoice_no: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("sales_invoice_hdr.invoice_no"),
        nullable=False,
        index=True,
    )

    receipt_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=0,
    )
    remark: Mapped[str | None] = mapped_column(String(200), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    invoice = relationship("SalesInvoiceHdr", back_populates="receipts")