const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

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
    throw err;
  }
}

export async function apiGet(path, headers) {
  return request(path, {
    method: "GET",
    headers,
  });
}

export async function apiPost(path, body, headers) {
  return request(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers,
  });
}

export async function apiPut(path, body, headers) {
  return request(path, {
    method: "PUT",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers,
  });
}

export async function apiPatch(path, body, headers) {
  return request(path, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers,
  });
}

export async function apiDelete(path, headers) {
  return request(path, {
    method: "DELETE",
    headers,
  });
}