from pydantic import BaseModel
from typing import Optional

class ItemCreate(BaseModel):
    item_code: str
    item_name: str
    units: Optional[str] = None
    opening_balance: Optional[float] = None
    cost_price: Optional[float] = None
    selling_price: Optional[float] = None

class ItemUpdate(BaseModel):
    item_name: Optional[str] = None
    units: Optional[str] = None
    opening_balance: Optional[float] = None
    cost_price: Optional[float] = None
    selling_price: Optional[float] = None

class ItemOut(BaseModel):
    item_code: str
    item_name: str
    units: Optional[str] = None
    opening_balance: Optional[float] = None
    cost_price: Optional[float] = None
    selling_price: Optional[float] = None

    class Config:
        from_attributes = True
