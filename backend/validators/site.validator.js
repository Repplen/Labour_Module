const { z } = require("zod");
const { parseNamesPayload } = require("../helpers/site.helper");

const createValidationError = (field, message) => {
  const error = new Error(message);
  error.statusCode = 400;
  error.field = field;
  error.errors = [{ field, message }];
  return error;
};

const nameRegex =
  /^(?=.*[A-Za-z])[A-Za-z0-9]+(?:[ .&()/_-][A-Za-z0-9]+)*$/;

const commonNameValidator = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name cannot exceed 100 characters")
  .regex(nameRegex, "Invalid Name");

const SubSiteSchema = z.lazy(() =>
  z.object({
    name: commonNameValidator,
    headNames: z.array(commonNameValidator).default([]),
    children: z.array(SubSiteSchema).default([]),
  })
);

const SiteValidator = z.object({
  companyName: commonNameValidator,
  name: commonNameValidator,
  headNames: z.array(commonNameValidator).default([]),
  siteLeadNames: z.array(commonNameValidator).default([]),
  subSites: z.array(SubSiteSchema).default([]),
  isActive: z.boolean().default(true),
});

const validateStandardName = (value, label, field = "name") => {
  const result = commonNameValidator.safeParse(value);

  if (result.success) {
    return result.data;
  }

  const message = result.error?.issues?.[0]?.message || `${label} name is invalid.`;
  throw createValidationError(field, message);
};

const validateCreateSiteRequest = (body = {}) => {
  const companyName = validateStandardName(body.companyName, "Company", "companyName");
  const { names: rawNames, hasBulkPayload } = parseNamesPayload(body);

  if (!rawNames.length) {
    throw createValidationError("name", "Site name is required.");
  }

  const names = rawNames.map((item) => validateStandardName(item, "Site"));

  if (hasBulkPayload && names.length > 1) {
    const error = new Error("Only one site name can be added at a time in Site Master");
    error.statusCode = 400;
    throw error;
  }

  return {
    companyName,
    name: names[0],
    names,
    hasBulkPayload,
  };
};

const validateUpdateSiteRequest = (body = {}) => ({
  companyName: validateStandardName(body.companyName, "Company", "companyName"),
  name: validateStandardName(body.name, "Site"),
});

const validateCreateSubSiteRequest = (body = {}) => {
  const { names: rawNames, hasBulkPayload } = parseNamesPayload(body);

  if (!rawNames.length) {
    throw createValidationError("name", "Sub site name is required.");
  }

  return {
    names: rawNames.map((item) => validateStandardName(item, "Sub site")),
    hasBulkPayload,
  };
};

const validateUpdateSubSiteRequest = (body = {}) => ({
  name: validateStandardName(body.name, "Sub site"),
});

const sendValidationError = (res, err) =>
  res.status(err.statusCode || 400).json({
    success: false,
    message: err.message,
    errors: err.errors || [{ field: err.field || "name", message: err.message }],
  });

const validateCreateSiteRequestMiddleware = (req, res, next) => {
  try {
    req.validatedSite = validateCreateSiteRequest(req.body);
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

const validateUpdateSiteRequestMiddleware = (req, res, next) => {
  try {
    req.validatedSite = validateUpdateSiteRequest(req.body);
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

const validateCreateSubSiteRequestMiddleware = (req, res, next) => {
  try {
    req.validatedSubSite = validateCreateSubSiteRequest(req.body);
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

const validateUpdateSubSiteRequestMiddleware = (req, res, next) => {
  try {
    req.validatedSubSite = validateUpdateSubSiteRequest(req.body);
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

module.exports = {
  SiteValidator,
  SubSiteSchema,
  validateCreateSiteRequest,
  validateCreateSiteRequestMiddleware,
  validateCreateSubSiteRequest,
  validateCreateSubSiteRequestMiddleware,
  validateUpdateSiteRequest,
  validateUpdateSiteRequestMiddleware,
  validateUpdateSubSiteRequest,
  validateUpdateSubSiteRequestMiddleware,
};
