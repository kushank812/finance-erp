// src/utils/date.js

export function toDisplayDate(value) {
  if (!value) return "";

  try {
    let s = String(value).trim();
    if (!s) return "";

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