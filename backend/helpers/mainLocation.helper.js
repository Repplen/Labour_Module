const mongoose = require("mongoose");
const { normalizeMasterName } = require("../utils/masterNameValidation");

const MAIN_LOCATION_MODULE_KEY = "main_location";
const VALID_LOCATION_NAME_REGEX = /^(?=.*[A-Za-z])[A-Za-z0-9]+(?:[ .&()/_-][A-Za-z0-9]+)*$/;

const normalizeLocationName = (value) => normalizeMasterName(value);

const createMainLocationError = (message, statusCode = 400, field = "") => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errors = field ? [{ field, message }] : [];
  return error;
};

const escapeRegExp = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));

const normalizeOptionalObjectId = (value) => {
  const normalizedValue = String(value || "").trim();
  return normalizedValue && isValidObjectId(normalizedValue) ? normalizedValue : "";
};

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
    const parentId = row.parentLocationId ? String(row.parentLocationId) : "";
    const parent = parentId ? byId.get(parentId) : null;

    if (parent) {
      parent.children.push(row);
    } else {
      roots.push(row);
    }
  });

  const sortNodes = (nodes) => {
    nodes.sort((left, right) =>
      String(left.locationName || "").localeCompare(String(right.locationName || ""))
    );
    nodes.forEach((node) => sortNodes(node.children || []));
  };

  sortNodes(roots);
  return roots;
};

module.exports = {
  MAIN_LOCATION_MODULE_KEY,
  VALID_LOCATION_NAME_REGEX,
  buildTree,
  createMainLocationError,
  escapeRegExp,
  getAuditUserId,
  isValidObjectId,
  normalizeLocationName,
  normalizeOptionalObjectId,
};
