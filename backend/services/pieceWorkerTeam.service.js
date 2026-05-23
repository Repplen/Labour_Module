const Department = require("../models/Department");
const Employee = require("../models/Employee");
const NatureOfWork = require("../models/NatureOfWork");
const PieceWorkerTeam = require("../models/PieceWorkerTeam");
const Site = require("../models/Site");
const Uom = require("../models/Uom");
const {
  PIECE_TEAM_RATE_TYPES,
  TEAM_CODE_REGEX,
  TEAM_NAME_REGEX,
  calculateEmployeeWorkRates,
  createTeamError,
  escapeRegExp,
  normalizeMemberIds,
  normalizeOptionalObjectId,
  normalizeTeamCode,
  normalizeText,
  toBoolean,
} = require("../helpers/teamMaster.helper");

const activeFilter = { isDeleted: { $ne: true } };

const populatePieceWorkerTeamQuery = (query) =>
  query
    .populate("siteId", "name companyName")
    .populate("departmentId", "name")
    .populate("natureOfWorkId", "workName path")
    .populate("uomId", "uomName symbol shortCode")
    .populate("teamLeadEmployeeId", "employeeCode employeeName");

const validateTeamCode = (value) => {
  const teamCode = normalizeTeamCode(value);
  if (!teamCode) throw createTeamError("Team code is required.", 400, "teamCode");
  if (!TEAM_CODE_REGEX.test(teamCode)) throw createTeamError("Team code must contain valid text.", 400, "teamCode");
  return teamCode;
};

const validateTeamName = (value) => {
  const teamName = normalizeText(value);
  if (!teamName) throw createTeamError("Team name is required.", 400, "teamName");
  if (!TEAM_NAME_REGEX.test(teamName)) throw createTeamError("Team name must contain valid text.", 400, "teamName");
  return teamName;
};

const getSiteSnapshot = async (siteId) => {
  const normalizedId = normalizeOptionalObjectId(siteId);
  if (!normalizedId) return { siteId: null, siteName: "" };
  const site = await Site.findById(normalizedId, "name companyName").lean();
  if (!site) throw createTeamError("Site is invalid.", 400, "siteId");
  return {
    siteId: site._id,
    siteName: [site.companyName, site.name].filter(Boolean).join(" - "),
  };
};

const getDepartmentSnapshot = async (departmentId) => {
  const normalizedId = normalizeOptionalObjectId(departmentId);
  if (!normalizedId) return { departmentId: null, departmentName: "" };
  const department = await Department.findById(normalizedId, "name").lean();
  if (!department) throw createTeamError("Department is invalid.", 400, "departmentId");
  return { departmentId: department._id, departmentName: department.name || "" };
};

const getNatureSnapshot = async (natureOfWorkId) => {
  const normalizedId = normalizeOptionalObjectId(natureOfWorkId);
  if (!normalizedId) throw createTeamError("Nature of work is required.", 400, "natureOfWorkId");
  const work = await NatureOfWork.findOne({ _id: normalizedId, isActive: true, ...activeFilter }).lean();
  if (!work) throw createTeamError("Nature of work is required.", 400, "natureOfWorkId");
  return { natureOfWorkId: work._id, natureOfWorkPath: work.path || work.workName || "" };
};

const getUomSnapshot = async (uomId) => {
  const normalizedId = normalizeOptionalObjectId(uomId);
  if (!normalizedId) throw createTeamError("UOM is required.", 400, "uomId");
  const uom = await Uom.findOne({ _id: normalizedId, isActive: true, ...activeFilter }).lean();
  if (!uom) throw createTeamError("UOM is required.", 400, "uomId");
  return { uomId: uom._id, uomName: uom.uomName, uomSymbol: uom.symbol || "" };
};

const toRequiredNonNegativeNumber = (value, { field, message }) => {
  if (value === "" || value === null || typeof value === "undefined") throw createTeamError(message, 400, field);
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) throw createTeamError(message, 400, field);
  return numericValue;
};

