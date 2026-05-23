const Department = require("../models/Department");
const Employee = require("../models/Employee");
const LabourTeam = require("../models/LabourTeam");
const NatureOfWork = require("../models/NatureOfWork");
const Site = require("../models/Site");
const {
  LABOUR_TEAM_CATEGORIES,
  LABOUR_TEAM_RATE_TYPES,
  TEAM_CODE_REGEX,
  TEAM_NAME_REGEX,
  createTeamError,
  escapeRegExp,
  normalizeMemberIds,
  normalizeOptionalObjectId,
  normalizeTeamCode,
  normalizeText,
  roundCurrency,
} = require("../helpers/teamMaster.helper");

const activeFilter = { isDeleted: { $ne: true } };

const populateLabourTeamQuery = (query) =>
  query
    .populate("siteId", "name companyName")
    .populate("departmentId", "name")
    .populate("natureOfWorkId", "workName path")
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
  if (!normalizedId) return { natureOfWorkId: null, natureOfWorkPath: "" };
  const work = await NatureOfWork.findOne({ _id: normalizedId, isActive: true, ...activeFilter }).lean();
  if (!work) throw createTeamError("Nature of work is invalid.", 400, "natureOfWorkId");
  return { natureOfWorkId: work._id, natureOfWorkPath: work.path || work.workName || "" };
};

const buildMemberSnapshots = async (members = []) => {
  const memberIds = normalizeMemberIds(members);
  const employees = await Employee.find({ _id: { $in: memberIds }, isActive: true }).lean();
  const employeeMap = new Map(employees.map((employee) => [String(employee._id), employee]));

  return memberIds.map((employeeId) => {
    const employee = employeeMap.get(String(employeeId));
    if (!employee) throw createTeamError("Selected team member is invalid.", 400, "members");
    if (employee.employeeWorkType !== "Labour") {
      throw createTeamError("Only labour employees can be added to Labour Team.", 400, "members");
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

const validateDuplicates = async ({ teamCode, teamName, siteId, excludeId = null }) => {
  const codeFilter = {
    teamCode: { $regex: new RegExp(`^${escapeRegExp(teamCode)}$`, "i") },
    ...activeFilter,
  };
  const nameFilter = {
    teamName: { $regex: new RegExp(`^\\s*${escapeRegExp(teamName)}\\s*$`, "i") },
    siteId: siteId || null,
    ...activeFilter,
  };
  if (excludeId) {
    codeFilter._id = { $ne: excludeId };
    nameFilter._id = { $ne: excludeId };
  }
  if (await LabourTeam.exists(codeFilter)) throw createTeamError("Team code already exists.", 409, "teamCode");
  if (await LabourTeam.exists(nameFilter)) throw createTeamError("Team name already exists for this site.", 409, "teamName");
};

const normalizePayload = async (payload = {}) => {
  const teamCode = validateTeamCode(payload.teamCode);
  const teamName = validateTeamName(payload.teamName);
  const labourCategory = normalizeText(payload.labourCategory);
  if (labourCategory && !LABOUR_TEAM_CATEGORIES.includes(labourCategory)) {
    throw createTeamError("Labour category is invalid.", 400, "labourCategory");
  }
  const teamRateType = normalizeText(payload.teamRateType);
  if (teamRateType && !LABOUR_TEAM_RATE_TYPES.includes(teamRateType)) {
    throw createTeamError("Team rate type is invalid.", 400, "teamRateType");
  }

  const members = await buildMemberSnapshots(payload.members);
  const totalTeamRate = roundCurrency(members.reduce((total, member) => total + Number(member.netRate || 0), 0)) || 0;

  return {
    teamCode,
    teamName,
    ...(await getSiteSnapshot(payload.siteId)),
    ...(await getDepartmentSnapshot(payload.departmentId)),
    labourCategory,
    ...(await getNatureSnapshot(payload.natureOfWorkId)),
    members,
    ...buildLeadSnapshot(payload.teamLeadEmployeeId, members),
    teamRateType,
    totalTeamRate,
    remarks: normalizeText(payload.remarks),
    isActive: payload.isActive !== false,
  };
};

const buildFilter = (query = {}) => {
  const filter = { ...activeFilter };
  const search = normalizeText(query.search);
  const status = String(query.status || "").trim().toLowerCase();
  const siteId = normalizeOptionalObjectId(query.siteId);
  const labourCategory = normalizeText(query.labourCategory);
  if (siteId) filter.siteId = siteId;
  if (labourCategory) filter.labourCategory = labourCategory;
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

const listLabourTeamsService = async (query = {}) =>
  populateLabourTeamQuery(LabourTeam.find(buildFilter(query)).sort({ teamName: 1 })).lean();

const listActiveLabourTeamsService = async (query = {}) =>
  populateLabourTeamQuery(LabourTeam.find({ ...buildFilter(query), isActive: true }).sort({ teamName: 1 })).lean();

const getLabourTeamService = async (id) =>
  populateLabourTeamQuery(LabourTeam.findOne({ _id: id, ...activeFilter })).lean();

const getLabourTeamById = async (id) => {
  const team = await LabourTeam.findOne({ _id: id, ...activeFilter });
  if (!team) throw createTeamError("Labour team not found.", 404);
  return team;
};

const createLabourTeamService = async ({ payload, userId = "" }) => {
  const teamPayload = await normalizePayload(payload);
  await validateDuplicates(teamPayload);
  const team = await LabourTeam.create({ ...teamPayload, createdBy: userId, updatedBy: userId });
  return getLabourTeamService(team._id);
};

const updateLabourTeamService = async ({ id, payload, userId = "" }) => {
  const team = await getLabourTeamById(id);
  const teamPayload = await normalizePayload(payload);
  await validateDuplicates({ ...teamPayload, excludeId: team._id });
  Object.assign(team, teamPayload, { updatedBy: userId });
  await team.save();
  return getLabourTeamService(team._id);
};

const deleteLabourTeamService = async ({ id, userId = "" }) => {
  const team = await getLabourTeamById(id);
  team.isDeleted = true;
  team.isActive = false;
  team.deletedAt = new Date();
  team.deletedBy = userId;
  team.updatedBy = userId;
  await team.save();
  return { success: true, deletedCount: 1 };
};

const updateLabourTeamStatusService = async ({ id, isActive, userId = "" }) => {
  const team = await getLabourTeamById(id);
  team.isActive = Boolean(isActive);
  team.updatedBy = userId;
  await team.save();
  return getLabourTeamService(team._id);
};

module.exports = {
  createLabourTeamService,
  deleteLabourTeamService,
  getLabourTeamService,
  listActiveLabourTeamsService,
  listLabourTeamsService,
  updateLabourTeamService,
  updateLabourTeamStatusService,
};
