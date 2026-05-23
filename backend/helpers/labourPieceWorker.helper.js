const mongoose = require("mongoose");
const { normalizeMasterName } = require("../utils/masterNameValidation");

const WORKER_TYPES = ["Labour", "Piece Worker"];
const LABOUR_CATEGORIES = [
  "Skilled",
  "Semi-Skilled",
  "Unskilled",
  "Supervisor",
  "Contractor Team",
  "Other",
];

const LABOUR_RATE_TYPES = ["Per Day", "Per Hour", "Per Month"];
const PIECE_RATE_TYPES = ["Per UOM", "Per Piece", "Per Job"];
const RATE_TYPES = [...LABOUR_RATE_TYPES, ...PIECE_RATE_TYPES];

const VALID_WORKER_TEXT_REGEX = /^(?=.*[A-Za-z0-9])[A-Za-z0-9]+(?:[ .&()/_-][A-Za-z0-9]+)*$/;
const VALID_WORKER_CODE_REGEX = /^[A-Za-z0-9]+(?:[-_/][A-Za-z0-9]+)*$/;

const normalizeText = (value) => normalizeMasterName(value);
const normalizeWorkerCode = (value) => String(value || "").trim().replace(/\s+/g, "").toUpperCase();
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const normalizeOptionalObjectId = (value) => {
  const normalizedValue = String(value || "").trim();
  return normalizedValue && isValidObjectId(normalizedValue) ? normalizedValue : "";
};

const createLabourPieceWorkerError = (message, statusCode = 400, field = "") => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errors = field ? [{ field, message }] : [];
  return error;
};

const getAuditUserId = (req) =>
  String(req?.user?.id || req?.user?.principalId || req?.user?._id || "").trim();

const roundCurrency = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.round((numericValue + Number.EPSILON) * 100) / 100;
};

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "yes", "1"].includes(value.trim().toLowerCase());
  return Boolean(value);
};

const calculateLabourPieceRates = ({ standardRate, gstApplicable, gstPercent } = {}) => {
  if (standardRate === "" || standardRate === null || typeof standardRate === "undefined") {
    return {
      gstAmount: null,
      grossRate: null,
      netRate: null,
    };
  }

  const baseRate = Number(standardRate);
  const isGstApplicable = toBoolean(gstApplicable);
  const gstRate = isGstApplicable
    ? Number(gstPercent === "" || gstPercent === null || typeof gstPercent === "undefined" ? NaN : gstPercent)
    : 0;

  if (!Number.isFinite(baseRate) || baseRate < 0 || !Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) {
    return {
      gstAmount: null,
      grossRate: null,
      netRate: null,
    };
  }

  const gstAmount = isGstApplicable ? roundCurrency((baseRate * gstRate) / 100) : 0;
  const grossRate = roundCurrency(baseRate + gstAmount);

  return {
    gstAmount,
    grossRate,
    netRate: grossRate,
  };
};

module.exports = {
  LABOUR_CATEGORIES,
  LABOUR_RATE_TYPES,
  PIECE_RATE_TYPES,
  RATE_TYPES,
  VALID_WORKER_CODE_REGEX,
  VALID_WORKER_TEXT_REGEX,
  WORKER_TYPES,
  calculateLabourPieceRates,
  createLabourPieceWorkerError,
  escapeRegExp,
  getAuditUserId,
  isValidObjectId,
  normalizeOptionalObjectId,
  normalizeText,
  normalizeWorkerCode,
  roundCurrency,
  toBoolean,
};
