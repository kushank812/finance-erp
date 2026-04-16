import {
  formatDateForApi,
  parseDisplayDateToISO,
} from "../../utils/date";
import { normalizeText } from "./aiUtils";

function toValidDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function getStartOfDay(dateLike) {
  const d = toValidDate(dateLike);
  if (!d) return null;

  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function getEndOfDay(dateLike) {
  const d = toValidDate(dateLike);
  if (!d) return null;

  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function getMonthRange(year, monthIndex) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);

  return {
    start: getStartOfDay(start),
    end: getEndOfDay(end),
  };
}

function toRange(label, start, end) {
  const safeStart = getStartOfDay(start);
  const safeEnd = getEndOfDay(end);

  if (!safeStart || !safeEnd) return null;

  return {
    label,
    start: safeStart,
    end: safeEnd,
  };
}

function parseExplicitSingleDate(text) {
  const raw = String(text || "");

  const ddmmyyyyMatches = raw.match(/\b\d{2}[/-]\d{2}[/-]\d{4}\b/g) || [];
  const isoMatches = raw.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];

  if (ddmmyyyyMatches.length > 0) {
    const iso = parseDisplayDateToISO(ddmmyyyyMatches[0]);
    if (iso) return toRange(ddmmyyyyMatches[0], iso, iso);
  }

  if (isoMatches.length > 0) {
    const iso = formatDateForApi(isoMatches[0]);
    if (iso) return toRange(isoMatches[0], iso, iso);
  }

  return null;
}

function parseExplicitBetweenDates(text) {
  const raw = String(text || "");

  const match =
    raw.match(
      /\b(?:from|between)\s+(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}-\d{2}-\d{2})\s+(?:to|and|-)\s+(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}-\d{2}-\d{2})\b/i
    ) || [];

  if (!match[1] || !match[2]) return null;

  const startRaw = match[1];
  const endRaw = match[2];

  const startISO = startRaw.includes("/")
    ? parseDisplayDateToISO(startRaw)
    : formatDateForApi(startRaw);

  const endISO = endRaw.includes("/")
    ? parseDisplayDateToISO(endRaw)
    : formatDateForApi(endRaw);

  if (!startISO || !endISO) return null;

  return toRange(`${startRaw} to ${endRaw}`, startISO, endISO);
}

function parseRecentDays(q, now) {
  const match =
    q.match(/\blast\s+(\d+)\s+days?\b/i) ||
    q.match(/\bpast\s+(\d+)\s+days?\b/i);

  if (!match) return null;

  const days = Number(match[1] || 0);
  if (!days) return null;

  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));

  return toRange(`Last ${days} Days`, start, now);
}

function parseQuarter(q, now) {
  const match = q.match(/\bq([1-4])(?:\s+(20\d{2}))?\b/i);
  if (!match) return null;

  const quarter = Number(match[1]);
  const year = match[2] ? Number(match[2]) : now.getFullYear();

  const monthStart = (quarter - 1) * 3;
  const start = new Date(year, monthStart, 1);
  const end = new Date(year, monthStart + 3, 0);

  return toRange(`Q${quarter} ${year}`, start, end);
}

export function parseDateRangeFromText(text) {
  const raw = String(text || "").trim();
  const q = normalizeText(raw);
  const now = new Date();

  if (!q) return null;

  const explicitRange = parseExplicitBetweenDates(raw);
  if (explicitRange) return explicitRange;

  const recentDays = parseRecentDays(q, now);
  if (recentDays) return recentDays;

  const quarterRange = parseQuarter(q, now);
  if (quarterRange) return quarterRange;

  if (q.includes("today")) return toRange("Today", now, now);

  if (q.includes("yesterday")) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return toRange("Yesterday", d, d);
  }

  if (q.includes("tomorrow")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return toRange("Tomorrow", d, d);
  }

  if (q.includes("this week")) {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return toRange("This Week", start, end);
  }

  if (q.includes("last week")) {
    const start = new Date(now);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff - 7);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return toRange("Last Week", start, end);
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

  if (q.includes("this year")) {
    return toRange(
      "This Year",
      new Date(now.getFullYear(), 0, 1),
      new Date(now.getFullYear(), 11, 31)
    );
  }

  if (q.includes("last year")) {
    const y = now.getFullYear() - 1;
    return toRange("Last Year", new Date(y, 0, 1), new Date(y, 11, 31));
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

  const explicitSingle = parseExplicitSingleDate(raw);
  if (explicitSingle) return explicitSingle;

  return null;
}

export function isInDateRange(dateLike, range) {
  if (!range?.start || !range?.end) return true;

  const d = toValidDate(dateLike);
  if (!d) return false;

  return d.getTime() >= range.start.getTime() && d.getTime() <= range.end.getTime();
}