const mongoose = require("mongoose");
const { normalizeMasterName } = require("../utils/masterNameValidation");
const {
  FORMULA_TYPES,
  calculateOutturnQuantity,
  getFormulaFieldsByUom,
  toPositiveNumber,
} = require("./uom.helper");

const VALID_WORK_NAME_REGEX = /^(?=.*[A-Za-z])[A-Za-z0-9]+(?:[ .&()/_-][A-Za-z0-9]+)*$/;

const normalizeWorkName = (value) => normalizeMasterName(value);
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const normalizeOptionalObjectId = (value) => {
  const normalizedValue = String(value || "").trim();
  return normalizedValue && isValidObjectId(normalizedValue) ? normalizedValue : "";
};

const createNatureOfWorkError = (message, statusCode = 400, field = "") => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errors = field ? [{ field, message }] : [];
  return error;
};

const buildWorkPath = (parentPath, workName) =>
  [parentPath, normalizeWorkName(workName)].filter(Boolean).join(" / ");

const getAuditUserId = (req) =>
  String(req?.user?.id || req?.user?.principalId || req?.user?._id || "").trim();

const buildTree = (rows = []) => {
  const byId = new Map();
  const roots = [];

  rows.forEach((row) => {
    const plainRow = typeof row.toObject === "function" ? row.toObject() : { ...row };
    byId.set(String(plainRow._id), { ...plainRow, children: [] });
  });

  byId.forEach((row) => {
    const parentId = row.parentWorkId?._id || row.parentWorkId || "";
    const parent = parentId ? byId.get(String(parentId)) : null;
    if (parent) parent.children.push(row);
    else roots.push(row);
  });

  const sortNodes = (nodes) => {
    nodes.sort((left, right) => String(left.path || "").localeCompare(String(right.path || "")));
    nodes.forEach((node) => sortNodes(node.children || []));
  };

  sortNodes(roots);
  return roots;
};

const getRequiredMeasurementFields = (formulaType) =>
  getFormulaFieldsByUom(formulaType).filter((field) => field !== "outturnDescription");

const validatePositiveMeasurement = (value, field, message) => {
  const numericValue = toPositiveNumber(value);
  if (typeof numericValue === "undefined") {
    throw createNatureOfWorkError(message, 400, field);
  }
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw createNatureOfWorkError("Value must be a positive number.", 400, field);
  }
  return numericValue;
};

const formatNumber = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "";
  return Number.isInteger(numericValue) ? String(numericValue) : String(Number(numericValue.toFixed(3)));
};

const buildOutturnDescription = ({ formulaType, length, breadth, height, quantity, totalQuantity, uomSymbol }) => {
  const symbol = uomSymbol ? ` ${uomSymbol}` : "";
  if (formulaType === FORMULA_TYPES.LENGTH_BREADTH_HEIGHT) {
    return `${formatNumber(length)} × ${formatNumber(breadth)} × ${formatNumber(height)} = ${formatNumber(totalQuantity)}${symbol}`;
  }
  if (formulaType === FORMULA_TYPES.LENGTH_BREADTH) {
    return `${formatNumber(length)} × ${formatNumber(breadth)} = ${formatNumber(totalQuantity)}${symbol}`;
  }
  if (formulaType === FORMULA_TYPES.LENGTH) {
    return `${formatNumber(length)}${symbol}`;
  }
  if (formulaType === FORMULA_TYPES.QUANTITY || formulaType === FORMULA_TYPES.CUSTOM) {
    return `${formatNumber(quantity)}${symbol}`;
  }
  return "";
};

const calculateAndDescribeOutturn = (payload) => {
  const totalQuantity = calculateOutturnQuantity(payload);
  return {
    totalQuantity,
    outturnDescription: buildOutturnDescription({ ...payload, totalQuantity }),
  };
};

module.exports = {
  VALID_WORK_NAME_REGEX,
  buildTree,
  buildWorkPath,
  calculateAndDescribeOutturn,
  createNatureOfWorkError,
  escapeRegExp,
  getAuditUserId,
  getRequiredMeasurementFields,
  isValidObjectId,
  normalizeOptionalObjectId,
  normalizeWorkName,
  validatePositiveMeasurement,
};
