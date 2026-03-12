from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class Customer(Base):
    __tablename__ = "customer_master"

    customer_code: Mapped[str] = mapped_column(String(50), primary_key=True, index=True)
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)

    customer_address_line1: Mapped[str] = mapped_column(String(200), nullable=True)
    customer_address_line2: Mapped[str] = mapped_column(String(200), nullable=True)
    customer_address_line3: Mapped[str] = mapped_column(String(200), nullable=True)

    city: Mapped[str] = mapped_column(String(100), nullable=True)
    state: Mapped[str] = mapped_column(String(100), nullable=True)
    pincode: Mapped[str] = mapped_column(String(20), nullable=True)

    mobile_no: Mapped[str] = mapped_column(String(30), nullable=True)
    ph_no: Mapped[str] = mapped_column(String(30), nullable=True)

    email_id: Mapped[str] = mapped_column(String(200), nullable=True)
    gst_no: Mapped[str] = mapped_column(String(30), nullable=True)
