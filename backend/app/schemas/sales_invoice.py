from datetime import date
from typing import List, Optional

from pydantic import BaseModel


class SalesInvoiceLineCreate(BaseModel):
    item_code: str
    qty: float
    rate: float


class SalesInvoiceCreate(BaseModel):
    customer_code: str
    invoice_template: Optional[str] = "STANDARD"
    invoice_date: date
    due_date: Optional[date] = None
    tax_percent: Optional[float] = 0
    remark: Optional[str] = None
    lines: List[SalesInvoiceLineCreate]


class SalesInvoiceLineOut(BaseModel):
    id: int
    item_code: str
    qty: float
    rate: float
    line_total: float

    class Config:
        from_attributes = True


class SalesInvoiceOut(BaseModel):
    invoice_no: str
    invoice_template: str = "STANDARD"

    customer_code: str
    invoice_date: date
    due_date: Optional[date] = None

    subtotal: float
    tax_percent: float
    tax_amount: float
    grand_total: float

    amount_received: float
    adjusted_amount: float
    balance: float
    status: str
    remark: Optional[str] = None

    lines: List[SalesInvoiceLineOut]

    class Config:
        from_attributes = True