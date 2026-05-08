const Role = require("../models/Role");
const RolePermission = require("../models/RolePermission");
const UserPermission = require("../models/UserPermission");
const {
  ACTION_FIELD_MAP,
  buildEmptyPermissionFlags,
  getModuleCatalog,
  getModuleConfigByKey,
  getSystemRoleConfigByKey,
  normalizePermissionFlags,
} = require("./permissionCatalog.service");

const normalizeId = (value) => String(value?._id || value || "").trim();
const normalizeText = (value) => String(value || "").trim();
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

const getLegacyRoleFromPrincipal = ({ principalType, principal, resolvedRole }) => {
  if (principalType === "employee") return "employee";
  if (principal?.role === "admin") return "admin";
  if (resolvedRole?.key === "main_admin") return "admin";
  return "user";
};

const getFallbackRoleKey = ({ principalType, principal }) => {
  if (principalType === "employee") {
    return "employee";
  }

  if (principal?.isDefaultAdmin || principal?.role === "admin") {
    return "main_admin";
  }

  return "checklist_master_user";
};

const getRolePermissionMap = (permissionRows = []) => {
  const result = new Map();

  permissionRows.forEach((permissionRow) => {
    result.set(permissionRow.moduleKey, normalizePermissionFlags(permissionRow));
  });

  return result;
};

const mergePermissionMaps = ({
  rolePermissionMap = new Map(),
  overridePermissionMap = new Map(),
}) => {
  const merged = {};

  getModuleCatalog().forEach((moduleItem) => {
    merged[moduleItem.key] =
      overridePermissionMap.get(moduleItem.key) ||
      rolePermissionMap.get(moduleItem.key) ||
      buildEmptyPermissionFlags();
  });

  return merged;
};

const hasModulePermission = (permissions = {}, moduleKey, actionKey = "view") => {
  const fieldKey = ACTION_FIELD_MAP[actionKey];
  if (!fieldKey) return false;

  return Boolean(permissions?.[moduleKey]?.[fieldKey]);
};

const resolveHomePath = (permissions = {}, resolvedRole = null) => {
  const preferredModule = getModuleConfigByKey(resolvedRole?.homeModuleKey);
  if (
    preferredModule?.routePath &&
    preferredModule.key !== "dashboard" &&
    hasModulePermission(permissions, preferredModule.key, "view")
  ) {
    return preferredModule.routePath;
  }

  const firstVisibleModule = getModuleCatalog().find(
    (moduleItem) =>
      moduleItem.routePath &&
      moduleItem.key !== "dashboard" &&
      moduleItem.isNavigable !== false &&
      hasModulePermission(permissions, moduleItem.key, "view")
  );

  if (firstVisibleModule?.routePath) {
    return firstVisibleModule.routePath;
  }

  const dashboardModule = getModuleConfigByKey("dashboard");
  if (
    dashboardModule?.routePath &&
    hasModulePermission(permissions, dashboardModule.key, "view")
  ) {
    return dashboardModule.routePath;
  }

  return "/access-denied";
};

const resolveScopeStrategy = ({ principal, resolvedRole }) => {
  const principalStrategy = normalizeText(principal?.accessScopeStrategy).toLowerCase();

  if (principalStrategy && principalStrategy !== "inherit") {
    return principalStrategy;
  }

  return normalizeText(resolvedRole?.scopeStrategy || "mapped").toLowerCase() || "mapped";
};

const resolveScope = ({ principalType, principal, resolvedRole }) => {
  const scopeStrategy = resolveScopeStrategy({ principal, resolvedRole });
  const siteIds = uniqueIdList(principal?.accessSiteIds);
  const departmentIds = uniqueIdList(principal?.accessDepartmentIds);
  const subDepartmentIds = uniqueIdList(principal?.accessSubDepartmentIds);
  const companyIds = uniqueIdList(principal?.accessCompanyIds);
  const employeeIds = uniqueIdList(principal?.accessEmployeeIds);
  const legacySiteId = normalizeId(principal?.site);

  const resolvedScope = {
    strategy: scopeStrategy,
    companyIds,
    siteIds: siteIds.length ? siteIds : legacySiteId ? [legacySiteId] : [],
    departmentIds,
    subDepartmentIds,
    employeeIds,
  };

  if (principalType === "employee") {
    const shouldInferEmployeeMappings = scopeStrategy !== "managed";

    if (shouldInferEmployeeMappings && !resolvedScope.siteIds.length) {
      resolvedScope.siteIds = uniqueIdList(principal?.sites);
    }

    if (shouldInferEmployeeMappings && !resolvedScope.departmentIds.length) {
      resolvedScope.departmentIds = uniqueIdList(principal?.department);
    }

    if (shouldInferEmployeeMappings && !resolvedScope.subDepartmentIds.length) {
      resolvedScope.subDepartmentIds = uniqueIdList(principal?.subDepartment);
    }

    if (scopeStrategy === "own" && !resolvedScope.employeeIds.length) {
      resolvedScope.employeeIds = [normalizeId(principal)];
    }
  }

  return resolvedScope;
};

