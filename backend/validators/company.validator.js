const { validateCompanyName } = require("../utils/masterNameValidation");

const objectIdRegex = /^[a-f\d]{24}$/i;
//const objectIdRegex =
 // /^(?=.*[A-Za-z])[A-Za-z0-9]+(?:[ .&()/_-][A-Za-z0-9]+)*$/;

const createValidationError = (field, message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.field = field;
  error.errors = [{ field, message }];
  return error;
};

const validateCompanyRequest = (body = {}) => {
  if (typeof body.name !== "string") {
    throw createValidationError("name", "Company name is required.");
  }

  const { name, error } = validateCompanyName(body.name);

  if (error) {
    throw createValidationError("name", error);
  }

  validateDirectorNames(body.directorNames);
  validateDirectorEmployeeIds(body.directorEmployeeIds);
  validateIsActive(body.isActive);

  return { name };
};

const validateDirectorNames = (directorNames) => {
  if (directorNames === undefined) return;

  if (!Array.isArray(directorNames)) {
    throw createValidationError("directorNames", "Director names must be an array.");
  }

  directorNames.forEach((item, index) => {
    if (typeof item !== "string") {
      throw createValidationError(
        `directorNames.${index}`,
        "Each director name must be a string."
      );
    }

    if (!item.trim()) {
      throw createValidationError(
        `directorNames.${index}`,
        "Director name must not be empty."
      );
    }
  });
};

const validateDirectorEmployeeIds = (directorEmployeeIds) => {
  if (directorEmployeeIds === undefined) return;

  if (!Array.isArray(directorEmployeeIds)) {
    throw createValidationError(
      "directorEmployeeIds",
      "Director employee IDs must be an array."
    );
  }

  directorEmployeeIds.forEach((item, index) => {
    if (typeof item !== "string") {
      throw createValidationError(
        `directorEmployeeIds.${index}`,
        "Each director employee ID must be a string."
      );
    }

    if (!objectIdRegex.test(item.trim())) {
      throw createValidationError(
        `directorEmployeeIds.${index}`,
        "Invalid employee ID format."
      );
    }
  });
};

const validateIsActive = (isActive) => {
  if (isActive === undefined) return;

  if (typeof isActive !== "boolean") {
    throw createValidationError("isActive", "isActive must be a boolean.");
  }
};

const sendValidationError = (res, err) =>
  res.status(err.statusCode || 400).json({
    success: false,
    message: err.message,
    errors: err.errors || [{ field: err.field || "name", message: err.message }],
  });

const validateCompanyRequestMiddleware = (req, res, next) => {
  try {
    req.validatedCompany = validateCompanyRequest(req.body);
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

module.exports = {
  validateCompanyRequest,
  validateCompanyRequestMiddleware,
};
