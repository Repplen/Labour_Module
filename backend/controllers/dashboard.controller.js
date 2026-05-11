const { Types } = require("mongoose");
const Checklist = require("../models/Checklist");
const ChecklistTask = require("../models/ChecklistTask");
const Company = require("../models/Company");
const Department = require("../models/Department");
const Employee = require("../models/Employee");
const PersonalTask = require("../models/PersonalTask");
const Site = require("../models/Site");
const User = require("../models/User");
const {
  isAllScope,
  resolveAccessibleEmployeeIds,
  resolveManagedEmployeeIds,
} = require("../services/accessScope.service");

const normalizeId = (value) => String(value?._id || value || "").trim();
const normalizeText = (value) => String(value || "").trim();
const normalizeIdentityValue = (value) => normalizeText(value).toLowerCase();
const scoredChecklistTaskFilter = {
  finalMark: { $ne: null },
  approvalType: { $ne: "nil" },
  isNilApproval: { $ne: true },
  status: { $nin: ["nil_for_approval", "nil_approved"] },
};
const normalizeTextList = (value) => {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();

  return rawValues
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .filter((item) => {
      const normalizedKey = item.toLowerCase();
      if (seen.has(normalizedKey)) return false;
      seen.add(normalizedKey);
      return true;
    });
};

const normalizeIdList = (value) => {
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

const buildIdentitySet = (values = []) =>
  new Set(
    values.map((value) => normalizeIdentityValue(value)).filter(Boolean)
  );

const matchesIdentitySet = (values = [], identitySet = new Set()) =>
  (Array.isArray(values) ? values : [values]).some((value) =>
    identitySet.has(normalizeIdentityValue(value))
  );

const getRequesterRole = (user) => normalizeText(user?.role).toLowerCase();

const isAdminRequester = (user) => getRequesterRole(user) === "admin";

const isEmployeeRequester = (user) => getRequesterRole(user) === "employee";

const hasDashboardAccess = (user) =>
  isAdminRequester(user) ||
  isEmployeeRequester(user) ||
  getRequesterRole(user) === "user" ||
  Boolean(user?.checklistMasterAccess);

const isValidObjectId = (value) => Types.ObjectId.isValid(normalizeId(value));

const getRestrictedDashboardSiteId = (user) => {
  if (isAdminRequester(user) || isEmployeeRequester(user)) return "";
  if (!(getRequesterRole(user) === "user" || Boolean(user?.checklistMasterAccess))) return "";

  const siteId = normalizeId(user?.siteId);
  return isValidObjectId(siteId) ? siteId : "";
};

const roundMarkValue = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return null;

  return Math.round(parsedValue * 100) / 100;
};

const calculatePerformancePercentage = (overallMark, targetMark) => {
  const normalizedOverallMark = Number(overallMark);
  const normalizedTargetMark = Number(targetMark);

  if (!Number.isFinite(normalizedOverallMark) || !Number.isFinite(normalizedTargetMark)) {
    return null;
  }

  if (normalizedTargetMark <= 0) {
    return null;
  }

  return roundMarkValue((normalizedOverallMark / normalizedTargetMark) * 100);
};

const summarizeEmployeeMarks = (employees = []) => {
  let totalMark = 0;
  let hasScoredMark = false;
  let scoredChecklistCount = 0;
  let targetMark = 0;

  for (const employee of employees) {
    const overallMark = Number(employee?.overallMark);
    if (Number.isFinite(overallMark)) {
      totalMark += overallMark;
      hasScoredMark = true;
    }

    scoredChecklistCount += Number(employee?.scoredChecklistCount || 0);
    targetMark += Number(employee?.targetMark || 0);
  }

  const normalizedOverallMark = hasScoredMark ? roundMarkValue(totalMark) : null;
  const normalizedTargetMark = roundMarkValue(targetMark) ?? 0;

  return {
    overallMark: normalizedOverallMark,
    scoredChecklistCount,
    targetMark: normalizedTargetMark,
    performancePercentage: calculatePerformancePercentage(
      normalizedOverallMark,
      normalizedTargetMark
    ),
  };
};

const sortByLabel = (left, right) =>
  String(
    left?.label || left?.name || left?.employeeName || left?.employeeCode || ""
  ).localeCompare(
    String(
      right?.label || right?.name || right?.employeeName || right?.employeeCode || ""
    ),
    "en",
    { sensitivity: "base" }
  );

const getSortableOverallMark = (item) => {
  const parsedValue = Number(item?.overallMark);
  return Number.isFinite(parsedValue) ? parsedValue : Number.NEGATIVE_INFINITY;
};

const sortByOverallMarkDescending = (left, right) => {
  const leftMark = getSortableOverallMark(left);
  const rightMark = getSortableOverallMark(right);

  if (leftMark !== rightMark) {
    return rightMark - leftMark;
  }

  return sortByLabel(left, right);
};

const findSubDepartmentTrail = (rows = [], subDepartmentId, trail = []) => {
  for (const row of rows) {
    const nextTrail = [...trail, row.name];

    if (normalizeId(row?._id) === normalizeId(subDepartmentId)) {
      return nextTrail;
    }

    const childTrail = findSubDepartmentTrail(row.children || [], subDepartmentId, nextTrail);
    if (childTrail) return childTrail;
  }

  return null;
};

const flattenSubDepartments = (rows = [], trail = [], department = null) =>
  rows.flatMap((row) => {
    const nextTrail = [...trail, row.name];

    return [
      {
        _id: normalizeId(row?._id),
        name: row.name || "",
        departmentId: normalizeId(department?._id),
        departmentName: department?.name || "",
        label: department?.name
          ? `${department.name} > ${nextTrail.join(" > ")}`
          : nextTrail.join(" > "),
      },
      ...flattenSubDepartments(row.children || [], nextTrail, department),
    ];
  });

const getEmployeeSubDepartmentDetails = (departmentRows = [], subDepartmentRefs = []) =>
  normalizeIdList(subDepartmentRefs)
    .map((subDepartmentId) => {
      for (const department of departmentRows) {
        const trail = findSubDepartmentTrail(department?.subDepartments || [], subDepartmentId);
        if (!trail?.length) continue;

        return {
          _id: subDepartmentId,
          departmentId: normalizeId(department?._id),
          departmentName: department?.name || "",
          name: trail[trail.length - 1] || "",
          path: department?.name
            ? `${department.name} > ${trail.join(" > ")}`
            : trail.join(" > "),
        };
      }

      return null;
    })
    .filter(Boolean);

const applyEmployeeDashboardMarkSummary = (employee, markSummary = null) => ({
  ...employee,
  overallMark: roundMarkValue(markSummary?.overallMark),
  scoredChecklistCount: Number(markSummary?.scoredChecklistCount || 0),
  targetMark: roundMarkValue(markSummary?.targetMark) ?? 0,
  performancePercentage: calculatePerformancePercentage(
    roundMarkValue(markSummary?.overallMark),
    roundMarkValue(markSummary?.targetMark) ?? 0
  ),
});

const buildEmployeeDashboardRow = (employeeDoc, employeeMarkMap = new Map()) => {
  const departmentRows = (Array.isArray(employeeDoc?.department) ? employeeDoc.department : [])
    .filter((row) => row && typeof row === "object");
  const departmentIds = normalizeIdList(
    departmentRows.length ? departmentRows.map((row) => row._id) : employeeDoc?.department
  );
  const departmentDisplay = departmentRows
    .map((row) => String(row?.name || "").trim())
    .filter(Boolean)
    .join(", ");
  const subDepartmentIds = normalizeIdList(employeeDoc?.subDepartment);
  const subDepartmentDetails = getEmployeeSubDepartmentDetails(
    departmentRows,
    subDepartmentIds
  );
  const subDepartmentDisplay = subDepartmentDetails
    .map((row) => String(row?.path || row?.name || "").trim())
    .filter(Boolean)
    .join(", ");
  const employeeId = normalizeId(employeeDoc?._id);
  const siteIds = normalizeIdList(employeeDoc?.sites);

  return applyEmployeeDashboardMarkSummary(
    {
      _id: employeeId,
      employeeCode: employeeDoc?.employeeCode || "",
      employeeName: employeeDoc?.employeeName || "",
      photo: employeeDoc?.photo || null,
      isActive: employeeDoc?.isActive !== false,
      siteIds,
      departmentIds,
      subDepartmentIds,
      departmentDisplay,
      subDepartmentDisplay,
    },
    employeeMarkMap.get(employeeId)
  );
};

const sanitizeEmployeeDashboardRow = (employee = {}) => {
  const { siteIds, departmentIds, subDepartmentIds, ...safeEmployee } = employee;
  return safeEmployee;
};

