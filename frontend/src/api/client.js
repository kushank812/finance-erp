// src/api/client.js

const API_BASE =
  import.meta.env.VITE_API_URL ||
  "https://finance-erp.onrender.com";

console.log("API_BASE =", API_BASE);

async function handle(res) {
  const text = await res.text().catch(() => "");

  if (!res.ok) {
    let message = `HTTP ${res.status}`;

    try {
      const data = text ? JSON.parse(text) : null;
      message = data?.detail || data?.message || text || message;
    } catch {
      message = text || message;
    }

    throw new Error(message);
  }

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;

  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
      ...options,
    });

    return await handle(res);
  } catch (err) {
    throw new Error(`API request failed for ${url} - ${err.message}`);
  }
}

export function apiGet(path) {
  return request(path, { method: "GET" });
}

export function apiPost(path, body) {
  return request(path, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export function apiPut(path, body) {
  return request(path, {
    method: "PUT",
    body: JSON.stringify(body ?? {}),
  });
}

export function apiDelete(path) {
  return request(path, { method: "DELETE" });
}