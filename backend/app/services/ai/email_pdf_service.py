from pathlib import Path
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


EXPORT_DIR = Path("storage/email_exports")
EXPORT_DIR.mkdir(parents=True, exist_ok=True)


def money(value):
    return f"{float(value or 0):,.2f}"


def get_email(obj):
    return (
        getattr(obj, "email", None)
        or getattr(obj, "email_id", None)
        or getattr(obj, "customer_email", None)
        or getattr(obj, "vendor_email", None)
        or "-"
    )


def create_simple_pdf(title: str, lines: list[str], filename: str) -> str:
    path = EXPORT_DIR / filename

    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    y = height - 60

    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, y, title)

    y -= 30
    c.setFont("Helvetica", 10)
    c.drawString(50, y, f"Generated on: {datetime.now().strftime('%d-%m-%Y %I:%M %p')}")

    y -= 40
    c.setFont("Helvetica", 11)

    for line in lines:
        if y < 60:
            c.showPage()
            y = height - 60
            c.setFont("Helvetica", 11)

        c.drawString(50, y, str(line))
        y -= 22

    c.save()
    return str(path)


def invoice_pdf(invoice, customer):
    lines = [
        f"Customer: {customer.customer_name}",
        f"Customer Code: {invoice.customer_code}",
        f"Email: {get_email(customer)}",
        f"Invoice No: {invoice.invoice_no}",
        f"Invoice Date: {invoice.invoice_date}",
        f"Due Date: {invoice.due_date}",
        "",
        f"Subtotal: {money(invoice.subtotal)}",
        f"Tax Amount: {money(invoice.tax_amount)}",
        f"Grand Total: {money(invoice.grand_total)}",
        f"Amount Received: {money(invoice.amount_received)}",
        f"Balance Payable: {money(invoice.balance)}",
        f"Status: {invoice.status}",
    ]

    return create_simple_pdf(
        title=f"Sales Invoice - {invoice.invoice_no}",
        lines=lines,
        filename=f"invoice_{invoice.invoice_no}.pdf",
    )


def receipt_pdf(receipt, customer):
    lines = [
        f"Customer: {customer.customer_name}",
        f"Email: {get_email(customer)}",
        f"Receipt No: {receipt.receipt_no}",
        f"Invoice No: {receipt.invoice_no}",
        f"Receipt Date: {receipt.receipt_date}",
        f"Amount Received: {money(receipt.amount)}",
        f"Payment Mode: {getattr(receipt, 'payment_mode', '') or '-'}",
        f"Reference No: {getattr(receipt, 'reference_no', '') or '-'}",
    ]

    return create_simple_pdf(
        title=f"Receipt - {receipt.receipt_no}",
        lines=lines,
        filename=f"receipt_{receipt.receipt_no}.pdf",
    )


def purchase_bill_pdf(bill, vendor):
    lines = [
        f"Vendor: {vendor.vendor_name}",
        f"Vendor Code: {bill.vendor_code}",
        f"Email: {get_email(vendor)}",
        f"Bill No: {bill.bill_no}",
        f"Bill Date: {bill.bill_date}",
        f"Due Date: {bill.due_date}",
        "",
        f"Subtotal: {money(bill.subtotal)}",
        f"Tax Amount: {money(bill.tax_amount)}",
        f"Grand Total: {money(bill.grand_total)}",
        f"Amount Paid: {money(bill.amount_paid)}",
        f"Balance Payable: {money(bill.balance)}",
        f"Status: {bill.status}",
    ]

    return create_simple_pdf(
        title=f"Purchase Bill - {bill.bill_no}",
        lines=lines,
        filename=f"purchase_bill_{bill.bill_no}.pdf",
    )


def vendor_payment_pdf(payment, vendor):
    lines = [
        f"Vendor: {vendor.vendor_name}",
        f"Email: {get_email(vendor)}",
        f"Payment No: {payment.payment_no}",
        f"Bill No: {payment.bill_no}",
        f"Payment Date: {payment.payment_date}",
        f"Amount Paid: {money(payment.amount)}",
        f"Payment Mode: {getattr(payment, 'payment_mode', '') or '-'}",
        f"Reference No: {getattr(payment, 'reference_no', '') or '-'}",
    ]

    return create_simple_pdf(
        title=f"Vendor Payment - {payment.payment_no}",
        lines=lines,
        filename=f"vendor_payment_{payment.payment_no}.pdf",
    )


def customer_due_pdf(customer, invoices):
    lines = [
        f"Customer: {customer.customer_name}",
        f"Customer Code: {customer.customer_code}",
        f"Email: {get_email(customer)}",
        "",
        "Pending / Outstanding Invoices:",
        "",
    ]

    total = 0

    for inv in invoices:
        balance = float(inv.balance or 0)
        total += balance
        lines.append(
            f"{inv.invoice_no} | Date: {inv.invoice_date} | Due: {inv.due_date} | "
            f"Total: {money(inv.grand_total)} | Balance: {money(inv.balance)} | Status: {inv.status}"
        )

    lines.extend(["", f"Total Outstanding: {money(total)}"])

    return create_simple_pdf(
        title=f"Customer Outstanding Statement - {customer.customer_code}",
        lines=lines,
        filename=f"customer_statement_{customer.customer_code}.pdf",
    )


def vendor_due_pdf(vendor, bills):
    lines = [
        f"Vendor: {vendor.vendor_name}",
        f"Vendor Code: {vendor.vendor_code}",
        f"Email: {get_email(vendor)}",
        "",
        "Pending / Outstanding Bills:",
        "",
    ]

    total = 0

    for bill in bills:
        balance = float(bill.balance or 0)
        total += balance
        lines.append(
            f"{bill.bill_no} | Date: {bill.bill_date} | Due: {bill.due_date} | "
            f"Total: {money(bill.grand_total)} | Balance: {money(bill.balance)} | Status: {bill.status}"
        )

    lines.extend(["", f"Total Outstanding: {money(total)}"])

    return create_simple_pdf(
        title=f"Vendor Outstanding Statement - {vendor.vendor_code}",
        lines=lines,
        filename=f"vendor_statement_{vendor.vendor_code}.pdf",
    )