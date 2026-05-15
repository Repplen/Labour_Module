// ─────────────────────────────────────────────────────────────
// backend/utils/masterNameValidation.js
// Used by: companyRoutes, departmentRoutes, designationRoutes
// All business rules: allow letters, numbers, special chars
// Only rule: must contain at least one letter or number
// ─────────────────────────────────────────────────────────────

const normalizeMasterName = (value) =>
  String(value || "").trim().replace(/\s+/g, " ");

/**
 * Validates company name.
 * Allows: letters, numbers, spaces, special chars (& . , - ' etc.)
 * Rejects: only special chars with no letter or number
 */
const validateCompanyName = (value) => {
  const name = normalizeMasterName(value);

  if (!name)
    return { name, error: "Company name is required." };

  if (name.length < 2)
    return { name, error: "Company name must be at least 2 characters." };

  if (name.length > 100)
    return { name, error: "Company name must not exceed 100 characters." };

  if (!/[a-zA-Z0-9]/.test(name))
    return { name, error: "Company name must contain at least one letter or number." };

  return { name, error: "" };
};

/**
 * Generic validator for Department, Designation, Site, etc.
 * Same rules — just uses the label name in the message.
 */
const validateMasterName = (value, label = "Name") => {
  const name = normalizeMasterName(value);

  if (!name)
    return { name, error: `${label} name is required.` };

  if (name.length < 2)
    return { name, error: `${label} name must be at least 2 characters.` };

  if (name.length > 100)
    return { name, error: `${label} name must not exceed 100 characters.` };

  if (!/[a-zA-Z0-9]/.test(name))
    return { name, error: `${label} name must contain at least one letter or number.` };

  return { name, error: "" };
};

/**
 * Sends a structured 400 validation error response.
 */
const sendMasterNameValidationError = (res, field, message) =>
  res.status(400).json({
    success: false,
    message,
    errors: [{ field, message }],
  });

module.exports = {
  normalizeMasterName,
  validateCompanyName,
  validateMasterName,
  sendMasterNameValidationError,
};
