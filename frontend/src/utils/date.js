// src/utils/date.js

export function toDisplayDate(value) {
  if (!value) return "";

  try {
    let s = String(value).trim();
    if (!s) return "";

    // Handle ISO with time (2026-04-10T00:00:00)
    if (s.includes("T")) {
      s = s.split("T")[0];
    }

    // Handle space datetime (2026-04-10 00:00:00)
    if (s.includes(" ")) {
      s = s.split(" ")[0];
    }

    // Ensure yyyy-mm-dd
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

    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // Must be dd/mm/yyyy
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return "";

    const [d, m, y] = s.split("/");
    return `${y}-${m}-${d}`;
  } catch {
    return "";
  }
}

export function isValidDisplayDate(value) {
  if (!value) return false;
  return /^\d{2}\/\d{2}\/\d{4}$/.test(String(value).trim());
}

export function safeDisplayDate(value) {
  const d = toDisplayDate(value);
  return d || "-";
}