// src/utils/date.js

export function pad2(value) {
  return String(value).padStart(2, "0");
}

export function toDisplayDate(value) {
  if (!value) return "";

  try {
    let s = String(value).trim();
    if (!s) return "";

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;

    if (s.includes("T")) s = s.split("T")[0];
    if (s.includes(" ")) s = s.split(" ")[0];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";

    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return "";
  }
}

export function toISODate(value) {
  if (!value) return "";

  try {
    let s = String(value).trim();
    if (!s) return "";

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return "";

    const [d, m, y] = s.split("/");
    return `${y}-${m}-${d}`;
  } catch {
    return "";
  }
}

export function safeDisplayDate(value) {
  return toDisplayDate(value) || "-";
}

export function isValidDisplayDate(value) {
  if (!value) return false;

  const s = String(value).trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return false;

  const iso = toISODate(s);
  if (!iso) return false;

  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(`${iso}T00:00:00`);

  if (Number.isNaN(dt.getTime())) return false;

  return (
    dt.getFullYear() === y &&
    dt.getMonth() + 1 === m &&
    dt.getDate() === d
  );
}

export function normalizeISODate(value) {
  if (!value) return "";

  try {
    let s = String(value).trim();
    if (!s) return "";

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return toISODate(s);

    if (s.includes("T")) s = s.split("T")[0];
    if (s.includes(" ")) s = s.split(" ")[0];

    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
  } catch {
    return "";
  }
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayDisplay() {
  return toDisplayDate(todayISO());
}

export function firstDayOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
}

export function firstDayOfMonthDisplay() {
  return toDisplayDate(firstDayOfMonthISO());
}

export function startOfYearISO() {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}

export function startOfYearDisplay() {
  return toDisplayDate(startOfYearISO());
}