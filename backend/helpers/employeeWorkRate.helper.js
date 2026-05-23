const mongoose = require("mongoose");
const { normalizeMasterName } = require("../utils/masterNameValidation");

const EMPLOYEE_WORK_TYPES = ["General Employee", "Labour", "Piece Worker"];
const EMPLOYEE_SKILL_TYPES = [
  "Skilled",
  "Semi-Skilled",
  "Unskilled",
  "Mason",
  "Helper",
  "Carpenter",
  "Painter",
  "Electrician",
  "Plumber",
  "Bar Bender",
  "Tile Worker",
  "Welder",
  "Driver",
  "Operator",
  "Other",
];
const LABOUR_RATE_TYPES = ["Per Day", "Per Hour", "Per Month"];
const PIECE_WORKER_RATE_TYPES = ["Per UOM", "Per Piece", "Per Job"];

const normalizeText = (value) => normalizeMasterName(value);
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const normalizeOptionalObjectId = (value) => {
  const normalizedValue = String(value || "").trim();
  return normalizedValue && isValidObjectId(normalizedValue) ? normalizedValue : "";
};

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "yes", "1", "on"].includes(value.trim().toLowerCase());
  return Boolean(value);
};

const roundCurrency = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.round((numericValue + Number.EPSILON) * 100) / 100;
};

const calculateEmployeeWorkRates = ({ standardRate, gstApplicable, gstPercent } = {}) => {
  if (standardRate === "" || standardRate === null || typeof standardRate === "undefined") {
    return {
      gstAmount: null,
      grossRate: null,
      netRate: null,
    };
  }

  const baseRate = Number(standardRate);
  const hasGst = toBoolean(gstApplicable);
  const gstRate = hasGst
    ? Number(gstPercent === "" || gstPercent === null || typeof gstPercent === "undefined" ? NaN : gstPercent)
    : 0;

  if (!Number.isFinite(baseRate) || baseRate < 0 || !Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) {
    return {
      gstAmount: null,
      grossRate: null,
      netRate: null,
    };
  }

  const gstAmount = hasGst ? roundCurrency((baseRate * gstRate) / 100) : 0;
  const grossRate = roundCurrency(baseRate + gstAmount);

  return {
    gstAmount,
    grossRate,
    netRate: grossRate,
  };
};

const createEmployeeWorkError = (message, status = 400, field = "") => {
  const error = new Error(message);
  error.status = status;
  error.errors = field ? [{ field, message }] : [];
  return error;
};

module.exports = {
  EMPLOYEE_SKILL_TYPES,
  EMPLOYEE_WORK_TYPES,
  LABOUR_RATE_TYPES,
  PIECE_WORKER_RATE_TYPES,
  calculateEmployeeWorkRates,
  createEmployeeWorkError,
  normalizeOptionalObjectId,
  normalizeText,
  roundCurrency,
  toBoolean,
};
