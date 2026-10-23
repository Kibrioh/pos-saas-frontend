const BASE_URL = (import.meta.env.VITE_API_URL || "https://pos-saas-backend-jnyb.onrender.com/api").replace(/\/$/, "");
const TOKEN_KEY = "techpoint_token";
const BRANCH_KEY = "techpoint_branch_id";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const getActiveBranchId = () => localStorage.getItem(BRANCH_KEY);
export const setActiveBranchId = (branchId) => localStorage.setItem(BRANCH_KEY, String(branchId));
export const clearToken = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(BRANCH_KEY);
};

export async function apiFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const branchId = getActiveBranchId();
  if (token && branchId) headers["X-Branch-ID"] = branchId;

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // some responses have no body
  }

  if (!response.ok) {
    const message =
      (data && (data.message || data.error)) || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function login(username, password) {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setToken(data.access_token);
  setActiveBranchId(data.user.branch_id);
  return data.user;
}

export async function registerManager(businessName, name, username, password) {
  const data = await apiFetch("/auth/manager-signup", {
    method: "POST",
    body: JSON.stringify({ business_name: businessName, name, username, password }),
  });
  setToken(data.access_token);
  setActiveBranchId(data.user.branch_id);
  return data.user;
}
