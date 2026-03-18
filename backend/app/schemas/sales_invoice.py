from pydantic import BaseModel
from typing import Optional, List
from datetime import date


class SalesInvoiceLineCreate(BaseModel):
    item_code: str
    qty: float
    rate: float


class SalesInvoiceCreate(BaseModel):
    customer_code: str
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
    customer_code: str
    invoice_date: date
    due_date: Optional[date] = None

    subtotal: float
    tax_percent: float
    tax_amount: float
    grand_total: float

    amount_received: float
    balance: float
    status: str
    remark: Optional[str] = None

    lines: List[SalesInvoiceLineOut]

    class Config:
        from_attributes = True