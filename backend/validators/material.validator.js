const { z } = require("zod");
const {
  createMaterialError,
  normalizeMaterialCode,
  normalizeOptionalObjectId,
  normalizeText,
} = require("../helpers/material.helper");

const booleanSchema = z.union([z.boolean(), z.string()]).optional().transform((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return undefined;
});

const optionalNumberSchema = z.union([z.number(), z.string(), z.null()]).optional().transform((value) => {
  if (value === "" || value === null || typeof value === "undefined") return undefined;
  return Number(value);
});

const materialSchema = z.object({
  materialCode: z.string().transform(normalizeMaterialCode).refine(Boolean, "Material code is required."),
  materialName: z.string().transform(normalizeText).refine(Boolean, "Material name is required."),
  category: z.string().transform(normalizeText).refine(Boolean, "Material category is required."),
  uomId: z.string().transform((value) => normalizeOptionalObjectId(value)).refine(Boolean, "UOM is required."),
  materialType: z.string().transform(normalizeText).optional().default(""),
  brand: z.string().transform(normalizeText).optional().default(""),
  specification: z.string().transform(normalizeText).optional().default(""),
  description: z.string().transform(normalizeText).optional().default(""),
  standardRate: optionalNumberSchema,
  gstPercent: optionalNumberSchema,
  minimumStock: optionalNumberSchema,
  openingStock: optionalNumberSchema,
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
    errors: err.errors || [{ field: err.field || "materialName", message: err.message }],
  });

const validateWithSchema = (schema, body, targetKey) => {
  const result = schema.safeParse(body || {});
  if (!result.success) {
    const issue = result.error.issues[0];
    throw createMaterialError(
      issue?.message || "Invalid material data.",
      400,
      issue?.path?.[0] || "materialName"
    );
  }
  return { [targetKey]: result.data };
};

const validateCreateMaterialRequestMiddleware = (req, res, next) => {
  try {
    Object.assign(req, validateWithSchema(materialSchema, req.body, "validatedMaterial"));
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

const validateUpdateMaterialRequestMiddleware = validateCreateMaterialRequestMiddleware;

const validateStatusMaterialRequestMiddleware = (req, res, next) => {
  try {
    Object.assign(req, validateWithSchema(statusSchema, req.body, "validatedMaterialStatus"));
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

module.exports = {
  validateCreateMaterialRequestMiddleware,
  validateStatusMaterialRequestMiddleware,
  validateUpdateMaterialRequestMiddleware,
};
