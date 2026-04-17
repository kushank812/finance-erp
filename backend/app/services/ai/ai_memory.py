# backend/app/services/ai/ai_memory.py

memory_store = {}


def get_memory(session_id: str):
    if session_id not in memory_store:
        memory_store[session_id] = {
            "last_intent": None,
            "last_entities": {},
            "history": [],
        }
    return memory_store[session_id]


def update_memory(session_id: str, intent, entities, query):
    mem = get_memory(session_id)

    mem["last_intent"] = intent
    mem["last_entities"] = {**mem["last_entities"], **entities}

    mem["history"].append({
        "query": query,
        "intent": intent,
        "entities": entities,
    })

    if len(mem["history"]) > 20:
        mem["history"].pop(0)