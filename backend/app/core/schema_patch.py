from __future__ import annotations

from sqlalchemy import inspect, text

from app.core.database import engine


def _get_existing_tables() -> set[str]:
    inspector = inspect(engine)
    return set(inspector.get_table_names())


def _get_existing_columns(table_name: str) -> set[str]:
    inspector = inspect(engine)
    return {col["name"] for col in inspector.get_columns(table_name)}


def ensure_column(table_name: str, column_name: str, column_sql: str) -> None:
    existing_tables = _get_existing_tables()
    if table_name not in existing_tables:
        return

    existing_columns = _get_existing_columns(table_name)
    if column_name in existing_columns:
        return

    sql = text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_sql}")
    with engine.begin() as conn:
        conn.execute(sql)


def run_schema_patches() -> None:
    """
    Temporary startup schema patcher for production environments
    where code was deployed before DB schema was updated.

    Safe behavior:
    - does nothing if the table does not exist
    - does nothing if the column already exists
    """

    ensure_column(
        table_name="sales_invoice_hdr",
        column_name="adjusted_amount",
        column_sql="NUMERIC(18, 2) NOT NULL DEFAULT 0",
    )

    ensure_column(
        table_name="purchase_invoice_hdr",
        column_name="adjusted_amount",
        column_sql="NUMERIC(18, 2) NOT NULL DEFAULT 0",
    )