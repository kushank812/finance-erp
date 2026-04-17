from pydantic import BaseModel
from typing import Optional, List
from datetime import date


class PurchaseInvoiceLineCreate(BaseModel):
    item_code: str
    qty: float
    rate: float


class PurchaseInvoiceCreate(BaseModel):
    vendor_code: str
    bill_date: date
    due_date: Optional[date] = None
    tax_percent: Optional[float] = 0
    remark: Optional[str] = None
    lines: List[PurchaseInvoiceLineCreate]


class PurchaseInvoiceLineOut(BaseModel):
    id: int
    item_code: str
    qty: float
    rate: float
    line_total: float

    class Config:
        from_attributes = True


class PurchaseInvoiceOut(BaseModel):
    bill_no: str
    vendor_code: str
    bill_date: date
    due_date: Optional[date] = None

    subtotal: float
    tax_percent: float
    tax_amount: float
    grand_total: float

    amount_paid: float
    adjusted_amount: float
    balance: float
    status: str
    remark: Optional[str] = None

    lines: List[PurchaseInvoiceLineOut]

    class Config:
        from_attributes = True