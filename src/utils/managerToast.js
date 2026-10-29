const EVENT_NAME = "techpoint:manager-success";
const STORAGE_KEY = "techpoint:pending-manager-success";

function actionPosition(anchor) {
  if (typeof window === "undefined") return null;
  const activeElement = anchor || document.activeElement;
  const action = activeElement?.closest?.("button, input[type='submit'], [role='button'], select")
    || activeElement;
  if (!action?.getBoundingClientRect) return null;

  const rect = action.getBoundingClientRect();
  const margin = 12;
  const toastWidth = Math.min(420, window.innerWidth - margin * 2);
  const left = Math.min(
    Math.max(margin, rect.left),
    Math.max(margin, window.innerWidth - toastWidth - margin),
  );
  let top = rect.bottom + 10;
  if (top + 78 > window.innerHeight) top = Math.max(margin, rect.top - 82);
  return { left, top };
}

export function showManagerSuccess(message, { persist = false } = {}) {
  if (typeof window === "undefined") return;
  const success = { message, position: actionPosition() };
  if (persist) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(success));
    } catch {
      // The in-page toast still works if session storage is unavailable.
    }
  }
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: success }));
}

export function getPendingManagerSuccess() {
  if (typeof window === "undefined") return "";
  try {
    const pending = window.sessionStorage.getItem(STORAGE_KEY);
    if (!pending) return null;
    try {
      const parsed = JSON.parse(pending);
      return parsed?.message ? parsed : { message: pending, position: null };
    } catch {
      return { message: pending, position: null };
    }
  } catch {
    return null;
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
