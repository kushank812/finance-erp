import {
  countKeywordMatches,
  includesAny,
  normalizeText,
} from "./aiUtils";

const INTENT_KEYWORDS = {
  navigate: [
    "open",
    "go to",
    "take me to",
    "navigate",
    "show page",
    "open page",
    "open screen",
  ],
  dashboard: [
    "dashboard",
    "summary",
    "overall",
    "snapshot",
    "kpi",
    "status",
    "finance summary",
  ],
  overdue: [
    "overdue",
    "late",
    "past due",
    "due now",
    "pending due",
    "unpaid overdue",
  ],
  vendor_dues: [
    "vendor dues",
    "vendor payable",
    "supplier dues",
    "supplier payable",
    "payables",
    "ap dues",
  ],
  customer_dues: [
    "customer dues",
    "customer receivable",
    "receivables",
    "ar dues",
    "money to collect",
    "customers still owe",
    "customer outstanding",
  ],
  invoice_search: [
    "invoice",
    "sales invoice",
    "inv",
    "invoice list",
    "find invoice",
    "invoices not yet paid",
    "unpaid invoices",
    "outstanding invoices",
  ],
  bill_search: [
    "bill",
    "purchase bill",
    "purchase invoice",
    "supplier bill",
    "find bill",
    "unpaid bills",
    "outstanding bills",
  ],
  receipt_search: [
    "receipt",
    "receipts",
    "customer payment",
    "received payment",
  ],
  vendor_payment_search: [
    "vendor payment",
    "supplier payment",
    "payment made",
    "paid vendor",
  ],
  masters_summary: [
    "customers",
    "vendors",
    "items",
    "masters",
    "master data",
  ],
  reports_help: [
    "report",
    "reports",
    "ledger",
    "aging",
    "ageing",
    "statement",
  ],
  daily_summary: [
    "today",
    "daily",
    "daily summary",
    "what happened today",
    "latest summary",
  ],
  payment_priority: [
    "which vendors should i pay first",
    "who should i pay first",
    "pay first",
    "payment priority",
    "priority vendors",
    "which supplier first",
  ],
  collection_priority: [
    "which customers should i collect from first",
    "who should i collect from first",
    "collection priority",
    "priority customers",
    "collect first",
  ],
};

function scoreIntent(query, intent) {
  const normalized = normalizeText(query);
  const keywords = INTENT_KEYWORDS[intent] || [];
  let score = countKeywordMatches(normalized, keywords);

  if (intent === "navigate" && includesAny(normalized, INTENT_KEYWORDS.navigate)) {
    score += 4;
  }

  if (intent === "dashboard" && normalized.includes("dashboard")) score += 3;
  if (intent === "overdue" && normalized.includes("overdue")) score += 4;

  if (
    intent === "vendor_dues" &&
    includesAny(normalized, ["vendor", "supplier", "payable", "payables"])
  ) {
    score += 2;
  }

  if (
    intent === "customer_dues" &&
    includesAny(normalized, ["customer", "customers", "receivable", "receivables", "owe", "owed"])
  ) {
    score += 2;
  }

  if (intent === "invoice_search" && includesAny(normalized, ["invoice", "inv"])) {
    score += 3;
  }

  if (intent === "bill_search" && includesAny(normalized, ["bill", "purchase"])) {
    score += 3;
  }

  if (
    intent === "payment_priority" &&
    includesAny(normalized, ["pay first", "payment priority", "priority vendors"])
  ) {
    score += 5;
  }

  if (
    intent === "collection_priority" &&
    includesAny(normalized, ["collect first", "collection priority", "priority customers"])
  ) {
    score += 5;
  }

  return score;
}

export function parseIntent(query) {
  const normalized = normalizeText(query);

  if (!normalized) return "unknown";

  if (
    includesAny(normalized, [
      "which vendors should i pay first",
      "who should i pay first",
      "pay first",
      "payment priority",
      "priority vendors",
      "which supplier first",
    ])
  ) {
    return "payment_priority";
  }

  if (
    includesAny(normalized, [
      "which customers should i collect from first",
      "who should i collect from first",
      "collect first",
      "collection priority",
      "priority customers",
    ])
  ) {
    return "collection_priority";
  }

  if (
    includesAny(normalized, [
      "show invoices not yet paid",
      "invoices not yet paid",
      "unpaid invoices",
      "outstanding invoices",
    ])
  ) {
    return "invoice_search";
  }

  if (
    includesAny(normalized, [
      "what money do customers still owe",
      "customers still owe",
      "customer outstanding",
      "outstanding customers",
    ])
  ) {
    return "customer_dues";
  }

  const intents = [
    "navigate",
    "dashboard",
    "overdue",
    "vendor_dues",
    "customer_dues",
    "invoice_search",
    "bill_search",
    "receipt_search",
    "vendor_payment_search",
    "masters_summary",
    "reports_help",
    "daily_summary",
    "payment_priority",
    "collection_priority",
  ];

  let bestIntent = "unknown";
  let bestScore = 0;

  for (const intent of intents) {
    const score = scoreIntent(normalized, intent);
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  if (bestScore <= 0) return "unknown";

  if (
    bestIntent === "dashboard" &&
    includesAny(normalized, ["overdue", "late", "pending"])
  ) {
    return "overdue";
  }

  if (
    bestIntent === "reports_help" &&
    includesAny(normalized, ["ledger", "statement", "aging", "ageing"])
  ) {
    return "navigate";
  }

  return bestIntent;
}