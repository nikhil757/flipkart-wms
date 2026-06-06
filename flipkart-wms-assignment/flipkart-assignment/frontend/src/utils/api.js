const BASE = "/api";

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("wms_token");
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(!(options.body instanceof FormData) && { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  get: (path) => apiFetch(path),
  post: (path, body) =>
    apiFetch(path, { method: "POST", body: JSON.stringify(body) }),
  postForm: (path, formData) =>
    apiFetch(path, { method: "POST", body: formData }),
};
