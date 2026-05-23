const mongoose = require("mongoose");
const { normalizeMasterName } = require("../utils/masterNameValidation");

const MATERIAL_CATEGORIES = [
  "Cement",
  "Brick",
  "Steel",
  "Sand",
  "Aggregate",
  "Paint",
  "Electrical",
  "Plumbing",
  "Wood",
  "Hardware",
  "Others",
];

const MATERIAL_TYPES = [
  "Consumable",
  "Non-Consumable",
  "Asset",
  "Tool",
  "Equipment",
  "Raw Material",
  "Finished Material",
];

const VALID_MATERIAL_TEXT_REGEX = /^(?=.*[A-Za-z0-9])[A-Za-z0-9]+(?:[ .&()/_-][A-Za-z0-9]+)*$/;
const VALID_MATERIAL_CODE_REGEX = /^[A-Za-z0-9]+(?:[-_/][A-Za-z0-9]+)*$/;

const normalizeText = (value) => normalizeMasterName(value);
const normalizeMaterialCode = (value) => String(value || "").trim().replace(/\s+/g, "").toUpperCase();
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const normalizeOptionalObjectId = (value) => {
  const normalizedValue = String(value || "").trim();
  return normalizedValue && isValidObjectId(normalizedValue) ? normalizedValue : "";
};

const createMaterialError = (message, statusCode = 400, field = "") => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errors = field ? [{ field, message }] : [];
  return error;
};

const getAuditUserId = (req) =>
  String(req?.user?.id || req?.user?.principalId || req?.user?._id || "").trim();

const toOptionalNonNegativeNumber = (value) => {
  if (value === "" || value === null || typeof value === "undefined") return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : NaN;
};

const toOptionalPositiveNumber = (value) => {
  if (value === "" || value === null || typeof value === "undefined") return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : NaN;
};

const roundCurrency = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.round((numericValue + Number.EPSILON) * 100) / 100;
};

const calculateMaterialRates = ({ standardRate, gstPercent } = {}) => {
  if (standardRate === "" || standardRate === null || typeof standardRate === "undefined") {
    return {
      gstAmount: null,
      grossRate: null,
      netRate: null,
    };
  }

  const baseRate = Number(standardRate);
  const gstRate = gstPercent === "" || gstPercent === null || typeof gstPercent === "undefined"
    ? 0
    : Number(gstPercent);

  if (!Number.isFinite(baseRate) || baseRate < 0 || !Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) {
    return {
      gstAmount: null,
      grossRate: null,
      netRate: null,
    };
  }

  const gstAmount = roundCurrency((baseRate * gstRate) / 100);
  const grossRate = roundCurrency(baseRate + gstAmount);

  return {
    gstAmount,
    grossRate,
    netRate: grossRate,
  };
};

module.exports = {
  MATERIAL_CATEGORIES,
  MATERIAL_TYPES,
  VALID_MATERIAL_CODE_REGEX,
  VALID_MATERIAL_TEXT_REGEX,
  calculateMaterialRates,
  createMaterialError,
  escapeRegExp,
  getAuditUserId,
  isValidObjectId,
  normalizeMaterialCode,
  normalizeOptionalObjectId,
  normalizeText,
  roundCurrency,
  toOptionalNonNegativeNumber,
  toOptionalPositiveNumber,
};
