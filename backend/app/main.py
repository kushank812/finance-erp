from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import test_db_connection, engine
from app.models.base import Base

# Register models so SQLAlchemy metadata is complete
import app.models.customer
import app.models.item
import app.models.vendor
import app.models.sales_invoice
import app.models.purchase_invoice
import app.models.user
import app.models.audit_log
import app.models.number_sequence
import app.models.vendor_payment

# Routers
from app.api.customer import router as customer_router
from app.api.item import router as item_router
from app.api.vendor import router as vendor_router
from app.api.sales_invoice import router as sales_invoice_router
from app.api.purchase_invoice import router as purchase_invoice_router
from app.api.receipt import router as receipt_router
from app.api.dashboard import router as dashboard_router
from app.api.aging import router as aging_router
from app.api.statement import router as statement_router
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.vendor_payment import router as vendor_payment_router
from app.api.audit import router as audit_router
from app.api.audit_meta import router as audit_meta_router
from app.api.ai_interpreter import router as ai_router

app = FastAPI(
    title="Finance AP/AR Backend",
    version="1.0",
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://finance-erp.vercel.app",
    ],
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$|^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):(5173|5174)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(customer_router)
app.include_router(item_router)
app.include_router(vendor_router)
app.include_router(sales_invoice_router)
app.include_router(purchase_invoice_router)
app.include_router(receipt_router)
app.include_router(dashboard_router)
app.include_router(aging_router)
app.include_router(statement_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(vendor_payment_router)
app.include_router(audit_router)
app.include_router(audit_meta_router)
app.include_router(ai_router)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/health/db")
def health_db():
    test_db_connection()
    return {"db": "connected"}