const { z } = require("zod");
const {
  VALID_LOCATION_NAME_REGEX,
  createMainLocationError,
  normalizeLocationName,
  normalizeOptionalObjectId,
} = require("../helpers/mainLocation.helper");

const locationNameSchema = z
  .string()
  .transform((value) => normalizeLocationName(value))
  .refine((value) => Boolean(value), "Location name is required.")
  .refine((value) => VALID_LOCATION_NAME_REGEX.test(value), {
    message: "Location name must contain valid text.",
  });

const booleanSchema = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.trim().toLowerCase() === "true";
    return undefined;
  });

const createSchema = z.object({
  siteId: z
    .string()
    .transform((value) => normalizeOptionalObjectId(value))
    .optional(),
  locationName: locationNameSchema,
  parentLocationId: z
    .string()
    .transform((value) => normalizeOptionalObjectId(value))
    .optional(),
});

const updateSchema = z.object({
  locationName: locationNameSchema,
});

const statusSchema = z.object({
  isActive: booleanSchema.refine((value) => typeof value === "boolean", {
    message: "isActive must be true or false.",
  }),
  cascadeChildren: booleanSchema.default(false),
});

const sendValidationError = (res, err) =>
  res.status(err.statusCode || 400).json({
    success: false,
    message: err.message,
    errors: err.errors || [{ field: err.field || "locationName", message: err.message }],
  });

const validateWithSchema = (schema, body, targetKey) => {
  const result = schema.safeParse(body || {});
  if (!result.success) {
    const issue = result.error.issues[0];
    throw createMainLocationError(
      issue?.message || "Invalid main location data.",
      400,
      issue?.path?.[0] || "locationName"
    );
  }
  return { [targetKey]: result.data };
};

const validateCreateMainLocationRequestMiddleware = (req, res, next) => {
  try {
    Object.assign(req, validateWithSchema(createSchema, req.body, "validatedMainLocation"));
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

const validateUpdateMainLocationRequestMiddleware = (req, res, next) => {
  try {
    Object.assign(req, validateWithSchema(updateSchema, req.body, "validatedMainLocation"));
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

const validateStatusMainLocationRequestMiddleware = (req, res, next) => {
  try {
    Object.assign(req, validateWithSchema(statusSchema, req.body, "validatedMainLocationStatus"));
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

module.exports = {
  validateCreateMainLocationRequestMiddleware,
  validateStatusMainLocationRequestMiddleware,
  validateUpdateMainLocationRequestMiddleware,
};
