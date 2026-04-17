from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import String, Integer, Date, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class JournalVoucherHdr(Base):
    __tablename__ = "journal_voucher_hdr"

    voucher_no: Mapped[str] = mapped_column(
        String(50),
        primary_key=True,
        index=True,
    )

    voucher_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    voucher_kind: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="ADJUSTMENT",
    )

    reference_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
    )

    reference_no: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    party_code: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=0,
    )

    reason_code: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        default="MANUAL_ADJUSTMENT",
    )

    narration: Mapped[str | None] = mapped_column(
        String(300),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="POSTED",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
    )

    lines: Mapped[list["JournalVoucherDtl"]] = relationship(
        "JournalVoucherDtl",
        back_populates="hdr",
        cascade="all, delete-orphan",
    )


class JournalVoucherDtl(Base):
    __tablename__ = "journal_voucher_dtl"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    voucher_no: Mapped[str] = mapped_column(
        String(50),
        ForeignKey("journal_voucher_hdr.voucher_no"),
        nullable=False,
        index=True,
    )

    line_no: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )

    account_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    debit_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=0,
    )

    credit_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=0,
    )

    remark: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
    )

    hdr: Mapped["JournalVoucherHdr"] = relationship(
        "JournalVoucherHdr",
        back_populates="lines",
    )