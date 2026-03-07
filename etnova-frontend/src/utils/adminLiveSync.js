export const ADMIN_DATA_SYNC_KEY = "etnova_admin_data_sync";

export function emitAdminDataUpdated() {
  const stamp = String(Date.now());
  try {
    localStorage.setItem(ADMIN_DATA_SYNC_KEY, stamp);
  } catch {
    // Ignore storage errors in restricted environments.
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("admin-data-updated", { detail: { stamp } }));
  }
}

