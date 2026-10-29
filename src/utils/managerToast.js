const EVENT_NAME = "techpoint:manager-success";
const STORAGE_KEY = "techpoint:pending-manager-success";

export function showManagerSuccess(message, { persist = false } = {}) {
  if (typeof window === "undefined") return;
  if (persist) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, message);
    } catch {
      // The in-page toast still works if session storage is unavailable.
    }
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { message } }));
}

export function getPendingManagerSuccess() {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function clearPendingManagerSuccess() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore unavailable session storage.
  }
}

export const MANAGER_SUCCESS_EVENT = EVENT_NAME;