const buildMemberSnapshots = async (members = []) => {
  const memberIds = normalizeMemberIds(members);
  const employees = await Employee.find({ _id: { $in: memberIds }, isActive: true }).lean();
  const employeeMap = new Map(employees.map((employee) => [String(employee._id), employee]));

  return memberIds.map((employeeId) => {
    const employee = employeeMap.get(String(employeeId));
    if (!employee) throw createTeamError("Selected team member is invalid.", 400, "members");
    if (employee.employeeWorkType !== "Piece Worker") {
      throw createTeamError("Only piece worker employees can be added to Piece Worker Team.", 400, "members");
    }

    return {
      employeeId: employee._id,
      employeeName: employee.employeeName || "",
      skillType: employee.skillType || "",
      natureOfWorkPath: employee.subNatureOfWorkPath || employee.natureOfWorkPath || "",
      uomName: employee.uomName || "",
      rateType: employee.rateType || "",
      standardRate: employee.standardRate ?? null,
      gstAmount: employee.gstAmount ?? null,
      grossRate: employee.grossRate ?? null,
      netRate: employee.netRate ?? null,
    };
  });
};

const buildLeadSnapshot = (teamLeadEmployeeId, members) => {
  const normalizedLeadId = normalizeOptionalObjectId(teamLeadEmployeeId);
  if (!normalizedLeadId) return { teamLeadEmployeeId: null, teamLeadEmployeeName: "" };
  const member = members.find((row) => String(row.employeeId) === normalizedLeadId);
  if (!member) throw createTeamError("Team lead must be selected from team members.", 400, "teamLeadEmployeeId");
  return { teamLeadEmployeeId: member.employeeId, teamLeadEmployeeName: member.employeeName || "" };
};

const validateDuplicates = async ({ teamCode, teamName, natureOfWorkId, siteId, excludeId = null }) => {
  const codeFilter = {
    teamCode: { $regex: new RegExp(`^${escapeRegExp(teamCode)}$`, "i") },
    ...activeFilter,
  };
  const nameFilter = {
    teamName: { $regex: new RegExp(`^\\s*${escapeRegExp(teamName)}\\s*$`, "i") },
    natureOfWorkId,
    siteId: siteId || null,
    ...activeFilter,
  };
  if (excludeId) {
    codeFilter._id = { $ne: excludeId };
    nameFilter._id = { $ne: excludeId };
  }
  if (await PieceWorkerTeam.exists(codeFilter)) throw createTeamError("Team code already exists.", 409, "teamCode");
  if (await PieceWorkerTeam.exists(nameFilter)) throw createTeamError("Team name already exists for this site.", 409, "teamName");
};

const normalizePayload = async (payload = {}) => {
  const teamCode = validateTeamCode(payload.teamCode);
  const teamName = validateTeamName(payload.teamName);
  const rateType = normalizeText(payload.rateType);
  if (!rateType || !PIECE_TEAM_RATE_TYPES.includes(rateType)) {
    throw createTeamError("Rate type is required.", 400, "rateType");
  }

  const standardRate = toRequiredNonNegativeNumber(payload.standardRate, {
    field: "standardRate",
    message: "Standard rate must be a positive number.",
  });
  const gstApplicable = toBoolean(payload.gstApplicable);
  let gstPercent = null;
  if (gstApplicable) {
    gstPercent = toRequiredNonNegativeNumber(payload.gstPercent, {
      field: "gstPercent",
      message: "GST percentage must be between 0 and 100.",
    });
    if (gstPercent < 0 || gstPercent > 100) {
      throw createTeamError("GST percentage must be between 0 and 100.", 400, "gstPercent");
    }
  }

  const members = await buildMemberSnapshots(payload.members);

  return {
    teamCode,
    teamName,
    ...(await getSiteSnapshot(payload.siteId)),
    ...(await getDepartmentSnapshot(payload.departmentId)),
    ...(await getNatureSnapshot(payload.natureOfWorkId)),
    ...(await getUomSnapshot(payload.uomId)),
    members,
    ...buildLeadSnapshot(payload.teamLeadEmployeeId, members),
    rateType,
    standardRate,
    gstApplicable,
    gstPercent,
    ...calculateEmployeeWorkRates({ standardRate, gstApplicable, gstPercent }),
    remarks: normalizeText(payload.remarks),
    isActive: payload.isActive !== false,
  };
};

