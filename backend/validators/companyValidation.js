const { z } = require("zod");



const companyNameSchema = z
  .string({ required_error: "Company name is required." })
  .trim()
  .min(1, "Company name is required.")
  .min(2, "Company name must be at least 2 characters.")
  .max(100, "Company name must not exceed 100 characters.")
  .refine(
    (value) => /[a-zA-Z0-9]/.test(value),
    { message: "Company name must contain at least one letter or number." }
  );


const directorNamesSchema = z
  .array(
    z
      .string({ invalid_type_error: "Each director name must be a string." })
      .trim()
      .min(1, "Director name must not be empty.")
  )
  .default([]);


const directorEmployeeIdsSchema = z
  .array(
    z
      .string({ invalid_type_error: "Each director employee ID must be a string." })
      .trim()
      .regex(/^[a-f\d]{24}$/i, "Invalid employee ID format.")
  )
  .default([]);


const createCompanySchema = z.object({
  name: companyNameSchema,
  directorNames: directorNamesSchema.optional(),
  directorEmployeeIds: directorEmployeeIdsSchema.optional(),
  isActive: z.boolean().default(true).optional(),
});


const updateCompanySchema = z.object({
  name: companyNameSchema.optional(),
  directorNames: directorNamesSchema.optional(),
  directorEmployeeIds: directorEmployeeIdsSchema.optional(),
  isActive: z.boolean().optional(),
});

// ─── Middleware factory ───────────────────────────────────────────────────────

/**
 * Returns an Express middleware that validates req.body against the given
 * Zod schema.  On failure it sends a structured 422 response; on success it
 * replaces req.body with the coerced/trimmed data and calls next().
 *
 * @param {import("zod").ZodTypeAny} schema
 */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const errors = result.error.errors.map((issue) => ({
      field: issue.path.join(".") || "unknown",
      message: issue.message,
    }));

    return res.status(422).json({
      message: "Validation failed.",
      errors,
    });
  }

  req.body = result.data;
  next();
};



module.exports = {
  companyNameSchema,
  directorNamesSchema,
  directorEmployeeIdsSchema,
  createCompanySchema,
  updateCompanySchema,
  validate,
};
