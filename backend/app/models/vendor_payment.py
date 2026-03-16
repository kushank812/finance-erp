from sqlalchemy import Column, String, Date, Numeric, Text

from app.models.base import Base


class VendorPayment(Base):
    __tablename__ = "vendor_payments"

    payment_no = Column(String, primary_key=True, index=True)
    payment_date = Column(Date, nullable=True)
    bill_no = Column(String, nullable=False, index=True)
    amount = Column(Numeric(14, 2), nullable=False, default=0)
    remark = Column(Text, nullable=True)