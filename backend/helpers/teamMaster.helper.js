const mongoose = require("mongoose");
const { normalizeMasterName } = require("../utils/masterNameValidation");
const { calculateEmployeeWorkRates, roundCurrency, toBoolean } = require("./employeeWorkRate.helper");

const TEAM_CODE_REGEX = /^[A-Za-z0-9]+(?:[-_/][A-Za-z0-9]+)*$/;
const TEAM_NAME_REGEX = /^(?=.*[A-Za-z0-9])[A-Za-z0-9]+(?:[ .&()/_-][A-Za-z0-9]+)*$/;
const LABOUR_TEAM_CATEGORIES = ["Skilled", "Semi-Skilled", "Unskilled", "Mixed Team", "Other"];
const LABOUR_TEAM_RATE_TYPES = ["Per Day", "Per Hour", "Per Job"];
const PIECE_TEAM_RATE_TYPES = ["Per UOM", "Per Piece", "Per Job"];

const normalizeText = (value) => normalizeMasterName(value);
const normalizeTeamCode = (value) => String(value || "").trim().replace(/\s+/g, "").toUpperCase();
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const normalizeOptionalObjectId = (value) => {
  const normalizedValue = String(value || "").trim();
  return normalizedValue && isValidObjectId(normalizedValue) ? normalizedValue : "";
};

const createTeamError = (message, statusCode = 400, field = "") => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errors = field ? [{ field, message }] : [];
  return error;
};

const getAuditUserId = (req) =>
  String(req?.user?.id || req?.user?.principalId || req?.user?._id || "").trim();

const normalizeMemberIds = (members = []) => {
  const rawMembers = Array.isArray(members) ? members : members ? [members] : [];
  const seen = new Set();
  const normalized = [];

  rawMembers.forEach((member) => {
    const employeeId = normalizeOptionalObjectId(member?.employeeId || member);
    if (!employeeId) return;
    if (seen.has(employeeId)) {
      throw createTeamError("This employee is already added to the team.", 400, "members");
    }
    seen.add(employeeId);
    normalized.push(employeeId);
  });

  return normalized;
};

module.exports = {
  LABOUR_TEAM_CATEGORIES,
  LABOUR_TEAM_RATE_TYPES,
  PIECE_TEAM_RATE_TYPES,
  TEAM_CODE_REGEX,
  TEAM_NAME_REGEX,
  calculateEmployeeWorkRates,
  createTeamError,
  escapeRegExp,
  getAuditUserId,
  isValidObjectId,
  normalizeMemberIds,
  normalizeOptionalObjectId,
  normalizeTeamCode,
  normalizeText,
  roundCurrency,
  toBoolean,
};
