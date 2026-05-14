const {
  idParamSchema,
  objectIdField,
  optionalBooleanLike,
  optionalObjectIdField,
  optionalTrimmedString,
  requiredTrimmedString,
  z,
} = require("./common");

const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const userNamePattern = /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/;

const userNameField = z.preprocess(
  (value) => String(value || "").trim().replace(/\s+/g, " "),
  z
    .string()
    .min(1, "Name is required.")
    .refine((value) => userNamePattern.test(value), "Name can contain only letters and spaces.")
);

const userEmailField = z.preprocess(
  (value) => String(value || "").trim().toLowerCase(),
  z
    .string()
    .min(1, "Email is required.")
    .refine((value) => emailPattern.test(value), "Please enter a valid email address.")
);

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
    name: userNameField,
    email: userEmailField,
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
    name: userNameField,
    email: userEmailField,
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