const buildDepartmentChoices = (departmentDocs = [], employees = []) => {
  return departmentDocs
    .map((department) => {
      const departmentId = normalizeId(department?._id);
      const departmentEmployees = employees.filter((employee) =>
        (employee.departmentIds || []).includes(departmentId)
      );
      const markSummary = summarizeEmployeeMarks(departmentEmployees);

      return {
        _id: departmentId,
        name: department?.name || "",
        employeeCount: departmentEmployees.length,
        subDepartmentCount: flattenSubDepartments(
          department?.subDepartments || [],
          [],
          department
        ).length,
        overallMark: markSummary.overallMark,
        scoredChecklistCount: markSummary.scoredChecklistCount,
        targetMark: markSummary.targetMark,
        performancePercentage: markSummary.performancePercentage,
      };
    })
    .filter((department) => department.employeeCount > 0)
    .sort(sortByOverallMarkDescending);
};

const buildScopedSubDepartmentChoices = (departmentDocs = [], employees = []) => {
  return departmentDocs
    .flatMap((departmentDoc) => {
      const departmentId = normalizeId(departmentDoc?._id);
      const departmentEmployees = employees.filter((employee) =>
        (employee.departmentIds || []).includes(departmentId)
      );

      return buildSubDepartmentChoices(departmentDoc, departmentEmployees);
    })
    .sort(sortByOverallMarkDescending);
};

const buildSubDepartmentChoices = (departmentDoc, employees = []) => {
  return flattenSubDepartments(departmentDoc?.subDepartments || [], [], departmentDoc)
    .map((subDepartment) => {
      const subDepartmentEmployees = employees.filter((employee) =>
        (employee.subDepartmentIds || []).includes(subDepartment._id)
      );
      const markSummary = summarizeEmployeeMarks(subDepartmentEmployees);

      return {
        ...subDepartment,
        employeeCount: subDepartmentEmployees.length,
        overallMark: markSummary.overallMark,
        scoredChecklistCount: markSummary.scoredChecklistCount,
        targetMark: markSummary.targetMark,
        performancePercentage: markSummary.performancePercentage,
      };
    })
    .filter((subDepartment) => subDepartment.employeeCount > 0)
    .sort(sortByOverallMarkDescending);
};

const buildCompanyChoices = (companyDocs = [], siteDocs = [], employees = []) => {
  const siteMap = new Map(
    siteDocs.map((site) => [normalizeId(site?._id), normalizeText(site?.companyName)])
  );
  const companyNames = new Set();

  for (const companyDoc of companyDocs) {
    const companyName = normalizeText(companyDoc?.name);
    if (companyName) companyNames.add(companyName);
  }

  for (const siteDoc of siteDocs) {
    const companyName = normalizeText(siteDoc?.companyName);
    if (companyName) companyNames.add(companyName);
  }

  return Array.from(companyNames)
    .map((companyName) => {
      const companyEmployees = employees.filter((employee) =>
        (employee.siteIds || []).some(
          (siteId) => normalizeText(siteMap.get(siteId)) === companyName
        )
      );
      const markSummary = summarizeEmployeeMarks(companyEmployees);
      const departmentIdSet = new Set(
        companyEmployees.flatMap((employee) => employee.departmentIds || []).filter(Boolean)
      );
      const subDepartmentIdSet = new Set(
        companyEmployees.flatMap((employee) => employee.subDepartmentIds || []).filter(Boolean)
      );

      return {
        _id: companyName,
        name: companyName,
        siteCount: siteDocs.filter(
          (siteDoc) => normalizeText(siteDoc?.companyName) === companyName
        ).length,
        departmentCount: departmentIdSet.size,
        subDepartmentCount: subDepartmentIdSet.size,
        employeeCount: companyEmployees.length,
        overallMark: markSummary.overallMark,
        scoredChecklistCount: markSummary.scoredChecklistCount,
        targetMark: markSummary.targetMark,
        performancePercentage: markSummary.performancePercentage,
      };
    })
    .sort(sortByOverallMarkDescending);
};

const buildSiteChoices = (siteDocs = [], employees = [], companyName = "") => {
  return siteDocs
    .filter((siteDoc) =>
      !companyName || normalizeText(siteDoc?.companyName) === normalizeText(companyName)
    )
    .map((siteDoc) => {
      const siteId = normalizeId(siteDoc?._id);
      const siteEmployees = employees.filter((employee) => (employee.siteIds || []).includes(siteId));
      const markSummary = summarizeEmployeeMarks(siteEmployees);
      const departmentIdSet = new Set(
        siteEmployees.flatMap((employee) => employee.departmentIds || []).filter(Boolean)
      );
      const subDepartmentIdSet = new Set(
        siteEmployees.flatMap((employee) => employee.subDepartmentIds || []).filter(Boolean)
      );

      return {
        _id: siteId,
        name: siteDoc?.name || "",
        companyName: normalizeText(siteDoc?.companyName),
        departmentCount: departmentIdSet.size,
        subDepartmentCount: subDepartmentIdSet.size,
        employeeCount: siteEmployees.length,
        overallMark: markSummary.overallMark,
        scoredChecklistCount: markSummary.scoredChecklistCount,
        targetMark: markSummary.targetMark,
        performancePercentage: markSummary.performancePercentage,
      };
    })
    .sort(sortByOverallMarkDescending);
};

const buildSiteLeadChoices = (siteDocs = [], employees = []) =>
  Array.from(
    new Set(
      siteDocs.flatMap((siteDoc) => normalizeTextList(siteDoc?.siteLeadNames || []))
    )
  )
    .map((leadName) => {
      const leadSites = siteDocs.filter((siteDoc) =>
        normalizeTextList(siteDoc?.siteLeadNames || []).includes(leadName)
      );
      const leadSiteIds = new Set(
        leadSites.map((siteDoc) => normalizeId(siteDoc?._id)).filter(Boolean)
      );
      const leadEmployees = employees.filter((employee) =>
        (employee.siteIds || []).some((siteId) => leadSiteIds.has(siteId))
      );
      const markSummary = summarizeEmployeeMarks(leadEmployees);

      return {
        _id: leadName,
        name: leadName,
        siteCount: leadSites.length,
        employeeCount: leadEmployees.length,
        overallMark: markSummary.overallMark,
        scoredChecklistCount: markSummary.scoredChecklistCount,
      };
    })
    .filter((lead) => lead.siteCount > 0)
    .sort(sortByOverallMarkDescending);

const buildDepartmentLeadChoices = (departmentDocs = [], employees = []) =>
  Array.from(
    new Set(
      departmentDocs.flatMap((departmentDoc) =>
        normalizeTextList(departmentDoc?.departmentLeadNames || [])
      )
    )
  )
    .map((leadName) => {
      const leadDepartments = departmentDocs.filter((departmentDoc) =>
        normalizeTextList(departmentDoc?.departmentLeadNames || []).includes(leadName)
      );
      const leadDepartmentIds = new Set(
        leadDepartments.map((departmentDoc) => normalizeId(departmentDoc?._id)).filter(Boolean)
      );
      const leadEmployees = employees.filter((employee) =>
        (employee.departmentIds || []).some((departmentId) => leadDepartmentIds.has(departmentId))
      );
      const markSummary = summarizeEmployeeMarks(leadEmployees);

      return {
        _id: leadName,
        name: leadName,
        departmentCount: leadDepartments.length,
        employeeCount: leadEmployees.length,
        overallMark: markSummary.overallMark,
        scoredChecklistCount: markSummary.scoredChecklistCount,
      };
    })
    .filter((lead) => lead.departmentCount > 0)
    .sort(sortByOverallMarkDescending);

const buildCompletedTaskRows = async (employeeId, access = null, options = {}) => {
  const normalizedEmployeeId = normalizeId(employeeId);
  if (!normalizedEmployeeId) return [];

  const taskFilter = await buildDashboardTaskScopeFilter(access, [], {
    employeeIds: [normalizedEmployeeId],
    scoredOnly: true,
    siteIds: options.siteIds,
  });

  if (taskFilter?._id === null) {
    return [];
  }

  return ChecklistTask.find(
    taskFilter,
    "taskNumber checklistName occurrenceDate completedAt status timelinessStatus finalMark"
  )
    .sort({ completedAt: -1, occurrenceDate: -1 })
    .lean();
};

const getLatestDateValue = (values = []) =>
  values
    .map((value) => (value ? new Date(value) : null))
    .filter((value) => value && !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())[0] || null;

