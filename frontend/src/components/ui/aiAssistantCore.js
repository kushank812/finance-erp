import { apiGet } from "../../api/client";

export const STORAGE_KEY = "finance_ai_workspace_chats_v4";

export function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function nowISO() {
  return new Date().toISOString();
}

export function nowTime() {
  try {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function money(n) {
  const value = Number(n || 0);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `₹${value.toFixed(2)}`;
  }
}

export function toDateValue(dateLike) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function formatDate(dateLike) {
  const d = toDateValue(dateLike);
  if (!d) return "-";
  try {
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

export function daysOverdueFromDueDate(dueDate, fallbackDate) {
  const due = toDateValue(dueDate) || toDateValue(fallbackDate);
  if (!due) return 0;

  const now = new Date();
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diff = now.getTime() - due.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isAdmin(user) {
  return user?.role === "ADMIN";
}

export function isOperator(user) {
  return user?.role === "OPERATOR";
}

export function isViewer(user) {
  return user?.role === "VIEWER";
}

export function canViewReports(user) {
  return isAdmin(user) || isOperator(user) || isViewer(user);
}

export function canViewDocuments(user) {
  return isAdmin(user) || isOperator(user) || isViewer(user);
}

export function canDoTransactions(user) {
  return isAdmin(user) || isOperator(user);
}

export function canManageUsers(user) {
  return isAdmin(user);
}

export function canViewAudit(user) {
  return isAdmin(user);
}

export function canViewMasters(user) {
  return isAdmin(user) || isOperator(user) || isViewer(user);
}

export function canNavigateTo(path, user) {
  if (!user?.role) return false;

  const normalizedPath = String(path || "").trim();

  if (normalizedPath === "/dashboard") return true;
  if (normalizedPath === "/change-password") return true;

  if (normalizedPath === "/users") {
    return canManageUsers(user);
  }

  if (normalizedPath === "/audit") {
    return canViewAudit(user);
  }

  if (
    normalizedPath === "/entry" ||
    normalizedPath === "/billing" ||
    normalizedPath === "/receipt/new" ||
    normalizedPath === "/purchase/new" ||
    normalizedPath === "/purchase/pay" ||
    normalizedPath.startsWith("/billing/edit/") ||
    normalizedPath.startsWith("/purchase/edit/")
  ) {
    return canDoTransactions(user);
  }

  if (
    normalizedPath === "/ledger" ||
    normalizedPath === "/aging" ||
    normalizedPath === "/statement"
  ) {
    return canViewReports(user);
  }

  if (
    normalizedPath === "/customers" ||
    normalizedPath === "/vendors" ||
    normalizedPath === "/items"
  ) {
    return canViewMasters(user);
  }

  if (
    normalizedPath === "/sales-invoices" ||
    normalizedPath === "/purchase-bills" ||
    normalizedPath.startsWith("/sales-invoice-view/") ||
    normalizedPath.startsWith("/purchase/view/") ||
    normalizedPath.startsWith("/receipt/view/") ||
    normalizedPath.startsWith("/vendor-payment/view/")
  ) {
    return canViewDocuments(user);
  }

  return false;
}

export function safeNavigate(path, navigate, user, destinationLabel) {
  if (!canNavigateTo(path, user)) {
    return {
      blocked: true,
      result: {
        reply:
          user?.role === "VIEWER"
            ? `Access denied. ${destinationLabel} is not allowed for VIEWER role.`
            : "Access denied. You are not allowed to open this screen.",
        cards: [
          {
            type: "summary",
            title: "Permission Blocked",
            rows: [
              { label: "Requested screen", value: destinationLabel || path },
              { label: "Route", value: path },
              { label: "Your role", value: user?.role || "UNKNOWN" },
              { label: "Status", value: "Blocked" },
            ],
          },
        ],
      },
    };
  }

  navigate(path);

  return {
    blocked: false,
    result: {
      reply: `Opening ${destinationLabel}...`,
      cards: [
        {
          type: "summary",
          title: "Navigation",
          rows: [
            { label: "Destination", value: destinationLabel },
            { label: "Route", value: path },
            { label: "Status", value: "Allowed" },
          ],
        },
      ],
    },
  };
}

export const QUICK_PROMPTS = [
  "Summarize dashboard",
  "Generate receivables report",
  "Generate payables report",
  "Show overdue customers",
  "Who should I follow up first",
  "Show biggest risks",
  "Show recent receipts",
  "Show recent vendor payments",
  "Show master data summary",
  "Top 5 overdue invoices",
  "Top 5 vendor dues",
  "Show unpaid sales invoices",
  "Show unpaid purchase bills",
  "Generate daily finance summary",
  "Generate reminder",
  "Open dashboard",
  "Open entry",
  "Open aging report",
  "Open statement",
  "Open ledger",
  "Open customers",
  "Open vendors",
  "Open items",
  "Open users",
  "Open audit logs",
  "Open invoices",
  "Open purchase bills",
  "Open create invoice",
  "Open create purchase bill",
  "Open create receipt",
  "Open vendor payment",
];

export function createWelcomeMessages(currentUser) {
  return [
    {
      id: uid(),
      role: "assistant",
      time: nowTime(),
      text:
        currentUser?.role === "VIEWER"
          ? "Welcome to the AI Finance Workspace. You are in read-only AI mode. I can summarize dashboard status, analyze receivables and payables, answer customer/vendor/invoice/bill questions, generate structured reports, draft reminders, and open only pages allowed for your role."
          : "Welcome to the AI Finance Workspace. I can analyze live finance data, answer customer/vendor/invoice/bill questions, generate structured reports, draft reminders, and open relevant project pages.",
      cards: [
        {
          type: "summary",
          title: "Supported AI Actions",
          rows: [
            { label: "Dashboard", value: "Summary / Risks / Daily view" },
            { label: "Receivables", value: "Overdue / Follow-up / Reports / Invoice search" },
            { label: "Payables", value: "Vendor dues / Bill search / Reports" },
            { label: "Operations", value: "Receipts / Vendor payments / Masters / Navigation" },
          ],
        },
      ],
    },
  ];
}

export function createNewChat(currentUser) {
  const timestamp = nowISO();
  return {
    id: uid(),
    title: "New Chat",
    createdAt: timestamp,
    updatedAt: timestamp,
    lastContext: null,
    messages: createWelcomeMessages(currentUser),
  };
}

export function trimTitle(text) {
  const finalText = String(text || "").replace(/\s+/g, " ").trim();
  if (!finalText) return "New Chat";
  return finalText.length > 42 ? `${finalText.slice(0, 42)}...` : finalText;
}

export async function fetchFinanceSnapshot() {
  const [
    dashboardData,
    arData,
    apData,
    receiptData,
    vendorPaymentData,
    customerData,
    vendorData,
    itemData,
  ] = await Promise.all([
    apiGet("/dashboard/summary").catch(() => ({})),
    apiGet("/sales-invoices/").catch(() => []),
    apiGet("/purchase-invoices/").catch(() => []),
    apiGet("/receipts/").catch(() => []),
    apiGet("/vendor-payments/").catch(() => []),
    apiGet("/customers/").catch(() => []),
    apiGet("/vendors/").catch(() => []),
    apiGet("/items/").catch(() => []),
  ]);

  const salesRows = Array.isArray(arData) ? arData : [];
  const purchaseRows = Array.isArray(apData) ? apData : [];
  const receiptRows = Array.isArray(receiptData) ? receiptData : [];
  const vendorPaymentRows = Array.isArray(vendorPaymentData) ? vendorPaymentData : [];
  const customerRows = Array.isArray(customerData) ? customerData : [];
  const vendorRows = Array.isArray(vendorData) ? vendorData : [];
  const itemRows = Array.isArray(itemData) ? itemData : [];

  const normalizedSalesRows = salesRows.map((r) => {
    const overdueDays = daysOverdueFromDueDate(r.due_date, r.invoice_date);
    return {
      ...r,
      balance: Number(r.balance || 0),
      grand_total: Number(r.grand_total || r.total_amount || 0),
      overdueDays,
      kind: "sales_invoice",
      refNo: r.invoice_no || "-",
      partyCode: r.customer_code || "-",
      docDate: r.invoice_date || r.created_at || null,
      dueDate: r.due_date || null,
      statusLabel: String(r.status || "").toUpperCase() || "UNKNOWN",
    };
  });

  const normalizedPurchaseRows = purchaseRows.map((r) => {
    const overdueDays = daysOverdueFromDueDate(r.due_date, r.bill_date);
    return {
      ...r,
      balance: Number(r.balance || 0),
      grand_total: Number(r.grand_total || r.total_amount || 0),
      overdueDays,
      kind: "purchase_bill",
      refNo: r.bill_no || "-",
      partyCode: r.vendor_code || "-",
      docDate: r.bill_date || r.created_at || null,
      dueDate: r.due_date || null,
      statusLabel: String(r.status || "").toUpperCase() || "UNKNOWN",
    };
  });

  const overdueRows = normalizedSalesRows
    .filter((r) => r.balance > 0 && r.overdueDays > 0)
    .sort((a, b) => {
      if (b.overdueDays !== a.overdueDays) return b.overdueDays - a.overdueDays;
      return b.balance - a.balance;
    });

  const openPayables = normalizedPurchaseRows
    .filter((r) => r.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const openReceivables = normalizedSalesRows
    .filter((r) => r.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueThisWeek = openPayables.filter((r) => {
    const due = toDateValue(r.dueDate || r.docDate);
    if (!due) return false;
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  });

  const overdueTotal =
    Number(dashboardData?.overdue_receivables || 0) ||
    overdueRows.reduce((sum, r) => sum + Number(r.balance || 0), 0);

  const openReceivablesTotal = openReceivables.reduce(
    (sum, r) => sum + Math.max(0, Number(r.balance || 0)),
    0
  );

  const openPayablesTotal = openPayables.reduce(
    (sum, r) => sum + Math.max(0, Number(r.balance || 0)),
    0
  );

  const recentReceipts = [...receiptRows]
    .map((r) => ({
      ...r,
      amount: Number(r.amount || r.receipt_amount || 0),
    }))
    .sort((a, b) => {
      const aDate = new Date(a.receipt_date || a.created_at || 0).getTime();
      const bDate = new Date(b.receipt_date || b.created_at || 0).getTime();
      return bDate - aDate;
    })
    .slice(0, 10);

  const recentVendorPayments = [...vendorPaymentRows]
    .map((r) => ({
      ...r,
      amount: Number(r.amount || r.payment_amount || 0),
    }))
    .sort((a, b) => {
      const aDate = new Date(a.payment_date || a.created_at || 0).getTime();
      const bDate = new Date(b.payment_date || b.created_at || 0).getTime();
      return bDate - aDate;
    })
    .slice(0, 10);

  return {
    dashboardData,
    salesRows: normalizedSalesRows,
    purchaseRows: normalizedPurchaseRows,
    receiptRows,
    vendorPaymentRows,
    customerRows,
    vendorRows,
    itemRows,
    overdueRows,
    openReceivables,
    openPayables,
    dueThisWeek,
    overdueTotal,
    openReceivablesTotal,
    openPayablesTotal,
    recentReceipts,
    recentVendorPayments,
  };
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text, words) {
  const value = normalizeText(text);
  return words.some((word) => value.includes(normalizeText(word)));
}

function extractTopN(text, fallback = 5) {
  const match = String(text || "").match(/\btop\s+(\d+)\b/i);
  if (match) return Math.max(1, Math.min(50, Number(match[1])));
  const firstNumber = String(text || "").match(/\b(\d+)\b/);
  if (firstNumber) return Math.max(1, Math.min(50, Number(firstNumber[1])));
  return fallback;
}

function getStartOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getEndOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function getMonthRange(year, monthIndex) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return { start: getStartOfDay(start), end: getEndOfDay(end) };
}

function parseDateRangeFromText(text) {
  const q = normalizeText(text);
  const now = new Date();

  if (q.includes("today")) {
    return {
      label: "Today",
      start: getStartOfDay(now),
      end: getEndOfDay(now),
    };
  }

  if (q.includes("yesterday")) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return {
      label: "Yesterday",
      start: getStartOfDay(d),
      end: getEndOfDay(d),
    };
  }

  if (q.includes("this week")) {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      label: "This Week",
      start: getStartOfDay(start),
      end: getEndOfDay(end),
    };
  }

  if (q.includes("last week")) {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff - 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      label: "Last Week",
      start: getStartOfDay(start),
      end: getEndOfDay(end),
    };
  }

  if (q.includes("this month")) {
    return {
      label: "This Month",
      ...getMonthRange(now.getFullYear(), now.getMonth()),
    };
  }

  if (q.includes("last month")) {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      label: "Last Month",
      ...getMonthRange(d.getFullYear(), d.getMonth()),
    };
  }

  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];

  for (let i = 0; i < monthNames.length; i += 1) {
    if (q.includes(monthNames[i])) {
      const yearMatch = q.match(/\b(20\d{2})\b/);
      const year = yearMatch ? Number(yearMatch[1]) : now.getFullYear();
      return {
        label: `${monthNames[i][0].toUpperCase()}${monthNames[i].slice(1)} ${year}`,
        ...getMonthRange(year, i),
      };
    }
  }

  return null;
}

