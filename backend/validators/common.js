const { z } = require("zod");

const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

const trimValue = (value) => {
  if (value === undefined || value === null) return value;
  return typeof value === "string" ? value.trim() : String(value).trim();
};

const normalizeBooleanInput = (value) => String(value ?? "").trim().toLowerCase();

const optionalTrimmedString = z.preprocess(
  (value) => {
    const trimmed = trimValue(value);
    return trimmed === "" ? undefined : trimmed;
  },
  z.string().optional()
);

const requiredTrimmedString = (label, schema = z.string()) =>
  z.preprocess(trimValue, schema.min(1, `${label} is required`));

const objectIdField = (label) =>
  z.preprocess(
    trimValue,
    z.string().regex(objectIdPattern, `${label} must be a valid id`)
  );

const optionalObjectIdField = (label) =>
  z.preprocess(
    (value) => {
      const trimmed = trimValue(value);
      return trimmed === "" || trimmed === null ? undefined : trimmed;
    },
    z.string().regex(objectIdPattern, `${label} must be a valid id`).optional()
  );

const idParamSchema = z.object({
  id: objectIdField("Id"),
});

const notificationIdParamSchema = z.object({
  notificationId: objectIdField("Notification id"),
});

const booleanLike = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  const normalized = normalizeBooleanInput(value);
  if (!normalized) return false;
  return ["true", "1", "yes", "on"].includes(normalized);
}, z.boolean());

const optionalBooleanLike = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const normalized = normalizeBooleanInput(value);
  return ["true", "1", "yes", "on"].includes(normalized);
}, z.boolean().optional());

const numberLike = (label, { min } = {}) => {
  let schema = z.number({
    invalid_type_error: `${label} must be a number`,
  });

  if (typeof min === "number") {
    schema = schema.min(min, `${label} must be at least ${min}`);
  }

  return z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : value;
  }, schema);
};

const optionalNumberLike = ({ min } = {}) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : value;
  }, typeof min === "number" ? z.number().min(min).optional() : z.number().optional());

const dateStringField = (label) =>
  requiredTrimmedString(label).refine(
    (value) => !Number.isNaN(new Date(value).getTime()),
    `${label} must be a valid date`
  );

const optionalDateStringField = z.preprocess(
  (value) => {
    const trimmed = trimValue(value);
    return trimmed === "" ? undefined : trimmed;
  },
  z
    .string()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Date must be valid")
    .optional()
);

const timeStringField = (label) =>
  requiredTrimmedString(label).refine(
    (value) => timePattern.test(value),
    `${label} must be in HH:mm format`
  );

module.exports = {
  z,
  booleanLike,
  dateStringField,
  idParamSchema,
  notificationIdParamSchema,
  numberLike,
  objectIdField,
  optionalBooleanLike,
  optionalDateStringField,
  optionalNumberLike,
  optionalObjectIdField,
  optionalTrimmedString,
  requiredTrimmedString,
  timeStringField,
};
