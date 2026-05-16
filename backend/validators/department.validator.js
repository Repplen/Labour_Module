const { z } = require("zod");
const { parseSubDepartmentNames } = require("../helpers/department.helper");

const createValidationError = (field, message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.field = field;
  error.errors = [{ field, message }];
  return error;
};

/**
 * Common name validation regex
 */
const nameRegex =
  /^(?=.*[A-Za-z])[A-Za-z0-9]+(?:[ .&()/_-][A-Za-z0-9]+)*$/;

/**
 * Common reusable name validator
 */
const commonNameValidator = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name cannot exceed 100 characters")
  .regex(
    nameRegex,
    "Invalid Name"
  );

/**
 * Recursive SubDepartment Validator
 */
const SubDepartmentSchema = z.lazy(() =>
  z.object({
    name: commonNameValidator,

    headNames: z
      .array(commonNameValidator)
      .default([]),

    children: z
      .array(SubDepartmentSchema)
      .default([])
  })
);

/**
 * Department Validator
 */
const DepartmentValidator = z.object({
  name: commonNameValidator,

  headNames: z
    .array(commonNameValidator)
    .default([]),

  departmentLeadNames: z
    .array(commonNameValidator)
    .default([]),

  subDepartments: z
    .array(SubDepartmentSchema)
    .default([]),

  isActive: z
    .boolean()
    .default(true)
});

const validateStandardDepartmentName = (value, label) => {
  const result = commonNameValidator.safeParse(value);

  if (result.success) {
    return result.data;
  }

  const message =
    result.error?.issues?.[0]?.message || `${label} name is invalid.`;
  throw createValidationError("name", message);
};

const validateDepartmentRequest = (body = {}) => {
  return {
    name: validateStandardDepartmentName(body.name, "Department"),
  };
};

const validateCreateSubDepartmentRequest = (body = {}) => {
  const { names: rawNames, hasBulkPayload } = parseSubDepartmentNames(body);

  if (!rawNames.length) {
    throw createValidationError("name", "Sub department name is required.");
  }

  return {
    names: rawNames.map((item) =>
      validateStandardDepartmentName(item, "Sub department")
    ),
    hasBulkPayload,
  };
};

const validateUpdateSubDepartmentRequest = (body = {}) => {
  return {
    name: validateStandardDepartmentName(body.name, "Sub department"),
  };
};

const sendValidationError = (res, err) =>
  res.status(err.statusCode || 400).json({
    success: false,
    message: err.message,
    errors: err.errors || [{ field: "name", message: err.message }],
  });

const validateDepartmentRequestMiddleware = (req, res, next) => {
  try {
    req.validatedDepartment = validateDepartmentRequest(req.body);
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

const validateCreateSubDepartmentRequestMiddleware = (req, res, next) => {
  try {
    req.validatedSubDepartment = validateCreateSubDepartmentRequest(req.body);
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

const validateUpdateSubDepartmentRequestMiddleware = (req, res, next) => {
  try {
    req.validatedSubDepartment = validateUpdateSubDepartmentRequest(req.body);
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

module.exports = {
  DepartmentValidator,
  SubDepartmentSchema,
  validateCreateSubDepartmentRequestMiddleware,
  validateCreateSubDepartmentRequest,
  validateDepartmentRequestMiddleware,
  validateDepartmentRequest,
  validateUpdateSubDepartmentRequestMiddleware,
  validateUpdateSubDepartmentRequest
};