function isInDateRange(dateLike, range) {
  if (!range?.start || !range?.end) return true;
  const d = toDateValue(dateLike);
  if (!d) return false;
  return d.getTime() >= range.start.getTime() && d.getTime() <= range.end.getTime();
}

function matchesEntity(row, query, keys) {
  const q = normalizeText(query);
  if (!q) return true;

  return keys.some((key) => normalizeText(row?.[key]).includes(q));
}

function extractEntityAfterKeyword(text, keywords) {
  const raw = String(text || "").trim();

  for (const key of keywords) {
    const re = new RegExp(`${key}\\s+([a-zA-Z0-9_./-]+(?:\\s+[a-zA-Z0-9_./-]+){0,3})`, "i");
    const match = raw.match(re);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function aggregateBy(rows, groupKey, labelKey) {
  const map = new Map();

  rows.forEach((row) => {
    const key = row[groupKey] || row[labelKey] || "-";
    if (!map.has(key)) {
      map.set(key, {
        code: key,
        count: 0,
        totalBalance: 0,
        totalAmount: 0,
        maxOverdueDays: 0,
      });
    }

    const item = map.get(key);
    item.count += 1;
    item.totalBalance += Number(row.balance || 0);
    item.totalAmount += Number(row.grand_total || 0);
    item.maxOverdueDays = Math.max(item.maxOverdueDays, Number(row.overdueDays || 0));
  });

  return [...map.values()];
}

function buildTableCard(title, columns, rows) {
  return {
    type: "table",
    title,
    columns,
    rows,
  };
}

export function buildDashboardSummary(snapshot) {
  const {
    dashboardData,
    overdueRows,
    dueThisWeek,
    overdueTotal,
    openReceivablesTotal,
    openPayablesTotal,
  } = snapshot;

  const highestRisk = overdueRows[0];

  return {
    reply: "Here is a structured dashboard summary based on your current finance data.",
    cards: [
      {
        type: "summary",
        title: "Dashboard Summary",
        rows: [
          {
            label: "Open receivables",
            value: money(Number(dashboardData?.total_receivables || openReceivablesTotal || 0)),
          },
          {
            label: "Overdue receivables",
            value: money(overdueTotal),
          },
          {
            label: "Open payables",
            value: money(Number(dashboardData?.total_payables || openPayablesTotal || 0)),
          },
          {
            label: "Vendor bills due this week",
            value: String(dueThisWeek.length),
          },
        ],
      },
      {
        type: "list",
        title: "Key Insights",
        items: [
          overdueRows.length > 0
            ? `${overdueRows.length} receivable invoice(s) are overdue.`
            : "No overdue receivable invoices found.",
          highestRisk
            ? `Highest AR risk: ${highestRisk.customer_code || "CUSTOMER"} | ${
                highestRisk.invoice_no || "-"
              } | ${money(Number(highestRisk.balance || 0))} | ${
                highestRisk.overdueDays
              } days overdue`
            : "No critical overdue receivable identified.",
          dueThisWeek.length > 0
            ? `${dueThisWeek.length} vendor bill(s) are due within 7 days.`
            : "No vendor bills due within this week.",
        ],
      },
    ],
  };
}

export function buildReceivablesReport(snapshot, opts = {}) {
  const { overdueRows, salesRows, overdueTotal, openReceivablesTotal } = snapshot;
  const range = opts.dateRange || null;
  const limit = opts.limit || 10;

  const filteredSales = salesRows.filter((r) => isInDateRange(r.docDate, range));
  const filteredOverdue = overdueRows
    .filter((r) => isInDateRange(r.docDate, range))
    .slice(0, limit);

  const openInvoices = filteredSales.filter((r) => Number(r.balance || 0) > 0).length;
  const filteredOpenTotal = filteredSales.reduce(
    (sum, r) => sum + Math.max(0, Number(r.balance || 0)),
    0
  );
  const filteredOverdueTotal = filteredSales
    .filter((r) => Number(r.balance || 0) > 0 && Number(r.overdueDays || 0) > 0)
    .reduce((sum, r) => sum + Number(r.balance || 0), 0);

  return {
    reply: `Receivables report generated${range?.label ? ` for ${range.label}` : ""}.`,
    cards: [
      {
        type: "summary",
        title: "Receivables Report",
        rows: [
          { label: "Open invoices", value: String(openInvoices) },
          {
            label: "Overdue invoices",
            value: String(
              filteredSales.filter(
                (r) => Number(r.balance || 0) > 0 && Number(r.overdueDays || 0) > 0
              ).length
            ),
          },
          {
            label: "Open receivables",
            value: money(filteredOpenTotal || openReceivablesTotal),
          },
          {
            label: "Overdue amount",
            value: money(filteredOverdueTotal || overdueTotal),
          },
        ],
      },
      buildTableCard(
        "Top Receivables",
        ["Invoice", "Customer", "Balance", "Overdue Days", "Due Date"],
        filteredOverdue.map((r) => [
          r.invoice_no || "-",
          r.customer_code || "-",
          money(r.balance),
          String(r.overdueDays || 0),
          formatDate(r.dueDate),
        ])
      ),
    ],
  };
}

export function buildPayablesReport(snapshot, opts = {}) {
  const { openPayables, purchaseRows, dueThisWeek } = snapshot;
  const range = opts.dateRange || null;
  const limit = opts.limit || 10;

  const filteredPurchase = purchaseRows.filter((r) => isInDateRange(r.docDate, range));
  const filteredOpen = filteredPurchase
    .filter((r) => Number(r.balance || 0) > 0)
    .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));

  const filteredDueThisWeek = filteredOpen.filter((r) => {
    const due = toDateValue(r.dueDate || r.docDate);
    if (!due) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  });

  return {
    reply: `Payables report generated${range?.label ? ` for ${range.label}` : ""}.`,
    cards: [
      {
        type: "summary",
        title: "Payables Report",
        rows: [
          { label: "Open vendor bills", value: String(filteredOpen.length) },
          {
            label: "Total payables",
            value: money(filteredOpen.reduce((sum, r) => sum + Number(r.balance || 0), 0)),
          },
          {
            label: "Due this week",
            value: String(filteredDueThisWeek.length || dueThisWeek.length),
          },
          {
            label: "Due this week amount",
            value: money(
              filteredDueThisWeek.reduce((sum, r) => sum + Number(r.balance || 0), 0)
            ),
          },
        ],
      },
      buildTableCard(
        "Top Vendor Payables",
        ["Bill", "Vendor", "Balance", "Due Date", "Status"],
        filteredOpen.slice(0, limit).map((r) => [
          r.bill_no || "-",
          r.vendor_code || "-",
          money(r.balance),
          formatDate(r.dueDate),
          r.status || "-",
        ])
      ),
    ],
  };
}

