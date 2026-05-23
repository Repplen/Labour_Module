const { z } = require("zod");
const { createTeamError, normalizeText, normalizeTeamCode } = require("../helpers/teamMaster.helper");

const booleanSchema = z.union([z.boolean(), z.string()]).optional().transform((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "yes", "1"].includes(value.trim().toLowerCase());
  return undefined;
});

const optionalNumberSchema = z.union([z.number(), z.string(), z.null()]).optional().transform((value) => {
  if (value === "" || value === null || typeof value === "undefined") return undefined;
  return Number(value);
});

const parseMembers = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value !== "string") return [value];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value ? [value] : [];
  }
};

const schema = z.object({
  teamCode: z.string().transform(normalizeTeamCode).refine(Boolean, "Team code is required."),
  teamName: z.string().transform(normalizeText).refine(Boolean, "Team name is required."),
  siteId: z.string().optional().default(""),
  departmentId: z.string().optional().default(""),
  natureOfWorkId: z.string().refine(Boolean, "Nature of work is required."),
  uomId: z.string().refine(Boolean, "UOM is required."),
  members: z.any().transform(parseMembers).default([]),
  teamLeadEmployeeId: z.string().optional().default(""),
  rateType: z.string().transform(normalizeText).refine(Boolean, "Rate type is required."),
  standardRate: optionalNumberSchema,
  gstApplicable: booleanSchema.default(false),
  gstPercent: optionalNumberSchema,
  remarks: z.string().transform(normalizeText).optional().default(""),
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
    errors: err.errors || [{ field: err.field || "teamName", message: err.message }],
  });

const validateWithSchema = (targetSchema, body, targetKey) => {
  const result = targetSchema.safeParse(body || {});
  if (!result.success) {
    const issue = result.error.issues[0];
    throw createTeamError(issue?.message || "Invalid team data.", 400, issue?.path?.[0] || "teamName");
  }
  return { [targetKey]: result.data };
};

const validatePieceWorkerTeamRequestMiddleware = (req, res, next) => {
  try {
    Object.assign(req, validateWithSchema(schema, req.body, "validatedPieceWorkerTeam"));
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

const validateStatusPieceWorkerTeamRequestMiddleware = (req, res, next) => {
  try {
    Object.assign(req, validateWithSchema(statusSchema, req.body, "validatedPieceWorkerTeamStatus"));
    next();
  } catch (err) {
    sendValidationError(res, err);
  }
};

module.exports = {
  validatePieceWorkerTeamRequestMiddleware,
  validateStatusPieceWorkerTeamRequestMiddleware,
};
