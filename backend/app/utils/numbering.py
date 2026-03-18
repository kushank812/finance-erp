from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sequence import NumberSequence


def get_next_number(db: Session, key: str) -> str:
    key = key.strip().upper()

    seq = (
        db.execute(
            select(NumberSequence)
            .where(NumberSequence.key_name == key)
            .with_for_update()
        )
        .scalar_one_or_none()
    )

    if not seq:
        raise ValueError(f"Sequence '{key}' not found")

    seq.last_value += 1

    return f"{seq.prefix}{str(seq.last_value).zfill(seq.padding)}"