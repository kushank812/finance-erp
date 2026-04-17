from fastapi import APIRouter
from pydantic import BaseModel
import re

router = APIRouter(prefix="/ai", tags=["AI"])


class AIRequest(BaseModel):
    query: str


class AIResponse(BaseModel):
    intent: str
    entities: dict
    confidence: float


def simple_fallback(query: str):
    q = query.lower()

    if "overdue" in q:
        return "overdue"
    if "dashboard" in q:
        return "dashboard"
    if "vendor" in q or "payable" in q:
        return "vendor_dues"
    if "customer" in q or "receivable" in q:
        return "customer_dues"
    if "invoice" in q:
        return "invoice_search"
    if "bill" in q:
        return "bill_search"

    return "unknown"


def extract_entities(query: str):
    return {
        "invoiceNo": re.findall(r"inv\d+", query, re.I),
        "billNo": re.findall(r"bill\d+", query, re.I),
    }


@router.post("/interpret", response_model=AIResponse)
def interpret(req: AIRequest):
    intent = simple_fallback(req.query)
    entities = extract_entities(req.query)

    return {
        "intent": intent,
        "entities": entities,
        "confidence": 0.7,
    }