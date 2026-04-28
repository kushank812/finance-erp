from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.auth import require_viewer_or_above

from app.models.user import User
from app.models.customer import Customer
from app.models.vendor import Vendor
from app.models.sales_invoice import SalesInvoiceHdr
from app.models.purchase_invoice import PurchaseInvoiceHdr
from app.models.sales_invoice import SalesReceipt
from app.models.vendor_payment import VendorPayment

from app.services.ai.email_service import EmailService
from app.services.ai.email_pdf_service import (
    invoice_pdf,
    receipt_pdf,
    purchase_bill_pdf,
    vendor_payment_pdf,
    customer_due_pdf,
    vendor_due_pdf,
)

router = APIRouter(prefix="/email", tags=["Email Reports"])


# 🔥 FIXED EMAIL RESOLVER (CUSTOMER + VENDOR)
def resolve_email(obj, entity: str):
    email = (
        getattr(obj, "email", None)
        or getattr(obj, "email_id", None)
        or getattr(obj, "customer_email", None)
        or getattr(obj, "vendor_email", None)
    )

    if not email or not str(email).strip():
        raise HTTPException(
            status_code=400,
            detail=f"{entity} email is missing in master.",
        )

    return str(email).strip()


# ================= SALES INVOICE =================
@router.post("/sales-invoice/{invoice_no}")
def email_sales_invoice(
    invoice_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    invoice = db.get(SalesInvoiceHdr, invoice_no)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    customer = db.get(Customer, invoice.customer_code)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    to_email = resolve_email(customer, "Customer")

    pdf_path = invoice_pdf(invoice, customer)

    EmailService().send_email(
        to_email=to_email,
        subject=f"Invoice {invoice.invoice_no}",
        body=(
            f"Dear {customer.customer_name},\n\n"
            f"Please find attached invoice {invoice.invoice_no}.\n\n"
            f"Invoice Amount: {invoice.grand_total}\n"
            f"Balance Payable: {invoice.balance}\n"
            f"Due Date: {invoice.due_date}\n\n"
            f"Regards,\nFinance Team"
        ),
        attachment_path=pdf_path,
        attachment_name=f"Invoice_{invoice.invoice_no}.pdf",
    )

    return {"message": "Invoice email sent successfully.", "to": to_email}


# ================= RECEIPT =================
@router.post("/receipt/{receipt_no}")
def email_receipt(
    receipt_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    receipt = db.get(SalesReceipt, receipt_no)
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found.")

    invoice = db.get(SalesInvoiceHdr, receipt.invoice_no)
    if not invoice:
        raise HTTPException(status_code=404, detail="Linked invoice not found.")

    customer = db.get(Customer, invoice.customer_code)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    to_email = resolve_email(customer, "Customer")

    pdf_path = receipt_pdf(receipt, customer)

    EmailService().send_email(
        to_email=to_email,
        subject=f"Receipt {receipt.receipt_no}",
        body=(
            f"Dear {customer.customer_name},\n\n"
            f"Payment received successfully.\n"
            f"Please find attached receipt {receipt.receipt_no}.\n\n"
            f"Regards,\nFinance Team"
        ),
        attachment_path=pdf_path,
        attachment_name=f"Receipt_{receipt.receipt_no}.pdf",
    )

    return {"message": "Receipt email sent successfully.", "to": to_email}


# ================= PURCHASE BILL =================
@router.post("/purchase-bill/{bill_no}")
def email_purchase_bill(
    bill_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    bill = db.get(PurchaseInvoiceHdr, bill_no)
    if not bill:
        raise HTTPException(status_code=404, detail="Purchase bill not found.")

    vendor = db.get(Vendor, bill.vendor_code)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")

    to_email = resolve_email(vendor, "Vendor")

    pdf_path = purchase_bill_pdf(bill, vendor)

    EmailService().send_email(
        to_email=to_email,
        subject=f"Purchase Bill {bill.bill_no}",
        body=(
            f"Dear {vendor.vendor_name},\n\n"
            f"Please find attached purchase bill {bill.bill_no}.\n\n"
            f"Bill Amount: {bill.grand_total}\n"
            f"Balance Payable: {bill.balance}\n"
            f"Due Date: {bill.due_date}\n\n"
            f"Regards,\nFinance Team"
        ),
        attachment_path=pdf_path,
        attachment_name=f"Purchase_Bill_{bill.bill_no}.pdf",
    )

    return {"message": "Purchase bill email sent successfully.", "to": to_email}


# ================= VENDOR PAYMENT =================
@router.post("/vendor-payment/{payment_no}")
def email_vendor_payment(
    payment_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    payment = db.get(VendorPayment, payment_no)
    if not payment:
        raise HTTPException(status_code=404, detail="Vendor payment not found.")

    bill = db.get(PurchaseInvoiceHdr, payment.bill_no)
    if not bill:
        raise HTTPException(status_code=404, detail="Linked bill not found.")

    vendor = db.get(Vendor, bill.vendor_code)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")

    to_email = resolve_email(vendor, "Vendor")

    pdf_path = vendor_payment_pdf(payment, vendor)

    EmailService().send_email(
        to_email=to_email,
        subject=f"Vendor Payment {payment.payment_no}",
        body=(
            f"Dear {vendor.vendor_name},\n\n"
            f"Payment has been recorded.\n"
            f"Please find attached payment report {payment.payment_no}.\n\n"
            f"Regards,\nFinance Team"
        ),
        attachment_path=pdf_path,
        attachment_name=f"Vendor_Payment_{payment.payment_no}.pdf",
    )

    return {"message": "Vendor payment email sent successfully.", "to": to_email}


# ================= CUSTOMER STATEMENT =================
@router.post("/customer-statement/{customer_code}")
def email_customer_statement(
    customer_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    customer = db.get(Customer, customer_code)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found.")

    to_email = resolve_email(customer, "Customer")

    invoices = (
        db.query(SalesInvoiceHdr)
        .filter(
            SalesInvoiceHdr.customer_code == customer_code,
            SalesInvoiceHdr.balance > 0,
            SalesInvoiceHdr.status != "CANCELLED",
        )
        .order_by(SalesInvoiceHdr.due_date.asc())
        .all()
    )

    pdf_path = customer_due_pdf(customer, invoices)

    EmailService().send_email(
        to_email=to_email,
        subject="Outstanding Payment Statement",
        body=(
            f"Dear {customer.customer_name},\n\n"
            f"Please find attached your outstanding payment statement.\n\n"
            f"Regards,\nFinance Team"
        ),
        attachment_path=pdf_path,
        attachment_name=f"Customer_Statement_{customer.customer_code}.pdf",
    )

    return {"message": "Customer statement email sent successfully.", "to": to_email}


# ================= VENDOR STATEMENT =================
@router.post("/vendor-statement/{vendor_code}")
def email_vendor_statement(
    vendor_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    vendor = db.get(Vendor, vendor_code)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found.")

    to_email = resolve_email(vendor, "Vendor")

    bills = (
        db.query(PurchaseInvoiceHdr)
        .filter(
            PurchaseInvoiceHdr.vendor_code == vendor_code,
            PurchaseInvoiceHdr.balance > 0,
            PurchaseInvoiceHdr.status != "CANCELLED",
        )
        .order_by(PurchaseInvoiceHdr.due_date.asc())
        .all()
    )

    pdf_path = vendor_due_pdf(vendor, bills)

    EmailService().send_email(
        to_email=to_email,
        subject="Outstanding Bill Statement",
        body=(
            f"Dear {vendor.vendor_name},\n\n"
            f"Please find attached your outstanding bill statement.\n\n"
            f"Regards,\nFinance Team"
        ),
        attachment_path=pdf_path,
        attachment_name=f"Vendor_Statement_{vendor.vendor_code}.pdf",
    )

    return {"message": "Vendor statement email sent successfully.", "to": to_email}