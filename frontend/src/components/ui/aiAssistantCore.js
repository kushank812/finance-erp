import { apiGet } from "../../api/client";

export const STORAGE_KEY = "finance_ai_workspace_chats_v3";

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
  "Show overdue customers",
  "Who should I follow up first",
  "Generate receivables report",
  "Generate payables report",
  "Generate daily finance summary",
  "Generate reminder",
  "Show biggest risks",
  "Show vendor dues",
  "Show recent receipts",
  "Show recent vendor payments",
  "Show master data summary",
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
          ? "Welcome to the AI Finance Workspace. You are in read-only AI mode. I can summarize dashboard status, analyze AR/AP, show recent receipts and vendor payments, summarize masters, draft reminders, and open only pages allowed for your role."
          : "Welcome to the AI Finance Workspace. I can work on your live finance data, summarize AR/AP, show recent receipts and vendor payments, summarize masters, draft reminders, and open relevant project pages.",
      cards: [
        {
          type: "summary",
          title: "Supported AI Actions",
          rows: [
            { label: "Dashboard", value: "Summary / Risks / Daily view" },
            { label: "Receivables", value: "Overdue / Follow-up / Report" },
            { label: "Payables", value: "Vendor dues / Report" },
            { label: "Operations", value: "Receipts / Vendor payments / Masters" },
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
    messages: createWelcomeMessages(currentUser),
  };
}

export function trimTitle(text) {
  const finalText = String(text || "").replace(/\s+/g, " ").trim();
  if (!finalText) return "New Chat";
  return finalText.length > 38 ? `${finalText.slice(0, 38)}...` : finalText;
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

  const overdueRows = salesRows
    .map((r) => {
      const overdueDays = daysOverdueFromDueDate(r.due_date, r.invoice_date);
      return { ...r, overdueDays };
    })
    .filter((r) => Number(r.balance || 0) > 0 && Number(r.overdueDays || 0) > 0)
    .sort((a, b) => {
      if (Number(b.overdueDays || 0) !== Number(a.overdueDays || 0)) {
        return Number(b.overdueDays || 0) - Number(a.overdueDays || 0);
      }
      return Number(b.balance || 0) - Number(a.balance || 0);
    });

  const openPayables = purchaseRows
    .filter((r) => Number(r.balance || 0) > 0)
    .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueThisWeek = openPayables.filter((r) => {
    const due = toDateValue(r.due_date || r.bill_date);
    if (!due) return false;
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  });

  const overdueTotal =
    Number(dashboardData?.overdue_receivables || 0) ||
    overdueRows.reduce((sum, r) => sum + Number(r.balance || 0), 0);

  const openReceivablesTotal = salesRows.reduce(
    (sum, r) => sum + Math.max(0, Number(r.balance || 0)),
    0
  );

  const openPayablesTotal = openPayables.reduce(
    (sum, r) => sum + Number(r.balance || 0),
    0
  );

  const recentReceipts = [...receiptRows]
    .sort((a, b) => {
      const aDate = new Date(a.receipt_date || a.created_at || 0).getTime();
      const bDate = new Date(b.receipt_date || b.created_at || 0).getTime();
      return bDate - aDate;
    })
    .slice(0, 5);

  const recentVendorPayments = [...vendorPaymentRows]
    .sort((a, b) => {
      const aDate = new Date(a.payment_date || a.created_at || 0).getTime();
      const bDate = new Date(b.payment_date || b.created_at || 0).getTime();
      return bDate - aDate;
    })
    .slice(0, 5);

  return {
    dashboardData,
    salesRows,
    purchaseRows,
    receiptRows,
    vendorPaymentRows,
    customerRows,
    vendorRows,
    itemRows,
    overdueRows,
    openPayables,
    dueThisWeek,
    overdueTotal,
    openReceivablesTotal,
    openPayablesTotal,
    recentReceipts,
    recentVendorPayments,
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

export function buildReceivablesReport(snapshot) {
  const { overdueRows, salesRows, overdueTotal, openReceivablesTotal } = snapshot;
  const top5 = overdueRows.slice(0, 5);
  const openInvoices = salesRows.filter((r) => Number(r.balance || 0) > 0).length;

  return {
    reply: "Receivables report generated from current sales invoice data.",
    cards: [
      {
        type: "summary",
        title: "Receivables Report",
        rows: [
          { label: "Open invoices", value: String(openInvoices) },
          { label: "Overdue invoices", value: String(overdueRows.length) },
          { label: "Open receivables", value: money(openReceivablesTotal) },
          { label: "Overdue amount", value: money(overdueTotal) },
        ],
      },
      ...(top5.length
        ? [
            {
              type: "list",
              title: "Top Overdue Receivables",
              items: top5.map(
                (r, index) =>
                  `${index + 1}. ${r.customer_code || "CUSTOMER"} | ${
                    r.invoice_no || "-"
                  } | ${money(Number(r.balance || 0))} | ${r.overdueDays} days overdue`
              ),
            },
          ]
        : []),
    ],
  };
}

export function buildPayablesReport(snapshot) {
  const { openPayables, openPayablesTotal, dueThisWeek } = snapshot;
  const top5 = openPayables.slice(0, 5);

  return {
    reply: "Payables report generated from current purchase bill data.",
    cards: [
      {
        type: "summary",
        title: "Payables Report",
        rows: [
          { label: "Open vendor bills", value: String(openPayables.length) },
          { label: "Total payables", value: money(openPayablesTotal) },
          { label: "Due this week", value: String(dueThisWeek.length) },
          {
            label: "Due this week amount",
            value: money(dueThisWeek.reduce((sum, r) => sum + Number(r.balance || 0), 0)),
          },
        ],
      },
      ...(top5.length
        ? [
            {
              type: "list",
              title: "Top Vendor Payables",
              items: top5.map(
                (r, index) =>
                  `${index + 1}. ${r.vendor_code || "VENDOR"} | ${
                    r.bill_no || "-"
                  } | ${money(Number(r.balance || 0))}`
              ),
            },
          ]
        : []),
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
      ...(overdueRows.length
        ? [
            {
              type: "list",
              title: "Top Risk Cases",
              items: overdueRows.slice(0, 3).map(
                (r, index) =>
                  `${index + 1}. ${r.customer_code || "CUSTOMER"} | ${
                    r.invoice_no || "-"
                  } | ${money(Number(r.balance || 0))} | ${r.overdueDays} days overdue`
              ),
            },
          ]
        : []),
    ],
  };
}

export function buildFollowUpPriority(snapshot) {
  const { overdueRows } = snapshot;
  const top5 = overdueRows.slice(0, 5);

  return {
    reply:
      top5.length > 0
        ? "These are the top receivable follow-up priorities based on overdue days and balance."
        : "No overdue follow-up cases found right now.",
    cards: [
      {
        type: "summary",
        title: "Follow-up Priority",
        rows: [
          { label: "Overdue invoices", value: String(overdueRows.length) },
          { label: "Priority cases", value: String(top5.length) },
          {
            label: "Oldest overdue",
            value: top5[0] ? `${top5[0].overdueDays} days` : "0 days",
          },
          {
            label: "Highest priority balance",
            value: top5[0] ? money(Number(top5[0].balance || 0)) : money(0),
          },
        ],
      },
      ...(top5.length
        ? [
            {
              type: "list",
              title: "Top Follow-up Targets",
              items: top5.map(
                (r, index) =>
                  `${index + 1}. ${r.customer_code || "CUSTOMER"} | ${
                    r.invoice_no || "-"
                  } | ${money(Number(r.balance || 0))} | ${r.overdueDays} days overdue`
              ),
            },
          ]
        : []),
    ],
  };
}

export function buildVendorDues(snapshot) {
  const { openPayables, openPayablesTotal, dueThisWeek } = snapshot;
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
      ...(openPayables.length
        ? [
            {
              type: "list",
              title: "Top Vendor Dues",
              items: openPayables.slice(0, 5).map(
                (r, index) =>
                  `${index + 1}. ${r.vendor_code || "VENDOR"} | ${
                    r.bill_no || "-"
                  } | ${money(Number(r.balance || 0))}`
              ),
            },
          ]
        : []),
    ],
  };
}

export function buildOverdueCustomers(snapshot) {
  const { overdueRows, overdueTotal } = snapshot;
  const highest = overdueRows[0];

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
          { label: "Highest overdue customer", value: highest?.customer_code || "-" },
          {
            label: "Largest overdue balance",
            value: highest ? money(Number(highest.balance || 0)) : money(0),
          },
        ],
      },
      ...(overdueRows.length
        ? [
            {
              type: "list",
              title: "Top Overdue Customers",
              items: overdueRows.slice(0, 5).map(
                (r, index) =>
                  `${index + 1}. ${r.customer_code || "CUSTOMER"} | ${
                    r.invoice_no || "-"
                  } | ${money(Number(r.balance || 0))} | ${r.overdueDays} days overdue`
              ),
            },
          ]
        : []),
    ],
  };
}

