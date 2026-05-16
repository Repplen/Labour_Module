const { z, idParamSchema } = require("./common");

// Trims and collapses internal whitespace before Zod validates
const designationNameSchema = z.preprocess(
  (value) =>
    typeof value === "string" ? value.trim().replace(/\s+/g, " ") : value,
  z
    .string({ required_error: "Designation name is required." })
    .min(1, "Designation name is required.")
    .min(2, "Designation name must be at least 2 characters.")
    .max(100, "Designation name must not exceed 100 characters.")
    .refine((value) => /[a-zA-Z0-9]/.test(value), {
      message: "Designation name must contain at least one letter or number.",
    })
);

const designationBodySchema = z.object({
  name: designationNameSchema,
});

module.exports = { designationBodySchema, designationNameSchema, idParamSchema };
