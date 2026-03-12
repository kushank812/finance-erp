from pydantic import BaseModel
from typing import Optional

class VendorCreate(BaseModel):
    vendor_code: str
    vendor_name: str
    vendor_address_line1: Optional[str] = None
    vendor_address_line2: Optional[str] = None
    vendor_address_line3: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    mobile_no: Optional[str] = None
    ph_no: Optional[str] = None
    email_id: Optional[str] = None
    gst_no: Optional[str] = None

class VendorUpdate(BaseModel):
    vendor_name: Optional[str] = None
    vendor_address_line1: Optional[str] = None
    vendor_address_line2: Optional[str] = None
    vendor_address_line3: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    mobile_no: Optional[str] = None
    ph_no: Optional[str] = None
    email_id: Optional[str] = None
    gst_no: Optional[str] = None

class VendorOut(BaseModel):
    vendor_code: str
    vendor_name: str
    vendor_address_line1: Optional[str] = None
    vendor_address_line2: Optional[str] = None
    vendor_address_line3: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    mobile_no: Optional[str] = None
    ph_no: Optional[str] = None
    email_id: Optional[str] = None
    gst_no: Optional[str] = None

    class Config:
        from_attributes = True
