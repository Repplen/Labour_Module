const { normalizeMasterName } = require("../utils/masterNameValidation");

const MAX_SUB_LEVELS = 4;
const duplicateDepartmentMessage = "Duplicate department data found";
const duplicateDepartmentNameError = {
  field: "name",
  message: "This department name already exists.",
};

const normalizeName = normalizeMasterName;

const createError = (message, statusCode = 400, options = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, options);
  return error;
};

const createDuplicateDepartmentError = () =>
  createError(duplicateDepartmentMessage, 409, {
    success: false,
    errors: [duplicateDepartmentNameError],
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

const formatEmployeeHeadLabel = (employee) => {
  const code = normalizeName(employee?.employeeCode);
  const name = normalizeName(employee?.employeeName);
  if (code && name) return `${code} - ${name}`;
  return code || name;
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

const hasDuplicateSubDepartment = (rows, name, ignoreId = null) =>
  rows.some(
    (item) =>
      item.name.trim().toLowerCase() === name.trim().toLowerCase() &&
      String(item._id) !== String(ignoreId || "")
  );

const parseSubDepartmentNames = (body = {}) => ({
  names: parseNameList(
    Array.isArray(body.names) || typeof body.names === "string"
      ? body.names
      : [body.name]
  ),
  hasBulkPayload: Array.isArray(body.names) || typeof body.names === "string",
});

const findSubDepartmentNode = (rows = [], subId, level = 1) => {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (String(row._id) === String(subId)) {
      return { node: row, siblings: rows, index: i, level };
    }

    const childMatch = findSubDepartmentNode(row.children || [], subId, level + 1);
    if (childMatch) return childMatch;
  }

  return null;
};

module.exports = {
  MAX_SUB_LEVELS,
  createDuplicateDepartmentError,
  createError,
  duplicateDepartmentMessage,
  duplicateDepartmentNameError,
  escapeRegExp,
  findSubDepartmentNode,
  formatEmployeeHeadLabel,
  hasDuplicateSubDepartment,
  normalizeName,
  parseEmployeeIds,
  parseNameList,
  parseSubDepartmentNames,
};
