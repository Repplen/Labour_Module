const mongoose = require("mongoose");
const { normalizeMasterName } = require("../utils/masterNameValidation");

const EQUIPMENT_CATEGORIES = [
  "Machinery",
  "Vehicle",
  "Tool",
  "Equipment",
  "Electrical Equipment",
  "Construction Equipment",
  "Safety Equipment",
  "Other",
];

const EQUIPMENT_TYPES = [
  "Owned",
  "Rental",
  "Lease",
  "Contractor Provided",
  "Company Provided",
];

const FUEL_TYPES = ["Diesel", "Petrol", "Electric", "Battery", "Manual", "NA"];

const VALID_EQUIPMENT_TEXT_REGEX = /^(?=.*[A-Za-z0-9])[A-Za-z0-9]+(?:[ .&()/_-][A-Za-z0-9]+)*$/;
const VALID_EQUIPMENT_CODE_REGEX = /^[A-Za-z0-9]+(?:[-_/][A-Za-z0-9]+)*$/;

const normalizeText = (value) => normalizeMasterName(value);
const normalizeEquipmentCode = (value) => String(value || "").trim().replace(/\s+/g, "").toUpperCase();
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const normalizeOptionalObjectId = (value) => {
  const normalizedValue = String(value || "").trim();
  return normalizedValue && isValidObjectId(normalizedValue) ? normalizedValue : "";
};

const createEquipmentError = (message, statusCode = 400, field = "") => {
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

const calculateEquipmentRates = ({ standardRate, gstPercent } = {}) => {
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
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_TYPES,
  FUEL_TYPES,
  VALID_EQUIPMENT_CODE_REGEX,
  VALID_EQUIPMENT_TEXT_REGEX,
  calculateEquipmentRates,
  createEquipmentError,
  escapeRegExp,
  getAuditUserId,
  isValidObjectId,
  normalizeEquipmentCode,
  normalizeOptionalObjectId,
  normalizeText,
  roundCurrency,
};