export function buildDailyFinanceSummary(snapshot) {
  const { overdueRows, dueThisWeek, overdueTotal, openPayablesTotal } = snapshot;
  const topAR = overdueRows[0];
  const topAP = dueThisWeek[0] || null;

  return {
    reply: "Here is your daily finance summary from the latest available data.",
    cards: [
      {
        type: "summary",
        title: "Daily Finance Summary",
        rows: [
          { label: "Overdue invoices", value: String(overdueRows.length) },
          { label: "Overdue amount", value: money(overdueTotal) },
          { label: "Vendor bills due this week", value: String(dueThisWeek.length) },
          { label: "Open payables", value: money(openPayablesTotal) },
        ],
      },
      {
        type: "list",
        title: "Today's Focus",
        items: [
          topAR
            ? `AR priority: ${topAR.customer_code || "CUSTOMER"} | ${topAR.invoice_no || "-"} | ${money(
                Number(topAR.balance || 0)
              )} | ${topAR.overdueDays} days overdue`
            : "No urgent AR overdue priority found.",
          topAP
            ? `AP priority: ${topAP.vendor_code || "VENDOR"} | ${topAP.bill_no || "-"} | ${money(
                Number(topAP.balance || 0)
              )}`
            : "No immediate AP due case found for this week.",
        ],
      },
    ],
  };
}

