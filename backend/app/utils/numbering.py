from sqlalchemy.orm import Session

from app.models.number_sequence import NumberSequence


def get_next_number(
    db: Session,
    key_name: str,
    prefix: str,
    padding: int = 4,
) -> str:
    sequence = db.get(NumberSequence, key_name)

    if not sequence:
        sequence = NumberSequence(
            key_name=key_name,
            prefix=prefix,
            last_value=0,
            padding=padding,
        )
        db.add(sequence)
        db.flush()

    sequence.last_value += 1

    if prefix != sequence.prefix:
        sequence.prefix = prefix

    if padding != sequence.padding:
        sequence.padding = padding

    db.flush()

    return f"{sequence.prefix}{str(sequence.last_value).zfill(sequence.padding)}"