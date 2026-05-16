import { getApiFieldError, validateMasterName } from "../utils/masterNameValidation";

export const duplicateSiteMessage = "This site name already exists.";
export const companyRequiredMessage = "Select company name.";
export const siteRequiredMessage = "Site name is required.";
export const subSiteRequiredMessage = "Sub site name is required.";

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

export const getSiteNameError = ({ name, sites, editingId, shouldShowRequired = false }) => {
  if (!String(name || "").trim()) {
    return shouldShowRequired ? siteRequiredMessage : "";
  }

  const validationMessage = validateMasterName(name, "Site");
  if (validationMessage) return validationMessage;

  const nextName = normalizeMasterNameForCompare(name);
  const hasDuplicate = sites.some(
    (site) =>
      String(site?._id || "") !== String(editingId || "") &&
      normalizeMasterNameForCompare(site?.name) === nextName
  );

  return hasDuplicate ? duplicateSiteMessage : "";
};

export const getCompanyNameError = (companyName, shouldShowRequired = false) => {
  if (!String(companyName || "").trim() && shouldShowRequired) {
    return companyRequiredMessage;
  }

  return "";
};

export const getSubSiteNameError = (subName, shouldShowRequired = false) => {
  const names = parseNames(subName);
  if (!names.length) {
    return shouldShowRequired ? subSiteRequiredMessage : "";
  }

  return names
    .map((item) => validateMasterName(item, "Sub site"))
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
    return duplicateSiteMessage;
  }

  return "";
};

export const getSiteApiFieldError = getApiFieldError;
