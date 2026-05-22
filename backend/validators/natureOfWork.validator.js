const { z } = require("zod");
const {
  VALID_WORK_NAME_REGEX,
  createNatureOfWorkError,
  normalizeOptionalObjectId,
  normalizeWorkName,
} = require("../helpers/natureOfWork.helper");

const booleanSchema = z.union([z.boolean(), z.string()]).optional().transform((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return undefined;
});

const optionalNumberSchema = z.union([z.number(), z.string(), z.null()]).optional().transform((value) => {
  if (value === "" || value === null || typeof value === "undefined") return undefined;
  return Number(value);
});

const workNameSchema = z
  .string()
  .transform((value) => normalizeWorkName(value))
  .refine(Boolean, "Work name is required.")
  .refine((value) => VALID_WORK_NAME_REGEX.test(value), "Work name must contain valid text.");

const natureOfWorkSchema = z.object({
  workName: workNameSchema,
  parentWorkId: z.string().transform((value) => normalizeOptionalObjectId(value)).optional(),
  isWorkOutturnRequired: booleanSchema.refine((value) => typeof value === "boolean", {
    message: "Work Outturn Required is required.",
  }),
  uomId: z.string().transform((value) => normalizeOptionalObjectId(value)).optional(),
  customUomName: z.string().transform((value) => normalizeWorkName(value)).optional().default(""),
  length: optionalNumberSchema,
  breadth: optionalNumberSchema,
  height: optionalNumberSchema,
  quantity: optionalNumberSchema,
  outturnDescription: z.string().optional().default(""),
  isActive: booleanSchema.default(true),
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
    errors: err.errors || [{ field: err.field || "workName", message: err.message }],
  });

const validateWithSchema = (schema, body, targetKey) => {
  const result = schema.safeParse(body || {});
  if (!result.success) {
    const issue = result.error.issues[0];
    throw createNatureOfWorkError(
      issue?.message || "Invalid nature of work data.",
      400,
      issue?.path?.[0] || "workName"
    );
  }
  return { [targetKey]: result.data };
};

const validateCreateNatureOfWorkRequestMiddleware = (req, res, next) => {
  try {
    Object.assign(req, validateWithSchema(natureOfWorkSchema, req.body, "validatedNatureOfWork"));
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

const validateUpdateNatureOfWorkRequestMiddleware = validateCreateNatureOfWorkRequestMiddleware;

const validateStatusNatureOfWorkRequestMiddleware = (req, res, next) => {
  try {
    Object.assign(req, validateWithSchema(statusSchema, req.body, "validatedNatureOfWorkStatus"));
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

module.exports = {
  validateCreateNatureOfWorkRequestMiddleware,
  validateStatusNatureOfWorkRequestMiddleware,
  validateUpdateNatureOfWorkRequestMiddleware,
};
