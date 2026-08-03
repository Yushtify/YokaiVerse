// ─── Delete Data ────────────────────────────────────────────────────────────

(window as any).deleteAccData = function deleteAccData() {
  try {
    sessionStorage.clear();
    localStorage.clear();

    console.log(
      "[DEBUG: privacySettings] All local and session storage data has been deleted.",
    );

    location.reload();
  } catch (error) {
    console.error(
      "[DEBUG: privacySettings] Failed to delete storage data:",
      error,
    );
  }
};
