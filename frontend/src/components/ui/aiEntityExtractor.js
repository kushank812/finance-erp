import { extractTopN, normalizeText } from "./aiUtils";
import { parseDateRangeFromText } from "./aiDateParser";

function extractAfterKeyword(text, keyword) {
  const re = new RegExp(`${keyword}\\s+([a-z0-9&._ -]{2,60})`, "i");
  const match = String(text || "").match(re);
  if (!match) return "";

  return String(match[1] || "")
    .replace(/\b(for|with|from|to|in|on|of|and|show|open|find|search|last|top)\b.*$/i, "")
    .trim();
}

function extractQuotedText(query) {
  const matches = String(query || "").match(/"([^"]+)"/g) || [];
  if (matches.length === 0) return "";

  return matches[0].replace(/^"/, "").replace(/"$/, "").trim();
}

function detectNavigationTarget(text) {
  const q = normalizeText(text);

  const targets = [
    { label: "Dashboard", path: "/dashboard", aliases: ["dashboard", "home"] },
    { label: "Entry", path: "/entry", aliases: ["entry"] },
    { label: "Ledger", path: "/ledger", aliases: ["ledger"] },
    { label: "Aging", path: "/aging", aliases: ["aging", "ageing", "aging report", "ageing report"] },
    { label: "Statement", path: "/statement", aliases: ["statement", "statements"] },
    { label: "Customers", path: "/customers", aliases: ["customers", "customer master"] },
    { label: "Vendors", path: "/vendors", aliases: ["vendors", "vendor master"] },
    { label: "Items", path: "/items", aliases: ["items", "item master"] },
    { label: "Users", path: "/users", aliases: ["users", "user management"] },
    { label: "Audit Logs", path: "/audit", aliases: ["audit", "audit logs"] },
    { label: "Create Invoice", path: "/billing", aliases: ["billing", "create invoice", "sales invoice entry"] },
    { label: "Sales Invoices", path: "/sales-invoices", aliases: ["sales invoices", "invoices", "invoice list"] },
    { label: "Create Receipt", path: "/receipt/new", aliases: ["receipt entry", "new receipt", "receipt entry screen"] },
    { label: "Purchase Bill Entry", path: "/purchase/new", aliases: ["purchase entry", "new purchase", "purchase bill entry", "purchase new"] },
    { label: "Purchase Bills", path: "/purchase-bills", aliases: ["purchase bills", "bills", "bill list"] },
    { label: "Vendor Payment", path: "/purchase/pay", aliases: ["vendor payment", "pay vendor", "purchase pay"] },
    { label: "AI Workspace", path: "/ai", aliases: ["ai", "ai workspace", "assistant"] },
  ];

  for (const target of targets) {
    if (target.aliases.some((alias) => q.includes(alias))) {
      return target;
    }
  }

  return null;
}

function detectFlags(text) {
  const q = normalizeText(text);

  return {
    unpaidOnly:
      q.includes("not yet paid") ||
      q.includes("unpaid") ||
      q.includes("outstanding") ||
      q.includes("balance pending") ||
      q.includes("still due"),
    paidOnly:
      q.includes("fully paid") || q.includes("paid invoices") || q.includes("closed invoices"),
    highestFirst:
      q.includes("highest") ||
      q.includes("largest") ||
      q.includes("biggest") ||
      q.includes("pay first") ||
      q.includes("collect first"),
  };
}

export function extractEntities(query) {
  const raw = String(query || "");
  const text = normalizeText(raw);
  const quoted = extractQuotedText(raw);
  const flags = detectFlags(raw);

  return {
    invoiceNo: (raw.match(/\binv[- ]?\d+\b/i) || [])[0]?.replace(/\s+/g, "") || "",
    billNo: (raw.match(/\bbill[- ]?\d+\b/i) || [])[0]?.replace(/\s+/g, "") || "",
    receiptNo: (raw.match(/\brcpt[- ]?\d+\b|\brct[- ]?\d+\b|\brec[- ]?\d+\b/i) || [])[0]?.replace(/\s+/g, "") || "",
    paymentNo: (raw.match(/\bpay[- ]?\d+\b/i) || [])[0]?.replace(/\s+/g, "") || "",
    customer: quoted || extractAfterKeyword(raw, "customer") || extractAfterKeyword(raw, "from"),
    vendor: quoted || extractAfterKeyword(raw, "vendor") || extractAfterKeyword(raw, "supplier"),
    searchText: quoted || extractAfterKeyword(raw, "invoice") || extractAfterKeyword(raw, "bill"),
    topN: extractTopN(raw, 5),
    dateRange: parseDateRangeFromText(raw),
    navigationTarget: detectNavigationTarget(raw),
    flags,
    raw,
    normalized: text,
  };
}