const resolveDashboardLeadershipScope = async ({
  user,
  access = null,
  companyDocs = [],
  departmentDocs = [],
  siteDocs = [],
}) => {
  const identityValues = [
    user?.name,
    user?.employeeName,
    user?.employeeCode,
    user?.email,
    access?.principalName,
    access?.principalEmail,
  ];
  const principalId = normalizeId(access?.principalId || user?.id);
  const principalType = normalizeText(access?.principalType).toLowerCase();
  let employee = null;

  if (principalId && (principalType === "employee" || getRequesterRole(user) === "employee")) {
    employee = await Employee.findById(
      principalId,
      "employeeCode employeeName email isActive"
    ).lean();

    if (employee?.isActive === false) {
      return {
        companyNames: [],
        departmentIds: [],
        employeeIds: [],
        siteIds: [],
      };
    }

    identityValues.push(employee?.employeeName, employee?.employeeCode, employee?.email);
  }

  const identitySet = buildIdentitySet(identityValues);
  if (!identitySet.size && !employee?._id) {
    return {
      companyNames: [],
      departmentIds: [],
      employeeIds: [],
      siteIds: [],
    };
  }

  const companyNames = companyDocs
    .filter((companyDoc) => matchesIdentitySet(companyDoc?.directorNames, identitySet))
    .map((companyDoc) => normalizeText(companyDoc?.name))
    .filter(Boolean);
  const companyNameSet = new Set(companyNames);
  const siteIds = siteDocs
    .filter((siteDoc) => {
      const companyMatch = companyNameSet.has(normalizeText(siteDoc?.companyName));
      const siteHeadMatch =
        matchesIdentitySet(siteDoc?.headNames, identitySet) ||
        matchesIdentitySet(siteDoc?.siteLeadNames, identitySet);

      return companyMatch || siteHeadMatch;
    })
    .map((siteDoc) => normalizeId(siteDoc?._id))
    .filter(Boolean);
  const departmentIds = departmentDocs
    .filter(
      (departmentDoc) =>
        matchesIdentitySet(departmentDoc?.headNames, identitySet) ||
        matchesIdentitySet(departmentDoc?.departmentLeadNames, identitySet)
    )
    .map((departmentDoc) => normalizeId(departmentDoc?._id))
    .filter(Boolean);
  const managedEmployeeIds = employee?._id
    ? await resolveManagedEmployeeIds(employee._id)
    : [];

  return {
    companyNames: [...companyNameSet],
    departmentIds: [...new Set(departmentIds)],
    employeeIds: [...new Set(managedEmployeeIds)],
    siteIds: [...new Set(siteIds)],
  };
};

const filterDashboardSnapshotForViewer = async ({
  user,
  access = null,
  companyDocs = [],
  departmentDocs = [],
  siteDocs = [],
  employees = [],
}) => {
  if (access) {
    if (isAllScope(access)) {
      return { companyDocs, departmentDocs, siteDocs, employees };
    }

    const leadershipScope = await resolveDashboardLeadershipScope({
      user,
      access,
      companyDocs,
      departmentDocs,
      siteDocs,
    });
    const accessibleEmployeeIds = [
      ...new Set([
        ...(await resolveAccessibleEmployeeIds(access)),
        ...leadershipScope.employeeIds,
      ]),
    ];
    const accessibleEmployeeIdSet = new Set(accessibleEmployeeIds);
    const leadershipSiteIdSet = new Set(normalizeIdList(leadershipScope.siteIds));
    const leadershipDepartmentIdSet = new Set(normalizeIdList(leadershipScope.departmentIds));
    const scopedEmployees = employees.filter((employee) => {
      if (accessibleEmployeeIdSet.has(normalizeId(employee?._id))) {
        return true;
      }

      const siteMatch = (employee.siteIds || []).some((siteId) =>
        leadershipSiteIdSet.has(siteId)
      );
      const departmentMatch = (employee.departmentIds || []).some((departmentId) =>
        leadershipDepartmentIdSet.has(departmentId)
      );

      return siteMatch || departmentMatch;
    });
    const scopedSiteIdSet = new Set([
      ...normalizeIdList(access?.scope?.siteIds),
      ...normalizeIdList(leadershipScope.siteIds),
    ]);
    const scopedDepartmentIdSet = new Set([
      ...normalizeIdList(access?.scope?.departmentIds),
      ...normalizeIdList(leadershipScope.departmentIds),
    ]);
    const scopedCompanyIdSet = new Set(normalizeIdList(access?.scope?.companyIds));
    const scopedCompanyNameSet = new Set(
      normalizeTextList(leadershipScope.companyNames)
    );

    scopedEmployees.forEach((employee) => {
      (employee.siteIds || []).forEach((siteId) => {
        if (siteId) {
          scopedSiteIdSet.add(siteId);
        }
      });

      (employee.departmentIds || []).forEach((departmentId) => {
        if (departmentId) {
          scopedDepartmentIdSet.add(departmentId);
        }
      });
    });

    const scopedSiteDocs = siteDocs.filter((siteDoc) => {
      const siteId = normalizeId(siteDoc?._id);
      const matchesScope = scopedSiteIdSet.has(siteId);

      if (matchesScope) {
        const companyName = normalizeText(siteDoc?.companyName);
        if (companyName) {
          scopedCompanyNameSet.add(companyName);
        }
      }

      return matchesScope;
    });

    scopedSiteDocs.forEach((siteDoc) => {
      const companyName = normalizeText(siteDoc?.companyName);
      if (companyName) {
        scopedCompanyNameSet.add(companyName);
      }
    });

    return {
      companyDocs: companyDocs.filter((companyDoc) => {
        const companyId = normalizeId(companyDoc?._id);
        const companyName = normalizeText(companyDoc?.name);
        return scopedCompanyIdSet.has(companyId) || scopedCompanyNameSet.has(companyName);
      }),
      departmentDocs: departmentDocs.filter((departmentDoc) =>
        scopedDepartmentIdSet.has(normalizeId(departmentDoc?._id))
      ),
      siteDocs: scopedSiteDocs,
      employees: scopedEmployees,
      taskSiteScopeIds: normalizeIdList([
        ...normalizeIdList(access?.scope?.siteIds),
        ...normalizeIdList(leadershipScope.siteIds),
      ]),
    };
  }

  if (!user || isAdminRequester(user)) {
    return { companyDocs, departmentDocs, siteDocs, employees };
  }

  if (!hasDashboardAccess(user)) {
    return {
      companyDocs: [],
      departmentDocs: [],
      siteDocs: [],
      employees: [],
    };
  }

  const siteDocById = new Map(siteDocs.map((siteDoc) => [normalizeId(siteDoc?._id), siteDoc]));
  const restrictedSiteId = getRestrictedDashboardSiteId(user);

  if (restrictedSiteId) {
    const scopedSiteDocs = siteDocs.filter(
      (siteDoc) => normalizeId(siteDoc?._id) === restrictedSiteId
    );
    const scopedSiteIdSet = new Set(
      scopedSiteDocs.map((siteDoc) => normalizeId(siteDoc?._id)).filter(Boolean)
    );
    const scopedEmployees = employees.filter((employee) =>
      (employee.siteIds || []).some((siteId) => scopedSiteIdSet.has(siteId))
    );
    const scopedDepartmentIdSet = new Set(
      scopedEmployees.flatMap((employee) => employee.departmentIds || []).filter(Boolean)
    );
    const scopedCompanyNameSet = new Set(
      scopedSiteDocs.map((siteDoc) => normalizeText(siteDoc?.companyName)).filter(Boolean)
    );

    return {
      companyDocs: companyDocs.filter((companyDoc) =>
        scopedCompanyNameSet.has(normalizeText(companyDoc?.name))
      ),
      departmentDocs: departmentDocs.filter((departmentDoc) =>
        scopedDepartmentIdSet.has(normalizeId(departmentDoc?._id))
      ),
      siteDocs: scopedSiteDocs,
      employees: scopedEmployees,
      taskSiteScopeIds: normalizeIdList(Array.from(scopedSiteIdSet)),
    };
  }

  if (!isEmployeeRequester(user)) {
    return { companyDocs, departmentDocs, siteDocs, employees };
  }

  const viewer = await Employee.findById(
    user?.id,
    "employeeCode employeeName email sites department isActive"
  ).lean();

  if (!viewer || viewer.isActive === false) {
    return {
      companyDocs: [],
      departmentDocs: [],
      siteDocs: [],
      employees: [],
    };
  }

  const viewerIdentitySet = buildIdentitySet([
    viewer.employeeName,
    viewer.employeeCode,
    viewer.email,
    user?.email,
  ]);
  const allowedCompanyNameSet = new Set(
    companyDocs
      .filter((companyDoc) => matchesIdentitySet(companyDoc?.directorNames, viewerIdentitySet))
      .map((companyDoc) => normalizeText(companyDoc?.name))
      .filter(Boolean)
  );
  const allowedSiteIdSet = new Set([
    ...normalizeIdList(viewer?.sites),
    ...siteDocs
      .filter(
        (siteDoc) =>
          matchesIdentitySet(siteDoc?.headNames, viewerIdentitySet) ||
          matchesIdentitySet(siteDoc?.siteLeadNames, viewerIdentitySet)
      )
      .map((siteDoc) => normalizeId(siteDoc?._id))
      .filter(Boolean),
  ]);
  const allowedDepartmentIdSet = new Set([
    ...normalizeIdList(viewer?.department),
    ...departmentDocs
      .filter(
        (departmentDoc) =>
          matchesIdentitySet(departmentDoc?.headNames, viewerIdentitySet) ||
          matchesIdentitySet(departmentDoc?.departmentLeadNames, viewerIdentitySet)
      )
      .map((departmentDoc) => normalizeId(departmentDoc?._id))
      .filter(Boolean),
  ]);
  const scopedEmployees = employees.filter((employee) => {
    const siteMatch = (employee.siteIds || []).some((siteId) => allowedSiteIdSet.has(siteId));
    const departmentMatch = (employee.departmentIds || []).some((departmentId) =>
      allowedDepartmentIdSet.has(departmentId)
    );

    return siteMatch || departmentMatch || normalizeId(employee?._id) === normalizeId(viewer?._id);
  });
  const scopedSiteIdSet = new Set(allowedSiteIdSet);
  const scopedDepartmentIdSet = new Set(allowedDepartmentIdSet);
  const scopedCompanyNameSet = new Set(allowedCompanyNameSet);

  scopedEmployees.forEach((employee) => {
    (employee.siteIds || []).forEach((siteId) => {
      if (!siteId) return;
      scopedSiteIdSet.add(siteId);

      const siteDoc = siteDocById.get(siteId);
      const companyName = normalizeText(siteDoc?.companyName);
      if (companyName) {
        scopedCompanyNameSet.add(companyName);
      }
    });

    (employee.departmentIds || []).forEach((departmentId) => {
      if (departmentId) {
        scopedDepartmentIdSet.add(departmentId);
      }
    });
  });

  const scopedSiteDocs = siteDocs.filter((siteDoc) => {
    const siteId = normalizeId(siteDoc?._id);
    const companyName = normalizeText(siteDoc?.companyName);

    return scopedSiteIdSet.has(siteId) || scopedCompanyNameSet.has(companyName);
  });

  scopedSiteDocs.forEach((siteDoc) => {
    const companyName = normalizeText(siteDoc?.companyName);
    if (companyName) {
      scopedCompanyNameSet.add(companyName);
    }
  });

  return {
    companyDocs: companyDocs.filter((companyDoc) =>
      scopedCompanyNameSet.has(normalizeText(companyDoc?.name))
    ),
    departmentDocs: departmentDocs.filter((departmentDoc) =>
      scopedDepartmentIdSet.has(normalizeId(departmentDoc?._id))
    ),
    siteDocs: scopedSiteDocs,
    employees: scopedEmployees,
    taskSiteScopeIds: normalizeIdList(Array.from(scopedSiteIdSet)),
  };
};

