const Company = require("../models/Company");
const Employee = require("../models/Employee");
const Site = require("../models/Site");

const normalizeId = (value) => String(value?._id || value || "").trim();
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
    return uniqueIdList([access?.principalId]);
  }

  const directEmployeeIds = uniqueIdList(access?.scope?.employeeIds);
  const managedEmployeeIds =
    strategy === "managed" ? await resolveManagedEmployeeIds(access?.principalId) : [];
  const siteIds = uniqueIdList(access?.scope?.siteIds);
  const departmentIds = uniqueIdList(access?.scope?.departmentIds);
  const subDepartmentIds = uniqueIdList(access?.scope?.subDepartmentIds);
  const query = {
    isActive: { $ne: false },
  };
  const or = [];

  if (directEmployeeIds.length) {
    or.push({ _id: { $in: directEmployeeIds } });
  }

  if (managedEmployeeIds.length) {
    or.push({ _id: { $in: managedEmployeeIds } });
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

  if (!or.length) {
    return [];
  }

  query.$or = or;

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