export function buildRisksSummary(snapshot) {
  const { overdueRows, dueThisWeek } = snapshot;
  const over60 = overdueRows.filter((r) => Number(r.overdueDays || 0) > 60);
  const over90 = overdueRows.filter((r) => Number(r.overdueDays || 0) > 90);

  return {
    reply: "Here are the biggest finance risks visible in current live data.",
    cards: [
      {
        type: "summary",
        title: "Risk Summary",
        rows: [
          { label: "Overdue invoices", value: String(overdueRows.length) },
          { label: "Over 60 days", value: String(over60.length) },
          { label: "Over 90 days", value: String(over90.length) },
          { label: "Vendor bills due this week", value: String(dueThisWeek.length) },
        ],
      },
      buildTableCard(
        "Top Risk Cases",
        ["Invoice", "Customer", "Balance", "Overdue Days"],
        overdueRows.slice(0, 10).map((r) => [
          r.invoice_no || "-",
          r.customer_code || "-",
          money(r.balance),
          String(r.overdueDays || 0),
        ])
      ),
    ],
  };
}

export function buildFollowUpPriority(snapshot, opts = {}) {
  const { overdueRows } = snapshot;
  const topN = opts.limit || 5;
  const topRows = overdueRows.slice(0, topN);

  return {
    reply:
      topRows.length > 0
        ? "These are the top receivable follow-up priorities based on overdue days and balance."
        : "No overdue follow-up cases found right now.",
    cards: [
      {
        type: "summary",
        title: "Follow-up Priority",
        rows: [
          { label: "Overdue invoices", value: String(overdueRows.length) },
          { label: "Priority cases", value: String(topRows.length) },
          {
            label: "Oldest overdue",
            value: topRows[0] ? `${topRows[0].overdueDays} days` : "0 days",
          },
          {
            label: "Highest priority balance",
            value: topRows[0] ? money(Number(topRows[0].balance || 0)) : money(0),
          },
        ],
      },
      buildTableCard(
        "Top Follow-up Targets",
        ["Invoice", "Customer", "Balance", "Overdue Days", "Due Date"],
        topRows.map((r) => [
          r.invoice_no || "-",
          r.customer_code || "-",
          money(r.balance),
          String(r.overdueDays || 0),
          formatDate(r.dueDate),
        ])
      ),
    ],
  };
}

