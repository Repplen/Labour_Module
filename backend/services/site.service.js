const Company = require("../models/Company");
const Employee = require("../models/Employee");
const Site = require("../models/Site");
const { buildSiteScopeFilter } = require("./accessScope.service");
const {
  MAX_SUB_LEVELS,
  createDuplicateSiteError,
  createError,
  escapeRegExp,
  findSubSiteNode,
  formatEmployeeHeadLabel,
  hasDuplicateSubSite,
  parseEmployeeIds,
  parseNameList,
} = require("../helpers/site.helper");

const findDuplicateSite = (name, currentSiteId = null) => {
  const filter = {
    name: { $regex: new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`, "i") },
  };

  if (currentSiteId) {
    filter._id = { $ne: currentSiteId };
  }

  return Site.exists(filter);
};

const resolveHeadNames = async ({
  headEmployeeIds,
  fallbackHeadNames,
  requireAtLeastOne = false,
  invalidSelectionMessage = "One or more selected site heads are invalid",
  requiredMessage = "Sub site head name is required",
}) => {
  const employeeIds = parseEmployeeIds(headEmployeeIds);
  const fallbackNames = parseNameList(fallbackHeadNames);

  if (!employeeIds.length) {
    if (requireAtLeastOne && !fallbackNames.length) {
      throw createError(requiredMessage, 400);
    }
    return fallbackNames;
  }

  const employees = await Employee.find(
    { _id: { $in: employeeIds }, isActive: { $ne: false } },
    "employeeCode employeeName"
  );

  if (employees.length !== employeeIds.length) {
    throw createError(invalidSelectionMessage, 400);
  }

  const byId = new Map(employees.map((employee) => [String(employee._id), employee]));
  const employeeHeadNames = employeeIds
    .map((id) => formatEmployeeHeadLabel(byId.get(String(id))))
    .filter(Boolean);
  const headNames = [...employeeHeadNames];
  const seen = new Set(headNames.map((item) => item.toLowerCase()));

  fallbackNames.forEach((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    headNames.push(item);
  });

  if (requireAtLeastOne && !headNames.length) {
    throw createError(requiredMessage, 400);
  }

  return headNames;
};

const canAccessScopedSite = async (access, siteId) => {
  const scopeFilter = await buildSiteScopeFilter(access || {});

  if (!scopeFilter?._id?.$in) {
    return scopeFilter?._id !== null;
  }

  return scopeFilter._id.$in.some((value) => String(value) === String(siteId));
};

const assertCanAccessSite = async (access, siteId) => {
  if (!(await canAccessScopedSite(access, siteId))) {
    throw createError("Site not found", 404);
  }
};

const assertCompanyExists = async (companyName) => {
  const companyExists = await Company.exists({
    name: companyName,
    isActive: { $ne: false },
  });

  if (!companyExists) {
    throw createError("Selected company is invalid", 400);
  }
};

const buildSitePayload = async (body, validatedSite, currentSiteId = null) => {
  const { companyName, name } = validatedSite || {};

  if (!companyName) throw createError("Company name is required.", 400);
  if (!name) throw createError("Site name is required.", 400);

  const headNames = await resolveHeadNames({
    headEmployeeIds: body.headEmployeeIds,
    fallbackHeadNames: body.headNames,
  });
  const siteLeadNames = await resolveHeadNames({
    headEmployeeIds: body.siteLeadEmployeeIds,
    fallbackHeadNames: body.siteLeadNames,
    invalidSelectionMessage: "One or more selected site leads are invalid",
    requiredMessage: "Site lead name is required",
  });

  await assertCompanyExists(companyName);

  const duplicateSite = await findDuplicateSite(name, currentSiteId);
  if (duplicateSite) {
    throw createDuplicateSiteError();
  }

  return { companyName, name, headNames, siteLeadNames };
};

const listSitesService = async (access) =>
  Site.find({
    ...(await buildSiteScopeFilter(access || {})),
    isActive: { $ne: false },
  }).sort({ companyName: 1, name: 1 });

const createSiteService = async (body, validatedSite) => {
  const data = await buildSitePayload(body, validatedSite);
  return Site.create(data);
};

const updateSiteService = async (siteId, body, access, validatedSite) => {
  await assertCanAccessSite(access, siteId);
  const data = await buildSitePayload(body, validatedSite, siteId);

  const updated = await Site.findOneAndUpdate(
    { _id: siteId, isActive: { $ne: false } },
    data,
    { new: true, runValidators: true }
  );

  if (!updated) throw createError("Site not found", 404);
  return updated;
};

const deleteSiteService = async (siteId, access) => {
  await assertCanAccessSite(access, siteId);

  const site = await Site.findOne({
    _id: siteId,
    isActive: { $ne: false },
  });
  if (!site) throw createError("Site not found", 404);

  site.isActive = false;
  await site.save();

  return { success: true, isActive: false };
};

const listSubSitesService = async (siteId, parentId = "", access) => {
  await assertCanAccessSite(access, siteId);

  const row = await Site.findById(siteId, "subSites");
  if (!row) throw createError("Site not found", 404);

  if (!parentId) {
    return row.subSites || [];
  }

  const parent = findSubSiteNode(row.subSites || [], parentId);
  if (!parent) throw createError("Sub site not found", 404);

  return parent.node.children || [];
};

const createSubSiteService = async (siteId, body, access, validatedSubSite) => {
  await assertCanAccessSite(access, siteId);

  const { names, hasBulkPayload } = validatedSubSite || {};
  if (!Array.isArray(names) || !names.length) {
    throw createError("Sub site name is required.", 400);
  }

  const headNames = await resolveHeadNames({
    headEmployeeIds: body.headEmployeeIds,
    fallbackHeadNames: body.headNames,
    requireAtLeastOne: true,
  });

  const row = await Site.findById(siteId);
  if (!row) throw createError("Site not found", 404);

  const { parentId = "" } = body;
  let targetRows = row.subSites || [];
  let parentLevel = 0;

  if (parentId) {
    const parent = findSubSiteNode(row.subSites || [], parentId);
    if (!parent) throw createError("Sub site not found", 404);
    parentLevel = parent.level;
    targetRows = parent.node.children || [];
  }

  if (parentLevel >= MAX_SUB_LEVELS) {
    throw createError(`You can only create up to Sub Site Master ${MAX_SUB_LEVELS}`, 400);
  }

  const skipped = [];
  const created = [];

  names.forEach((item) => {
    if (hasDuplicateSubSite(targetRows, item)) {
      skipped.push(item);
      return;
    }
    targetRows.push({ name: item, headNames });
    created.push(targetRows[targetRows.length - 1]);
  });

  if (!created.length) {
    throw createError("All sub site names already exist", 409, { skipped });
  }

  await row.save();

  if (!hasBulkPayload && created.length === 1 && skipped.length === 0) {
    return created[0];
  }

  return { created, skipped };
};

const updateSubSiteService = async (siteId, subId, body, access, validatedSubSite) => {
  await assertCanAccessSite(access, siteId);

  const { name } = validatedSubSite || {};
  if (!name) throw createError("Sub site name is required.", 400);

  const headNames = await resolveHeadNames({
    headEmployeeIds: body.headEmployeeIds,
    fallbackHeadNames: body.headNames,
    requireAtLeastOne: true,
  });

  const row = await Site.findById(siteId);
  if (!row) throw createError("Site not found", 404);

  const sub = findSubSiteNode(row.subSites || [], subId);
  if (!sub) throw createError("Sub site not found", 404);

  if (hasDuplicateSubSite(sub.siblings || [], name, sub.node._id)) {
    throw createError("Sub site already exists at this level", 409);
  }

  sub.node.name = name;
  sub.node.headNames = headNames;
  await row.save();

  return sub.node;
};

const deleteSubSiteService = async (siteId, subId, access) => {
  await assertCanAccessSite(access, siteId);

  const row = await Site.findById(siteId);
  if (!row) throw createError("Site not found", 404);

  const sub = findSubSiteNode(row.subSites || [], subId);
  if (!sub) throw createError("Sub site not found", 404);

  sub.siblings.splice(sub.index, 1);
  await row.save();

  return { success: true };
};

module.exports = {
  createSiteService,
  createSubSiteService,
  deleteSiteService,
  deleteSubSiteService,
  findDuplicateSite,
  listSitesService,
  listSubSitesService,
  resolveHeadNames,
  updateSiteService,
  updateSubSiteService,
};