const buildDashboardSnapshot = async (user = null, access = null) => {
  const [companyDocs, departmentDocs, siteDocs, employeeDocs] = await Promise.all([
    Company.find({}, "name directorNames").sort({ name: 1 }).lean(),
    Department.find({}, "name subDepartments headNames departmentLeadNames").sort({ name: 1 }).lean(),
    Site.find({}, "companyName name headNames siteLeadNames").sort({ name: 1 }).lean(),
    Employee.find(
      {},
      "employeeCode employeeName email photo isActive department subDepartment sites"
    )
      .populate("department", "name subDepartments")
      .lean(),
  ]);

  const employees = employeeDocs
    .map((employee) => buildEmployeeDashboardRow(employee))
    .sort(sortByOverallMarkDescending);
  const scopedSnapshot = await filterDashboardSnapshotForViewer({
    user,
    access,
    companyDocs,
    departmentDocs,
    siteDocs,
    employees,
  });
  const markTaskFilter = await buildDashboardTaskScopeFilter(
    access,
    scopedSnapshot.employees,
    { scoredOnly: true, siteIds: scopedSnapshot.taskSiteScopeIds }
  );
  const employeeMarkRows =
    markTaskFilter?._id === null
      ? []
      : await ChecklistTask.aggregate([
          { $match: markTaskFilter },
          {
            $group: {
              _id: "$assignedEmployee",
              overallMark: { $sum: "$finalMark" },
              scoredChecklistCount: { $sum: 1 },
              targetMark: {
                $sum: {
                  $ifNull: ["$baseMark", 0],
                },
              },
            },
          },
        ]);
  const employeeMarkMap = new Map(
    employeeMarkRows.map((row) => [
      normalizeId(row?._id),
      {
        overallMark: row?.overallMark,
        scoredChecklistCount: row?.scoredChecklistCount,
        targetMark: row?.targetMark,
      },
    ])
  );
  scopedSnapshot.employees = scopedSnapshot.employees
    .map((employee) =>
      applyEmployeeDashboardMarkSummary(employee, employeeMarkMap.get(employee._id))
    )
    .sort(sortByOverallMarkDescending);
  const departments = buildDepartmentChoices(
    scopedSnapshot.departmentDocs,
    scopedSnapshot.employees
  );
  const subDepartments = buildScopedSubDepartmentChoices(
    scopedSnapshot.departmentDocs,
    scopedSnapshot.employees
  );
  const companies = buildCompanyChoices(
    scopedSnapshot.companyDocs,
    scopedSnapshot.siteDocs,
    scopedSnapshot.employees
  );
  const sites = buildSiteChoices(scopedSnapshot.siteDocs, scopedSnapshot.employees);

  return {
    companies,
    departmentDocs: scopedSnapshot.departmentDocs,
    departments,
    employees: scopedSnapshot.employees,
    sites,
    siteDocs: scopedSnapshot.siteDocs,
    subDepartments,
    taskSiteScopeIds: scopedSnapshot.taskSiteScopeIds || [],
  };
};

const countScopedChecklistTasks = async (access = null, scopedEmployees = [], options = {}) => {
  if (!access || isAllScope(access)) {
    return ChecklistTask.countDocuments();
  }

  const taskFilter = await buildDashboardTaskScopeFilter(access, scopedEmployees, {
    siteIds: options.siteIds,
  });
  if (taskFilter?._id === null) {
    return 0;
  }

  return ChecklistTask.countDocuments(taskFilter);
};

const getDashboardLastUpdated = async (access = null, scopedEmployees = [], options = {}) => {
  if (!access || isAllScope(access)) {
    const [
      latestEmployee,
      latestChecklist,
      latestChecklistTask,
      latestDepartment,
    ] = await Promise.all([
      Employee.findOne({}, "updatedAt").sort({ updatedAt: -1 }).lean(),
      Checklist.findOne({}, "updatedAt").sort({ updatedAt: -1 }).lean(),
      ChecklistTask.findOne({}, "updatedAt").sort({ updatedAt: -1 }).lean(),
      Department.findOne({}, "updatedAt").sort({ updatedAt: -1 }).lean(),
    ]);

    return getLatestDateValue([
      latestEmployee?.updatedAt,
      latestChecklist?.updatedAt,
      latestChecklistTask?.updatedAt,
      latestDepartment?.updatedAt,
    ]);
  }

  const scopedEmployeeIds = toObjectIdList(
    (scopedEmployees || []).map((employee) => employee?._id)
  );
  const taskFilter = await buildDashboardTaskScopeFilter(access, scopedEmployees, {
    siteIds: options.siteIds,
  });
  const employeeFilter = scopedEmployeeIds.length
    ? { _id: { $in: scopedEmployeeIds } }
    : { _id: null };

  const [latestEmployee, latestChecklistTask] = await Promise.all([
    Employee.findOne(employeeFilter, "updatedAt").sort({ updatedAt: -1 }).lean(),
    taskFilter?._id === null
      ? Promise.resolve(null)
      : ChecklistTask.findOne(taskFilter, "updatedAt").sort({ updatedAt: -1 }).lean(),
  ]);

  return getLatestDateValue([
    latestEmployee?.updatedAt,
    latestChecklistTask?.updatedAt,
  ]);
};

const parseDateBoundary = (value, boundary = "start") => {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return null;

  const parsedValue = new Date(normalizedValue);
  if (Number.isNaN(parsedValue.getTime())) {
    return null;
  }

  if (boundary === "end") {
    parsedValue.setHours(23, 59, 59, 999);
  } else {
    parsedValue.setHours(0, 0, 0, 0);
  }

  return parsedValue;
};