export function buildVendorDues(snapshot, opts = {}) {
  const { openPayables, openPayablesTotal, dueThisWeek } = snapshot;
  const topN = opts.limit || 10;
  const highest = openPayables[0];

  return {
    reply: "Vendor dues summary ready from current purchase invoice data.",
    cards: [
      {
        type: "summary",
        title: "Vendor Dues Summary",
        rows: [
          { label: "Open vendor bills", value: String(openPayables.length) },
          { label: "Total payable", value: money(openPayablesTotal) },
          {
            label: "Due this week amount",
            value: money(dueThisWeek.reduce((sum, r) => sum + Number(r.balance || 0), 0)),
          },
          { label: "Highest payable vendor", value: highest?.vendor_code || "-" },
        ],
      },
      buildTableCard(
        "Top Vendor Dues",
        ["Bill", "Vendor", "Balance", "Due Date", "Status"],
        openPayables.slice(0, topN).map((r) => [
          r.bill_no || "-",
          r.vendor_code || "-",
          money(r.balance),
          formatDate(r.dueDate),
          r.status || "-",
        ])
      ),
    ],
  };
}

export function buildOverdueCustomers(snapshot, opts = {}) {
  const { overdueRows, overdueTotal } = snapshot;
  const grouped = aggregateBy(overdueRows, "customer_code", "customer_code")
    .sort((a, b) => b.totalBalance - a.totalBalance)
    .slice(0, opts.limit || 10);

  return {
    reply:
      overdueRows.length > 0
        ? `Found ${overdueRows.length} overdue invoice(s) from live sales data.`
        : "No overdue customers found in current live sales data.",
    cards: [
      {
        type: "summary",
        title: "Overdue Customer Summary",
        rows: [
          { label: "Invoices overdue", value: String(overdueRows.length) },
          { label: "Total overdue", value: money(overdueTotal) },
          { label: "Customers overdue", value: String(grouped.length) },
          {
            label: "Largest overdue customer",
            value: grouped[0]?.code || "-",
          },
        ],
      },
      buildTableCard(
        "Top Overdue Customers",
        ["Customer", "Invoices", "Total Overdue", "Oldest Overdue"],
        grouped.map((r) => [
          r.code,
          String(r.count),
          money(r.totalBalance),
          `${r.maxOverdueDays} days`,
        ])
      ),
    ],
  };
}

export function buildRecentReceipts(snapshot, opts = {}) {
  const { receiptRows, recentReceipts } = snapshot;
  const limit = opts.limit || 10;

  return {
    reply: "Here are the latest receipts recorded in the system.",
    cards: [
      {
        type: "summary",
        title: "Receipt Summary",
        rows: [
          { label: "Total receipts", value: String(receiptRows.length) },
          {
            label: "Recent total",
            value: money(
              recentReceipts
                .slice(0, limit)
                .reduce((sum, r) => sum + Number(r.amount || r.receipt_amount || 0), 0)
            ),
          },
        ],
      },
      buildTableCard(
        "Recent Receipts",
        ["Receipt", "Customer", "Amount", "Date"],
        recentReceipts.slice(0, limit).map((r) => [
          r.receipt_no || "-",
          r.customer_code || "-",
          money(Number(r.amount || r.receipt_amount || 0)),
          formatDate(r.receipt_date || r.created_at),
        ])
      ),
    ],
  };
}

export function buildRecentVendorPayments(snapshot, opts = {}) {
  const { vendorPaymentRows, recentVendorPayments } = snapshot;
  const limit = opts.limit || 10;

  return {
    reply: "Here are the latest vendor payments recorded in the system.",
    cards: [
      {
        type: "summary",
        title: "Vendor Payment Summary",
        rows: [
          { label: "Total vendor payments", value: String(vendorPaymentRows.length) },
          {
            label: "Recent total",
            value: money(
              recentVendorPayments
                .slice(0, limit)
                .reduce((sum, r) => sum + Number(r.amount || r.payment_amount || 0), 0)
            ),
          },
        ],
      },
      buildTableCard(
        "Recent Vendor Payments",
        ["Payment", "Vendor", "Amount", "Date"],
        recentVendorPayments.slice(0, limit).map((r) => [
          r.payment_no || "-",
          r.vendor_code || "-",
          money(Number(r.amount || r.payment_amount || 0)),
          formatDate(r.payment_date || r.created_at),
        ])
      ),
    ],
  };
}

export function buildMasterSummary(snapshot) {
  const { customerRows, vendorRows, itemRows } = snapshot;

  return {
    reply: "Here is the current master data summary.",
    cards: [
      {
        type: "summary",
        title: "Master Data Summary",
        rows: [
          { label: "Customers", value: String(customerRows.length) },
          { label: "Vendors", value: String(vendorRows.length) },
          { label: "Items", value: String(itemRows.length) },
        ],
      },
      {
        type: "list",
        title: "Project Coverage",
        items: [
          "Customer Master is connected.",
          "Vendor Master is connected.",
          "Item Master is connected.",
        ],
      },
    ],
  };
}

