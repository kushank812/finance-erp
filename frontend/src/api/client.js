// src/api/client.js

const ENV_API_BASE = (import.meta.env.VITE_API_BASE || "").trim();
const RAW_API_BASE = ENV_API_BASE || "http://127.0.0.1:8000";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

async function parseError(res) {
  const contentType = res.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const data = await res.json();
      return (
        data?.detail ||
        data?.message ||
        data?.error ||
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
    throw new Error(message);
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

  const finalOptions = {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body !== undefined && options.body !== null
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers || {}),
    },
    ...options,
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