const buildFilter = (query = {}) => {
  const filter = { ...activeFilter };
  const search = normalizeText(query.search);
  const status = String(query.status || "").trim().toLowerCase();
  const siteId = normalizeOptionalObjectId(query.siteId);
  const natureOfWorkId = normalizeOptionalObjectId(query.natureOfWorkId);
  const uomId = normalizeOptionalObjectId(query.uomId);
  if (siteId) filter.siteId = siteId;
  if (natureOfWorkId) filter.natureOfWorkId = natureOfWorkId;
  if (uomId) filter.uomId = uomId;
  if (status === "active") filter.isActive = true;
  if (status === "inactive") filter.isActive = false;
  if (search) {
    filter.$or = [
      { teamCode: { $regex: new RegExp(escapeRegExp(search), "i") } },
      { teamName: { $regex: new RegExp(escapeRegExp(search), "i") } },
    ];
  }
  return filter;
};

const listPieceWorkerTeamsService = async (query = {}) =>
  populatePieceWorkerTeamQuery(PieceWorkerTeam.find(buildFilter(query)).sort({ teamName: 1 })).lean();

const listActivePieceWorkerTeamsService = async (query = {}) =>
  populatePieceWorkerTeamQuery(PieceWorkerTeam.find({ ...buildFilter(query), isActive: true }).sort({ teamName: 1 })).lean();

const getPieceWorkerTeamService = async (id) =>
  populatePieceWorkerTeamQuery(PieceWorkerTeam.findOne({ _id: id, ...activeFilter })).lean();

const getPieceWorkerTeamById = async (id) => {
  const team = await PieceWorkerTeam.findOne({ _id: id, ...activeFilter });
  if (!team) throw createTeamError("Piece worker team not found.", 404);
  return team;
};

const createPieceWorkerTeamService = async ({ payload, userId = "" }) => {
  const teamPayload = await normalizePayload(payload);
  await validateDuplicates(teamPayload);
  const team = await PieceWorkerTeam.create({ ...teamPayload, createdBy: userId, updatedBy: userId });
  return getPieceWorkerTeamService(team._id);
};

const updatePieceWorkerTeamService = async ({ id, payload, userId = "" }) => {
  const team = await getPieceWorkerTeamById(id);
  const teamPayload = await normalizePayload(payload);
  await validateDuplicates({ ...teamPayload, excludeId: team._id });
  Object.assign(team, teamPayload, { updatedBy: userId });
  await team.save();
  return getPieceWorkerTeamService(team._id);
};

const deletePieceWorkerTeamService = async ({ id, userId = "" }) => {
  const team = await getPieceWorkerTeamById(id);
  team.isDeleted = true;
  team.isActive = false;
  team.deletedAt = new Date();
  team.deletedBy = userId;
  team.updatedBy = userId;
  await team.save();
  return { success: true, deletedCount: 1 };
};

const updatePieceWorkerTeamStatusService = async ({ id, isActive, userId = "" }) => {
  const team = await getPieceWorkerTeamById(id);
  team.isActive = Boolean(isActive);
  team.updatedBy = userId;
  await team.save();
  return getPieceWorkerTeamService(team._id);
};

module.exports = {
  createPieceWorkerTeamService,
  deletePieceWorkerTeamService,
  getPieceWorkerTeamService,
  listActivePieceWorkerTeamsService,
  listPieceWorkerTeamsService,
  updatePieceWorkerTeamService,
  updatePieceWorkerTeamStatusService,
};
