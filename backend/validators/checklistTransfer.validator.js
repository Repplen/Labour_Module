const { Types } = require("mongoose");
const { normalizeText } = require("../helpers/checklistTransfer.helper");

const isValidObjectId = (value) => Types.ObjectId.isValid(normalizeText(value));

const normalizeChecklistIds = (value) => {
  const checklistIds = Array.isArray(value)
    ? value.map((id) => normalizeText(id)).filter(Boolean)
    : [];

  return [...new Set(checklistIds)];
};

const validateTransferPayload = (body = {}) => {
  const fromEmployeeId = normalizeText(body?.fromEmployeeId);
  const toEmployeeId = normalizeText(body?.toEmployeeId);
  const checklistIds = normalizeChecklistIds(body?.checklistIds);

  if (!isValidObjectId(fromEmployeeId)) {
    return { message: "Select a valid From Employee", status: 400 };
  }

  if (!isValidObjectId(toEmployeeId)) {
    return { message: "Select a valid To Employee", status: 400 };
  }

  if (fromEmployeeId === toEmployeeId) {
    return {
      message: "From Employee and To Employee cannot be the same",
      status: 400,
    };
  }

  if (!checklistIds.length) {
    return { message: "Select at least one checklist to transfer", status: 400 };
  }

  if (checklistIds.some((id) => !isValidObjectId(id))) {
    return {
      message: "One or more selected checklists are invalid",
      status: 400,
    };
  }

  return {
    value: {
      fromEmployeeId,
      toEmployeeId,
      checklistIds,
    },
  };
};

const parseTransferHistoryLimit = (value, fallback = 20) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return fallback;
  return Math.min(100, Math.max(1, Math.floor(parsedValue)));
};

module.exports = {
  parseTransferHistoryLimit,
  validateTransferPayload,
};
