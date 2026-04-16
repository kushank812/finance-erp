import {
  aggregateBy,
  buildListCard,
  buildSummaryCard,
  buildTableCard,
  formatDate,
  money,
  sortByDateDesc,
  sortByNumberDesc,
  sumBy,
} from "./aiUtils";
import { isInDateRange } from "./aiDateParser";

function limitRows(rows, topN = 5) {
  return rows.slice(0, Math.max(1, Math.min(50, Number(topN || 5))));
}

function filterByDate(rows, dateKey, range) {
  if (!range) return rows;
  return rows.filter((row) => isInDateRange(row?.[dateKey], range));
}

export function buildDashboard(snapshot) {
  const overdueInvoices = snapshot.salesRows.filter((r) => Number(r.balance || 0) > 0);
  const overdueBills = snapshot.purchaseRows.filter((r) => Number(r.balance || 0) > 0);

  return {
    reply: "Here is your finance dashboard summary.",
    cards: [
      buildSummaryCard("Finance Summary", [
        { label: "Sales Invoices", value: snapshot.salesRows.length },
        { label: "Purchase Bills", value: snapshot.purchaseRows.length },
        { label: "Open Receivables", value: money(sumBy(snapshot.salesRows, "balance")) },
        { label: "Open Payables", value: money(sumBy(snapshot.purchaseRows, "balance")) },
        { label: "Receipts", value: snapshot.receiptRows.length },
        { label: "Vendor Payments", value: snapshot.vendorPaymentRows.length },
        { label: "Overdue Invoices", value: overdueInvoices.length },
        { label: "Overdue Bills", value: overdueBills.length },
      ]),
    ],
  };
}

export function buildDailyFinanceSummary(snapshot) {
  const latestReceipts = sortByDateDesc(snapshot.receiptRows, "receipt_date").slice(0, 5);
  const latestPayments = sortByDateDesc(snapshot.vendorPaymentRows, "payment_date").slice(0, 5);
  const biggestOverdues = sortByNumberDesc(
    snapshot.salesRows.filter((r) => Number(r.balance || 0) > 0),
    "balance"
  ).slice(0, 5);

  return {
    reply: "Here is the automatic daily finance summary.",
    cards: [
      buildSummaryCard("Today’s Snapshot", [
        { label: "Customers", value: snapshot.customers.length },
        { label: "Vendors", value: snapshot.vendors.length },
        { label: "Items", value: snapshot.items.length },
        { label: "Receivables", value: money(sumBy(snapshot.salesRows, "balance")) },
        { label: "Payables", value: money(sumBy(snapshot.purchaseRows, "balance")) },
      ]),
      buildTableCard(
        "Largest Open Invoices",
        ["Invoice", "Customer", "Balance", "Overdue Days"],
        biggestOverdues.map((r) => [
          r.invoice_no || "-",
          r.customer_name || r.customer_code || "-",
          money(r.balance),
          String(r.overdueDays || 0),
        ])
      ),
      buildTableCard(
        "Recent Receipts",
        ["Receipt", "Customer", "Date", "Amount"],
        latestReceipts.map((r) => [
          r.receipt_no || "-",
          r.customer_name || r.customer_code || "-",
          formatDate(r.receipt_date),
          money(r.amount),
        ])
      ),
      buildTableCard(
        "Recent Vendor Payments",
        ["Payment", "Vendor", "Date", "Amount"],
        latestPayments.map((r) => [
          r.payment_no || "-",
          r.vendor_name || r.vendor_code || "-",
          formatDate(r.payment_date),
          money(r.amount),
        ])
      ),
    ],
  };
}

export function buildOverdue(snapshot, entities = {}) {
  const filtered = snapshot.salesRows.filter((r) => Number(r.balance || 0) > 0);
  const byDate = filterByDate(filtered, "due_date", entities.dateRange);
  const sorted = sortByNumberDesc(byDate, "balance");
  const limited = limitRows(sorted, entities.topN || 10);

  return {
    reply:
      limited.length > 0
        ? `I found ${limited.length} overdue invoice${limited.length > 1 ? "s" : ""}.`
        : "I could not find overdue invoices for that request.",
    cards: [
      buildSummaryCard("Overdue Summary", [
        { label: "Count", value: limited.length },
        { label: "Total Overdue", value: money(sumBy(byDate, "balance")) },
        { label: "Date Filter", value: entities.dateRange?.label || "All dates" },
      ]),
      buildTableCard(
        "Overdue Invoices",
        ["Invoice", "Customer", "Due Date", "Balance", "Overdue Days"],
        limited.map((r) => [
          r.invoice_no || "-",
          r.customer_name || r.customer_code || "-",
          formatDate(r.due_date),
          money(r.balance),
          String(r.overdueDays || 0),
        ])
      ),
    ],
  };
}

