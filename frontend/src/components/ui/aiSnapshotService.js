import { apiGet } from "../../api/client";
import { daysOverdueFromDueDate, pickFirstNonEmpty } from "./aiUtils";

async function safeGet(path, fallback = []) {
  try {
    const data = await apiGet(path);
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.rows)) return value.rows;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function normalizeSalesRow(row) {
  const invoiceDate = row.invoice_date || row.date || row.created_at || "";
  const dueDate = row.due_date || row.invoice_due_date || invoiceDate;

  const grandTotal = Number(
    row.grand_total ??
      row.invoice_total ??
      row.total ??
      row.amount ??
      0
  );

  const paidAmount = Number(
    row.paid_amount ??
      row.received_amount ??
      row.receipt_total ??
      0
  );

  const balance = Number(
    row.balance ??
      row.balance_amount ??
      Math.max(0, grandTotal - paidAmount)
  );

  return {
    ...row,
    invoice_no: pickFirstNonEmpty(row.invoice_no, row.invoiceNo, row.sales_invoice_no),
    customer_code: pickFirstNonEmpty(row.customer_code, row.customerCode),
    customer_name: pickFirstNonEmpty(row.customer_name, row.customerName, row.customer_code),
    invoice_date: invoiceDate,
    due_date: dueDate,
    grand_total: grandTotal,
    paid_amount: paidAmount,
    balance,
    overdueDays: balance > 0 ? daysOverdueFromDueDate(dueDate, invoiceDate) : 0,
  };
}

function normalizePurchaseRow(row) {
  const billDate = row.bill_date || row.invoice_date || row.date || row.created_at || "";
  const dueDate = row.due_date || row.bill_due_date || billDate;

  const grandTotal = Number(
    row.grand_total ??
      row.bill_total ??
      row.total ??
      row.amount ??
      0
  );

  const paidAmount = Number(
    row.paid_amount ??
      row.payment_total ??
      0
  );

  const balance = Number(
    row.balance ??
      row.balance_amount ??
      Math.max(0, grandTotal - paidAmount)
  );

  return {
    ...row,
    bill_no: pickFirstNonEmpty(row.bill_no, row.billNo, row.purchase_invoice_no),
    vendor_code: pickFirstNonEmpty(row.vendor_code, row.vendorCode),
    vendor_name: pickFirstNonEmpty(row.vendor_name, row.vendorName, row.vendor_code),
    bill_date: billDate,
    due_date: dueDate,
    grand_total: grandTotal,
    paid_amount: paidAmount,
    balance,
    overdueDays: balance > 0 ? daysOverdueFromDueDate(dueDate, billDate) : 0,
  };
}

function normalizeReceiptRow(row) {
  return {
    ...row,
    receipt_no: pickFirstNonEmpty(row.receipt_no, row.receiptNo),
    customer_code: pickFirstNonEmpty(row.customer_code, row.customerCode),
    customer_name: pickFirstNonEmpty(row.customer_name, row.customerName, row.customer_code),
    receipt_date: row.receipt_date || row.date || row.created_at || "",
    amount: Number(row.amount ?? row.received_amount ?? 0),
  };
}

function normalizeVendorPaymentRow(row) {
  return {
    ...row,
    payment_no: pickFirstNonEmpty(row.payment_no, row.paymentNo),
    vendor_code: pickFirstNonEmpty(row.vendor_code, row.vendorCode),
    vendor_name: pickFirstNonEmpty(row.vendor_name, row.vendorName, row.vendor_code),
    payment_date: row.payment_date || row.date || row.created_at || "",
    amount: Number(row.amount ?? row.paid_amount ?? 0),
  };
}

export async function fetchFinanceSnapshot() {
  const [
    salesRaw,
    purchaseRaw,
    receiptsRaw,
    vendorPaymentsRaw,
    customersRaw,
    vendorsRaw,
    itemsRaw,
    dashboardRaw,
  ] = await Promise.all([
    safeGet("/sales-invoices", []),
    safeGet("/purchase-invoices", []),
    safeGet("/receipts", []),
    safeGet("/vendor-payments", []),
    safeGet("/customers", []),
    safeGet("/vendors", []),
    safeGet("/items", []),
    safeGet("/dashboard/summary", {}),
  ]);

  const salesRows = ensureArray(salesRaw).map(normalizeSalesRow);
  const purchaseRows = ensureArray(purchaseRaw).map(normalizePurchaseRow);
  const receiptRows = ensureArray(receiptsRaw).map(normalizeReceiptRow);
  const vendorPaymentRows = ensureArray(vendorPaymentsRaw).map(normalizeVendorPaymentRow);
  const customers = ensureArray(customersRaw);
  const vendors = ensureArray(vendorsRaw);
  const items = ensureArray(itemsRaw);

  return {
    dashboard: dashboardRaw || {},
    salesRows,
    purchaseRows,
    receiptRows,
    vendorPaymentRows,
    customers,
    vendors,
    items,
    fetchedAt: new Date().toISOString(),
  };
}