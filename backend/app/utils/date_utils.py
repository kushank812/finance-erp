from datetime import datetime, date

def parse_ddmmyyyy(value: str | None) -> date | None:
    if value is None:
        return None

    s = str(value).strip()
    if not s:
        return None

    return datetime.strptime(s, "%d/%m/%Y").date()


def format_ddmmyyyy(value) -> str | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        value = value.date()

    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")

    s = str(value).strip()
    if not s:
        return None

    # try ISO-like input
    if "T" in s:
        s = s.split("T")[0]
    if " " in s:
        s = s.split(" ")[0]

    try:
        d = datetime.strptime(s[:10], "%Y-%m-%d").date()
        return d.strftime("%d/%m/%Y")
    except Exception:
        return None