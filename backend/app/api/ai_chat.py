# backend/app/api/ai_chat.py

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.ai.ai_orchestrator import handle_ai_chat

router = APIRouter(prefix="/ai", tags=["AI"])


class ChatRequest(BaseModel):
    message: str
    session_id: str


@router.post("/chat")
def chat(req: ChatRequest, db: Session = Depends(get_db)):

    # TODO: replace with real auth user
    user = {"role": "ADMIN"}

    result = handle_ai_chat(
        query=req.message,
        session_id=req.session_id,
        db=db,
        user=user,
    )

    return result