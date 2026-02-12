const API_BASE = import.meta.env.VITE_API_URL || "/api";

function getToken() {
  return localStorage.getItem("token");
}

export async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || data.error || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function dlRequest(path, options = {}) {
  const token = getToken();
  const headers = {
 
    ...options.headers,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || data.error || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  login: (email, password) =>
    apiRequest("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email, password, role = "user") =>
    apiRequest("/register", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    }),
  getMovies: () => apiRequest("/movies"),
  getUsers: () => apiRequest("/users"),
  updateUser: (id, data) =>
    apiRequest(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteUser: (id) =>
    dlRequest(`/users/${id}`, { method: "DELETE" }),
};