export function buildVendorDues(snapshot, entities = {}) {
  const rows = snapshot.purchaseRows.filter((r) => Number(r.balance || 0) > 0);
  const filtered = entities.vendor
    ? rows.filter((r) =>
        String(`${r.vendor_name || ""} ${r.vendor_code || ""}`)
          .toLowerCase()
          .includes(String(entities.vendor || "").toLowerCase())
      )
    : rows;

  const grouped = aggregateBy(filtered, "vendor_code", "vendor_name")
    .map((row) => ({
      ...row,
      name:
        filtered.find(
          (x) =>
            (x.vendor_code || x.vendor_name || "-") === row.code
        )?.vendor_name || row.code,
    }))
    .sort((a, b) => b.totalBalance - a.totalBalance);

  const limited = limitRows(grouped, entities.topN || 10);

  return {
    reply:
      limited.length > 0
        ? "Here are the vendor dues."
        : "I could not find vendor dues for that request.",
    cards: [
      buildSummaryCard("Vendor Payables Summary", [
        { label: "Open Bills", value: filtered.length },
        { label: "Total Payable", value: money(sumBy(filtered, "balance")) },
        { label: "Filtered Vendor", value: entities.vendor || "All vendors" },
      ]),
      buildTableCard(
        "Vendor Dues",
        ["Vendor", "Open Bills", "Total Amount", "Outstanding", "Max Overdue"],
        limited.map((r) => [
          r.name || r.code || "-",
          String(r.count || 0),
          money(r.totalAmount),
          money(r.totalBalance),
          `${r.maxOverdueDays || 0} days`,
        ])
      ),
    ],
  };
}

export function buildCustomerDues(snapshot, entities = {}) {
  const rows = snapshot.salesRows.filter((r) => Number(r.balance || 0) > 0);
  const filtered = entities.customer
    ? rows.filter((r) =>
        String(`${r.customer_name || ""} ${r.customer_code || ""}`)
          .toLowerCase()
          .includes(String(entities.customer || "").toLowerCase())
      )
    : rows;

  const grouped = aggregateBy(filtered, "customer_code", "customer_name")
    .map((row) => ({
      ...row,
      name:
        filtered.find(
          (x) =>
            (x.customer_code || x.customer_name || "-") === row.code
        )?.customer_name || row.code,
    }))
    .sort((a, b) => b.totalBalance - a.totalBalance);

  const limited = limitRows(grouped, entities.topN || 10);

  return {
    reply:
      limited.length > 0
        ? "Here are the customer receivables."
        : "I could not find customer receivables for that request.",
    cards: [
      buildSummaryCard("Customer Receivables Summary", [
        { label: "Open Invoices", value: filtered.length },
        { label: "Total Receivable", value: money(sumBy(filtered, "balance")) },
        { label: "Filtered Customer", value: entities.customer || "All customers" },
      ]),
      buildTableCard(
        "Customer Dues",
        ["Customer", "Open Invoices", "Invoice Value", "Outstanding", "Max Overdue"],
        limited.map((r) => [
          r.name || r.code || "-",
          String(r.count || 0),
          money(r.totalAmount),
          money(r.totalBalance),
          `${r.maxOverdueDays || 0} days`,
        ])
      ),
    ],
  };
}

export function buildInvoiceSearch(snapshot, entities = {}) {
  let rows = [...snapshot.salesRows];

  if (entities.invoiceNo) {
    rows = rows.filter((r) =>
      String(r.invoice_no || "").toLowerCase() === String(entities.invoiceNo || "").toLowerCase()
    );
  } else if (entities.customer) {
    rows = rows.filter((r) =>
      String(`${r.customer_name || ""} ${r.customer_code || ""}`)
        .toLowerCase()
        .includes(String(entities.customer || "").toLowerCase())
    );
  } else if (entities.searchText) {
    rows = rows.filter((r) =>
      String(
        `${r.invoice_no || ""} ${r.customer_name || ""} ${r.customer_code || ""} ${r.remark || ""}`
      )
        .toLowerCase()
        .includes(String(entities.searchText || "").toLowerCase())
    );
  }

  rows = filterByDate(rows, "invoice_date", entities.dateRange);
  rows = sortByDateDesc(rows, "invoice_date");
  rows = limitRows(rows, entities.topN || 10);

  return {
    reply:
      rows.length > 0
        ? `I found ${rows.length} sales invoice result${rows.length > 1 ? "s" : ""}.`
        : "I could not find matching sales invoices.",
    cards: [
      buildTableCard(
        "Sales Invoices",
        ["Invoice", "Customer", "Invoice Date", "Due Date", "Total", "Balance"],
        rows.map((r) => [
          r.invoice_no || "-",
          r.customer_name || r.customer_code || "-",
          formatDate(r.invoice_date),
          formatDate(r.due_date),
          money(r.grand_total),
          money(r.balance),
        ])
      ),
    ],
  };
}

