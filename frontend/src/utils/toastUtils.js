// ─────────────────────────────────────────────────────────────
// frontend/src/utils/toastUtils.js
// ─────────────────────────────────────────────────────────────

/**
 * Shows a toast notification.
 *
 * @param {Function} setToast  - state setter from useState
 * @param {string}   message   - message to display
 * @param {string}   variant   - "success" | "error" | "warning" | "info"
 *
 * Usage:
 *   import { showToast } from "../../utils/toastUtils";
 *   showToast(setToast, "Company added successfully!");
 *   showToast(setToast, "Something went wrong.", "error");
 */
export const showToast = (setToast, message, variant = "success") => {
  setToast({ show: true, message, variant });
};
