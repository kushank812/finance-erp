// src/utils/date.js

export function pad2(value) {
  return String(value).padStart(2, "0");
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  const y = Number(year);
  const m = Number(month);

  if (m < 1 || m > 12) return 0;
  if ([1, 3, 5, 7, 8, 10, 12].includes(m)) return 31;
  if ([4, 6, 9, 11].includes(m)) return 30;
  return isLeapYear(y) ? 29 : 28;
}

function isValidYMD(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);

  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return false;
  }

  if (m < 1 || m > 12) return false;

  const maxDay = daysInMonth(y, m);
  return d >= 1 && d <= maxDay;
}

function cleanDateString(value) {
  let s = String(value || "").trim();
  if (!s) return "";

  if (s.includes("T")) s = s.split("T")[0];
  if (s.includes(" ")) s = s.split(" ")[0];

  return s;
}

function parseToISO(value) {
  const s = cleanDateString(value);
  if (!s) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return isValidYMD(y, m, d) ? `${y}-${m}-${d}` : "";
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [d, m, y] = s.split("-");
    return isValidYMD(y, m, d) ? `${y}-${m}-${d}` : "";
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return isValidYMD(y, m, d) ? `${y}-${m}-${d}` : "";
  }

  return "";
}

export function toDisplayDate(value) {
  if (!value) return "";

  try {
    const iso = parseToISO(value);
    if (!iso) return "";

    const [y, m, d] = iso.split("-");
    return `${d}-${m}-${y}`;
  } catch {
    return "";
  }
}

export function toInputDate(value) {
  if (!value) return "";

  try {
    return parseToISO(value);
  } catch {
    return "";
  }
}

export function toISODate(value) {
  if (!value) return "";

  try {
    return parseToISO(value);
  } catch {
    return "";
  }
}

export function safeDisplayDate(value) {
  return toDisplayDate(value) || "-";
}

export function safeInputDate(value) {
  return toInputDate(value) || "";
}

export function isValidDisplayDate(value) {
  if (!value) return false;

  const s = String(value).trim();
  if (!/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(s)) return false;

  return Boolean(parseToISO(s));
}

export function normalizeISODate(value) {
  return toISODate(value);
}

export function normalizeDateInput(value) {
  const raw = String(value || "").replace(/[^\d]/g, "").slice(0, 8);

  if (raw.length <= 2) return raw;
  if (raw.length <= 4) return `${raw.slice(0, 2)}/${raw.slice(2)}`;
  return `${raw.slice(0, 2)}/${raw.slice(2, 4)}/${raw.slice(4)}`;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayDisplay() {
  return toDisplayDate(todayISO());
}

export function todayInput() {
  return toInputDate(todayISO());
}

export function firstDayOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
}

export function firstDayOfMonthDisplay() {
  return toDisplayDate(firstDayOfMonthISO());
}

export function firstDayOfMonthInput() {
  return toInputDate(firstDayOfMonthISO());
}

export function startOfYearISO() {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

export function startOfYearDisplay() {
  return toDisplayDate(startOfYearISO());
}

export function startOfYearInput() {
  return toInputDate(startOfYearISO());
}

export const formatDateForDisplay = toDisplayDate;
export const formatDateForInput = toInputDate;
export const formatDateDDMMYYYY = toDisplayDate;
export const parseDisplayDateToISO = toISODate;
export const formatDateForApi = toISODate;
export const formatDateForCalendarText = toDisplayDate;