export function buildReminder(snapshot) {
  const top = snapshot.overdueRows[0];

  if (!top) {
    return {
      reply: "No overdue invoice found, so I could not generate a live reminder.",
      cards: [],
    };
  }

  const whatsappMsg = `Hi ${top.customer_code},

Your payment of ${money(Number(top.balance || 0))} for invoice ${
    top.invoice_no || "-"
  } is overdue by ${top.overdueDays} day(s).

Please arrange payment soon and share the payment details.

Regards,
Accounts Team`;

  const emailMsg = `Subject: Payment Reminder – Invoice ${top.invoice_no || "-"}

Dear ${top.customer_code},

This is a reminder that your payment of ${money(
    Number(top.balance || 0)
  )} against invoice ${top.invoice_no || "-"} is overdue by ${
    top.overdueDays
  } day(s).

Kindly arrange the payment at the earliest and share the payment details with us.

Regards,
Accounts Team`;

  return {
    reply: "Reminder generated with WhatsApp and Email formats.",
    cards: [
      {
        type: "summary",
        title: "Reminder Source",
        rows: [
          { label: "Customer", value: top.customer_code || "-" },
          { label: "Invoice", value: top.invoice_no || "-" },
          { label: "Balance", value: money(Number(top.balance || 0)) },
          { label: "Days overdue", value: String(top.overdueDays || 0) },
        ],
      },
      {
        type: "message",
        title: "WhatsApp Reminder",
        message: whatsappMsg,
      },
      {
        type: "message",
        title: "Email Reminder",
        message: emailMsg,
      },
    ],
  };
}

function buildSalesInvoiceSearch(snapshot, queryText, opts = {}) {
  const limit = opts.limit || 10;
  const q =
    extractEntityAfterKeyword(queryText, ["invoice", "invoices", "customer"]) ||
    queryText;

  const rows = snapshot.salesRows
    .filter(
      (r) =>
        matchesEntity(r, q, ["invoice_no", "customer_code", "status", "remarks", "refNo"]) ||
        normalizeText(r.invoice_no) === normalizeText(q)
    )
    .slice(0, limit);

  return {
    reply: rows.length
      ? `Found ${rows.length} matching sales invoice(s).`
      : "No matching sales invoices found.",
    cards: [
      {
        type: "summary",
        title: "Sales Invoice Search",
        rows: [
          { label: "Search text", value: q || "-" },
          { label: "Matches", value: String(rows.length) },
        ],
      },
      buildTableCard(
        "Matching Sales Invoices",
        ["Invoice", "Customer", "Amount", "Balance", "Status", "Due Date"],
        rows.map((r) => [
          r.invoice_no || "-",
          r.customer_code || "-",
          money(r.grand_total),
          money(r.balance),
          r.status || "-",
          formatDate(r.dueDate),
        ])
      ),
    ],
  };
}

function buildPurchaseBillSearch(snapshot, queryText, opts = {}) {
  const limit = opts.limit || 10;
  const q =
    extractEntityAfterKeyword(queryText, ["bill", "bills", "vendor"]) ||
    queryText;

  const rows = snapshot.purchaseRows
    .filter(
      (r) =>
        matchesEntity(r, q, ["bill_no", "vendor_code", "status", "remarks", "refNo"]) ||
        normalizeText(r.bill_no) === normalizeText(q)
    )
    .slice(0, limit);

  return {
    reply: rows.length
      ? `Found ${rows.length} matching purchase bill(s).`
      : "No matching purchase bills found.",
    cards: [
      {
        type: "summary",
        title: "Purchase Bill Search",
        rows: [
          { label: "Search text", value: q || "-" },
          { label: "Matches", value: String(rows.length) },
        ],
      },
      buildTableCard(
        "Matching Purchase Bills",
        ["Bill", "Vendor", "Amount", "Balance", "Status", "Due Date"],
        rows.map((r) => [
          r.bill_no || "-",
          r.vendor_code || "-",
          money(r.grand_total),
          money(r.balance),
          r.status || "-",
          formatDate(r.dueDate),
        ])
      ),
    ],
  };
}

function buildCustomerOutstandingReport(snapshot, queryText) {
  const customerQuery = extractEntityAfterKeyword(queryText, ["customer", "for"]) || "";
  const rows = snapshot.salesRows.filter((r) => Number(r.balance || 0) > 0);
  const filtered = customerQuery
    ? rows.filter((r) => matchesEntity(r, customerQuery, ["customer_code"]))
    : rows;

  const grouped = aggregateBy(filtered, "customer_code", "customer_code").sort(
    (a, b) => b.totalBalance - a.totalBalance
  );

  return {
    reply: customerQuery
      ? `Customer outstanding report generated for ${customerQuery}.`
      : "Customer outstanding report generated.",
    cards: [
      {
        type: "summary",
        title: "Customer Outstanding Report",
        rows: [
          { label: "Customers", value: String(grouped.length) },
          { label: "Open invoices", value: String(filtered.length) },
          {
            label: "Outstanding amount",
            value: money(filtered.reduce((sum, r) => sum + Number(r.balance || 0), 0)),
          },
        ],
      },
      buildTableCard(
        "Customer Outstanding",
        ["Customer", "Open Invoices", "Outstanding", "Oldest Overdue"],
        grouped.slice(0, 20).map((r) => [
          r.code,
          String(r.count),
          money(r.totalBalance),
          `${r.maxOverdueDays} days`,
        ])
      ),
    ],
  };
}

