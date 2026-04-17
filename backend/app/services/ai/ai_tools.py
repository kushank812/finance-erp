# backend/app/services/ai/ai_tools.py

def get_dashboard_summary(db):
    return {
        "reply": "Dashboard summary",
        "cards": [
            {
                "type": "summary",
                "title": "Business Overview",
                "rows": [
                    {"label": "Sales", "value": "Check Dashboard"},
                    {"label": "Purchases", "value": "Check Dashboard"},
                ],
            }
        ],
    }


def get_overdue_invoices(db):
    return {
        "reply": "These are overdue invoices.",
        "cards": [],
    }


def get_customer_dues(db):
    return {
        "reply": "Customer dues summary.",
        "cards": [],
    }


def get_vendor_dues(db):
    return {
        "reply": "Vendor dues summary.",
        "cards": [],
    }