const {
  idParamSchema,
  objectIdField,
  optionalObjectIdField,
  optionalTrimmedString,
  requiredTrimmedString,
  z,
} = require("./common");

const employeeCreateSchema = z
  .object({
    employeeCode: requiredTrimmedString("Employee code"),
    employeeName: requiredTrimmedString("Employee name"),
    designation: objectIdField("Designation"),
    department: z.any(),
    subDepartment: z.any().optional(),
    sites: z.any(),
    superiorEmployee: optionalObjectIdField("Superior employee"),
    dateOfJoining: optionalTrimmedString,
    email: optionalTrimmedString.refine(
      (value) => value === undefined || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Email must be valid"
    ),
    mobile: optionalTrimmedString,
    password: requiredTrimmedString(
      "Password",
      z.string().min(6, "Employee login password must be at least 6 characters")
    ),
  })
  .passthrough();

const employeeUpdateSchema = z
  .object({
    employeeCode: requiredTrimmedString("Employee code"),
    employeeName: requiredTrimmedString("Employee name"),
    designation: objectIdField("Designation"),
    department: z.any(),
    subDepartment: z.any().optional(),
    sites: z.any(),
    superiorEmployee: optionalObjectIdField("Superior employee"),
    dateOfJoining: optionalTrimmedString,
    email: optionalTrimmedString.refine(
      (value) => value === undefined || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Email must be valid"
    ),
    mobile: optionalTrimmedString,
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