const formatScheduleTypeLabel = (value) => {
  const normalizedValue = normalizeText(value).toLowerCase();
  if (!normalizedValue) return "";

  return normalizedValue
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const buildSelectOption = (id, label) => ({
  _id: id,
  name: label,
  label,
});

const toObjectIdList = (values = []) =>
  normalizeIdList(values)
    .filter((value) => Types.ObjectId.isValid(value))
    .map((value) => new Types.ObjectId(value));

const getAccessScopeStrategy = (access = {}) =>
  normalizeText(access?.scope?.strategy).toLowerCase();

const resolveDashboardSiteScopeIds = async (access = {}) => {
  if (!access || isAllScope(access) || getAccessScopeStrategy(access) === "own") {
    return [];
  }

  let siteIds = normalizeIdList(access?.scope?.siteIds);
  const companyIds = normalizeIdList(access?.scope?.companyIds);

  if (companyIds.length) {
    const companyDocs = await Company.find({ _id: { $in: companyIds } }, "name").lean();
    const companyNames = [
      ...new Set(
        companyDocs
          .map((companyDoc) => normalizeText(companyDoc?.name))
          .filter(Boolean)
      ),
    ];

    if (companyNames.length) {
      const companySiteDocs = await Site.find(
        { companyName: { $in: companyNames } },
        "_id"
      ).lean();
      siteIds = normalizeIdList([
        ...siteIds,
        ...companySiteDocs.map((siteDoc) => siteDoc._id),
      ]);
    }
  }

  return siteIds;
};

const buildDashboardTaskScopeFilter = async (
  access = null,
  scopedEmployees = [],
  { employeeIds = [], scoredOnly = false, siteIds = [] } = {}
) => {
  const filter = scoredOnly ? { ...scoredChecklistTaskFilter } : {};
  const forcedEmployeeIds = normalizeIdList(employeeIds);

  if (!access || isAllScope(access)) {
    if (forcedEmployeeIds.length) {
      const employeeObjectIds = toObjectIdList(forcedEmployeeIds);
      if (!employeeObjectIds.length) return { _id: null };
      filter.assignedEmployee = { $in: employeeObjectIds };
    }

    return filter;
  }

  const scopedEmployeeIds = forcedEmployeeIds.length
    ? forcedEmployeeIds
    : normalizeIdList((scopedEmployees || []).map((employee) => employee?._id));
  const employeeObjectIds = toObjectIdList(scopedEmployeeIds);

  if (!employeeObjectIds.length) {
    return { _id: null };
  }

  filter.assignedEmployee = { $in: employeeObjectIds };

  const siteScopeIds = normalizeIdList([
    ...(await resolveDashboardSiteScopeIds(access)),
    ...normalizeIdList(siteIds),
  ]);
  if (siteScopeIds.length) {
    const checklistDocs = await Checklist.find(
      { employeeAssignedSite: { $in: toObjectIdList(siteScopeIds) } },
      "_id"
    ).lean();
    const checklistObjectIds = toObjectIdList(checklistDocs.map((checklistDoc) => checklistDoc._id));

    if (!checklistObjectIds.length) {
      return { _id: null };
    }

    filter.checklist = { $in: checklistObjectIds };
  }

  return filter;
};

const buildSummaryFilterEmployees = ({
  employees = [],
  siteDocs = [],
  company = "",
  site = "",
  department = "",
  subDepartment = "",
  employee = "",
}) => {
  const normalizedCompany = normalizeText(company);
  const normalizedSite = normalizeId(site);
  const normalizedDepartment = normalizeId(department);
  const normalizedSubDepartment = normalizeId(subDepartment);
  const normalizedEmployee = normalizeId(employee);
  const siteById = new Map(
    (siteDocs || []).map((siteDoc) => [normalizeId(siteDoc?._id), siteDoc])
  );

  return (employees || []).filter((employeeRow) => {
    if (normalizedEmployee && employeeRow._id !== normalizedEmployee) {
      return false;
    }

    if (normalizedSubDepartment && !(employeeRow.subDepartmentIds || []).includes(normalizedSubDepartment)) {
      return false;
    }

    if (normalizedDepartment && !(employeeRow.departmentIds || []).includes(normalizedDepartment)) {
      return false;
    }

    if (normalizedSite && !(employeeRow.siteIds || []).includes(normalizedSite)) {
      return false;
    }

    if (normalizedCompany) {
      const matchesCompany = (employeeRow.siteIds || []).some((siteId) => {
        const siteDoc = siteById.get(siteId);
        return normalizeText(siteDoc?.companyName) === normalizedCompany;
      });

      if (!matchesCompany) {
        return false;
      }
    }

    return true;
  });
};

const buildHierarchicalSummaryCards = ({
  totalChecklistMark = 0,
  selectedCompany = null,
  selectedSite = null,
  selectedDepartment = null,
  selectedSubDepartment = null,
  selectedEmployee = null,
  checklistTypeLabel = "",
  employeeCount = 0,
}) => ({
  company: selectedCompany
    ? {
        label: "Company",
        name: selectedCompany.name || "-",
        totalMark: roundMarkValue(totalChecklistMark) || 0,
      }
    : null,
  site: selectedSite
    ? {
        label: "Site",
        name: selectedSite.name || "-",
        totalMark: roundMarkValue(totalChecklistMark) || 0,
      }
    : null,
  department: selectedDepartment
    ? {
        label: "Department",
        name: selectedDepartment.name || "-",
        totalMark: roundMarkValue(totalChecklistMark) || 0,
      }
    : null,
  subDepartment: selectedSubDepartment
    ? {
        label: "Sub-Department",
        name: selectedSubDepartment.label || selectedSubDepartment.name || "-",
        totalMark: roundMarkValue(totalChecklistMark) || 0,
      }
    : null,
  employee: {
    label: "Employee",
    name:
      selectedEmployee?.employeeName ||
      selectedEmployee?.employeeCode ||
      (employeeCount === 1 ? "1 employee" : `${employeeCount} employees`),
    totalMark: roundMarkValue(totalChecklistMark) || 0,
  },
  checklist: {
    label: "Checklist",
    name: checklistTypeLabel || "All Checklist Types",
    totalMark: roundMarkValue(totalChecklistMark) || 0,
  },
});

exports.getWelcomeSummary = async (req, res) => {
  try {
    const requesterRole = normalizeText(req.user?.role).toLowerCase();

    if (requesterRole !== "employee") {
      const account = await User.findById(req.user?.id, "name email role").lean();

      return res.json({
        userName:
          normalizeText(account?.name) ||
          normalizeText(account?.email) ||
          normalizeText(req.user?.email) ||
          "User",
        pendingTaskCount: 0,
        pendingChecklistCount: 0,
        pendingReminderCount: 0,
        isDepartmentSuperior: false,
        departmentPendingCount: 0,
      });
    }

    const employee = await Employee.findById(
      req.user?.id,
      "employeeName employeeCode email isActive"
    ).lean();

    if (!employee || employee.isActive === false) {
      return res.status(404).json({ message: "Employee account not found" });
    }

    const employeeIdentitySet = buildIdentitySet([
      employee.employeeName,
      employee.employeeCode,
      employee.email,
    ]);

    const [
      pendingChecklistCount,
      pendingReminderCount,
      departmentRows,
      directReportRows,
    ] = await Promise.all([
      ChecklistTask.countDocuments({
        assignedEmployee: employee._id,
        status: { $in: ["open", "rejected"] },
      }),
      PersonalTask.countDocuments({
        assignedEmployee: employee._id,
        status: "pending",
      }),
      Department.find(
        { isActive: { $ne: false } },
        "_id name headNames departmentLeadNames"
      ).lean(),
      Employee.find(
        { superiorEmployee: employee._id, isActive: true },
        "_id"
      ).lean(),
    ]);

    const managedDepartmentRows = departmentRows.filter(
      (department) =>
        matchesIdentitySet(department?.headNames, employeeIdentitySet) ||
        matchesIdentitySet(department?.departmentLeadNames, employeeIdentitySet)
    );
    const managedDepartmentIds = managedDepartmentRows
      .map((department) => normalizeId(department?._id))
      .filter(Boolean);

    const managedDepartmentEmployeeRows = managedDepartmentIds.length
      ? await Employee.find(
          {
            department: { $in: managedDepartmentIds },
            isActive: true,
          },
          "_id"
        ).lean()
      : [];

    const managedEmployeeIds = [
      ...new Set(
        [...directReportRows, ...managedDepartmentEmployeeRows]
          .map((employeeRow) => normalizeId(employeeRow?._id))
          .filter(Boolean)
      ),
    ];

    const departmentPendingCount = managedEmployeeIds.length
      ? await ChecklistTask.countDocuments({
          assignedEmployee: { $in: managedEmployeeIds },
          status: { $in: ["open", "rejected"] },
        })
      : 0;

    return res.json({
      userName:
        normalizeText(employee.employeeName) ||
        normalizeText(employee.employeeCode) ||
        normalizeText(req.user?.email) ||
        "Employee",
      pendingTaskCount: Number(pendingChecklistCount || 0) + Number(pendingReminderCount || 0),
      pendingChecklistCount: Number(pendingChecklistCount || 0),
      pendingReminderCount: Number(pendingReminderCount || 0),
      isDepartmentSuperior: managedEmployeeIds.length > 0,
      departmentPendingCount: Number(departmentPendingCount || 0),
    });
  } catch (err) {
    console.error("GET WELCOME SUMMARY ERROR:", err);
    return res.status(500).json({ message: "Failed to load welcome summary" });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const snapshot = await buildDashboardSnapshot(req.user, req.access);
    const totalChecklistTasks = await countScopedChecklistTasks(
      req.access,
      snapshot.employees,
      { siteIds: snapshot.taskSiteScopeIds }
    );

    const total = snapshot.employees.length;
    const active = snapshot.employees.filter((employee) => employee.isActive).length;
    const inactive = total - active;
    const lastUpdated = await getDashboardLastUpdated(req.access, snapshot.employees, {
      siteIds: snapshot.taskSiteScopeIds,
    });
    const markSummary = summarizeEmployeeMarks(snapshot.employees);
    const taskStatusFilter = await buildDashboardTaskScopeFilter(
      req.access,
      snapshot.employees,
      { siteIds: snapshot.taskSiteScopeIds }
    );
    const taskStatusRows =
      taskStatusFilter?._id === null
        ? []
        : await ChecklistTask.aggregate([
            { $match: taskStatusFilter },
            { $group: { _id: "$status", count: { $sum: 1 } } },
          ]);
    const taskStatusCounts = taskStatusRows.reduce((result, row) => {
      result[normalizeText(row?._id).toLowerCase()] = Number(row?.count || 0);
      return result;
    }, {});

    return res.json({
      total,
      active,
      inactive,
      totalChecklistTasks,
      overallMark: markSummary.overallMark,
      targetMark: markSummary.targetMark,
      percentage: markSummary.performancePercentage ?? 0,
      pendingTasks:
        Number(taskStatusCounts.open || 0) +
        Number(taskStatusCounts.submitted || 0) +
        Number(taskStatusCounts.nil_for_approval || 0) +
        Number(taskStatusCounts.waiting_dependency || 0),
      approvedTasks: Number(taskStatusCounts.approved || 0),
      rejectedTasks: Number(taskStatusCounts.rejected || 0),
      nilApprovedTasks: Number(taskStatusCounts.nil_approved || 0),
      lastUpdated,
      byDepartment: snapshot.departments.map((department) => ({
        _id: department._id,
        name: department.name,
        count: department.employeeCount,
      })),
      employeeOverallMarks: snapshot.employees.map(sanitizeEmployeeDashboardRow),
    });
  } catch (err) {
    console.error("GET DASHBOARD STATS ERROR:", err);
    return res.status(500).json({ message: "Failed to load dashboard data" });
  }
};

exports.getEmployeeMarkDrilldown = async (req, res) => {
  try {
    const snapshot = await buildDashboardSnapshot(req.user, req.access);
    const selectedDepartmentId = normalizeId(req.query?.departmentId);
    const selectedDepartmentDoc = snapshot.departmentDocs.find(
      (department) => normalizeId(department?._id) === selectedDepartmentId
    );
    const selectedDepartment =
      snapshot.departments.find((department) => department._id === selectedDepartmentId) || null;

    let subDepartments = [];
    let selectedSubDepartment = null;
    let employees = [];
    let selectedEmployee = null;
    let completedTasks = [];

    if (selectedDepartmentDoc) {
      const departmentEmployees = snapshot.employees.filter((employee) =>
        employee.departmentIds.includes(selectedDepartmentId)
      );
      subDepartments = buildSubDepartmentChoices(selectedDepartmentDoc, departmentEmployees);

      const selectedSubDepartmentId = normalizeId(req.query?.subDepartmentId);
      selectedSubDepartment =
        subDepartments.find((subDepartment) => subDepartment._id === selectedSubDepartmentId) ||
        null;

      employees = departmentEmployees
        .filter((employee) =>
          !selectedSubDepartment || employee.subDepartmentIds.includes(selectedSubDepartment._id)
        )
        .sort(sortByOverallMarkDescending);

      const selectedEmployeeId = normalizeId(req.query?.employeeId);
      selectedEmployee =
        employees.find((employee) => employee._id === selectedEmployeeId) || null;

      completedTasks = selectedEmployee
        ? await buildCompletedTaskRows(selectedEmployee._id, req.access, {
            siteIds: snapshot.taskSiteScopeIds,
          })
        : [];
    }

    return res.json({
      departments: snapshot.departments,
      selectedDepartment,
      subDepartments,
      selectedSubDepartment,
      employees: employees.map(sanitizeEmployeeDashboardRow),
      selectedEmployee: selectedEmployee ? sanitizeEmployeeDashboardRow(selectedEmployee) : null,
      completedTasks,
    });
  } catch (err) {
    console.error("GET EMPLOYEE MARK DRILLDOWN ERROR:", err);
    return res.status(500).json({ message: "Failed to load employee mark drilldown" });
  }
};

exports.getCompanySiteEmployeeMarkDrilldown = async (req, res) => {
  try {
    const snapshot = await buildDashboardSnapshot(req.user, req.access);
    const selectedCompanyId = normalizeText(req.query?.companyId);
    const useWorkflowHierarchy = normalizeText(req.query?.hierarchySource) === "workflow";
    const selectedCompany =
      snapshot.companies.find((company) => company._id === selectedCompanyId) || null;

    let siteLeads = [];
    let selectedSiteLead = null;
    let sites = [];
    let selectedSite = null;
    let departmentLeads = [];
    let selectedDepartmentLead = null;
    let departments = [];
    let selectedDepartment = null;
    let subDepartments = [];
    let selectedSubDepartment = null;
    let employees = [];
    let selectedEmployee = null;
    let completedTasks = [];

    if (selectedCompany) {
      const companySites = snapshot.siteDocs.filter(
        (siteDoc) => normalizeText(siteDoc?.companyName) === normalizeText(selectedCompany.name)
      );
      const companySiteIds = new Set(
        companySites.map((siteDoc) => normalizeId(siteDoc?._id)).filter(Boolean)
      );
      const companyEmployees = snapshot.employees.filter((employee) =>
        (employee.siteIds || []).some((siteId) => companySiteIds.has(siteId))
      );

      if (useWorkflowHierarchy) {
        siteLeads = buildSiteLeadChoices(companySites, companyEmployees);

        const selectedSiteLeadId = normalizeText(req.query?.siteLeadId);
        selectedSiteLead =
          siteLeads.find((siteLead) => siteLead._id === selectedSiteLeadId) || null;

        const leadScopedSites = siteLeads.length
          ? selectedSiteLead
            ? companySites.filter((siteDoc) =>
                normalizeTextList(siteDoc?.siteLeadNames || []).includes(selectedSiteLead._id)
              )
            : []
          : companySites;

        sites = buildSiteChoices(leadScopedSites, companyEmployees);
      } else {
        sites = buildSiteChoices(companySites, companyEmployees);
      }

      const selectedSiteId = normalizeId(req.query?.siteId);
      selectedSite = sites.find((site) => site._id === selectedSiteId) || null;

      if (selectedSite) {
        const siteEmployees = companyEmployees.filter((employee) =>
          employee.siteIds.includes(selectedSite._id)
        );

        if (useWorkflowHierarchy) {
          departmentLeads = buildDepartmentLeadChoices(snapshot.departmentDocs, siteEmployees);

          const selectedDepartmentLeadId = normalizeText(req.query?.departmentLeadId);
          selectedDepartmentLead =
            departmentLeads.find(
              (departmentLead) => departmentLead._id === selectedDepartmentLeadId
            ) || null;

          const leadScopedDepartments = departmentLeads.length
            ? selectedDepartmentLead
              ? snapshot.departmentDocs.filter((departmentDoc) =>
                  normalizeTextList(departmentDoc?.departmentLeadNames || []).includes(
                    selectedDepartmentLead._id
                  )
                )
              : []
            : snapshot.departmentDocs;

          departments = buildDepartmentChoices(leadScopedDepartments, siteEmployees);
        } else {
          departments = buildDepartmentChoices(snapshot.departmentDocs, siteEmployees);
        }

        const selectedDepartmentId = normalizeId(req.query?.departmentId);
        const selectedDepartmentDoc = snapshot.departmentDocs.find(
          (department) => normalizeId(department?._id) === selectedDepartmentId
        );
        selectedDepartment =
          departments.find((department) => department._id === selectedDepartmentId) || null;

        if (selectedDepartmentDoc && selectedDepartment) {
          const departmentEmployees = siteEmployees.filter((employee) =>
            employee.departmentIds.includes(selectedDepartmentId)
          );

          subDepartments = buildSubDepartmentChoices(selectedDepartmentDoc, departmentEmployees);

          const selectedSubDepartmentId = normalizeId(req.query?.subDepartmentId);
          selectedSubDepartment =
            subDepartments.find(
              (subDepartment) => subDepartment._id === selectedSubDepartmentId
            ) || null;

          employees = departmentEmployees
            .filter((employee) =>
              !selectedSubDepartment ||
              employee.subDepartmentIds.includes(selectedSubDepartment._id)
            )
            .sort(sortByOverallMarkDescending);

          const selectedEmployeeId = normalizeId(req.query?.employeeId);
          selectedEmployee =
            employees.find((employee) => employee._id === selectedEmployeeId) || null;

          completedTasks = selectedEmployee
            ? await buildCompletedTaskRows(selectedEmployee._id, req.access, {
                siteIds: snapshot.taskSiteScopeIds,
              })
            : [];
        }
      }
    }

    return res.json({
      companies: snapshot.companies,
      levelSummaries: {
        companies: snapshot.companies,
        sites: snapshot.sites,
        departments: snapshot.departments,
        subDepartments: snapshot.subDepartments,
        employees: snapshot.employees.map((employee) => ({
          _id: employee._id,
          name: employee.employeeName || employee.employeeCode || "",
          photo: employee.photo || null,
          employeeCode: employee.employeeCode || "",
          departmentDisplay: employee.departmentDisplay || "",
          subDepartmentDisplay: employee.subDepartmentDisplay || "",
          employeeCount: 1,
          overallMark: employee.overallMark,
          scoredChecklistCount: employee.scoredChecklistCount,
          targetMark: employee.targetMark,
          performancePercentage: employee.performancePercentage,
          isActive: employee.isActive !== false,
        })),
      },
      selectedCompany,
      siteLeads,
      selectedSiteLead,
      sites,
      selectedSite,
      departmentLeads,
      selectedDepartmentLead,
      departments,
      selectedDepartment,
      subDepartments,
      selectedSubDepartment,
      employees: employees.map(sanitizeEmployeeDashboardRow),
      selectedEmployee: selectedEmployee ? sanitizeEmployeeDashboardRow(selectedEmployee) : null,
      completedTasks,
    });
  } catch (err) {
    console.error("GET COMPANY SITE EMPLOYEE MARK DRILLDOWN ERROR:", err);
    return res.status(500).json({ message: "Failed to load company site employee mark drilldown" });
  }
};

exports.getDashboardHierarchicalMarkSummary = async (req, res) => {
  try {
    const snapshot = await buildDashboardSnapshot(req.user, req.access);
    const selectedFilters = {
      company: normalizeText(req.query?.company),
      site: normalizeId(req.query?.site),
      department: normalizeId(req.query?.department),
      subDepartment: normalizeId(req.query?.subDepartment),
      employee: normalizeId(req.query?.employee),
      fromDate: normalizeText(req.query?.fromDate),
      toDate: normalizeText(req.query?.toDate),
      checklistType: normalizeText(req.query?.checklistType).toLowerCase(),
    };

    const fromDate = parseDateBoundary(selectedFilters.fromDate, "start");
    const toDate = parseDateBoundary(selectedFilters.toDate, "end");

    if (selectedFilters.fromDate && !fromDate) {
      return res.status(400).json({ message: "Invalid from date filter" });
    }

    if (selectedFilters.toDate && !toDate) {
      return res.status(400).json({ message: "Invalid to date filter" });
    }

    if (fromDate && toDate && fromDate > toDate) {
      return res.status(400).json({ message: "From date cannot be greater than to date" });
    }

    const filteredEmployees = buildSummaryFilterEmployees({
      employees: snapshot.employees,
      siteDocs: snapshot.siteDocs,
      company: selectedFilters.company,
      site: selectedFilters.site,
      department: selectedFilters.department,
      subDepartment: selectedFilters.subDepartment,
      employee: selectedFilters.employee,
    });
    const employeeById = new Map(filteredEmployees.map((employee) => [employee._id, employee]));
    const scopedEmployeeIds = filteredEmployees.map((employee) => employee._id);

    const companyOptions = snapshot.companies.map((company) =>
      buildSelectOption(company._id, company.name || company._id)
    );
    const siteOptions = buildSiteChoices(
      snapshot.siteDocs,
      buildSummaryFilterEmployees({
        employees: snapshot.employees,
        siteDocs: snapshot.siteDocs,
        company: selectedFilters.company,
      }),
      selectedFilters.company
    ).map((site) => buildSelectOption(site._id, [site.companyName, site.name].filter(Boolean).join(" - ")));
    const departmentOptions = buildDepartmentChoices(
      snapshot.departmentDocs,
      buildSummaryFilterEmployees({
        employees: snapshot.employees,
        siteDocs: snapshot.siteDocs,
        company: selectedFilters.company,
        site: selectedFilters.site,
      })
    ).map((department) => buildSelectOption(department._id, department.name || department._id));
    const scopedSubDepartmentOptions =
      selectedFilters.department &&
      snapshot.departmentDocs.find(
        (departmentDoc) => normalizeId(departmentDoc?._id) === selectedFilters.department
      )
        ? buildSubDepartmentChoices(
            snapshot.departmentDocs.find(
              (departmentDoc) => normalizeId(departmentDoc?._id) === selectedFilters.department
            ),
            buildSummaryFilterEmployees({
              employees: snapshot.employees,
              siteDocs: snapshot.siteDocs,
              company: selectedFilters.company,
              site: selectedFilters.site,
              department: selectedFilters.department,
            })
          )
        : buildScopedSubDepartmentChoices(
            snapshot.departmentDocs,
            buildSummaryFilterEmployees({
              employees: snapshot.employees,
              siteDocs: snapshot.siteDocs,
              company: selectedFilters.company,
              site: selectedFilters.site,
              department: selectedFilters.department,
            })
          );
    const subDepartmentOptions = scopedSubDepartmentOptions.map((subDepartment) =>
      buildSelectOption(subDepartment._id, subDepartment.label || subDepartment.name || subDepartment._id)
    );
    const employeeOptions = filteredEmployees.map((employee) =>
      buildSelectOption(
        employee._id,
        employee.employeeCode
          ? `${employee.employeeCode} - ${employee.employeeName || "Employee"}`
          : employee.employeeName || employee._id
      )
    );

    const checklistTypeFilter = scopedEmployeeIds.length
      ? await buildDashboardTaskScopeFilter(req.access, filteredEmployees, {
          employeeIds: scopedEmployeeIds,
          scoredOnly: true,
          siteIds: snapshot.taskSiteScopeIds,
        })
      : { _id: null };
    const checklistTypeRows =
      checklistTypeFilter?._id === null
        ? []
        : await ChecklistTask.aggregate([
            { $match: checklistTypeFilter },
            { $group: { _id: "$scheduleType" } },
            { $sort: { _id: 1 } },
          ]);
    const checklistTypes = checklistTypeRows
      .map((row) => ({
        value: normalizeText(row?._id).toLowerCase(),
        label: formatScheduleTypeLabel(row?._id),
      }))
      .filter((row) => row.value && row.label);

    if (!scopedEmployeeIds.length) {
      return res.json({
        filters: {
          selected: selectedFilters,
          options: {
            companies: companyOptions,
            sites: siteOptions,
            departments: departmentOptions,
            subDepartments: subDepartmentOptions,
            employees: employeeOptions,
          },
          checklistTypes,
        },
        summary: buildHierarchicalSummaryCards({
          totalChecklistMark: 0,
          selectedCompany:
            snapshot.companies.find((company) => company._id === selectedFilters.company) || null,
          selectedSite:
            snapshot.sites.find((site) => site._id === selectedFilters.site) || null,
          selectedDepartment:
            snapshot.departments.find(
              (department) => department._id === selectedFilters.department
            ) || null,
          selectedSubDepartment:
            snapshot.subDepartments.find(
              (subDepartment) => subDepartment._id === selectedFilters.subDepartment
            ) || null,
          selectedEmployee:
            snapshot.employees.find((employee) => employee._id === selectedFilters.employee) || null,
          checklistTypeLabel:
            checklistTypes.find((item) => item.value === selectedFilters.checklistType)?.label || "",
          employeeCount: 0,
        }),
        rows: [],
      });
    }

    const taskQuery = await buildDashboardTaskScopeFilter(req.access, filteredEmployees, {
      employeeIds: scopedEmployeeIds,
      scoredOnly: true,
      siteIds: snapshot.taskSiteScopeIds,
    });

    if (taskQuery?._id === null) {
      return res.json({
        filters: {
          selected: selectedFilters,
          options: {
            companies: companyOptions,
            sites: siteOptions,
            departments: departmentOptions,
            subDepartments: subDepartmentOptions,
            employees: employeeOptions,
          },
          checklistTypes,
        },
        summary: buildHierarchicalSummaryCards({
          totalChecklistMark: 0,
          selectedCompany:
            snapshot.companies.find((company) => company._id === selectedFilters.company) || null,
          selectedSite:
            snapshot.sites.find((site) => site._id === selectedFilters.site) || null,
          selectedDepartment:
            snapshot.departments.find(
              (department) => department._id === selectedFilters.department
            ) || null,
          selectedSubDepartment:
            snapshot.subDepartments.find(
              (subDepartment) => subDepartment._id === selectedFilters.subDepartment
            ) || null,
          selectedEmployee:
            snapshot.employees.find((employee) => employee._id === selectedFilters.employee) || null,
          checklistTypeLabel:
            checklistTypes.find((item) => item.value === selectedFilters.checklistType)?.label || "",
          employeeCount: 0,
        }),
        rows: [],
      });
    }

    if (fromDate || toDate) {
      taskQuery.occurrenceDate = {};
      if (fromDate) taskQuery.occurrenceDate.$gte = fromDate;
      if (toDate) taskQuery.occurrenceDate.$lte = toDate;
    }

    if (selectedFilters.checklistType) {
      taskQuery.scheduleType = selectedFilters.checklistType;
    }

    const taskRows = await ChecklistTask.find(
      taskQuery,
      "_id checklistName scheduleType occurrenceDate finalMark assignedEmployee checklist"
    )
      .populate({
        path: "checklist",
        select: "employeeAssignedSite",
        populate: {
          path: "employeeAssignedSite",
          select: "name companyName",
        },
      })
      .lean();

    const departmentById = new Map(
      (snapshot.departmentDocs || []).map((departmentDoc) => [normalizeId(departmentDoc?._id), departmentDoc])
    );
    const subDepartmentById = new Map(
      (snapshot.subDepartments || []).map((subDepartment) => [subDepartment._id, subDepartment])
    );
    const siteById = new Map((snapshot.siteDocs || []).map((siteDoc) => [normalizeId(siteDoc?._id), siteDoc]));
    const companyMarkMap = new Map();
    const siteMarkMap = new Map();
    const departmentMarkMap = new Map();
    const subDepartmentMarkMap = new Map();
    const employeeMarkMap = new Map();

    const rows = taskRows
      .map((taskRow) => {
        const employeeId = normalizeId(taskRow?.assignedEmployee);
        const employee = employeeById.get(employeeId);
        if (!employee) return null;

        const taskSiteId =
          normalizeId(taskRow?.checklist?.employeeAssignedSite?._id) || employee.siteIds?.[0] || "";
        const taskSite =
          taskRow?.checklist?.employeeAssignedSite || siteById.get(taskSiteId) || null;
        const companyName = normalizeText(taskSite?.companyName);
        const siteName = normalizeText(taskSite?.name);

        if (selectedFilters.company && companyName !== selectedFilters.company) {
          return null;
        }

        if (selectedFilters.site && taskSiteId !== selectedFilters.site) {
          return null;
        }

        const departmentId =
          (selectedFilters.department &&
          (employee.departmentIds || []).includes(selectedFilters.department)
            ? selectedFilters.department
            : employee.departmentIds?.[0]) || "";
        const departmentDoc = departmentById.get(departmentId) || null;
        const departmentName =
          departmentDoc?.name || employee.departmentDisplay || "";

        if (selectedFilters.department && departmentId !== selectedFilters.department) {
          return null;
        }

        const subDepartmentId =
          (selectedFilters.subDepartment &&
          (employee.subDepartmentIds || []).includes(selectedFilters.subDepartment)
            ? selectedFilters.subDepartment
            : employee.subDepartmentIds?.[0]) || "";
        const subDepartment = subDepartmentById.get(subDepartmentId) || null;
        const subDepartmentName =
          subDepartment?.label || employee.subDepartmentDisplay || "";

        if (selectedFilters.subDepartment && subDepartmentId !== selectedFilters.subDepartment) {
          return null;
        }

        const checklistTaskMark = roundMarkValue(taskRow?.finalMark) || 0;

        return {
          _id: normalizeId(taskRow?._id),
          companyName,
          companyKey: companyName,
          siteId: taskSiteId,
          siteName,
          departmentId,
          departmentName,
          subDepartmentId,
          subDepartmentName,
          employeeId,
          employeeName: employee.employeeName || employee.employeeCode || "",
          checklistTaskName: taskRow?.checklistName || "",
          checklistType: formatScheduleTypeLabel(taskRow?.scheduleType),
          occurrenceDate: taskRow?.occurrenceDate || null,
          checklistTaskMark,
        };
      })
      .filter(Boolean);

    rows.forEach((row) => {
      companyMarkMap.set(
        row.companyKey,
        roundMarkValue((companyMarkMap.get(row.companyKey) || 0) + row.checklistTaskMark) || 0
      );
      siteMarkMap.set(
        row.siteId,
        roundMarkValue((siteMarkMap.get(row.siteId) || 0) + row.checklistTaskMark) || 0
      );
      departmentMarkMap.set(
        row.departmentId,
        roundMarkValue((departmentMarkMap.get(row.departmentId) || 0) + row.checklistTaskMark) || 0
      );
      subDepartmentMarkMap.set(
        row.subDepartmentId,
        roundMarkValue((subDepartmentMarkMap.get(row.subDepartmentId) || 0) + row.checklistTaskMark) || 0
      );
      employeeMarkMap.set(
        row.employeeId,
        roundMarkValue((employeeMarkMap.get(row.employeeId) || 0) + row.checklistTaskMark) || 0
      );
    });

    const enrichedRows = rows.map((row) => ({
      ...row,
      companyMark: companyMarkMap.get(row.companyKey) || 0,
      siteMark: siteMarkMap.get(row.siteId) || 0,
      departmentMark: row.departmentId ? departmentMarkMap.get(row.departmentId) || 0 : null,
      subDepartmentMark: row.subDepartmentId
        ? subDepartmentMarkMap.get(row.subDepartmentId) || 0
        : null,
      employeeMark: employeeMarkMap.get(row.employeeId) || 0,
    }));

    const totalChecklistMark = roundMarkValue(
      enrichedRows.reduce((sum, row) => sum + Number(row.checklistTaskMark || 0), 0)
    ) || 0;

    return res.json({
      filters: {
        selected: selectedFilters,
        options: {
          companies: companyOptions,
          sites: siteOptions,
          departments: departmentOptions,
          subDepartments: subDepartmentOptions,
          employees: employeeOptions,
        },
        checklistTypes,
      },
      summary: buildHierarchicalSummaryCards({
        totalChecklistMark,
        selectedCompany:
          snapshot.companies.find((company) => company._id === selectedFilters.company) || null,
        selectedSite:
          snapshot.sites.find((site) => site._id === selectedFilters.site) || null,
        selectedDepartment:
          snapshot.departments.find(
            (department) => department._id === selectedFilters.department
          ) || null,
        selectedSubDepartment:
          snapshot.subDepartments.find(
            (subDepartment) => subDepartment._id === selectedFilters.subDepartment
          ) || null,
        selectedEmployee:
          snapshot.employees.find((employee) => employee._id === selectedFilters.employee) || null,
        checklistTypeLabel:
          checklistTypes.find((item) => item.value === selectedFilters.checklistType)?.label || "",
        employeeCount: new Set(enrichedRows.map((row) => row.employeeId)).size,
      }),
      rows: enrichedRows,
    });
  } catch (err) {
    console.error("GET DASHBOARD HIERARCHICAL MARK SUMMARY ERROR:", err);
    return res.status(500).json({ message: "Failed to load dashboard hierarchical mark summary" });
  }
};