function buildVendorOutstandingReport(snapshot, queryText) {
  const vendorQuery = extractEntityAfterKeyword(queryText, ["vendor", "for"]) || "";
  const rows = snapshot.purchaseRows.filter((r) => Number(r.balance || 0) > 0);
  const filtered = vendorQuery
    ? rows.filter((r) => matchesEntity(r, vendorQuery, ["vendor_code"]))
    : rows;

  const grouped = aggregateBy(filtered, "vendor_code", "vendor_code").sort(
    (a, b) => b.totalBalance - a.totalBalance
  );

  return {
    reply: vendorQuery
      ? `Vendor outstanding report generated for ${vendorQuery}.`
      : "Vendor outstanding report generated.",
    cards: [
      {
        type: "summary",
        title: "Vendor Outstanding Report",
        rows: [
          { label: "Vendors", value: String(grouped.length) },
          { label: "Open bills", value: String(filtered.length) },
          {
            label: "Outstanding amount",
            value: money(filtered.reduce((sum, r) => sum + Number(r.balance || 0), 0)),
          },
        ],
      },
      buildTableCard(
        "Vendor Outstanding",
        ["Vendor", "Open Bills", "Outstanding", "Oldest Due"],
        grouped.slice(0, 20).map((r) => [
          r.code,
          String(r.count),
          money(r.totalBalance),
          `${r.maxOverdueDays} days`,
        ])
      ),
    ],
  };
}

function buildUnpaidSalesInvoices(snapshot, opts = {}) {
  const rows = snapshot.salesRows
    .filter((r) => Number(r.balance || 0) > 0)
    .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))
    .slice(0, opts.limit || 20);

  return {
    reply: "Here are the current unpaid sales invoices.",
    cards: [
      {
        type: "summary",
        title: "Unpaid Sales Invoices",
        rows: [
          { label: "Invoices", value: String(rows.length) },
          {
            label: "Balance total",
            value: money(rows.reduce((sum, r) => sum + Number(r.balance || 0), 0)),
          },
        ],
      },
      buildTableCard(
        "Unpaid Sales Invoices",
        ["Invoice", "Customer", "Balance", "Status", "Due Date"],
        rows.map((r) => [
          r.invoice_no || "-",
          r.customer_code || "-",
          money(r.balance),
          r.status || "-",
          formatDate(r.dueDate),
        ])
      ),
    ],
  };
}

function buildUnpaidPurchaseBills(snapshot, opts = {}) {
  const rows = snapshot.purchaseRows
    .filter((r) => Number(r.balance || 0) > 0)
    .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))
    .slice(0, opts.limit || 20);

  return {
    reply: "Here are the current unpaid purchase bills.",
    cards: [
      {
        type: "summary",
        title: "Unpaid Purchase Bills",
        rows: [
          { label: "Bills", value: String(rows.length) },
          {
            label: "Balance total",
            value: money(rows.reduce((sum, r) => sum + Number(r.balance || 0), 0)),
          },
        ],
      },
      buildTableCard(
        "Unpaid Purchase Bills",
        ["Bill", "Vendor", "Balance", "Status", "Due Date"],
        rows.map((r) => [
          r.bill_no || "-",
          r.vendor_code || "-",
          money(r.balance),
          r.status || "-",
          formatDate(r.dueDate),
        ])
      ),
    ],
  };
}

function buildUnknownResponse() {
  return {
    reply:
      "I could not fully understand that request yet. Try asking in one of these ways: 'Generate receivables report', 'Show top 10 overdue invoices', 'Show unpaid purchase bills', 'Customer outstanding report', 'Vendor outstanding report', 'Find invoice INV0001', 'Find bill BILL0001', 'Show recent receipts', or 'Summarize dashboard'.",
    cards: [
      {
        type: "list",
        title: "Try These",
        items: [
          "Generate receivables report for this month",
          "Show top 10 overdue invoices",
          "Customer outstanding report",
          "Vendor outstanding report",
          "Find invoice INV0001",
          "Find bill BILL0001",
          "Show unpaid sales invoices",
          "Show unpaid purchase bills",
        ],
      },
    ],
  };
}

function getNavigationIntent(query, navigate, currentUser) {
  const q = normalizeText(query);

  if (q.includes("open dashboard") || q === "dashboard") {
    return safeNavigate("/dashboard", navigate, currentUser, "Dashboard").result;
  }

  if (q.includes("open entry") || q === "entry") {
    return safeNavigate("/entry", navigate, currentUser, "Entry Screen").result;
  }

  if (q.includes("open aging") || q === "aging" || q.includes("aging report")) {
    return safeNavigate("/aging", navigate, currentUser, "Aging Report").result;
  }

  if (q.includes("open statement") || q === "statement") {
    return safeNavigate("/statement", navigate, currentUser, "Statement").result;
  }

  if (q.includes("open ledger") || q === "ledger") {
    return safeNavigate("/ledger", navigate, currentUser, "Ledger").result;
  }

  if (q.includes("open customers") || q === "customers") {
    return safeNavigate("/customers", navigate, currentUser, "Customer Master").result;
  }

  if (q.includes("open vendors") || q === "vendors") {
    return safeNavigate("/vendors", navigate, currentUser, "Vendor Master").result;
  }

  if (q.includes("open items") || q === "items") {
    return safeNavigate("/items", navigate, currentUser, "Item Master").result;
  }

  if (q.includes("open users") || q === "users") {
    return safeNavigate("/users", navigate, currentUser, "Users").result;
  }

  if (q.includes("open audit") || q.includes("audit log")) {
    return safeNavigate("/audit", navigate, currentUser, "Audit Logs").result;
  }

  if (q.includes("change password")) {
    return safeNavigate("/change-password", navigate, currentUser, "Change Password").result;
  }

  if (
    q.includes("create invoice") ||
    q.includes("open create invoice") ||
    q === "billing"
  ) {
    return safeNavigate("/billing", navigate, currentUser, "Create Invoice").result;
  }

  if (
    q.includes("create purchase bill") ||
    q.includes("open create purchase bill")
  ) {
    return safeNavigate("/purchase/new", navigate, currentUser, "Create Purchase Bill").result;
  }

  if (q.includes("create receipt") || q.includes("open create receipt")) {
    return safeNavigate("/receipt/new", navigate, currentUser, "Create Receipt").result;
  }

  if (q.includes("vendor payment") || q.includes("open vendor payment")) {
    return safeNavigate("/purchase/pay", navigate, currentUser, "Vendor Payment").result;
  }

  if (q.includes("purchase bill") || q.includes("purchase bills")) {
    return safeNavigate("/purchase-bills", navigate, currentUser, "Purchase Bills").result;
  }

  if (
    (q.includes("invoice") || q.includes("invoices")) &&
    !q.includes("find invoice") &&
    !q.includes("overdue invoice") &&
    !q.includes("unpaid sales invoice") &&
    !q.includes("sales invoice report")
  ) {
    return safeNavigate("/sales-invoices", navigate, currentUser, "Sales Invoices").result;
  }

  return null;
}

