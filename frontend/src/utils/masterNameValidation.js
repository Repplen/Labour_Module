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

const allowedCompanyNameRegex = /^[A-Za-z0-9 .&()/_-]+$/;
const repeatedCompanySeparatorRegex = /([.&()/_-])\1/;

/**
 * Validates a master name (Designation, Department, Site, etc.).
 * Returns an error string, or "" if valid.
 */
export const validateMasterName = (value, label = "Name") => {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  if (!name) return `${label} name is required.`;
  if (name.length < 2) return `${label} name must be at least 2 characters.`;
  if (name.length > 100) return `${label} name must not exceed 100 characters.`;
  if (!/[a-zA-Z0-9]/.test(name))
    return `${label} name must contain at least one letter or number.`;
  return "";
};

/**
 * Validates a company name (same rules, different label).
 * Returns an error string, or "" if valid.
 */
export const validateCompanyName = (value) => {
  const name = normalizeMasterName(value);
  if (!name) return "Company name is required.";
  if (name.length < 2) return "Company name must be at least 2 characters.";
  if (name.length > 100) return "Company name must not exceed 100 characters.";
  if (!/[a-zA-Z]/.test(name)) {
    return "Company name must contain at least one alphabet.";
  }
  if (!/^[A-Za-z0-9]/.test(name)) {
    return "Company name must start with a letter or number.";
  }
  if (!allowedCompanyNameRegex.test(name)) {
    return "Company name contains invalid characters.";
  }
  if (repeatedCompanySeparatorRegex.test(name)) {
    return "Company name must not contain repeated separators.";
  }

  return "";
};

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
