// ─────────────────────────────────────────────────────────────
// backend/utils/masterNameValidation.js
// Used by: companyRoutes, departmentRoutes, designationRoutes
// Company names use a stricter business-name standard.
// Generic master names keep the older shared master-name rules.
// ─────────────────────────────────────────────────────────────

const normalizeMasterName = (value) =>
  String(value || "").trim().replace(/\s+/g, " ");

const allowedCompanyNameRegex = /^[A-Za-z0-9 .&()/_-]+$/;
const repeatedCompanySeparatorRegex = /([.&()/_-])\1/;

/**
 * Validates company name.
 * Allows: letters, numbers, spaces, and common business separators: . & - _ / ( )
 * Rejects: only numbers, names starting with separators, dangerous characters,
 * and repeated separators like --, .., &&, __, //, ((, or )).
 */
const validateCompanyName = (value) => {
  const name = normalizeMasterName(value);

  if (!name)
    return { name, error: "Company name is required." };

  if (name.length < 2)
    return { name, error: "Company name must be at least 2 characters." };

  if (name.length > 100)
    return { name, error: "Company name must not exceed 100 characters." };

  if (!/[a-zA-Z]/.test(name))
    return { name, error: "Company name must contain at least one alphabet." };

  if (!/^[A-Za-z0-9]/.test(name))
    return { name, error: "Company name must start with a letter or number." };

  if (!allowedCompanyNameRegex.test(name))
    return { name, error: "Company name contains invalid characters." };

  if (repeatedCompanySeparatorRegex.test(name))
    return { name, error: "Company name must not contain repeated separators." };

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
