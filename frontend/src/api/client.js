export function pad2(value) {
  return String(value).padStart(2, "0");
}

export function isValidDateObject(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

export function parseISODate(value) {
  if (!value) return null;

  const str = String(value).trim();

  const onlyDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (onlyDateMatch) {
    const [, y, m, d] = onlyDateMatch;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return isValidDateObject(date) ? date : null;
  }

  const date = new Date(str);
  return isValidDateObject(date) ? date : null;
}

export function formatDateDDMMYYYY(value, separator = "-") {
  const date = parseISODate(value);
  if (!date) return "-";

  const dd = pad2(date.getDate());
  const mm = pad2(date.getMonth() + 1);
  const yyyy = date.getFullYear();

  return `${dd}${separator}${mm}${separator}${yyyy}`;
}

export function formatDateForDisplay(value) {
  return formatDateDDMMYYYY(value, "-");
}

export function formatDateForCalendarText(value) {
  const date = parseISODate(value);
  if (!date) return "";

  const dd = pad2(date.getDate());
  const mm = pad2(date.getMonth() + 1);
  const yyyy = date.getFullYear();

  return `${dd}/${mm}/${yyyy}`;
}

export function formatDateForApi(value) {
  const date = parseISODate(value);
  if (!date) return "";

  const dd = pad2(date.getDate());
  const mm = pad2(date.getMonth() + 1);
  const yyyy = date.getFullYear();

  return `${yyyy}-${mm}-${dd}`;
}

export function parseDisplayDateToISO(value) {
  if (!value) return "";

  const str = String(value).trim();

  let match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd}`;
  }

  match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(str);
  if (match) {
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd}`;
  }

  match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (match) {
    return str;
  }

  return "";
}