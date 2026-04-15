// src/api/client.js

const ENV_API_BASE = (import.meta.env.VITE_API_BASE || "").trim();
const RAW_API_BASE = ENV_API_BASE || "http://127.0.0.1:8000";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

function normalizeErrorMessage(value) {
  if (!value) return null;

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => {
        if (typeof item === "string") return item;

        if (item && typeof item === "object") {
          const loc = Array.isArray(item.loc) ? item.loc.join(" → ") : "";
          const msg = item.msg || item.message || JSON.stringify(item);
          return loc ? `${loc}: ${msg}` : msg;
        }

        return String(item);
      })
      .filter(Boolean);

    return parts.length ? parts.join(" | ") : "Request failed.";
  }

  if (typeof value === "object") {
    if (typeof value.message === "string") return value.message;
    if (typeof value.detail === "string") return value.detail;

    try {
      return JSON.stringify(value);
    } catch {
      return "Request failed.";
    }
  }

  return String(value);
}

async function parseError(res) {
  const contentType = res.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const data = await res.json();

      return (
        normalizeErrorMessage(data?.detail) ||
        normalizeErrorMessage(data?.message) ||
        normalizeErrorMessage(data?.error) ||
        `HTTP ${res.status}`
      );
    }

    const text = await res.text();
    return text || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function handle(res) {
  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    const message = await parseError(res);
    throw new Error(normalizeErrorMessage(message) || `HTTP ${res.status}`);
  }

  if (
    contentType.includes(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) ||
    contentType.includes("application/pdf") ||
    contentType.includes("application/octet-stream") ||
    contentType.includes("text/csv")
  ) {
    return await res.blob();
  }

  if (contentType.includes("application/json")) {
    return await res.json();
  }

  const text = await res.text();
  return text || null;
}

async function request(path, options = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${normalizedPath}`;

  const mergedHeaders = {
    Accept: "application/json",
    ...(options.body !== undefined && options.body !== null
      ? { "Content-Type": "application/json" }
      : {}),
    ...(options.headers || {}),
  };

  const finalOptions = {
    ...options,
    credentials: "include",
    headers: mergedHeaders,
  };

  let res;
  try {
    res = await fetch(url, finalOptions);
  } catch {
    throw new Error(
      `Unable to connect to backend at ${API_BASE}. Check VITE_API_BASE, backend status, CORS, and cookie settings.`
    );
  }

  return handle(res);
}

export async function apiGet(path, headers = {}) {
  return request(path, {
    method: "GET",
    headers,
  });
}

export async function apiPost(path, body, headers = {}) {
  return request(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
  });
}

export async function apiPut(path, body, headers = {}) {
  return request(path, {
    method: "PUT",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
  });
}

export async function apiPatch(path, body, headers = {}) {
  return request(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers,
  });
}

export async function apiDelete(path, headers = {}) {
  return request(path, {
    method: "DELETE",
    headers,
  });
}

export { API_BASE };