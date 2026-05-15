// ─────────────────────────────────────────────────────────────
// frontend/src/utils/masterNameValidation.js
// NO business rules — all validation is in the backend.
// Functions kept so existing imports don't break.
// ─────────────────────────────────────────────────────────────

/**
 * Trims and collapses multiple spaces.
 * Still useful before sending data to API.
 */
export const normalizeMasterName = (value) =>
  String(value || "").trim().replace(/\s+/g, " ");

/**
 * No frontend validation — backend handles all rules.
 * Kept so DepartmentMaster, DesignationMaster imports don't break.
 */
export const validateMasterName = () => "";

/**
 * No frontend validation — backend handles all rules.
 * Kept so CompanyMaster import doesn't break.
 */
export const validateCompanyName = () => "";

/**
 * Extracts the first error message from a backend API error response.
 * Works for Zod (422) and Mongoose (400/409) shapes.
 */
export const getApiFieldError = (error) => {
  const data = error?.response?.data;
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  if (errors.length > 0) return errors[0]?.message || "";
  if (data?.message) return data.message;
  return "";
};
