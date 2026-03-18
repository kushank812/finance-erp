from pydantic import BaseModel
from typing import Optional


class CustomerCreate(BaseModel):
    customer_name: str
    customer_address_line1: Optional[str] = None
    customer_address_line2: Optional[str] = None
    customer_address_line3: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    mobile_no: Optional[str] = None
    ph_no: Optional[str] = None
    email_id: Optional[str] = None
    gst_no: Optional[str] = None


class CustomerUpdate(BaseModel):
    customer_name: Optional[str] = None
    customer_address_line1: Optional[str] = None
    customer_address_line2: Optional[str] = None
    customer_address_line3: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    mobile_no: Optional[str] = None
    ph_no: Optional[str] = None
    email_id: Optional[str] = None
    gst_no: Optional[str] = None


class CustomerOut(BaseModel):
    customer_code: str
    customer_name: str
    customer_address_line1: Optional[str] = None
    customer_address_line2: Optional[str] = None
    customer_address_line3: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    mobile_no: Optional[str] = None
    ph_no: Optional[str] = None
    email_id: Optional[str] = None
    gst_no: Optional[str] = None

    class Config:
        from_attributes = True