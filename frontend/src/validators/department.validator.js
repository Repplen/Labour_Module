import { getApiFieldError, validateMasterName } from "../utils/masterNameValidation";

export const duplicateDepartmentMessage = "This department name already exists.";

export const parseNames = (value) => {
  const seen = new Set();
  return String(value || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const normalizeMasterNameForCompare = (value) =>
  String(value || "").trim().toLowerCase();

export const getDepartmentNameError = ({ name, departments, editingId }) => {
  const validationMessage = validateMasterName(name, "Department");
  if (validationMessage) return validationMessage;

  const nextName = normalizeMasterNameForCompare(name);
  const hasDuplicate = departments.some(
    (department) =>
      String(department?._id || "") !== String(editingId || "") &&
      normalizeMasterNameForCompare(department?.name) === nextName
  );

  return hasDuplicate ? duplicateDepartmentMessage : "";
};

export const getSubDepartmentNameError = (subName) => {
  const names = parseNames(subName);
  if (!names.length) return "";

  return names
    .map((item) => validateMasterName(item, "Sub department"))
    .find(Boolean) || "";
};

export const getApiNameDuplicateError = (error) => {
  const errors = Array.isArray(error?.response?.data?.errors)
    ? error.response.data.errors
    : [];
  const hasNameError = errors.some(
    (row) => String(row?.field || row?.path || "").trim() === "name"
  );

  if (error?.response?.status === 409 && hasNameError) {
    return duplicateDepartmentMessage;
  }

  return "";
};

export const getDepartmentApiFieldError = getApiFieldError;
