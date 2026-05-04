const {
  idParamSchema,
  objectIdField,
  optionalBooleanLike,
  optionalObjectIdField,
  optionalTrimmedString,
  requiredTrimmedString,
  z,
} = require("./common");

const loginSchema = z
  .object({
    loginId: optionalTrimmedString,
    email: optionalTrimmedString,
    password: requiredTrimmedString("Password"),
  })
  .superRefine((value, context) => {
    if (!value.loginId && !value.email) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Login ID or email is required",
        path: ["loginId"],
      });
    }
  })
  .passthrough();

const createUserSchema = z
  .object({
    name: requiredTrimmedString("Name"),
    email: requiredTrimmedString("Email", z.string().email("Email must be valid")),
    password: requiredTrimmedString(
      "Password",
      z.string().min(6, "Password must be at least 6 characters")
    ),
    role: optionalTrimmedString,
    siteId: objectIdField("Site id").optional(),
    site: objectIdField("Site").optional(),
    roleId: objectIdField("Role id").optional(),
    checklistMasterAccess: optionalBooleanLike,
  })
  .passthrough();

const updateUserSchema = z
  .object({
    name: requiredTrimmedString("Name"),
    email: requiredTrimmedString("Email", z.string().email("Email must be valid")),
    password: optionalTrimmedString.refine(
      (value) => value === undefined || value.length >= 6,
      "Password must be at least 6 characters"
    ),
    role: optionalTrimmedString,
    siteId: optionalObjectIdField("Site id"),
    site: optionalObjectIdField("Site"),
    roleId: optionalObjectIdField("Role id"),
    checklistMasterAccess: optionalBooleanLike,
  })
  .passthrough();

module.exports = {
  createUserSchema,
  idParamSchema,
  loginSchema,
  updateUserSchema,
};
