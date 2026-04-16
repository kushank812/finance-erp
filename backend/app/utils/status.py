from __future__ import annotations

from datetime import date
from decimal import Decimal


STATUS_PENDING = "PENDING"
STATUS_PARTIAL = "PARTIAL"
STATUS_PAID = "PAID"
STATUS_OVERDUE = "OVERDUE"
STATUS_CANCELLED = "CANCELLED"


def to_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def normalize_amount(value) -> Decimal:
    amt = to_decimal(value)
    if amt < 0:
        return Decimal("0")
    return amt


def compute_balance(grand_total, amount_done) -> Decimal:
    total = normalize_amount(grand_total)
    done = normalize_amount(amount_done)

    balance = total - done
    if balance < 0:
        return Decimal("0")
    return balance


def is_overdue(
    *,
    due_date: date | None = None,
    balance=None,
    cancelled: bool = False,
    today: date | None = None,
) -> bool:
    if cancelled:
        return False

    bal = normalize_amount(balance)
    if bal <= 0:
        return False

    if not due_date:
        return False

    reference_date = today or date.today()
    return due_date < reference_date


def compute_status(
    grand_total,
    amount_done=None,
    due_date: date | None = None,
    *,
    balance=None,
    cancelled: bool = False,
    today: date | None = None,
) -> str:
    """
    Generic finance payment-status calculator.

    Use for:
    - Sales Invoice: amount_done = amount_received
    - Purchase Bill: amount_done = amount_paid

    This function returns PAYMENT STATUS only:
    1. Cancelled
    2. Paid
    3. Partial
    4. Pending

    Overdue is computed separately using is_overdue(...).
    """
    if cancelled:
        return STATUS_CANCELLED

    total = normalize_amount(grand_total)

    if balance is None:
        bal = compute_balance(total, amount_done)
    else:
        bal = normalize_amount(balance)

    if bal <= 0:
        return STATUS_PAID

    if total > 0 and bal < total:
        return STATUS_PARTIAL

    return STATUS_PENDING


def status_counts_from_rows(rows, *, today: date | None = None) -> dict[str, int]:
    """
    rows format:
    [
        {
            "grand_total": ...,
            "balance": ...,
            "due_date": ...,
            "cancelled": False,
        },
        ...
    ]

    Returns payment-status counts only.
    """
    counts = {
        STATUS_PENDING: 0,
        STATUS_PARTIAL: 0,
        STATUS_PAID: 0,
        STATUS_OVERDUE: 0,
        STATUS_CANCELLED: 0,
    }

    reference_date = today or date.today()

    for row in rows:
        status = compute_status(
            grand_total=row.get("grand_total"),
            balance=row.get("balance"),
            due_date=row.get("due_date"),
            cancelled=bool(row.get("cancelled", False)),
            today=reference_date,
        )
        counts[status] += 1

    return counts


def overdue_count_from_rows(rows, *, today: date | None = None) -> int:
    """
    Counts all open overdue rows, including both PENDING and PARTIAL documents.
    """
    reference_date = today or date.today()
    count = 0

    for row in rows:
        if is_overdue(
            due_date=row.get("due_date"),
            balance=row.get("balance"),
            cancelled=bool(row.get("cancelled", False)),
            today=reference_date,
        ):
            count += 1

    return count


def amount_if_overdue(
    grand_total,
    amount_done=None,
    due_date: date | None = None,
    *,
    balance=None,
    cancelled: bool = False,
    today: date | None = None,
):
    if balance is None:
        bal = compute_balance(grand_total, amount_done)
    else:
        bal = normalize_amount(balance)

    if not is_overdue(
        due_date=due_date,
        balance=bal,
        cancelled=cancelled,
        today=today,
    ):
        return Decimal("0")

    return bal