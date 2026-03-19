from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException

from app.models.number_sequence import NumberSequence


def get_next_number(db: Session, key_name: str) -> str:
    seq = (
        db.execute(
            select(NumberSequence)
            .where(NumberSequence.key_name == key_name)
            .with_for_update()
        )
        .scalar_one_or_none()
    )

    if not seq:
        raise ValueError(f"Sequence '{key_name}' not found")

    seq.last_value += 1

    next_number = f"{seq.prefix}{str(seq.last_value).zfill(seq.padding)}"

    return next_number