export function buildBillSearch(snapshot, entities = {}) {
  let rows = [...snapshot.purchaseRows];

  if (entities.billNo) {
    rows = rows.filter((r) =>
      String(r.bill_no || "").toLowerCase() === String(entities.billNo || "").toLowerCase()
    );
  } else if (entities.vendor) {
    rows = rows.filter((r) =>
      String(`${r.vendor_name || ""} ${r.vendor_code || ""}`)
        .toLowerCase()
        .includes(String(entities.vendor || "").toLowerCase())
    );
  } else if (entities.searchText) {
    rows = rows.filter((r) =>
      String(
        `${r.bill_no || ""} ${r.vendor_name || ""} ${r.vendor_code || ""} ${r.remark || ""}`
      )
        .toLowerCase()
        .includes(String(entities.searchText || "").toLowerCase())
    );
  }

  rows = filterByDate(rows, "bill_date", entities.dateRange);
  rows = sortByDateDesc(rows, "bill_date");
  rows = limitRows(rows, entities.topN || 10);

  return {
    reply:
      rows.length > 0
        ? `I found ${rows.length} purchase bill result${rows.length > 1 ? "s" : ""}.`
        : "I could not find matching purchase bills.",
    cards: [
      buildTableCard(
        "Purchase Bills",
        ["Bill", "Vendor", "Bill Date", "Due Date", "Total", "Balance"],
        rows.map((r) => [
          r.bill_no || "-",
          r.vendor_name || r.vendor_code || "-",
          formatDate(r.bill_date),
          formatDate(r.due_date),
          money(r.grand_total),
          money(r.balance),
        ])
      ),
    ],
  };
}

export function buildRecentReceipts(snapshot, entities = {}) {
  let rows = [...snapshot.receiptRows];
  rows = filterByDate(rows, "receipt_date", entities.dateRange);
  rows = sortByDateDesc(rows, "receipt_date");
  rows = limitRows(rows, entities.topN || 10);

  return {
    reply:
      rows.length > 0
        ? "Here are the recent customer receipts."
        : "I could not find receipts for that request.",
    cards: [
      buildTableCard(
        "Receipts",
        ["Receipt", "Customer", "Date", "Amount"],
        rows.map((r) => [
          r.receipt_no || "-",
          r.customer_name || r.customer_code || "-",
          formatDate(r.receipt_date),
          money(r.amount),
        ])
      ),
    ],
  };
}

export function buildRecentVendorPayments(snapshot, entities = {}) {
  let rows = [...snapshot.vendorPaymentRows];
  rows = filterByDate(rows, "payment_date", entities.dateRange);
  rows = sortByDateDesc(rows, "payment_date");
  rows = limitRows(rows, entities.topN || 10);

  return {
    reply:
      rows.length > 0
        ? "Here are the recent vendor payments."
        : "I could not find vendor payments for that request.",
    cards: [
      buildTableCard(
        "Vendor Payments",
        ["Payment", "Vendor", "Date", "Amount"],
        rows.map((r) => [
          r.payment_no || "-",
          r.vendor_name || r.vendor_code || "-",
          formatDate(r.payment_date),
          money(r.amount),
        ])
      ),
    ],
  };
}

export function buildMasterSummary(snapshot) {
  return {
    reply: "Here is the master data summary.",
    cards: [
      buildSummaryCard("Masters Summary", [
        { label: "Customers", value: snapshot.customers.length },
        { label: "Vendors", value: snapshot.vendors.length },
        { label: "Items", value: snapshot.items.length },
      ]),
      buildListCard("Available Master Screens", [
        "Customers",
        "Vendors",
        "Items",
        "Users (admin only)",
      ]),
    ],
  };
}

export function buildUnknown() {
  return {
    reply:
      "I understood this only partially. Try asking for dashboard summary, overdue invoices, customer dues, vendor dues, sales invoices, purchase bills, receipts, vendor payments, or navigation like open ledger.",
    cards: [
      buildListCard("Try Questions Like", [
        "Summarize dashboard",
        "Show overdue invoices",
        "Show customer dues",
        "Show vendor dues",
        "Find invoice INV0001",
        "Find bills for vendor ABC",
        "Show recent receipts",
        "Open ledger",
      ]),
    ],
  };
}