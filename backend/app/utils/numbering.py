from sqlalchemy.orm import Session

from app.models.number_sequence import NumberSequence


def get_next_number(
    db: Session,
    key_name: str,
    prefix: str,
    padding: int = 4,
) -> str:
    key_name = key_name.strip().upper()
    prefix = prefix.strip().upper()

    sequence = db.get(NumberSequence, key_name)

    if sequence is None:
        sequence = NumberSequence(
            key_name=key_name,
            prefix=prefix,
            last_value=0,
            padding=padding,
        )
        db.add(sequence)
        db.flush()

    if not sequence.prefix:
        sequence.prefix = prefix

    if not sequence.padding or sequence.padding < 1:
        sequence.padding = padding

    if sequence.prefix != prefix:
        sequence.prefix = prefix

    if sequence.padding != padding:
        sequence.padding = padding

    sequence.last_value += 1
    db.flush()

    return f"{sequence.prefix}{str(sequence.last_value).zfill(sequence.padding)}"