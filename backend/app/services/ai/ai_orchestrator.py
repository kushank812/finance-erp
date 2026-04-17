# backend/app/services/ai/ai_orchestrator.py

from app.services.ai.ai_memory import get_memory, update_memory
from app.services.ai.ai_interpreter import interpret_query
from app.services.ai.ai_tools import (
    get_dashboard_summary,
    get_overdue_invoices,
    get_customer_dues,
    get_vendor_dues,
)


def handle_ai_chat(query: str, session_id: str, db, user):

    memory = get_memory(session_id)

    intent, entities = interpret_query(query, memory)

    # ROUTING
    if intent == "dashboard":
        result = get_dashboard_summary(db)

    elif intent == "overdue":
        result = get_overdue_invoices(db)

    elif intent == "customer_dues":
        result = get_customer_dues(db)

    elif intent == "vendor_dues":
        result = get_vendor_dues(db)

    else:
        result = {
            "reply": "I did not understand that.",
            "cards": [],
        }

    update_memory(session_id, intent, entities, query)

    return result