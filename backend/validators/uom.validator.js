const { z } = require("zod");
const { FORMULA_TYPES, createUomError, normalizeCode, normalizeText } = require("../helpers/uom.helper");

const booleanSchema = z.union([z.boolean(), z.string()]).optional().transform((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return undefined;
});

const uomSchema = z.object({
  uomName: z.string().transform(normalizeText).refine(Boolean, "UOM name is required."),
  shortCode: z.string().transform(normalizeCode).refine(Boolean, "Short code is required."),
  symbol: z.string().transform(normalizeText).optional().default(""),
  category: z.string().transform(normalizeText).optional().default("Other"),
  formulaType: z.enum(Object.values(FORMULA_TYPES)),
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
    errors: err.errors || [{ field: err.field || "uomName", message: err.message }],
  });

const validateWithSchema = (schema, body, targetKey) => {
  const result = schema.safeParse(body || {});
  if (!result.success) {
    const issue = result.error.issues[0];
    throw createUomError(issue?.message || "Invalid UOM data.", 400, issue?.path?.[0] || "uomName");
  }
  return { [targetKey]: result.data };
};

const validateCreateUomRequestMiddleware = (req, res, next) => {
  try {
    Object.assign(req, validateWithSchema(uomSchema, req.body, "validatedUom"));
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

const validateStatusUomRequestMiddleware = (req, res, next) => {
  try {
    Object.assign(req, validateWithSchema(statusSchema, req.body, "validatedUomStatus"));
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

module.exports = {
  validateCreateUomRequestMiddleware,
  validateStatusUomRequestMiddleware,
};
