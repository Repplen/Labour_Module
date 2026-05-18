const {
  idParamSchema,
  objectIdField,
  optionalTrimmedString,
  requiredTrimmedString,
  timeStringField,
  z,
} = require("./common");

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

const optionalObjectIdField = (label) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null) return undefined;

      const trimmedValue = String(value).trim();
      return trimmedValue ? trimmedValue : undefined;
    },
    z.string().regex(objectIdPattern, `${label} must be a valid id`).optional()
  );

const checklistCreateSchema = z
  .object({
    checklistName: requiredTrimmedString("Checklist name"),
    assignedToEmployee: objectIdField("Assigned employee"),
    employeeAssignedSite: objectIdField("Assigned site"),
    checklistSourceSite: optionalObjectIdField("Checklist source site"),
    scheduleType: z
      .preprocess((value) => String(value || "").trim().toLowerCase(), z.enum([
        "daily",
        "weekly",
        "monthly",
        "yearly",
        "custom",
      ])),
    startDate: requiredTrimmedString("Start date"),
    scheduleTime: timeStringField("Schedule time"),
    endDate: requiredTrimmedString("End date"),
    endTime: timeStringField("End time"),
    priority: optionalTrimmedString,
    isDependentTask: z.any().optional(),
    dependencyChecklistId: optionalTrimmedString,
    checklistItems: z.any().optional(),
    approvals: z.any().optional(),
    approvalHierarchy: optionalTrimmedString,
  })
  .passthrough();

const checklistUpdateSchema = checklistCreateSchema;

const checklistBulkDeleteSchema = z.object({
  checklistIds: z.array(objectIdField("Checklist id")).min(1, "Select at least one checklist"),
});

const generatedChecklistTaskBulkDeleteSchema = z.object({
  taskIds: z.array(objectIdField("Task id")).min(1, "Select at least one generated task"),
});

const checklistDecisionSchema = z
  .object({
    action: optionalTrimmedString,
    decision: optionalTrimmedString,
    remark: optionalTrimmedString,
    comments: optionalTrimmedString,
  })
  .passthrough();

const checklistTaskReportQuerySchema = z
  .object({
    search: optionalTrimmedString,
    fromDate: optionalTrimmedString,
    toDate: optionalTrimmedString,
    status: optionalTrimmedString,
    scheduleType: optionalTrimmedString,
    companyName: optionalTrimmedString,
    siteId: optionalTrimmedString,
    site: optionalTrimmedString,
    department: optionalTrimmedString,
    subDepartment: optionalTrimmedString,
    assignedEmployee: optionalTrimmedString,
    approverEmployee: optionalTrimmedString,
    timelinessStatus: optionalTrimmedString,
    submissionTimingStatus: optionalTrimmedString,
  })
  .passthrough();

module.exports = {
  checklistBulkDeleteSchema,
  checklistCreateSchema,
  checklistDecisionSchema,
  checklistTaskReportQuerySchema,
  generatedChecklistTaskBulkDeleteSchema,
  checklistUpdateSchema,
  idParamSchema,
};
