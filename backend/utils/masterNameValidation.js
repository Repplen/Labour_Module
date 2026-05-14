const lettersAndSpacesPattern = /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/;

const normalizeMasterName = (value) => String(value || "").trim().replace(/\s+/g, " ");

const validateMasterName = (value, label) => {
  const name = normalizeMasterName(value);

  if (!name) {
    return {
      name,
      error: `${label} name is required.`,
    };
  }

  if (!lettersAndSpacesPattern.test(name)) {
    return {
      name,
      error: `${label} name can contain only letters and spaces.`,
    };
  }

  return { name, error: "" };
};

const validateCompanyName = (value) => {
  const name = normalizeMasterName(value);

  if (!name) {
    return {
      name,
      error: "Company name is required.",
    };
  }

  if (!lettersAndSpacesPattern.test(name)) {
    return {
      name,
      error: "Company name can contain only letters and spaces.",
    };
  }

  return { name, error: "" };
};

const sendMasterNameValidationError = (res, field, message) =>
  res.status(400).json({
    success: false,
    message: "Validation failed",
    errors: [{ field, message }],
  });

module.exports = {
  normalizeMasterName,
  sendMasterNameValidationError,
  validateCompanyName,
  validateMasterName,
};