export async function buildAIResponse(text, navigate, currentUser) {
  const query = String(text || "").trim();
  const normalized = normalizeText(query);

  if (!query) {
    return {
      reply:
        "Please type a command like Summarize dashboard, Generate receivables report, Show top 10 overdue invoices, Find invoice INV0001, Show vendor dues, or Open dashboard.",
      cards: [],
    };
  }

  const navResult = getNavigationIntent(query, navigate, currentUser);
  if (navResult) return navResult;

  const snapshot = await fetchFinanceSnapshot();
  const dateRange = parseDateRangeFromText(query);
  const limit = extractTopN(query, 5);

  if (
    includesAny(normalized, [
      "summarize dashboard",
      "dashboard summary",
      "dashboard status",
      "dashboard report",
    ])
  ) {
    return buildDashboardSummary(snapshot);
  }

  if (
    includesAny(normalized, [
      "receivables report",
      "ar report",
      "sales outstanding report",
      "receivable report",
    ])
  ) {
    return buildReceivablesReport(snapshot, { dateRange, limit: Math.max(limit, 10) });
  }

  if (
    includesAny(normalized, [
      "payables report",
      "ap report",
      "vendor payable report",
      "payable report",
    ])
  ) {
    return buildPayablesReport(snapshot, { dateRange, limit: Math.max(limit, 10) });
  }

  if (
    includesAny(normalized, [
      "daily finance summary",
      "what should i do today",
      "what should i do",
      "today summary",
    ])
  ) {
    return buildDailyFinanceSummary(snapshot);
  }

  if (includesAny(normalized, ["biggest risks", "risk summary", "risk report", "risks"])) {
    return buildRisksSummary(snapshot);
  }

  if (
    includesAny(normalized, [
      "follow up",
      "follow-up",
      "priority",
      "who should i follow up first",
      "collection priority",
    ])
  ) {
    return buildFollowUpPriority(snapshot, { limit });
  }

  if (includesAny(normalized, ["vendor dues", "vendor due", "top vendor dues"])) {
    return buildVendorDues(snapshot, { limit: Math.max(limit, 10) });
  }

  if (includesAny(normalized, ["recent receipts", "show receipts", "receipt report"])) {
    return buildRecentReceipts(snapshot, { limit: Math.max(limit, 10) });
  }

  if (
    includesAny(normalized, [
      "recent vendor payments",
      "show vendor payments",
      "vendor payment report",
    ])
  ) {
    return buildRecentVendorPayments(snapshot, { limit: Math.max(limit, 10) });
  }

  if (
    includesAny(normalized, [
      "master data summary",
      "show masters",
      "master summary",
      "master data report",
    ])
  ) {
    return buildMasterSummary(snapshot);
  }

  if (
    includesAny(normalized, [
      "overdue customers",
      "customer overdue",
      "top overdue customers",
    ])
  ) {
    return buildOverdueCustomers(snapshot, { limit: Math.max(limit, 10) });
  }

  if (
    includesAny(normalized, [
      "generate reminder",
      "draft payment reminder",
      "payment reminder",
      "reminder",
    ])
  ) {
    return buildReminder(snapshot);
  }

  if (
    includesAny(normalized, [
      "customer outstanding",
      "customer wise outstanding",
      "customer report",
      "outstanding customer report",
    ])
  ) {
    return buildCustomerOutstandingReport(snapshot, query);
  }

  if (
    includesAny(normalized, [
      "vendor outstanding",
      "vendor wise outstanding",
      "vendor report",
      "outstanding vendor report",
    ])
  ) {
    return buildVendorOutstandingReport(snapshot, query);
  }

  if (
    includesAny(normalized, [
      "unpaid sales invoices",
      "open sales invoices",
      "open receivables invoices",
    ])
  ) {
    return buildUnpaidSalesInvoices(snapshot, { limit: Math.max(limit, 20) });
  }

  if (
    includesAny(normalized, [
      "unpaid purchase bills",
      "open purchase bills",
      "open vendor bills",
      "unpaid vendor bills",
    ])
  ) {
    return buildUnpaidPurchaseBills(snapshot, { limit: Math.max(limit, 20) });
  }

  if (
    includesAny(normalized, ["top overdue invoices", "overdue invoices", "top invoices overdue"])
  ) {
    return buildFollowUpPriority(snapshot, { limit: Math.max(limit, 10) });
  }

  if (
    includesAny(normalized, ["find invoice", "search invoice", "invoice details"]) ||
    (normalized.includes("invoice") && /\b[a-z]{2,}\d+/i.test(query))
  ) {
    return buildSalesInvoiceSearch(snapshot, query, { limit: Math.max(limit, 10) });
  }

  if (
    includesAny(normalized, ["find bill", "search bill", "bill details"]) ||
    (normalized.includes("bill") && /\b[a-z]{2,}\d+/i.test(query))
  ) {
    return buildPurchaseBillSearch(snapshot, query, { limit: Math.max(limit, 10) });
  }

  if (includesAny(normalized, ["customer", "customers"]) && normalized.includes("outstanding")) {
    return buildCustomerOutstandingReport(snapshot, query);
  }

  if (includesAny(normalized, ["vendor", "vendors"]) && normalized.includes("outstanding")) {
    return buildVendorOutstandingReport(snapshot, query);
  }

  return buildUnknownResponse();
}