const {
  idParamSchema,
  objectIdField,
  optionalObjectIdField,
  optionalTrimmedString,
  z,
} = require("./common");

const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const employeeCodePattern = /^\d+$/;
const letterPattern = /[A-Za-z]/;
const employeeNamePattern = /^[A-Za-z][A-Za-z\s.'-]*$/;
const onlyZerosPattern = /^0+$/;
const mobilePattern = /^\d{10}$/;

const optionalContactString = z.preprocess(
  (value) => {
    if (value === undefined || value === null) return undefined;
    const trimmed = String(value).trim();
    return trimmed === "" ? undefined : trimmed;
  },
  z.string().optional()
);

const employeeCodeField = z.preprocess(
  (value) => String(value || "").trim(),
  z
    .string()
    .min(1, "Employee code is required.")
    .refine((value) => !onlyZerosPattern.test(value), "Employee code cannot be only zeros.")
    .refine(
      (value) => employeeCodePattern.test(value),
      "Employee code can contain only numbers."
    )
);

const employeeNameField = z.preprocess(
  (value) => String(value || "").trim().replace(/\s+/g, " "),
  z
    .string()
    .min(1, "Employee name is required.")
    .refine((value) => letterPattern.test(value), "Employee name must contain letters.")
    .refine(
      (value) => employeeNamePattern.test(value),
      "Employee name can contain only letters, spaces, dot, apostrophe, and hyphen."
    )
);

const emailField = optionalContactString.refine(
  (value) => value === undefined || emailPattern.test(value),
  "Please enter a valid email address."
);

const mobileField = optionalContactString.refine(
  (value) => value === undefined || mobilePattern.test(value.replace(/[\s-]+/g, "")),
  "Please enter a valid 10-digit mobile number."
);

const employeeCreateSchema = z
  .object({
    employeeCode: employeeCodeField,
    employeeName: employeeNameField,
    designation: objectIdField("Designation"),
    department: z.any(),
    subDepartment: z.any().optional(),
    sites: z.any(),
    superiorEmployee: optionalObjectIdField("Superior employee"),
    dateOfJoining: optionalTrimmedString,
    email: emailField,
    mobile: mobileField,
    password: z.preprocess(
      (value) => String(value || "").trim(),
      z
        .string()
        .min(1, "Employee login password is required")
        .min(6, "Employee login password must be at least 6 characters")
    ),
  })
  .passthrough();

const employeeUpdateSchema = z
  .object({
    employeeCode: employeeCodeField,
    employeeName: employeeNameField,
    designation: objectIdField("Designation"),
    department: z.any(),
    subDepartment: z.any().optional(),
    sites: z.any(),
    superiorEmployee: optionalObjectIdField("Superior employee"),
    dateOfJoining: optionalTrimmedString,
    email: emailField,
    mobile: mobileField,
    password: optionalTrimmedString.refine(
      (value) => value === undefined || value.length >= 6,
      "Employee login password must be at least 6 characters"
    ),
  })
  .passthrough();

const employeeBulkDeleteSchema = z.object({
  employeeIds: z.array(objectIdField("Employee id")).min(1, "Select at least one employee"),
});

module.exports = {
  employeeBulkDeleteSchema,
  employeeCreateSchema,
  employeeUpdateSchema,
  idParamSchema,
};
