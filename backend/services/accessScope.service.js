const Company = require("../models/Company");
const Department = require("../models/Department");
const Employee = require("../models/Employee");
const Site = require("../models/Site");

const normalizeId = (value) => String(value?._id || value || "").trim();
const normalizeText = (value) => String(value || "").trim();
const normalizeIdentityValue = (value) => normalizeText(value).toLowerCase();
const uniqueIdList = (value) => {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();

  return rawValues
    .map((item) => normalizeId(item))
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
};

const isAllScope = (access) =>
  String(access?.scope?.strategy || "").trim().toLowerCase() === "all" ||
  Boolean(access?.isDefaultAdmin);

const buildEmptyAccessFilter = () => ({ _id: null });

const buildEmptyLeadershipScope = () => ({
  companyNames: [],
  departmentIds: [],
  siteIds: [],
  subDepartmentIds: [],
  subSiteIds: [],
});

const normalizeTextList = (value) => {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();

  return rawValues
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const buildEmployeeIdentitySet = (employee = {}) => {
  const employeeCode = normalizeText(employee?.employeeCode);
  const employeeName = normalizeText(employee?.employeeName);
  const email = normalizeText(employee?.email);
  const identityValues = [
    normalizeId(employee),
    employeeCode,
    employeeName,
    email,
    employeeCode && employeeName ? `${employeeCode} - ${employeeName}` : "",
    employeeCode && employeeName ? `${employeeCode}-${employeeName}` : "",
  ];

  return new Set(identityValues.map((value) => normalizeIdentityValue(value)).filter(Boolean));
};

const matchesIdentitySet = (values = [], identitySet = new Set()) =>
  normalizeTextList(values).some((value) => identitySet.has(normalizeIdentityValue(value)));

const collectMatchingNestedIds = (rows = [], identitySet = new Set()) => {
  const matchingIds = [];

  rows.forEach((row) => {
    if (matchesIdentitySet(row?.headNames, identitySet)) {
      matchingIds.push(normalizeId(row));
    }

    matchingIds.push(...collectMatchingNestedIds(row?.children || [], identitySet));
  });

  return uniqueIdList(matchingIds);
};

const resolveEmployeeLeadershipScope = async (access = {}) => {
  if (String(access?.principalType || "").trim().toLowerCase() !== "employee") {
    return buildEmptyLeadershipScope();
  }

  const principalId = normalizeId(access?.principalId);
  if (!principalId) {
    return buildEmptyLeadershipScope();
  }

  const employee = await Employee.findById(
    principalId,
    "employeeCode employeeName email"
  ).lean();
  if (!employee) {
    return buildEmptyLeadershipScope();
  }

  const identitySet = buildEmployeeIdentitySet(employee);
  if (!identitySet.size) {
    return buildEmptyLeadershipScope();
  }

  const [companies, departments, sites] = await Promise.all([
    Company.find({ isActive: { $ne: false } }, "name directorNames").lean(),
    Department.find(
      { isActive: { $ne: false } },
      "_id headNames departmentLeadNames subDepartments"
    ).lean(),
    Site.find(
      { isActive: { $ne: false } },
      "_id companyName headNames siteLeadNames subSites"
    ).lean(),
  ]);

  const companyNames = companies
    .filter((company) => matchesIdentitySet(company?.directorNames, identitySet))
    .map((company) => normalizeText(company?.name))
    .filter(Boolean);
  const companyNameSet = new Set(companyNames);
  const siteIds = [];
  const subSiteIds = [];

  sites.forEach((site) => {
    const matchingSubSiteIds = collectMatchingNestedIds(site?.subSites || [], identitySet);
    const isSiteLeader =
      companyNameSet.has(normalizeText(site?.companyName)) ||
      matchesIdentitySet(site?.headNames, identitySet) ||
      matchesIdentitySet(site?.siteLeadNames, identitySet);

    if (isSiteLeader) {
      siteIds.push(normalizeId(site));
    }

    subSiteIds.push(...matchingSubSiteIds);
  });

  const departmentIds = [];
  const subDepartmentIds = [];

  departments.forEach((department) => {
    const matchingSubDepartmentIds = collectMatchingNestedIds(
      department?.subDepartments || [],
      identitySet
    );
    const isDepartmentLeader =
      matchesIdentitySet(department?.headNames, identitySet) ||
      matchesIdentitySet(department?.departmentLeadNames, identitySet);

    if (isDepartmentLeader) {
      departmentIds.push(normalizeId(department));
    }

    subDepartmentIds.push(...matchingSubDepartmentIds);
  });

  return {
    companyNames: normalizeTextList(companyNames),
    departmentIds: uniqueIdList(departmentIds),
    siteIds: uniqueIdList(siteIds),
    subDepartmentIds: uniqueIdList(subDepartmentIds),
    subSiteIds: uniqueIdList(subSiteIds),
  };
};

const buildEmployeeQueryForScopeIds = ({
  employeeIds = [],
  siteIds = [],
  departmentIds = [],
  subDepartmentIds = [],
  subSiteIds = [],
}) => {
  const or = [];

  if (employeeIds.length) {
    or.push({ _id: { $in: employeeIds } });
  }

  if (siteIds.length) {
    or.push({ sites: { $in: siteIds } });
  }

  if (departmentIds.length) {
    or.push({ department: { $in: departmentIds } });
  }

  if (subDepartmentIds.length) {
    or.push({ subDepartment: { $in: subDepartmentIds } });
  }

  if (subSiteIds.length) {
    or.push({ "subSites.subSite": { $in: subSiteIds } });
  }

  if (!or.length) {
    return null;
  }

  return {
    isActive: { $ne: false },
    $or: or,
  };
};

const resolveManagedEmployeeIds = async (principalId) => {
  const rootEmployeeId = normalizeId(principalId);
  if (!rootEmployeeId) {
    return [];
  }

  const managedEmployeeIds = [];
  const visitedEmployeeIds = new Set([rootEmployeeId]);
  let nextSuperiorIds = [rootEmployeeId];

  while (nextSuperiorIds.length) {
    const employees = await Employee.find(
      {
        superiorEmployee: { $in: nextSuperiorIds },
        isActive: { $ne: false },
      },
      "_id"
    ).lean();
    const childEmployeeIds = uniqueIdList(employees.map((employee) => employee._id)).filter(
      (employeeId) => !visitedEmployeeIds.has(employeeId)
    );

    childEmployeeIds.forEach((employeeId) => {
      visitedEmployeeIds.add(employeeId);
      managedEmployeeIds.push(employeeId);
    });

    nextSuperiorIds = childEmployeeIds;
  }

  return managedEmployeeIds;
};

const resolveAccessibleEmployeeIds = async (access = {}) => {
  if (isAllScope(access)) {
    return [];
  }

  const strategy = String(access?.scope?.strategy || "").trim().toLowerCase();
  if (strategy === "own") {
    const ownEmployeeIds = uniqueIdList([access?.principalId]);
    const leadershipScope = await resolveEmployeeLeadershipScope(access);
    const hasLeadershipScope =
      leadershipScope.siteIds.length ||
      leadershipScope.departmentIds.length ||
      leadershipScope.subDepartmentIds.length ||
      leadershipScope.subSiteIds.length;

    if (!hasLeadershipScope) {
      return ownEmployeeIds;
    }

    const leadershipQuery = buildEmployeeQueryForScopeIds({
      employeeIds: ownEmployeeIds,
      siteIds: leadershipScope.siteIds,
      departmentIds: leadershipScope.departmentIds,
      subDepartmentIds: leadershipScope.subDepartmentIds,
      subSiteIds: leadershipScope.subSiteIds,
    });

    if (!leadershipQuery) {
      return ownEmployeeIds;
    }

    const employees = await Employee.find(leadershipQuery, "_id").lean();
    return uniqueIdList([...ownEmployeeIds, ...employees.map((employee) => employee._id)]);
  }

  const directEmployeeIds = uniqueIdList(access?.scope?.employeeIds);
  const managedEmployeeIds =
    strategy === "managed" ? await resolveManagedEmployeeIds(access?.principalId) : [];
  const leadershipScope = await resolveEmployeeLeadershipScope(access);
  let siteIds = uniqueIdList(access?.scope?.siteIds);
  const departmentIds = uniqueIdList([
    ...(access?.scope?.departmentIds || []),
    ...leadershipScope.departmentIds,
  ]);
  const subDepartmentIds = uniqueIdList([
    ...(access?.scope?.subDepartmentIds || []),
    ...leadershipScope.subDepartmentIds,
  ]);
  const subSiteIds = uniqueIdList(leadershipScope.subSiteIds);
  const companyIds = uniqueIdList(access?.scope?.companyIds);
  const companyNames = [...leadershipScope.companyNames];

  if (companyIds.length) {
    const companies = await Company.find({ _id: { $in: companyIds } }, "name").lean();
    companyNames.push(
      ...companies.map((company) => String(company?.name || "").trim()).filter(Boolean)
    );
  }

  if (companyNames.length) {
    const companySites = await Site.find(
      { companyName: { $in: normalizeTextList(companyNames) } },
      "_id"
    ).lean();
    siteIds = uniqueIdList([
      ...siteIds,
      ...leadershipScope.siteIds,
      ...companySites.map((site) => site._id),
    ]);
  } else {
    siteIds = uniqueIdList([...siteIds, ...leadershipScope.siteIds]);
  }

  const query = buildEmployeeQueryForScopeIds({
    employeeIds: [...directEmployeeIds, ...managedEmployeeIds],
    siteIds,
    departmentIds,
    subDepartmentIds,
    subSiteIds,
  });
  if (!query) {
    return [];
  }

  const employees = await Employee.find(query, "_id").lean();
  return uniqueIdList(employees.map((employee) => employee._id));
};

const buildEmployeeScopeFilter = async (access = {}) => {
  if (isAllScope(access)) {
    return {};
  }

  const employeeIds = await resolveAccessibleEmployeeIds(access);

  if (!employeeIds.length) {
    return buildEmptyAccessFilter();
  }

  return { _id: { $in: employeeIds } };
};

const buildSiteScopeFilter = async (access = {}) => {
  if (isAllScope(access)) {
    return {};
  }

  const siteIds = uniqueIdList(access?.scope?.siteIds);
  if (siteIds.length) {
    return { _id: { $in: siteIds } };
  }

  const employeeIds = await resolveAccessibleEmployeeIds(access);
  if (!employeeIds.length) {
    return buildEmptyAccessFilter();
  }

  const employees = await Employee.find({ _id: { $in: employeeIds } }, "sites").lean();
  const accessibleSiteIds = uniqueIdList(employees.flatMap((employee) => employee.sites || []));

  return accessibleSiteIds.length ? { _id: { $in: accessibleSiteIds } } : buildEmptyAccessFilter();
};

const buildDepartmentScopeFilter = async (access = {}) => {
  if (isAllScope(access)) {
    return {};
  }

  const departmentIds = uniqueIdList(access?.scope?.departmentIds);
  if (departmentIds.length) {
    return { _id: { $in: departmentIds } };
  }

  const employeeIds = await resolveAccessibleEmployeeIds(access);
  if (!employeeIds.length) {
    return buildEmptyAccessFilter();
  }

  const employees = await Employee.find({ _id: { $in: employeeIds } }, "department").lean();
  const accessibleDepartmentIds = uniqueIdList(
    employees.flatMap((employee) => employee.department || [])
  );

  return accessibleDepartmentIds.length
    ? { _id: { $in: accessibleDepartmentIds } }
    : buildEmptyAccessFilter();
};

const buildCompanyScopeFilter = async (access = {}) => {
  if (isAllScope(access)) {
    return {};
  }

  const companyIds = uniqueIdList(access?.scope?.companyIds);
  if (companyIds.length) {
    return { _id: { $in: companyIds } };
  }

  const siteFilter = await buildSiteScopeFilter(access);
  if (!Object.keys(siteFilter).length) {
    return {};
  }

  if (siteFilter._id === null) {
    return buildEmptyAccessFilter();
  }

  const sites = await Site.find(siteFilter, "companyName").lean();
  const companyNames = [...new Set(sites.map((site) => String(site.companyName || "").trim()).filter(Boolean))];

  if (!companyNames.length) {
    return buildEmptyAccessFilter();
  }

  return { name: { $in: companyNames } };
};

const buildChecklistMasterScopeFilter = async (access = {}) => {
  if (isAllScope(access)) {
    return {};
  }

  const siteIds = uniqueIdList(access?.scope?.siteIds);
  const employeeIds = await resolveAccessibleEmployeeIds(access);
  const conditions = [];

  if (siteIds.length) {
    conditions.push({ employeeAssignedSite: { $in: siteIds } });
  }

  if (employeeIds.length) {
    conditions.push({ assignedToEmployee: { $in: employeeIds } });
  }

  if (!conditions.length) {
    return buildEmptyAccessFilter();
  }

  return conditions.length === 1 ? conditions[0] : { $or: conditions };
};

const filterRowsByAccessibleEmployees = async (rows = [], access = {}, selector) => {
  if (isAllScope(access)) {
    return rows;
  }

  const employeeIds = new Set(await resolveAccessibleEmployeeIds(access));
  if (!employeeIds.size) {
    return [];
  }

  return rows.filter((row) => employeeIds.has(normalizeId(selector(row))));
};

module.exports = {
  buildChecklistMasterScopeFilter,
  buildCompanyScopeFilter,
  buildDepartmentScopeFilter,
  buildEmployeeScopeFilter,
  buildSiteScopeFilter,
  filterRowsByAccessibleEmployees,
  isAllScope,
  resolveManagedEmployeeIds,
  resolveAccessibleEmployeeIds,
  uniqueIdList,
};