export function buildRecentReceipts(snapshot) {
  const { receiptRows, recentReceipts } = snapshot;

  return {
    reply: "Here are the latest receipts recorded in the system.",
    cards: [
      {
        type: "summary",
        title: "Receipt Summary",
        rows: [
          { label: "Total receipts", value: String(receiptRows.length) },
          {
            label: "Recent 5 total",
            value: money(
              recentReceipts.reduce((sum, r) => sum + Number(r.amount || r.receipt_amount || 0), 0)
            ),
          },
        ],
      },
      ...(recentReceipts.length
        ? [
            {
              type: "list",
              title: "Recent Receipts",
              items: recentReceipts.map(
                (r, index) =>
                  `${index + 1}. ${r.receipt_no || "-"} | ${r.customer_code || "-"} | ${money(
                    Number(r.amount || r.receipt_amount || 0)
                  )}`
              ),
            },
          ]
        : [
            {
              type: "list",
              title: "Recent Receipts",
              items: ["No receipts found."],
            },
          ]),
    ],
  };
}

export function buildRecentVendorPayments(snapshot) {
  const { vendorPaymentRows, recentVendorPayments } = snapshot;

  return {
    reply: "Here are the latest vendor payments recorded in the system.",
    cards: [
      {
        type: "summary",
        title: "Vendor Payment Summary",
        rows: [
          { label: "Total vendor payments", value: String(vendorPaymentRows.length) },
          {
            label: "Recent 5 total",
            value: money(
              recentVendorPayments.reduce(
                (sum, r) => sum + Number(r.amount || r.payment_amount || 0),
                0
              )
            ),
          },
        ],
      },
      ...(recentVendorPayments.length
        ? [
            {
              type: "list",
              title: "Recent Vendor Payments",
              items: recentVendorPayments.map(
                (r, index) =>
                  `${index + 1}. ${r.payment_no || "-"} | ${r.vendor_code || "-"} | ${money(
                    Number(r.amount || r.payment_amount || 0)
                  )}`
              ),
            },
          ]
        : [
            {
              type: "list",
              title: "Recent Vendor Payments",
              items: ["No vendor payments found."],
            },
          ]),
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

export async function buildAIResponse(text, navigate, currentUser) {
  const query = String(text || "").trim().toLowerCase();

  if (!query) {
    return {
      reply:
        "Please type a command like Summarize dashboard, Show overdue customers, Show recent receipts, Show recent vendor payments, Show master data summary, or Open dashboard.",
      cards: [],
    };
  }

  if (query.includes("open dashboard") || query === "dashboard") {
    return safeNavigate("/dashboard", navigate, currentUser, "Dashboard").result;
  }

  if (query.includes("open entry") || query === "entry") {
    return safeNavigate("/entry", navigate, currentUser, "Entry Screen").result;
  }

  if (query.includes("open aging") || query === "aging" || query.includes("aging report")) {
    return safeNavigate("/aging", navigate, currentUser, "Aging Report").result;
  }

  if (query.includes("open statement") || query === "statement") {
    return safeNavigate("/statement", navigate, currentUser, "Statement").result;
  }

  if (query.includes("open ledger") || query === "ledger") {
    return safeNavigate("/ledger", navigate, currentUser, "Ledger").result;
  }

  if (query.includes("open customers") || query === "customers") {
    return safeNavigate("/customers", navigate, currentUser, "Customer Master").result;
  }

  if (query.includes("open vendors") || query === "vendors") {
    return safeNavigate("/vendors", navigate, currentUser, "Vendor Master").result;
  }

  if (query.includes("open items") || query === "items") {
    return safeNavigate("/items", navigate, currentUser, "Item Master").result;
  }

  if (query.includes("open users") || query === "users") {
    return safeNavigate("/users", navigate, currentUser, "Users").result;
  }

  if (query.includes("open audit") || query.includes("audit log")) {
    return safeNavigate("/audit", navigate, currentUser, "Audit Logs").result;
  }

  if (query.includes("change password")) {
    return safeNavigate("/change-password", navigate, currentUser, "Change Password").result;
  }

  if (
    query.includes("create invoice") ||
    query.includes("open create invoice") ||
    query === "billing"
  ) {
    return safeNavigate("/billing", navigate, currentUser, "Create Invoice").result;
  }

  if (
    query.includes("create purchase bill") ||
    query.includes("open create purchase bill")
  ) {
    return safeNavigate("/purchase/new", navigate, currentUser, "Create Purchase Bill").result;
  }

  if (query.includes("create receipt") || query.includes("open create receipt")) {
    return safeNavigate("/receipt/new", navigate, currentUser, "Create Receipt").result;
  }

  if (query.includes("vendor payment") || query.includes("open vendor payment")) {
    return safeNavigate("/purchase/pay", navigate, currentUser, "Vendor Payment").result;
  }

  if (query.includes("purchase bill") || query.includes("purchase bills")) {
    return safeNavigate("/purchase-bills", navigate, currentUser, "Purchase Bills").result;
  }

  if (query.includes("invoice") || query.includes("invoices")) {
    return safeNavigate("/sales-invoices", navigate, currentUser, "Sales Invoices").result;
  }

  const snapshot = await fetchFinanceSnapshot();

  if (query.includes("summarize dashboard") || query.includes("dashboard summary")) {
    return buildDashboardSummary(snapshot);
  }

  if (query.includes("receivables report") || query.includes("ar report")) {
    return buildReceivablesReport(snapshot);
  }

  if (query.includes("payables report") || query.includes("ap report")) {
    return buildPayablesReport(snapshot);
  }

  if (
    query.includes("daily finance summary") ||
    query.includes("what should i do today") ||
    query.includes("what should i do")
  ) {
    return buildDailyFinanceSummary(snapshot);
  }

  if (query.includes("biggest risks") || query.includes("risk")) {
    return buildRisksSummary(snapshot);
  }

  if (
    query.includes("follow up") ||
    query.includes("follow-up") ||
    query.includes("priority") ||
    query.includes("who should i follow up first")
  ) {
    return buildFollowUpPriority(snapshot);
  }

  if (query.includes("vendor dues") || query.includes("vendor due")) {
    return buildVendorDues(snapshot);
  }

  if (query.includes("recent receipts") || query.includes("show receipts")) {
    return buildRecentReceipts(snapshot);
  }

  if (
    query.includes("recent vendor payments") ||
    query.includes("show vendor payments")
  ) {
    return buildRecentVendorPayments(snapshot);
  }

  if (
    query.includes("master data summary") ||
    query.includes("show masters") ||
    query.includes("master summary")
  ) {
    return buildMasterSummary(snapshot);
  }

  if (query.includes("overdue")) {
    return buildOverdueCustomers(snapshot);
  }

  if (
    query.includes("generate reminder") ||
    query.includes("draft payment reminder") ||
    query.includes("payment reminder") ||
    query.includes("reminder")
  ) {
    return buildReminder(snapshot);
  }

  return {
    reply:
      "Command not supported yet. Try: Summarize dashboard, Show overdue customers, Who should I follow up first, Generate receivables report, Generate payables report, Show recent receipts, Show recent vendor payments, Show master data summary, Open customers, Open vendors, Open items, Open users, Open audit logs, Open dashboard, Open entry, Open aging report, Open statement, Open ledger, Open invoices, Open purchase bills, Open create invoice, Open create purchase bill, Open create receipt, or Open vendor payment.",
    cards: [],
  };
}