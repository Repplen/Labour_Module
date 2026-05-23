const { z } = require("zod");
const {
  createEquipmentError,
  normalizeEquipmentCode,
  normalizeOptionalObjectId,
  normalizeText,
} = require("../helpers/equipment.helper");

const booleanSchema = z.union([z.boolean(), z.string()]).optional().transform((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return undefined;
});

const optionalNumberSchema = z.union([z.number(), z.string(), z.null()]).optional().transform((value) => {
  if (value === "" || value === null || typeof value === "undefined") return undefined;
  return Number(value);
});

const equipmentSchema = z.object({
  equipmentCode: z.string().transform(normalizeEquipmentCode).refine(Boolean, "Equipment code is required."),
  equipmentName: z.string().transform(normalizeText).refine(Boolean, "Equipment name is required."),
  category: z.string().transform(normalizeText).refine(Boolean, "Equipment category is required."),
  equipmentType: z.string().transform(normalizeText).optional().default(""),
  uomId: z.string().transform((value) => normalizeOptionalObjectId(value)).refine(Boolean, "UOM is required."),
  brand: z.string().transform(normalizeText).optional().default(""),
  modelNumber: z.string().transform(normalizeText).optional().default(""),
  serialNumber: z.string().transform(normalizeText).optional().default(""),
  registrationNumber: z.string().transform(normalizeText).optional().default(""),
  capacitySize: z.string().transform(normalizeText).optional().default(""),
  fuelType: z.string().transform(normalizeText).optional().default(""),
  description: z.string().transform(normalizeText).optional().default(""),
  standardRate: optionalNumberSchema,
  gstPercent: optionalNumberSchema,
  minimumAvailability: optionalNumberSchema,
  openingQuantity: optionalNumberSchema,
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
    errors: err.errors || [{ field: err.field || "equipmentName", message: err.message }],
  });

const validateWithSchema = (schema, body, targetKey) => {
  const result = schema.safeParse(body || {});
  if (!result.success) {
    const issue = result.error.issues[0];
    throw createEquipmentError(
      issue?.message || "Invalid equipment data.",
      400,
      issue?.path?.[0] || "equipmentName"
    );
  }
  return { [targetKey]: result.data };
};

const validateCreateEquipmentRequestMiddleware = (req, res, next) => {
  try {
    Object.assign(req, validateWithSchema(equipmentSchema, req.body, "validatedEquipment"));
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

const validateUpdateEquipmentRequestMiddleware = validateCreateEquipmentRequestMiddleware;

const validateStatusEquipmentRequestMiddleware = (req, res, next) => {
  try {
    Object.assign(req, validateWithSchema(statusSchema, req.body, "validatedEquipmentStatus"));
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

module.exports = {
  validateCreateEquipmentRequestMiddleware,
  validateStatusEquipmentRequestMiddleware,
  validateUpdateEquipmentRequestMiddleware,
};
