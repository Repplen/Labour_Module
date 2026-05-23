const { z } = require("zod");
const {
  createLabourPieceWorkerError,
  normalizeOptionalObjectId,
  normalizeText,
  normalizeWorkerCode,
} = require("../helpers/labourPieceWorker.helper");

const booleanSchema = z.union([z.boolean(), z.string()]).optional().transform((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "yes", "1"].includes(value.trim().toLowerCase());
  return undefined;
});

const optionalNumberSchema = z.union([z.number(), z.string(), z.null()]).optional().transform((value) => {
  if (value === "" || value === null || typeof value === "undefined") return undefined;
  return Number(value);
});

const labourPieceWorkerSchema = z.object({
  workerCode: z.string().transform(normalizeWorkerCode).refine(Boolean, "Worker code is required."),
  workerName: z.string().transform(normalizeText).refine(Boolean, "Worker name is required."),
  workerType: z.string().transform(normalizeText).refine(Boolean, "Worker type is required."),
  labourCategory: z.string().transform(normalizeText).refine(Boolean, "Labour category is required."),
  natureOfWorkId: z.string().optional().transform((value) => normalizeOptionalObjectId(value)).default(""),
  subNatureOfWorkId: z.string().optional().transform((value) => normalizeOptionalObjectId(value)).default(""),
  uomId: z.string().optional().transform((value) => normalizeOptionalObjectId(value)).default(""),
  rateType: z.string().transform(normalizeText).refine(Boolean, "Rate type is required."),
  standardRate: optionalNumberSchema,
  overtimeRate: optionalNumberSchema,
  pieceRate: optionalNumberSchema,
  gstApplicable: booleanSchema.default(false),
  gstPercent: optionalNumberSchema,
  description: z.string().transform(normalizeText).optional().default(""),
  isActive: booleanSchema.default(true),
});

const statusSchema = z.object({
  isActive: booleanSchema.refine((value) => typeof value === "boolean", {
    message: "isActive must be true or false.",
  }),
});

const sendValidationError = (res, err) =>
  res.status(err.statusCode || 400).json({
    success: false,
    message: err.message,
    errors: err.errors || [{ field: err.field || "workerName", message: err.message }],
  });

const validateWithSchema = (schema, body, targetKey) => {
  const result = schema.safeParse(body || {});
  if (!result.success) {
    const issue = result.error.issues[0];
    throw createLabourPieceWorkerError(
      issue?.message || "Invalid labour/piece worker data.",
      400,
      issue?.path?.[0] || "workerName"
    );
  }
  return { [targetKey]: result.data };
};

const validateCreateLabourPieceWorkerRequestMiddleware = (req, res, next) => {
  try {
    Object.assign(req, validateWithSchema(labourPieceWorkerSchema, req.body, "validatedLabourPieceWorker"));
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

const validateUpdateLabourPieceWorkerRequestMiddleware = validateCreateLabourPieceWorkerRequestMiddleware;

const validateStatusLabourPieceWorkerRequestMiddleware = (req, res, next) => {
  try {
    Object.assign(req, validateWithSchema(statusSchema, req.body, "validatedLabourPieceWorkerStatus"));
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

module.exports = {
  validateCreateLabourPieceWorkerRequestMiddleware,
  validateStatusLabourPieceWorkerRequestMiddleware,
  validateUpdateLabourPieceWorkerRequestMiddleware,
};
