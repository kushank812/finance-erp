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
    "pending due",
    "past due",
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
  ],
  invoice_search: [
    "invoice",
    "sales invoice",
    "inv",
    "invoice list",
    "find invoice",
  ],
  bill_search: [
    "bill",
    "purchase bill",
    "purchase invoice",
    "supplier bill",
    "find bill",
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
  if (intent === "vendor_dues" && includesAny(normalized, ["vendor", "supplier", "payable", "payables"])) {
    score += 2;
  }
  if (intent === "customer_dues" && includesAny(normalized, ["customer", "receivable", "receivables"])) {
    score += 2;
  }
  if (intent === "invoice_search" && includesAny(normalized, ["invoice", "inv"])) {
    score += 3;
  }
  if (intent === "bill_search" && includesAny(normalized, ["bill", "purchase"])) {
    score += 3;
  }

  return score;
}

export function parseIntent(query) {
  const normalized = normalizeText(query);

  if (!normalized) return "unknown";

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