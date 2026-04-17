# backend/app/services/ai/ai_interpreter.py

def interpret_query(query: str, memory: dict):
    q = query.lower()

    # fallback logic (LLM replace later)
    if "overdue" in q:
        return "overdue", {}
    if "dashboard" in q:
        return "dashboard", {}
    if "vendor" in q:
        return "vendor_dues", {}
    if "customer" in q:
        return "customer_dues", {}

    # follow-up memory
    if memory["last_intent"]:
        return memory["last_intent"], memory["last_entities"]

    return "unknown", {}