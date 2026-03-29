export function toDisplayDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function toISODate(display) {
  if (!display) return "";
  const [d, m, y] = display.split("/");
  return `${y}-${m}-${d}`;
}