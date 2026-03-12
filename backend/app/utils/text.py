# app/utils/text.py

def normalize_upper(data: dict):
    """
    Convert every string value in a dict to stripped uppercase.
    Non-string values are returned unchanged.
    """
    out = {}

    for k, v in data.items():
        if isinstance(v, str):
            out[k] = v.strip().upper()
        else:
            out[k] = v

    return out