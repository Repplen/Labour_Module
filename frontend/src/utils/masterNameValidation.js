const lettersAndSpacesPattern = /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/;

export const normalizeMasterName = (value) =>
  String(value || "").trim().replace(/\s+/g, " ");

export const validateMasterName = (value, label) => {
  const name = normalizeMasterName(value);

  if (!name) {
    return `${label} name is required.`;
  }

  if (!lettersAndSpacesPattern.test(name)) {
    return `${label} name can contain only letters and spaces.`;
  }

  return "";
};

export const validateCompanyName = (value) => {
  const name = normalizeMasterName(value);

  if (!name) {
    return "Company name is required.";
  }

  if (!lettersAndSpacesPattern.test(name)) {
    return "Company name can contain only letters and spaces.";
  }

  return "";
};

export const getApiFieldError = (error, field = "name") => {
  const errors = Array.isArray(error?.response?.data?.errors)
    ? error.response.data.errors
    : [];
  const row = errors.find(
    (item) => String(item?.field || item?.path || "").trim() === field
  );

  return row?.message || "";
};
