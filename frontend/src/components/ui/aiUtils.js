export const STORAGE_KEY = "finance_ai_workspace_chats_v7";

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
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
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

export function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text) {
  return normalizeText(text)
    .split(" ")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function includesAny(text, words) {
  const value = normalizeText(text);
  return words.some((word) => value.includes(normalizeText(word)));
}

export function countKeywordMatches(text, keywords = []) {
  const value = normalizeText(text);
  return keywords.reduce((count, keyword) => {
    if (!keyword) return count;
    return count + (value.includes(normalizeText(keyword)) ? 1 : 0);
  }, 0);
}

export function fuzzyContainsPhrase(text, phrase) {
  const value = normalizeText(text);
  const q = normalizeText(phrase);

  if (!q) return false;
  if (value.includes(q)) return true;

  const qTokens = tokenize(q);
  if (qTokens.length === 0) return false;

  return qTokens.every((token) => value.includes(token));
}

export function extractTopN(text, fallback = 5) {
  const topMatch = String(text || "").match(/\btop\s+(\d+)\b/i);
  if (topMatch) return Math.max(1, Math.min(50, Number(topMatch[1])));

  const latestMatch = String(text || "").match(/\blast\s+(\d+)\b/i);
  if (latestMatch) return Math.max(1, Math.min(50, Number(latestMatch[1])));

  const firstNumber = String(text || "").match(/\b(\d+)\b/);
  if (firstNumber) return Math.max(1, Math.min(50, Number(firstNumber[1])));

  return fallback;
}

export function trimTitle(text) {
  const finalText = String(text || "").replace(/\s+/g, " ").trim();
  if (!finalText) return "New Chat";
  return finalText.length > 42 ? `${finalText.slice(0, 42)}...` : finalText;
}

export function matchesEntity(row, query, keys) {
  const q = normalizeText(query);
  if (!q) return true;

  return keys.some((key) => normalizeText(row?.[key]).includes(q));
}

export function aggregateBy(rows, groupKey, labelKey) {
  const map = new Map();

  rows.forEach((row) => {
    const key = row?.[groupKey] || row?.[labelKey] || "-";

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
    item.totalBalance += Number(row?.balance || 0);
    item.totalAmount += Number(row?.grand_total || 0);
    item.maxOverdueDays = Math.max(item.maxOverdueDays, Number(row?.overdueDays || 0));
  });

  return [...map.values()];
}

export function uniqueStrings(values = []) {
  return [...new Set(values.map((x) => String(x || "").trim()).filter(Boolean))];
}

export function sumBy(rows = [], key) {
  return rows.reduce((sum, row) => sum + Number(row?.[key] || 0), 0);
}

export function sortByNumberDesc(rows = [], key) {
  return [...rows].sort((a, b) => Number(b?.[key] || 0) - Number(a?.[key] || 0));
}

export function sortByDateDesc(rows = [], key) {
  return [...rows].sort((a, b) => {
    const ad = new Date(a?.[key] || 0).getTime();
    const bd = new Date(b?.[key] || 0).getTime();
    return bd - ad;
  });
}

export function buildTableCard(title, columns, rows) {
  return {
    type: "table",
    title,
    columns,
    rows,
  };
}

export function buildSummaryCard(title, rows) {
  return {
    type: "summary",
    title,
    rows,
  };
}

export function buildListCard(title, items) {
  return {
    type: "list",
    title,
    items,
  };
}

export function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (String(value || "").trim()) return String(value).trim();
  }
  return "";
}