const buildResolvedModules = (permissions = {}) =>
  getModuleCatalog().map((moduleItem) => ({
    ...moduleItem,
    permissions: permissions[moduleItem.key] || buildEmptyPermissionFlags(),
    isVisible: hasModulePermission(permissions, moduleItem.key, "view"),
  }));

const resolvePrincipalRole = async ({ principalType, principal }) => {
  const roleId = normalizeId(principal?.roleId);
  if (roleId) {
    const role = await Role.findById(roleId).lean();
    if (role) return role;
  }

  const fallbackRoleKey = getFallbackRoleKey({ principalType, principal });
  const fallbackRole = await Role.findOne({ key: fallbackRoleKey }).lean();

  if (fallbackRole) return fallbackRole;

  return {
    _id: null,
    key: fallbackRoleKey,
    name: getSystemRoleConfigByKey(fallbackRoleKey)?.name || "Role",
    dashboardType: getSystemRoleConfigByKey(fallbackRoleKey)?.dashboardType || "generic",
    scopeStrategy: getSystemRoleConfigByKey(fallbackRoleKey)?.scopeStrategy || "mapped",
    homeModuleKey: getSystemRoleConfigByKey(fallbackRoleKey)?.homeModuleKey || "dashboard",
  };
};

const resolvePrincipalAccess = async ({ principalType, principal }) => {
  const resolvedRole = await resolvePrincipalRole({ principalType, principal });
  const isDefaultAdmin = Boolean(principal?.isDefaultAdmin) || resolvedRole?.key === "main_admin";
  const [rolePermissionRows, overridePermissionRows] = await Promise.all([
    resolvedRole?._id
      ? RolePermission.find({ roleId: resolvedRole._id, isActive: true }).lean()
      : Promise.resolve([]),
    UserPermission.find({
      principalType,
      principalId: principal?._id,
      isActive: true,
    }).lean(),
  ]);
  const rolePermissionMap = getRolePermissionMap(rolePermissionRows);
  const overridePermissionMap = getRolePermissionMap(overridePermissionRows);
  const permissions = isDefaultAdmin
    ? getModuleCatalog().reduce((result, moduleItem) => {
        result[moduleItem.key] = Object.values(ACTION_FIELD_MAP).reduce((row, fieldKey) => {
          row[fieldKey] = true;
          return row;
        }, {});
        return result;
      }, {})
    : mergePermissionMaps({ rolePermissionMap, overridePermissionMap });
  const homePath = resolveHomePath(permissions, resolvedRole);
  const scope = resolveScope({ principalType, principal, resolvedRole });
  const legacyRole = getLegacyRoleFromPrincipal({ principalType, principal, resolvedRole });
  const modules = buildResolvedModules(permissions);
  const primarySiteId =
    normalizeId(principal?.site) ||
    (scope.siteIds.length === 1 ? scope.siteIds[0] : "");

  return {
    principalType,
    principalId: normalizeId(principal),
    principalName: normalizeText(
      principalType === "employee" ? principal?.employeeName : principal?.name
    ),
    principalEmail: normalizeText(principal?.email),
    isDefaultAdmin,
    role: resolvedRole,
    legacyRole,
    permissions,
    modules,
    scope,
    homePath,
    primarySiteId,
    checklistMasterAccess: hasModulePermission(permissions, "checklist_master", "view"),
  };
};

const buildSessionUserPayload = ({ principalType, principal, access }) => {
  const basePayload = {
    id: principal?._id,
    principalType,
    role: access.legacyRole,
    roleId: access.role?._id || null,
    roleKey: access.role?.key || "",
    roleName: access.role?.name || "",
    dashboardType: access.role?.dashboardType || "generic",
    homePath: access.homePath,
    isDefaultAdmin: access.isDefaultAdmin,
    checklistMasterAccess: access.checklistMasterAccess,
    siteId: access.primarySiteId || "",
    accessScope: access.scope,
  };

  if (principalType === "employee") {
    return {
      ...basePayload,
      name: principal?.employeeName || "",
      email: principal?.email || principal?.employeeCode || "",
      employeeCode: principal?.employeeCode || "",
    };
  }

  return {
    ...basePayload,
    name: principal?.name || "",
    email: principal?.email || "",
    siteName: principal?.site?.name || "",
    siteCompanyName: principal?.site?.companyName || "",
    siteDisplayName:
      principal?.site?.companyName && principal?.site?.name
        ? `${principal.site.companyName} - ${principal.site.name}`
        : principal?.site?.name || principal?.site?.companyName || "",
  };
};

module.exports = {
  buildSessionUserPayload,
  hasModulePermission,
  resolvePrincipalAccess,
};
