const { normalizeMasterName } = require("../utils/masterNameValidation");

const duplicateCompanyMessage = "Duplicate company data found";
const duplicateCompanyNameError = {
  field: "name",
  message: "This company name already exists.",
};

const normalizeName = normalizeMasterName;

const createError = (message, statusCode = 400, options = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, options);
  return error;
};

const createDuplicateCompanyError = () =>
  createError(duplicateCompanyMessage, 409, {
    success: false,
    errors: [duplicateCompanyNameError],
  });

const escapeRegExp = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseNameList = (value) => {
  const raw = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[\n,]+/)
        .map((item) => item.trim());

  const unique = [];
  const seen = new Set();

  raw
    .map((item) => normalizeName(item))
    .filter(Boolean)
    .forEach((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(item);
    });

  return unique;
};

const parseEmployeeIds = (value) => {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();

  return raw
    .map((item) => normalizeName(item))
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
};

const formatEmployeeDirectorLabel = (employee) => {
  const code = normalizeName(employee?.employeeCode);
  const name = normalizeName(employee?.employeeName);
  if (code && name) return `${code} - ${name}`;
  return code || name;
};

module.exports = {
  createDuplicateCompanyError,
  createError,
  duplicateCompanyMessage,
  duplicateCompanyNameError,
  escapeRegExp,
  formatEmployeeDirectorLabel,
  normalizeName,
  parseEmployeeIds,
  parseNameList,
};
