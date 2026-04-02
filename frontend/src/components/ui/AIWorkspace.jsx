import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../../api/client";
import AIHistorySidebar from "./AIHistorySidebar";

const STORAGE_KEY = "finance_ai_workspace_chats_v2";

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowISO() {
  return new Date().toISOString();
}

function nowTime() {
  try {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function money(n) {
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

function toDateValue(dateLike) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function daysOverdueFromDueDate(dueDate, fallbackDate) {
  const due = toDateValue(dueDate) || toDateValue(fallbackDate);
  if (!due) return 0;

  const now = new Date();
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diff = now.getTime() - due.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function getSpeechRecognition() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function isAdmin(user) {
  return user?.role === "ADMIN";
}

function isOperator(user) {
  return user?.role === "OPERATOR";
}

function isViewer(user) {
  return user?.role === "VIEWER";
}

function canViewReports(user) {
  return isAdmin(user) || isOperator(user) || isViewer(user);
}

function canViewDocuments(user) {
  return isAdmin(user) || isOperator(user) || isViewer(user);
}

function canDoTransactions(user) {
  return isAdmin(user) || isOperator(user);
}

function canManageUsers(user) {
  return isAdmin(user);
}

function canViewAudit(user) {
  return isAdmin(user);
}

function canNavigateTo(path, user) {
  if (!user?.role) return false;

  const normalizedPath = String(path || "").trim();

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

function safeNavigate(path, navigate, user, destinationLabel) {
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

const QUICK_PROMPTS = [
  "Summarize dashboard",
  "Show overdue customers",
  "Who should I follow up first",
  "Generate receivables report",
  "Generate payables report",
  "Generate daily finance summary",
  "Generate reminder",
  "Show biggest risks",
  "Show vendor dues",
  "Open aging report",
  "Open statement",
  "Open ledger",
  "Show invoices",
  "Show purchase bills",
];

function createWelcomeMessages(currentUser) {
  return [
    {
      id: uid(),
      role: "assistant",
      time: nowTime(),
      text:
        currentUser?.role === "VIEWER"
          ? "Welcome to the AI Finance Workspace. You are using read-only AI mode. I can summarize dashboard status, identify overdue customers, rank follow-up priority, analyze vendor dues, generate receivables/payables summaries, draft reminders, and open only allowed read-only finance pages."
          : "Welcome to the AI Finance Workspace. I work best on your live AP/AR data. I can summarize dashboard status, identify overdue customers, rank follow-up priority, analyze vendor dues, generate receivables/payables summaries, draft reminders, and open relevant finance pages.",
      cards: [
        {
          type: "summary",
          title: "Supported AI Actions",
          rows: [
            { label: "Dashboard", value: "Summary / Risks / Daily view" },
            { label: "Receivables", value: "Overdue / Follow-up / Report" },
            { label: "Payables", value: "Vendor dues / Payables report" },
            { label: "Reports", value: "Aging / Statement / Ledger" },
          ],
        },
        {
          type: "list",
          title: "Best Prompts",
          items: [
            "Summarize dashboard",
            "Who should I follow up first",
            "Generate receivables report",
            "Generate daily finance summary",
          ],
        },
      ],
    },
  ];
}

function createNewChat(currentUser) {
  const timestamp = nowISO();
  return {
    id: uid(),
    title: "New Chat",
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: createWelcomeMessages(currentUser),
  };
}

function trimTitle(text) {
  const finalText = String(text || "").replace(/\s+/g, " ").trim();
  if (!finalText) return "New Chat";
  return finalText.length > 38 ? `${finalText.slice(0, 38)}...` : finalText;
}

function AssistantCard({ card }) {
  if (!card) return null;

  if (card.type === "summary") {
    return (
      <div style={cardBox}>
        <div style={cardTitle}>{card.title}</div>
        <div style={cardGrid}>
          {(card.rows || []).map((row, index) => (
            <div key={`${row.label}_${index}`} style={statTile}>
              <div style={statLabel}>{row.label}</div>
              <div style={statValue}>{row.value}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (card.type === "list") {
    return (
      <div style={cardBox}>
        <div style={cardTitle}>{card.title}</div>
        <div style={{ display: "grid", gap: 8 }}>
          {(card.items || []).map((item, index) => (
            <div key={`${item}_${index}`} style={listItem}>
              <span style={listDot} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (card.type === "message") {
    async function copyDraft() {
      try {
        await navigator.clipboard.writeText(card.message || "");
      } catch {
        // ignore
      }
    }

    return (
      <div style={cardBox}>
        <div style={cardTitle}>{card.title}</div>
        <div style={messageDraftBox}>
          <pre style={messageDraftText}>{card.message}</pre>
        </div>
        <div style={actionRow}>
          <button type="button" style={secondaryBtn} onClick={copyDraft}>
            Copy Draft
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: "88%",
          borderRadius: 16,
          padding: "10px 12px",
          whiteSpace: "pre-wrap",
          lineHeight: 1.45,
          fontSize: 13,
          border: isUser
            ? "1px solid rgba(64, 206, 255, 0.28)"
            : "1px solid rgba(255,255,255,0.08)",
          background: isUser
            ? "linear-gradient(135deg, rgba(39,190,255,0.22), rgba(90,120,255,0.18))"
            : "rgba(255,255,255,0.04)",
          color: "#f5f7ff",
          boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12, opacity: 0.9 }}>
          {isUser ? "You" : "AI Assistant"}
        </div>

        <div>{msg.text}</div>

        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            opacity: 0.7,
            textAlign: "right",
          }}
        >
          {msg.time}
        </div>

        {Array.isArray(msg.cards) && msg.cards.length > 0 ? (
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {msg.cards.map((card, index) => (
              <AssistantCard key={`${card.title || "card"}_${index}`} card={card} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MicIcon({ active = false }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: "block" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 15.5C9.93 15.5 8.25 13.82 8.25 11.75V7.75C8.25 5.68 9.93 4 12 4C14.07 4 15.75 5.68 15.75 7.75V11.75C15.75 13.82 14.07 15.5 12 15.5Z"
        stroke={active ? "#ffffff" : "rgba(235,242,255,0.92)"}
        strokeWidth="1.8"
      />
      <path
        d="M18.25 11.75C18.25 15.2 15.45 18 12 18C8.55 18 5.75 15.2 5.75 11.75"
        stroke={active ? "#ffffff" : "rgba(235,242,255,0.92)"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 18V21"
        stroke={active ? "#ffffff" : "rgba(235,242,255,0.92)"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M9.5 21H14.5"
        stroke={active ? "#ffffff" : "rgba(235,242,255,0.92)"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: "block" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21 3L10 14"
        stroke="#07121f"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 3L14 21L10 14L3 10L21 3Z"
        stroke="#07121f"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

async function fetchFinanceSnapshot() {
  const [dashboardData, arData, apData] = await Promise.all([
    apiGet("/dashboard/summary").catch(() => ({})),
    apiGet("/sales-invoices/").catch(() => []),
    apiGet("/purchase-invoices/").catch(() => []),
  ]);

  const salesRows = Array.isArray(arData) ? arData : [];
  const purchaseRows = Array.isArray(apData) ? apData : [];

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

  return {
    dashboardData,
    salesRows,
    purchaseRows,
    overdueRows,
    openPayables,
    dueThisWeek,
    overdueTotal,
    openReceivablesTotal,
    openPayablesTotal,
  };
}

function buildDashboardSummary(snapshot) {
  const { dashboardData, overdueRows, dueThisWeek, overdueTotal, openReceivablesTotal, openPayablesTotal } =
    snapshot;

  const highestRisk = overdueRows[0];

  return {
    reply:
      "Here is a structured dashboard summary based on your current finance data.",
    cards: [
      {
        type: "summary",
        title: "Dashboard Summary",
        rows: [
          {
            label: "Open receivables",
            value: money(
              Number(dashboardData?.total_receivables || openReceivablesTotal || 0)
            ),
          },
          {
            label: "Overdue receivables",
            value: money(overdueTotal),
          },
          {
            label: "Open payables",
            value: money(
              Number(dashboardData?.total_payables || openPayablesTotal || 0)
            ),
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
            ? `Highest AR risk: ${highestRisk.customer_code || "CUSTOMER"} | ${highestRisk.invoice_no || "-"} | ${money(
                Number(highestRisk.balance || 0)
              )} | ${highestRisk.overdueDays} days overdue`
            : "No critical overdue receivable identified.",
          dueThisWeek.length > 0
            ? `${dueThisWeek.length} vendor bill(s) are due within 7 days.`
            : "No vendor bills due within this week.",
        ],
      },
      {
        type: "list",
        title: "Recommended Actions",
        items: [
          overdueRows.length > 0
            ? "Prioritize collection follow-up for the most overdue customer balances."
            : "Continue monitoring receivables; no urgent AR follow-up is visible.",
          dueThisWeek.length > 0
            ? "Review payable scheduling for vendor bills due this week."
            : "No immediate AP scheduling pressure from this week's due dates.",
        ],
      },
    ],
  };
}

function buildReceivablesReport(snapshot) {
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
      {
        type: "list",
        title: "Suggested AR Actions",
        items: [
          top5.length
            ? "Start follow-up with the highest overdue balances first."
            : "No overdue receivables need immediate action.",
          openInvoices > 0
            ? "Review all open invoices and verify receipt posting."
            : "No open receivable invoices are pending.",
        ],
      },
    ],
  };
}

function buildPayablesReport(snapshot) {
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
            value: money(
              dueThisWeek.reduce((sum, r) => sum + Number(r.balance || 0), 0)
            ),
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
      {
        type: "list",
        title: "Suggested AP Actions",
        items: [
          dueThisWeek.length > 0
            ? "Schedule vendor payments for bills due within the next 7 days."
            : "No urgent vendor payment due within this week.",
          openPayables.length > 0
            ? "Review highest payable balances and confirm payment priority."
            : "No open vendor bills found.",
        ],
      },
    ],
  };
}

function buildDailyFinanceSummary(snapshot) {
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

function buildRisksSummary(snapshot) {
  const { overdueRows, dueThisWeek } = snapshot;

  const over60 = overdueRows.filter((r) => Number(r.overdueDays || 0) > 60);
  const over90 = overdueRows.filter((r) => Number(r.overdueDays || 0) > 90);
  const top3 = overdueRows.slice(0, 3);

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
      ...(top3.length
        ? [
            {
              type: "list",
              title: "Top Risk Cases",
              items: top3.map(
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

function buildFollowUpPriority(snapshot) {
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

function buildVendorDues(snapshot) {
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
            value: money(
              dueThisWeek.reduce((sum, r) => sum + Number(r.balance || 0), 0)
            ),
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

function buildOverdueCustomers(snapshot) {
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

function buildReminder(snapshot) {
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

async function buildAIResponse(text, navigate, currentUser) {
  const query = String(text || "").trim().toLowerCase();

  if (!query) {
    return {
      reply:
        "Please type a command like Summarize dashboard, Show overdue customers, Who should I follow up first, Generate receivables report, Generate payables report, or Generate daily finance summary.",
      cards: [],
    };
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
      "Command not supported yet. Try: Summarize dashboard, Show overdue customers, Who should I follow up first, Generate receivables report, Generate payables report, Generate daily finance summary, Generate reminder, Show biggest risks, Show vendor dues, Open aging report, Open statement, Open ledger, Show invoices, or Show purchase bills.",
    cards: [],
  };
}

export default function AIWorkspace({ currentUser = null }) {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) || chats[0] || null,
    [chats, activeChatId]
  );

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChats(parsed);
          setActiveChatId(parsed[0].id);
          return;
        }
      }
    } catch {
      // ignore
    }

    const first = createNewChat(currentUser);
    setChats([first]);
    setActiveChatId(first.id);
  }, [currentUser]);

  useEffect(() => {
    if (!Array.isArray(chats) || chats.length === 0) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch {
      // ignore
    }
  }, [chats]);

  useEffect(() => {
    const RecognitionClass = getSpeechRecognition();
    setSpeechSupported(Boolean(RecognitionClass));

    if (!RecognitionClass) return;

    const recognition = new RecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onstart = () => {
      setIsListening(true);
      setSpeechError("");
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }

      setInput(transcript.trim());
    };

    recognition.onerror = (event) => {
      const errorCode = event?.error || "";

      if (errorCode === "not-allowed") {
        setSpeechError("Microphone permission denied.");
      } else if (errorCode === "no-speech") {
        setSpeechError("No speech detected. Please try again.");
      } else if (errorCode === "audio-capture") {
        setSpeechError("No microphone detected.");
      } else {
        setSpeechError("Voice recognition failed. Please try again.");
      }

      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeChat, loading]);

  async function loadAutoInsights(chatId) {
    try {
      const snapshot = await fetchFinanceSnapshot();
      const result = buildDailyFinanceSummary(snapshot);

      appendMessageToChat(chatId, {
        id: uid(),
        role: "assistant",
        time: nowTime(),
        text:
          "I checked your latest dashboard, receivables, and payables. Here is the automatic daily finance summary.",
        cards: result.cards || [],
      });
    } catch {
      appendMessageToChat(chatId, {
        id: uid(),
        role: "assistant",
        time: nowTime(),
        text:
          "I could not load automatic finance insights right now, but you can still ask for dashboard summary, overdue customers, follow-up priority, reports, or reminders.",
        cards: [],
      });
    }
  }

  function updateChat(chatId, updater) {
    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== chatId) return chat;
        const next = typeof updater === "function" ? updater(chat) : chat;
        return {
          ...next,
          updatedAt: nowISO(),
        };
      })
    );
  }

  function ensureActiveChat() {
    if (activeChat) return activeChat.id;

    const fresh = createNewChat(currentUser);
    setChats([fresh]);
    setActiveChatId(fresh.id);
    return fresh.id;
  }

  function handleNewChat() {
    const fresh = createNewChat(currentUser);
    setChats((prev) => [fresh, ...prev]);
    setActiveChatId(fresh.id);
    setInput("");
    inputRef.current?.focus();
    loadAutoInsights(fresh.id);
  }

  function handleDeleteChat(chatId) {
    setChats((prev) => {
      const filtered = prev.filter((chat) => chat.id !== chatId);
      if (filtered.length === 0) {
        const fresh = createNewChat(currentUser);
        setActiveChatId(fresh.id);
        setTimeout(() => loadAutoInsights(fresh.id), 0);
        return [fresh];
      }

      if (chatId === activeChatId) {
        setActiveChatId(filtered[0].id);
      }

      return filtered;
    });
  }

  function appendMessageToChat(chatId, message) {
    updateChat(chatId, (chat) => {
      const nextMessages = [...(chat.messages || []), message];

      let nextTitle = chat.title;
      const userMessages = nextMessages.filter((m) => m.role === "user");

      if ((chat.title === "New Chat" || !chat.title) && userMessages.length > 0) {
        nextTitle = trimTitle(userMessages[0].text);
      }

      return {
        ...chat,
        title: nextTitle,
        messages: nextMessages,
      };
    });
  }

  function startListening() {
    setSpeechError("");

    if (!recognitionRef.current) {
      setSpeechError("Voice recognition is not supported in this browser.");
      return;
    }

    if (loading) return;

    try {
      recognitionRef.current.start();
      inputRef.current?.focus();
    } catch {
      // ignore duplicate start
    }
  }

  function stopListening() {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    setIsListening(false);
  }

  async function handleSend(customText) {
    const chatId = ensureActiveChat();
    const finalText = String(customText ?? input).trim();

    if (!finalText || loading) return;

    if (isListening) {
      stopListening();
    }

    appendMessageToChat(chatId, {
      id: uid(),
      role: "user",
      time: nowTime(),
      text: finalText,
      cards: [],
    });

    setInput("");
    setLoading(true);

    try {
      const result = await buildAIResponse(finalText, navigate, currentUser);

      appendMessageToChat(chatId, {
        id: uid(),
        role: "assistant",
        time: nowTime(),
        text: result.reply,
        cards: result.cards || [],
      });
    } catch (e) {
      appendMessageToChat(chatId, {
        id: uid(),
        role: "assistant",
        time: nowTime(),
        text: String(e?.message || e || "Something went wrong while processing the command."),
        cards: [],
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  }

  useEffect(() => {
    if (
      activeChat &&
      Array.isArray(activeChat.messages) &&
      activeChat.messages.length <= createWelcomeMessages(currentUser).length
    ) {
      loadAutoInsights(activeChat.id);
    }
  }, [activeChatId]);

  return (
    <>
      <div style={workspaceGrid} className="ai-workspace-grid">
        <div className="ai-history-col" style={historyCol}>
          <AIHistorySidebar
            chats={chats}
            activeChatId={activeChat?.id}
            onSelectChat={setActiveChatId}
            onNewChat={handleNewChat}
            onDeleteChat={handleDeleteChat}
          />
        </div>

        <div className="ai-chat-col" style={chatCol}>
          <div style={panelWrap}>
            <div style={panelHeader}>
              <div>
                <div style={panelTitle}>{activeChat?.title || "AI Finance Assistant"}</div>
                <div style={panelSubtitle}>
                  {currentUser?.role === "VIEWER"
                    ? "Read-only AI summaries, risks, reports, reminders, and safe navigation"
                    : "Live finance summaries, risks, reports, reminders, and navigation"}
                </div>
              </div>

              <div style={statusBadge}>
                <span style={statusDot} />
                <span>{currentUser?.role === "VIEWER" ? "Read Only" : "Ready"}</span>
              </div>
            </div>

            <div ref={scrollRef} style={panelBody}>
              <div style={promptSection}>
                <div style={sectionLabel}>Quick actions</div>
                <div style={chipsWrap}>
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      style={chipBtn}
                      onClick={() => handleSend(prompt)}
                      disabled={loading}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                {(activeChat?.messages || []).map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}

                {loading ? (
                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <div style={loadingBubble}>
                      <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12 }}>
                        AI Assistant
                      </div>
                      <div style={typingRow}>
                        <span style={typingDot} />
                        <span style={typingDot} />
                        <span style={typingDot} />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div style={panelFooter}>
              <div
                style={{
                  ...inputShell,
                  ...(isListening ? inputShellListening : null),
                }}
              >
                <div style={inputArea}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={isListening ? "Speak your finance command..." : "Ask your finance question"}
                    style={inputStyle}
                    disabled={loading}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </div>

                <div style={rightActions}>
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    disabled={!speechSupported || loading}
                    title={
                      !speechSupported
                        ? "Voice recognition not supported"
                        : isListening
                        ? "Stop voice input"
                        : "Start voice input"
                    }
                    style={{
                      ...(isListening ? micBtnActive : micBtn),
                      opacity: !speechSupported || loading ? 0.5 : 1,
                      cursor: !speechSupported || loading ? "not-allowed" : "pointer",
                    }}
                  >
                    <MicIcon active={isListening} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={!canSend}
                    style={{
                      ...sendBtn,
                      opacity: canSend ? 1 : 0.55,
                      cursor: canSend ? "pointer" : "not-allowed",
                    }}
                  >
                    <SendIcon />
                  </button>
                </div>
              </div>

              {speechError ? <div style={speechErrorText}>{speechError}</div> : null}

              <div style={footerHint}>
                Try: <span style={hintStrong}>Summarize dashboard</span>,{" "}
                <span style={hintStrong}>Generate receivables report</span>, or{" "}
                <span style={hintStrong}>Who should I follow up first</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{responsiveCss}</style>
    </>
  );
}

const workspaceGrid = {
  display: "grid",
  gridTemplateColumns: "320px minmax(0, 1fr)",
  gap: 18,
  alignItems: "stretch",
  minHeight: "calc(100vh - 220px)",
};

const historyCol = {
  minWidth: 0,
  minHeight: 0,
};

const chatCol = {
  minWidth: 0,
  minHeight: 0,
};

const panelWrap = {
  width: "100%",
  minHeight: "calc(100vh - 220px)",
  display: "flex",
  flexDirection: "column",
  borderRadius: 22,
  overflow: "hidden",
  background:
    "linear-gradient(180deg, rgba(12,18,36,0.98) 0%, rgba(14,19,42,0.96) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 22px 60px rgba(0,0,0,0.35)",
  color: "#f5f7ff",
};

const panelHeader = {
  padding: "14px 16px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  borderBottom: "1px solid rgba(255,255,255,0.07)",
  background:
    "linear-gradient(135deg, rgba(37,205,207,0.18), rgba(111,82,255,0.18))",
};

const panelTitle = {
  fontSize: 17,
  fontWeight: 900,
  letterSpacing: 0.2,
};

const panelSubtitle = {
  fontSize: 12,
  color: "rgba(235,240,255,0.78)",
  marginTop: 2,
};

const statusBadge = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.10)",
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const statusDot = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "#49e58e",
  boxShadow: "0 0 12px rgba(73,229,142,0.9)",
};

const panelBody = {
  flex: 1,
  overflowY: "auto",
  padding: 14,
  display: "grid",
  gap: 14,
  background:
    "radial-gradient(circle at top left, rgba(73,157,255,0.08), transparent 30%), radial-gradient(circle at bottom right, rgba(94,224,193,0.08), transparent 28%)",
};

const promptSection = {
  display: "grid",
  gap: 10,
};

const sectionLabel = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.9,
  fontWeight: 900,
  color: "rgba(220,228,255,0.72)",
};

const chipsWrap = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const chipBtn = {
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
  color: "#ecf2ff",
  padding: "9px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

const loadingBubble = {
  maxWidth: "70%",
  borderRadius: 16,
  padding: "10px 12px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const typingRow = {
  display: "flex",
  gap: 6,
  alignItems: "center",
};

const typingDot = {
  width: 7,
  height: 7,
  borderRadius: 999,
  background: "rgba(255,255,255,0.85)",
};

const cardBox = {
  borderRadius: 16,
  padding: 12,
  background: "rgba(9, 17, 34, 0.68)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const cardTitle = {
  fontSize: 13,
  fontWeight: 900,
  marginBottom: 10,
  color: "#dce7ff",
};

const cardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 10,
};

const statTile = {
  borderRadius: 14,
  padding: "10px 11px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.07)",
};

const statLabel = {
  fontSize: 11,
  color: "rgba(223,230,255,0.72)",
  marginBottom: 6,
};

const statValue = {
  fontSize: 14,
  fontWeight: 900,
  color: "#ffffff",
  lineHeight: 1.3,
};

const listItem = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  fontSize: 13,
  color: "#eef3ff",
  lineHeight: 1.45,
};

const listDot = {
  width: 7,
  height: 7,
  borderRadius: 999,
  background: "#55d4ff",
  marginTop: 6,
  flex: "0 0 auto",
};

const messageDraftBox = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: 10,
};

const messageDraftText = {
  margin: 0,
  whiteSpace: "pre-wrap",
  fontFamily: "inherit",
  fontSize: 13,
  lineHeight: 1.5,
  color: "#f4f7ff",
};

const actionRow = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 10,
};

const secondaryBtn = {
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 12,
  padding: "9px 12px",
  fontWeight: 800,
  cursor: "pointer",
  color: "#edf2ff",
  background: "rgba(255,255,255,0.05)",
};

const panelFooter = {
  borderTop: "1px solid rgba(255,255,255,0.07)",
  padding: 14,
  display: "grid",
  gap: 10,
  background: "rgba(8,12,26,0.88)",
};

const inputShell = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  borderRadius: 999,
  border: "1px solid rgba(102, 130, 255, 0.22)",
  background:
    "linear-gradient(180deg, rgba(18,26,52,0.96) 0%, rgba(14,21,44,0.96) 100%)",
  padding: "8px 10px 8px 14px",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(71,107,255,0.05)",
  minHeight: 58,
};

const inputShellListening = {
  border: "1px solid rgba(111, 192, 255, 0.4)",
  boxShadow:
    "0 0 0 1px rgba(111,192,255,0.08) inset, 0 0 24px rgba(63,136,255,0.10)",
};

const inputArea = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
};

const inputStyle = {
  width: "100%",
  minWidth: 0,
  border: "none",
  outline: "none",
  boxShadow: "none",
  WebkitBoxShadow: "none",
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  background: "transparent",
  backgroundColor: "transparent",
  color: "#ffffff",
  fontSize: 16,
  lineHeight: 1.4,
  fontFamily: "inherit",
  height: 24,
  padding: 0,
  margin: 0,
  borderRadius: 0,
};

const rightActions = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flex: "0 0 auto",
};

const micBtn = {
  width: 42,
  height: 42,
  border: "none",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.08)",
};

const micBtnActive = {
  width: 42,
  height: 42,
  border: "none",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, rgba(255,97,97,0.88), rgba(255,143,92,0.82))",
  boxShadow: "0 10px 20px rgba(255,90,90,0.20)",
};

const sendBtn = {
  width: 42,
  height: 42,
  border: "none",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, #6ceec7, #65b7ff)",
  boxShadow: "0 10px 20px rgba(101,183,255,0.22)",
};

const speechErrorText = {
  fontSize: 12,
  color: "#ffb3b3",
  fontWeight: 700,
};

const footerHint = {
  fontSize: 12,
  color: "rgba(226,232,255,0.72)",
};

const hintStrong = {
  color: "#ffffff",
  fontWeight: 800,
};

const responsiveCss = `
@media (max-width: 1100px) {
  .ai-workspace-grid {
    grid-template-columns: 1fr !important;
  }

  .ai-history-col {
    order: 2;
  }

  .ai-chat-col {
    order: 1;
  }
}

@media (max-width: 640px) {
  .ai-workspace-grid {
    gap: 12px !important;
  }
}
`;