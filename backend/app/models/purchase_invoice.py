from sqlalchemy import String, Integer, Date, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class PurchaseInvoiceHdr(Base):
    __tablename__ = "purchase_invoice_hdr"

    bill_no: Mapped[str] = mapped_column(String(50), primary_key=True, index=True)

    bill_date: Mapped[object] = mapped_column(Date, nullable=False)
    due_date: Mapped[object] = mapped_column(Date, nullable=True)

    vendor_code: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("vendor_master.vendor_code"),
        nullable=False,
        index=True,
    )

    subtotal: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    tax_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    grand_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)

    amount_paid: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    balance: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="Pending")
    remark: Mapped[str] = mapped_column(String(200), nullable=True)

    lines = relationship(
        "PurchaseInvoiceDtl",
        back_populates="hdr",
        cascade="all, delete-orphan",
    )


class PurchaseInvoiceDtl(Base):
    __tablename__ = "purchase_invoice_dtl"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    bill_no: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("purchase_invoice_hdr.bill_no"),
        nullable=False,
        index=True,
    )

    item_code: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("item_master.item_code"),
        nullable=False,
        index=True,
    )

    qty: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False, default=1)
    rate: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    line_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)

    hdr = relationship("PurchaseInvoiceHdr", back_populates="lines")