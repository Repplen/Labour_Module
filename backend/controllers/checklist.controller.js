const ExcelJS = require("exceljs");
const Checklist = require("../models/Checklist");
const ChecklistTask = require("../models/ChecklistTask");
const ChecklistTransferHistory = require("../models/ChecklistTransferHistory");
const ChecklistAdminRequest = require("../models/ChecklistAdminRequest");
const ChecklistRequestNotification = require("../models/ChecklistRequestNotification");
const Department = require("../models/Department");
const Employee = require("../models/Employee");
const Site = require("../models/Site");
const User = require("../models/User");
const {
  buildChecklistMasterScopeFilter,
  buildDepartmentScopeFilter,
  buildEmployeeScopeFilter,
  buildSiteScopeFilter,
  filterRowsByAccessibleEmployees,
  isAllScope,
  resolveAccessibleEmployeeIds,
  uniqueIdList,
} = require("../services/accessScope.service");
const {
  hasModulePermission,
  resolvePrincipalAccess,
} = require("../services/permissionResolver.service");
const {
  TASK_STATUSES,
  TASK_TIMELINESS_STATUSES,
  applyChecklistDecision,
  applyTaskSubmission,
  buildArchivedChecklistNumber,
  canAccessChecklistTask,
  hasChecklistMasterAccess,
  checklistPopulateQuery,
  checklistTaskPopulateQuery,
  getDependencyBlockedMessage,
  getNextChecklistNumberValue,
  getRestrictedChecklistSiteId,
  isAdminRequester,
  isEmployeeRequester,
  isValidObjectId,
  parseDateBoundary,
  runChecklistScheduler,
  runDependentChecklistScheduler,
  releaseSoftDeletedChecklistNumber,
  syncChecklistTaskDependencies,
  validateChecklistPayload,
} = require("../services/checklistWorkflow.service");

const normalizeText = (value) => String(value || "").trim();
const canViewChecklistTransfer = (user) =>
  hasModulePermission(user?.permissions, "checklist_transfer", "view");
const isMainAdminReviewer = (user) =>
  Boolean(user?.isDefaultAdmin) ||
  normalizeText(user?.roleKey).toLowerCase() === "main_admin";
const canApproveChecklistRequests = (user) =>
  isMainAdminReviewer(user) &&
  hasModulePermission(user?.permissions, "checklist_master", "approve");
const canRejectChecklistRequests = (user) =>
  isMainAdminReviewer(user) &&
  hasModulePermission(user?.permissions, "checklist_master", "reject");
const canReviewChecklistRequests = (user) =>
  canApproveChecklistRequests(user) || canRejectChecklistRequests(user);
const canBypassChecklistAdminApproval = (user) =>
  isAdminRequester(user) && isMainAdminReviewer(user);

const mergeQueryFilters = (...filters) => {
  const activeFilters = filters.filter(
    (filter) => filter && typeof filter === "object" && Object.keys(filter).length
  );

  if (!activeFilters.length) return {};
  if (activeFilters.length === 1) return activeFilters[0];
  return { $and: activeFilters };
};

const getChecklistTransferAccessContext = async (access = {}) => {
  const accessIsAll = isAllScope(access || {});

  if (accessIsAll) {
    return {
      accessIsAll: true,
      accessibleEmployeeIds: [],
      scopedSiteIds: [],
      hasScopedAccess: true,
    };
  }

  const accessibleEmployeeIds = await resolveAccessibleEmployeeIds(access || {});
  const scopedSiteIds = uniqueIdList(access?.scope?.siteIds);

  return {
    accessIsAll: false,
    accessibleEmployeeIds,
    scopedSiteIds,
    hasScopedAccess: Boolean(accessibleEmployeeIds.length || scopedSiteIds.length),
  };
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const CHECKLIST_EXCEL_SHEET_NAME = "Checklist Masters";
const CHECKLIST_INSTRUCTIONS_SHEET_NAME = "Instructions";
const CHECKLIST_TASK_REPORT_EXCEL_SHEET_NAME = "Checklist Task Report";
const IST_OFFSET_MS = 330 * 60 * 1000;
const CHECKLIST_REQUEST_MODULE_KEYS = {
  checklistMaster: "checklist_master",
  checklistTransfer: "checklist_transfer",
};
const CHECKLIST_REQUEST_ACTIONS = {
  add: "add",
  edit: "edit",
  permanentTransfer: "permanent_transfer",
  temporaryTransfer: "temporary_transfer",
};
const CHECKLIST_REQUEST_STATUS = {
  pending: "pending_admin_approval",
  approved: "approved",
  rejected: "rejected",
};
const CHECKLIST_REQUEST_NOTIFICATION_TYPES = {
  submitted: "request_submitted",
  approved: "request_approved",
  rejected: "request_rejected",
};

const checklistExcelColumns = [
  { header: "#", key: "serialNumber", width: 8 },
  { header: "Checklist Number", key: "checklistNumber", width: 18 },
  { header: "Name", key: "checklistName", width: 28, aliases: ["Checklist Name"] },
  { header: "Scoring", key: "enableMark", width: 14, aliases: ["Task Scoring"] },
  { header: "Base Mark", key: "baseMark", width: 12 },
  { header: "Delay Penalty / Day", key: "delayPenaltyPerDay", width: 20, aliases: ["Delay Penalty Per Day"] },
  { header: "Advance Bonus / Day", key: "advanceBonusPerDay", width: 20, aliases: ["Advance Bonus Per Day"] },
  { header: "Source Site", key: "sourceSite", width: 30, aliases: ["Checklist Source Site"] },
  { header: "Assigned Site", key: "assignedSite", width: 30, aliases: ["Employee Assigned Site", "Task Assigned Site", "Source Site"] },
  { header: "Employee", key: "assignedEmployeeCode", width: 30, aliases: ["Assign To Employee"] },
  { header: "Priority", key: "priority", width: 12 },
  { header: "Schedule", key: "scheduleType", width: 14, aliases: ["Schedule Type"] },
  { header: "Start Date", key: "startDate", width: 16, aliases: ["Start"] },
  { header: "Start Time", key: "startTime", width: 14, aliases: ["Start Task Time", "Start"] },
  { header: "End Date", key: "endDate", width: 16, aliases: ["End"] },
  { header: "End Time", key: "endTime", width: 14, aliases: ["End"] },
  { header: "Next Task", key: "nextTask", width: 20 },
  { header: "Task Related Questions", key: "checklistItems", width: 42, aliases: ["Questions", "Checklist Items"] },
  { header: "Approver Mapping", key: "approvalEmployeeCodes", width: 30, aliases: ["Approval Employee Codes"] },
  { header: "Dependency", key: "dependencyTaskNumber", width: 24, aliases: ["Dependent Task", "Previous Task Number"] },
  { header: "Status", key: "status", width: 12 },
];

const checklistTaskReportExcelColumns = [
  { header: "#", key: "serialNumber", width: 8 },
  { header: "Task Number", key: "taskNumber", width: 18 },
  { header: "Checklist Number", key: "checklistNumber", width: 18 },
  { header: "Checklist Name", key: "checklistName", width: 30 },
  { header: "Employee", key: "employee", width: 26 },
  { header: "Department", key: "department", width: 28 },
  { header: "Priority", key: "priority", width: 12 },
  { header: "Schedule", key: "schedule", width: 20 },
  { header: "Start", key: "start", width: 22 },
  { header: "End", key: "end", width: 22 },
  { header: "Target Date / Time", key: "targetDateTime", width: 24 },
  { header: "Submitted At", key: "submittedAt", width: 22 },
  { header: "Submission Status", key: "submissionStatus", width: 20 },
  { header: "Approval Type", key: "approvalType", width: 16 },
  { header: "Scoring", key: "scoring", width: 30 },
  { header: "Time Status", key: "timeStatus", width: 16 },
  { header: "Delay / Advance", key: "delayAdvance", width: 18 },
  { header: "Adjustment", key: "adjustment", width: 14 },
  { header: "Final Mark", key: "finalMark", width: 14 },
  { header: "Current Approver", key: "currentApprover", width: 26 },
  { header: "Approval Workflow", key: "approvalWorkflow", width: 34 },
  { header: "Approval Status", key: "approvalStatus", width: 18 },
];

const reportMarkFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const requiredChecklistImportKeys = [
  "checklistName",
  "assignedSite",
  "assignedEmployeeCode",
  "scheduleType",
  "startDate",
  "startTime",
  "endDate",
  "endTime",
];

const checklistExcelColumnMap = new Map(
  checklistExcelColumns.map((column) => [column.key, column])
);

const normalizeLookupKey = (value) => normalizeText(value).toLowerCase();

const pad = (value) => String(value).padStart(2, "0");

const formatSiteDisplayName = (site) => {
  if (!site) return "";

  const companyName = normalizeText(site.companyName);
  const name = normalizeText(site.name);

  if (companyName && name) return `${companyName} - ${name}`;
  return name || companyName;
};

const formatEmployeeDisplayName = (employee) => {
  if (!employee) return "";

  const employeeCode = normalizeText(employee.employeeCode);
  const employeeName = normalizeText(employee.employeeName);

  if (employeeCode && employeeName) return `${employeeCode} - ${employeeName}`;
  return employeeCode || employeeName;
};

const toPlainObject = (value) => {
  if (!value) return {};
  if (typeof value.toObject === "function") {
    return value.toObject({ depopulate: false, virtuals: false });
  }
  return value;
};

const capitalizeLabel = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).replace(/_/g, " ");
};

const formatDisplayDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatChecklistItemLines = (items = []) => {
  const rows = (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const label = normalizeText(item?.label);
      if (!label) return "";

      const detail = normalizeText(item?.detail);
      const requiredLabel = item?.isRequired !== false ? "Required" : "Optional";

      return `${index + 1}. ${label}${detail ? ` - ${detail}` : ""} (${requiredLabel})`;
    })
    .filter(Boolean);

  return rows.length ? rows.join("\n") : "-";
};

const formatApprovalFlowLines = (approvals = [], employeeMap = new Map()) => {
  const rows = (Array.isArray(approvals) ? approvals : [])
    .map((row, index) => {
      const approvalEmployeeId = normalizeText(
        row?.approvalEmployee?._id || row?.approvalEmployee
      );
      const employee = approvalEmployeeId ? employeeMap.get(approvalEmployeeId) : null;
      const employeeLabel =
        formatEmployeeDisplayName(employee || row?.approvalEmployee) || approvalEmployeeId;

      if (!employeeLabel) return "";
      return `${index + 1}. ${employeeLabel}`;
    })
    .filter(Boolean);

  return rows.length ? rows.join("\n") : "-";
};

const buildDisplaySnapshot = (sections = []) => ({
  sections: sections.filter((section) => Array.isArray(section?.fields) && section.fields.length),
});

const getSnapshotFieldMap = (snapshot = {}) => {
  const fieldMap = new Map();

  (snapshot?.sections || []).forEach((section) => {
    (section?.fields || []).forEach((field) => {
      if (!field?.key) return;
      fieldMap.set(field.key, {
        key: field.key,
        label: field.label || field.key,
        value: field.value ?? "-",
        sectionTitle: section.title || "",
      });
    });
  });

  return fieldMap;
};

const normalizeComparisonValue = (value) =>
  String(value === null || value === undefined ? "" : value)
    .trim()
    .replace(/\s+/g, " ");

const buildComparisonRows = (oldSnapshot = {}, newSnapshot = {}) => {
  const oldFieldMap = getSnapshotFieldMap(oldSnapshot);
  const newFieldMap = getSnapshotFieldMap(newSnapshot);
  const orderedKeys = [
    ...newFieldMap.keys(),
    ...[...oldFieldMap.keys()].filter((key) => !newFieldMap.has(key)),
  ];

  return orderedKeys.map((key) => {
    const oldField = oldFieldMap.get(key);
    const newField = newFieldMap.get(key);
    const oldValue = oldField?.value ?? "-";
    const newValue = newField?.value ?? "-";

    return {
      key,
      label: newField?.label || oldField?.label || capitalizeLabel(key),
      oldValue,
      newValue,
      changed: normalizeComparisonValue(oldValue) !== normalizeComparisonValue(newValue),
      sectionTitle: newField?.sectionTitle || oldField?.sectionTitle || "",
    };
  });
};

const getRequestModuleName = (moduleKey) =>
  moduleKey === CHECKLIST_REQUEST_MODULE_KEYS.checklistTransfer
    ? "Checklist Transfer"
    : "Checklist Master";

const getRequestActionLabel = (actionType) => {
  if (actionType === CHECKLIST_REQUEST_ACTIONS.permanentTransfer) {
    return "Permanent Transfer";
  }

  if (actionType === CHECKLIST_REQUEST_ACTIONS.temporaryTransfer) {
    return "Temporary Transfer";
  }

  return actionType === CHECKLIST_REQUEST_ACTIONS.edit ? "Edit" : "Add";
};

const getChecklistScoreDisplay = (payload = {}) => {
  const enableMark = payload?.enableMark === true;

  if (!enableMark) return "Disabled";

  return `Base ${reportMarkFormatter.format(roundMarkValue(payload?.baseMark ?? 0) ?? 0)}`;
};

const buildChecklistScheduleDisplay = (payload = {}) => {
  const scheduleLabel =
    payload?.scheduleType === "custom"
      ? `Custom${payload?.repeatSummary ? ` (${payload.repeatSummary})` : ""}`
      : capitalizeLabel(payload?.scheduleType);

  const startLabel = formatDisplayDateTime(payload?.startDate);
  const endLabel = formatDisplayDateTime(payload?.endDate);

  return `${scheduleLabel || "-"} | ${startLabel} to ${endLabel}`;
};

const buildChecklistDependencyDisplay = (payload = {}, dependencyChecklist = null) => {
  if (!payload?.isDependentTask) return "No";

  const dependencyLabel =
    [
      normalizeText(
        dependencyChecklist?.checklistNumber ||
          payload?.dependencyTaskNumber ||
          payload?.dependencyChecklistId?.checklistNumber
      ),
      normalizeText(
        dependencyChecklist?.checklistName || payload?.dependencyChecklistId?.checklistName
      ),
    ]
      .filter(Boolean)
      .join(" - ") || normalizeText(payload?.dependencyChecklistId);

  return dependencyLabel || "Yes";
};

const buildTransferChecklistLines = (checklists = []) => {
  const rows = (Array.isArray(checklists) ? checklists : [])
    .map((checklist, index) => {
      const label = [
        normalizeText(checklist?.checklistNumber),
        normalizeText(checklist?.checklistName),
        normalizeText(checklist?.assignedSiteName),
      ]
        .filter(Boolean)
        .join(" - ");

      return label ? `${index + 1}. ${label}` : "";
    })
    .filter(Boolean);

  return rows.length ? rows.join("\n") : "-";
};

const normalizeIdList = (value) =>
  (Array.isArray(value) ? value : [value])
    .map((item) => normalizeText(item?._id || item))
    .filter(Boolean);

const employeeHasSite = (employee, siteId) =>
  (employee?.sites || []).some((site) => String(site?._id || site) === String(siteId));

const employeeHasDepartment = (employee, departmentId) =>
  (employee?.department || []).some(
    (department) => String(department?._id || department) === String(departmentId)
  );

const getEmployeeTransferSiteIds = (employee, allowedSiteIds = []) => {
  const normalizedAllowedSiteIds = normalizeIdList(
    Array.isArray(allowedSiteIds) ? allowedSiteIds : allowedSiteIds ? [allowedSiteIds] : []
  );

  return normalizeIdList(employee?.sites).filter(
    (siteId) =>
      !normalizedAllowedSiteIds.length || normalizedAllowedSiteIds.includes(String(siteId))
  );
};

const getEmployeeTransferDepartmentIds = (employee) => normalizeIdList(employee?.department);

const getSharedEmployeeSiteIds = (fromEmployee, toEmployee, allowedSiteIds = []) => {
  const fromSiteIds = getEmployeeTransferSiteIds(fromEmployee, allowedSiteIds);
  if (!fromSiteIds.length) return [];

  return fromSiteIds.filter((siteId) => employeeHasSite(toEmployee, siteId));
};

const getSharedEmployeeDepartmentIds = (fromEmployee, toEmployee) => {
  const fromDepartmentIds = getEmployeeTransferDepartmentIds(fromEmployee);
  if (!fromDepartmentIds.length) return [];

  return fromDepartmentIds.filter((departmentId) => employeeHasDepartment(toEmployee, departmentId));
};

const mapChecklistTransferEmployee = (employee, allowedSiteIds = []) => {
  const siteIds = getEmployeeTransferSiteIds(employee, allowedSiteIds);
  const departmentIds = getEmployeeTransferDepartmentIds(employee);
  const siteLabels = (employee?.sites || [])
    .filter((site) => siteIds.includes(normalizeText(site?._id || site)))
    .map((site) => formatSiteDisplayName(site))
    .filter(Boolean);
  const departmentNames = (employee?.department || [])
    .map((department) => normalizeText(department?.name))
    .filter(Boolean);

  return {
    _id: employee?._id || null,
    employeeCode: normalizeText(employee?.employeeCode),
    employeeName: normalizeText(employee?.employeeName),
    email: normalizeText(employee?.email),
    isActive: employee?.isActive !== false,
    siteIds,
    siteLabels,
    departmentIds,
    departmentNames,
    departmentDisplay: departmentNames.join(", "),
  };
};

const ACTIVE_TEMPORARY_TRANSFER_STATUSES = ["pending", "active"];

const findConflictingChecklistTemporaryTransfers = async ({
  checklistIds = [],
  transferStartDate = null,
  transferEndDate = null,
  includeAnyOutstandingWindow = false,
}) => {
  const normalizedChecklistIds = normalizeIdList(checklistIds);
  if (!normalizedChecklistIds.length) return [];

  const filter = {
    transferType: "temporary",
    transferStatus: { $in: ACTIVE_TEMPORARY_TRANSFER_STATUSES },
    "checklists.checklist": { $in: normalizedChecklistIds },
  };

  if (!includeAnyOutstandingWindow && transferStartDate && transferEndDate) {
    filter.transferStartDate = { $lte: transferEndDate };
    filter.transferEndDate = { $gte: transferStartDate };
  }

  return ChecklistTransferHistory.find(
    filter,
    "checklists checklistNames transferStartDate transferEndDate transferStatus"
  ).lean();
};

const buildConflictingChecklistNameList = (historyRows = [], checklistIds = []) => {
  const selectedChecklistIdSet = new Set(normalizeIdList(checklistIds));
  const checklistNameSet = new Set();

  historyRows.forEach((historyRow) => {
    (historyRow?.checklists || []).forEach((checklistRow) => {
      const checklistId = normalizeText(checklistRow?.checklist?._id || checklistRow?.checklist);
      if (!selectedChecklistIdSet.has(checklistId)) return;

      const checklistName =
        normalizeText(checklistRow?.checklistName) ||
        normalizeText(checklistRow?.checklistNumber);

      if (checklistName) {
        checklistNameSet.add(checklistName);
      }
    });
  });

  return [...checklistNameSet];
};

const parseTransferHistoryLimit = (value, fallback = 20) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return fallback;
  return Math.min(100, Math.max(1, Math.floor(parsedValue)));
};

const checklistTransferHistoryPopulateQuery = [
  {
    path: "fromEmployee",
    select: "employeeCode employeeName",
  },
  {
    path: "toEmployee",
    select: "employeeCode employeeName",
  },
  {
    path: "transferredBy",
    select: "name email role",
  },
];

const getChecklistAdminRecipients = async () => {
  const users = await User.find(
    { isActive: { $ne: false } },
    "name email role roleId site isDefaultAdmin checklistMasterAccess accessScopeStrategy accessCompanyIds accessSiteIds accessDepartmentIds accessSubDepartmentIds accessEmployeeIds"
  ).lean();

  const recipientRows = await Promise.all(
    users.map(async (user) => {
      const access = await resolvePrincipalAccess({ principalType: "user", principal: user });
      const isMainAdmin =
        Boolean(user?.isDefaultAdmin) ||
        normalizeText(access.role?.key).toLowerCase() === "main_admin";
      const canReview =
        isMainAdmin &&
        (hasModulePermission(access.permissions, "checklist_master", "approve") ||
          hasModulePermission(access.permissions, "checklist_master", "reject"));

      return canReview ? user : null;
    })
  );

  return recipientRows.filter(Boolean);
};

const createChecklistRequestNotifications = async ({
  requestId,
  recipients = [],
  recipientScope,
  notificationType,
  moduleKey,
  actionType,
  title,
  message,
  routePath,
}) => {
  const recipientRows = (Array.isArray(recipients) ? recipients : []).filter(
    (recipient) => recipient?._id
  );

  if (!recipientRows.length) return [];

  return ChecklistRequestNotification.insertMany(
    recipientRows.map((recipient) => ({
      request: requestId,
      recipientUser: recipient._id,
      recipientScope,
      notificationType,
      moduleKey,
      actionType,
      title: normalizeText(title),
      message: normalizeText(message),
      routePath: normalizeText(routePath),
    }))
  );
};

const mapChecklistRequestNotificationRow = (notification) => ({
  _id: notification._id,
  requestId: normalizeText(notification?.request?._id || notification?.request),
  recipientScope: normalizeText(notification?.recipientScope),
  notificationType: normalizeText(notification?.notificationType),
  moduleKey: normalizeText(notification?.moduleKey),
  moduleName: getRequestModuleName(notification?.moduleKey),
  actionType: normalizeText(notification?.actionType),
  actionLabel: getRequestActionLabel(notification?.actionType),
  title: normalizeText(notification?.title),
  message: normalizeText(notification?.message),
  routePath: normalizeText(notification?.routePath),
  createdAt: notification?.createdAt || null,
  readAt: notification?.readAt || null,
});

const buildChecklistMasterDisplaySnapshot = async (value = {}) => {
  const payload = toPlainObject(value);
  const assignedEmployeeId = normalizeText(
    payload?.assignedToEmployee?._id || payload?.assignedToEmployee
  );
  const approvalEmployeeIds = (Array.isArray(payload?.approvals) ? payload.approvals : [])
    .map((row) => normalizeText(row?.approvalEmployee?._id || row?.approvalEmployee))
    .filter(Boolean);
  const employeeIds = [...new Set([assignedEmployeeId, ...approvalEmployeeIds].filter(Boolean))];
  const siteIds = [
    ...new Set(
      [
        normalizeText(payload?.employeeAssignedSite?._id || payload?.employeeAssignedSite),
        normalizeText(payload?.checklistSourceSite?._id || payload?.checklistSourceSite),
      ].filter(Boolean)
    ),
  ];
  const dependencyChecklistId = normalizeText(
    payload?.dependencyChecklistId?._id || payload?.dependencyChecklistId
  );

  const [employees, sites, dependencyChecklist] = await Promise.all([
    employeeIds.length
      ? Employee.find(
          { _id: { $in: employeeIds } },
          "employeeCode employeeName email superiorEmployee"
        ).lean()
      : Promise.resolve([]),
    siteIds.length
      ? Site.find({ _id: { $in: siteIds } }, "name companyName").lean()
      : Promise.resolve([]),
    dependencyChecklistId
      ? Checklist.findById(
          dependencyChecklistId,
          "checklistNumber checklistName assignedToEmployee"
        )
          .populate("assignedToEmployee", "employeeCode employeeName")
          .lean()
      : Promise.resolve(null),
  ]);

  const employeeMap = new Map(
    employees.map((employee) => [normalizeText(employee?._id), employee])
  );
  const siteMap = new Map(sites.map((site) => [normalizeText(site?._id), site]));
  const assignedEmployee =
    employeeMap.get(assignedEmployeeId) || toPlainObject(payload?.assignedToEmployee) || null;
  const assignedSite =
    siteMap.get(
      normalizeText(payload?.employeeAssignedSite?._id || payload?.employeeAssignedSite)
    ) ||
    toPlainObject(payload?.employeeAssignedSite) ||
    null;
  const sourceSite =
    siteMap.get(
      normalizeText(payload?.checklistSourceSite?._id || payload?.checklistSourceSite)
    ) ||
    toPlainObject(payload?.checklistSourceSite) ||
    null;

  return buildDisplaySnapshot([
    {
      title: "Checklist Setup",
      fields: [
        {
          key: "checklistNumber",
          label: "Checklist Number",
          value: normalizeText(payload?.checklistNumber) || "-",
        },
        {
          key: "checklistName",
          label: "Checklist Name",
          value: normalizeText(payload?.checklistName) || "-",
        },
        {
          key: "assignedSite",
          label: "Assigned Site",
          value: formatSiteDisplayName(assignedSite) || "-",
        },
        {
          key: "assignedEmployee",
          label: "Assigned Employee",
          value: formatEmployeeDisplayName(assignedEmployee) || "-",
        },
        {
          key: "sourceSite",
          label: "Checklist Source Site",
          value: formatSiteDisplayName(sourceSite) || "-",
        },
        {
          key: "priority",
          label: "Priority",
          value: capitalizeLabel(payload?.priority) || "-",
        },
        {
          key: "schedule",
          label: "Schedule",
          value: buildChecklistScheduleDisplay(payload),
        },
        {
          key: "taskScoring",
          label: "Task Scoring",
          value: getChecklistScoreDisplay(payload),
        },
        {
          key: "dependency",
          label: "Dependency",
          value: buildChecklistDependencyDisplay(payload, dependencyChecklist),
        },
        {
          key: "targetDayCount",
          label: "Target Day Count",
          value: payload?.isDependentTask ? String(payload?.targetDayCount ?? "-") : "-",
        },
      ],
    },
    {
      title: "Approval Workflow",
      fields: [
        {
          key: "approvalHierarchy",
          label: "Approval Hierarchy",
          value: capitalizeLabel(payload?.approvalHierarchy) || "-",
        },
        {
          key: "approvalFlow",
          label: "Approval Flow",
          value: formatApprovalFlowLines(payload?.approvals, employeeMap),
        },
      ],
    },
    {
      title: "Task Related Questions",
      fields: [
        {
          key: "checklistItems",
          label: "Questions",
          value: formatChecklistItemLines(payload?.checklistItems),
        },
      ],
    },
  ]);
};

const formatDisplayDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const buildTransferDisplaySnapshot = ({
  transferType,
  fromEmployee,
  toEmployee,
  selectedChecklists,
  transferStartDate,
  transferEndDate,
}) =>
  buildDisplaySnapshot([
    {
      title: "Transfer Setup",
      fields: [
        {
          key: "fromEmployee",
          label: "From Employee",
          value: formatEmployeeDisplayName(fromEmployee) || "-",
        },
        {
          key: "toEmployee",
          label: "To Employee",
          value: formatEmployeeDisplayName(toEmployee) || "-",
        },
        {
          key: "transferType",
          label: "Transfer Type",
          value:
            transferType === "temporary"
              ? "Temporary"
              : transferType === "permanent"
              ? "Permanent"
              : "-",
        },
        {
          key: "effectiveDates",
          label: "Effective Dates",
          value:
            transferType === "temporary"
              ? `${formatDisplayDate(transferStartDate)} to ${formatDisplayDate(transferEndDate)}`
              : transferType === "permanent"
              ? "Immediate"
              : "-",
        },
      ],
    },
    {
      title: "Checklist Selection",
      fields: [
        {
          key: "checklistCount",
          label: "Checklist Count",
          value: String(Array.isArray(selectedChecklists) ? selectedChecklists.length : 0),
        },
        {
          key: "checklists",
          label: "Selected Checklists",
          value: buildTransferChecklistLines(selectedChecklists),
        },
      ],
    },
  ]);

const buildCurrentTransferDisplaySnapshot = ({ fromEmployee, selectedChecklists }) =>
  buildDisplaySnapshot([
    {
      title: "Current Assignment",
      fields: [
        {
          key: "fromEmployee",
          label: "From Employee",
          value: formatEmployeeDisplayName(fromEmployee) || "-",
        },
        {
          key: "toEmployee",
          label: "To Employee",
          value: "-",
        },
        {
          key: "transferType",
          label: "Transfer Type",
          value: "-",
        },
        {
          key: "effectiveDates",
          label: "Effective Dates",
          value: "-",
        },
      ],
    },
    {
      title: "Checklist Selection",
      fields: [
        {
          key: "checklistCount",
          label: "Checklist Count",
          value: String(Array.isArray(selectedChecklists) ? selectedChecklists.length : 0),
        },
        {
          key: "checklists",
          label: "Selected Checklists",
          value: buildTransferChecklistLines(selectedChecklists),
        },
      ],
    },
  ]);

const buildPendingChecklistAddFilter = ({ checklistNumber, siteId }) => ({
  moduleKey: CHECKLIST_REQUEST_MODULE_KEYS.checklistMaster,
  actionType: CHECKLIST_REQUEST_ACTIONS.add,
  status: CHECKLIST_REQUEST_STATUS.pending,
  entryId: normalizeText(checklistNumber),
  ...(siteId ? { moduleSiteIds: siteId } : {}),
});

const getPendingAwareChecklistNumber = async (siteId) => {
  const nextChecklistNumber = await getNextChecklistNumberValue(siteId);
  if (!nextChecklistNumber) return null;

  const numberMatch = /^(.*?)-\s*(\d+)\s*$/.exec(normalizeText(nextChecklistNumber));
  if (!numberMatch) return nextChecklistNumber;

  const prefix = normalizeText(numberMatch[1]);
  const nextSequence = Number(numberMatch[2] || 0);
  const pendingRequests = await ChecklistAdminRequest.find(
    {
      moduleKey: CHECKLIST_REQUEST_MODULE_KEYS.checklistMaster,
      actionType: CHECKLIST_REQUEST_ACTIONS.add,
      status: CHECKLIST_REQUEST_STATUS.pending,
      moduleSiteIds: siteId,
      entryId: {
        $regex: `^${escapeRegex(prefix)}\\s*-\\s*`,
      },
    },
    "entryId"
  ).lean();

  const maxPendingSequence = pendingRequests.reduce((maxValue, row) => {
    const match = /^(.*?)-\s*(\d+)\s*$/.exec(normalizeText(row?.entryId));
    if (!match) return maxValue;
    const parsedValue = Number(match[2]);
    return Number.isNaN(parsedValue) ? maxValue : Math.max(maxValue, parsedValue);
  }, 0);

  const finalSequence = Math.max(nextSequence, maxPendingSequence + 1);
  return `${prefix} - ${String(finalSequence).padStart(3, "0")}`;
};

const getRequesterDisplayName = (user) =>
  normalizeText(user?.name || user?.employeeName || user?.email);

const buildAdminRequestNotificationTitle = (request) =>
  `${getRequestModuleName(request?.moduleKey)} ${getRequestActionLabel(request?.actionType)} Request`;

const buildAdminRequestNotificationMessage = (request) => {
  const requestedBy = normalizeText(request?.requestedByName) || "A user";
  const entryLabel = normalizeText(request?.entryLabel) || normalizeText(request?.requestSummary);

  return entryLabel
    ? `${requestedBy} submitted ${entryLabel} for admin approval.`
    : `${requestedBy} submitted a request for admin approval.`;
};

const buildRequesterNotificationRoute = (request) => {
  if (request?.moduleKey === CHECKLIST_REQUEST_MODULE_KEYS.checklistTransfer) {
    return "/masters/checklist-transfer";
  }

  if (request?.resultEntryId) {
    return `/checklists/${request.resultEntryId}`;
  }

  if (request?.targetChecklist) {
    return `/checklists/${request.targetChecklist}`;
  }

  return "/checklists";
};

const createChecklistMasterApprovalRequest = async ({
  requester,
  actionType,
  checklist = null,
  validatedPayload,
}) => {
  const adminRecipients = await getChecklistAdminRecipients();
  if (!adminRecipients.length) {
    throw new Error("No admin account is available to review this request");
  }

  const oldPayload = checklist ? toPlainObject(checklist) : {};
  const [oldDisplay, newDisplay] = await Promise.all([
    checklist ? buildChecklistMasterDisplaySnapshot(checklist) : Promise.resolve(buildDisplaySnapshot([])),
    buildChecklistMasterDisplaySnapshot(validatedPayload),
  ]);
  const comparisonRows = buildComparisonRows(oldDisplay, newDisplay);
  const checklistNumber = normalizeText(validatedPayload?.checklistNumber || checklist?.checklistNumber);
  const checklistName = normalizeText(validatedPayload?.checklistName || checklist?.checklistName);
  const entryLabel = [checklistNumber, checklistName].filter(Boolean).join(" - ") || checklistName;

  const request = await ChecklistAdminRequest.create({
    moduleKey: CHECKLIST_REQUEST_MODULE_KEYS.checklistMaster,
    moduleName: getRequestModuleName(CHECKLIST_REQUEST_MODULE_KEYS.checklistMaster),
    actionType,
    entryId: checklistNumber,
    entryLabel,
    requestSummary: `${getRequestActionLabel(actionType)} ${entryLabel || "Checklist Master"}`,
    targetChecklist: checklist?._id || null,
    relatedChecklistIds: checklist?._id ? [checklist._id] : [],
    moduleSiteIds: validatedPayload?.employeeAssignedSite ? [validatedPayload.employeeAssignedSite] : [],
    requestedBy: requester?.id || null,
    requestedByName: getRequesterDisplayName(requester),
    requestedByEmail: normalizeText(requester?.email),
    requestPayload: validatedPayload,
    oldPayload,
    oldDisplay,
    newDisplay,
    comparisonRows,
  });

  try {
    await createChecklistRequestNotifications({
      requestId: request._id,
      recipients: adminRecipients,
      recipientScope: "admin",
      notificationType: CHECKLIST_REQUEST_NOTIFICATION_TYPES.submitted,
      moduleKey: request.moduleKey,
      actionType: request.actionType,
      title: buildAdminRequestNotificationTitle(request),
      message: buildAdminRequestNotificationMessage(request),
      routePath: "/checklists/admin-approvals",
    });
  } catch (notificationError) {
    console.error("CHECKLIST MASTER REQUEST NOTIFICATION ERROR:", notificationError);
  }

  return request;
};

const createChecklistTransferApprovalRequest = async ({
  requester,
  actionType,
  transferType,
  fromEmployee,
  toEmployee,
  selectedChecklists,
  transferStartDate = null,
  transferEndDate = null,
  siteIds = [],
}) => {
  const adminRecipients = await getChecklistAdminRecipients();
  if (!adminRecipients.length) {
    throw new Error("No admin account is available to review this request");
  }

  const oldDisplay = buildCurrentTransferDisplaySnapshot({
    fromEmployee,
    selectedChecklists,
  });
  const newDisplay = buildTransferDisplaySnapshot({
    transferType,
    fromEmployee,
    toEmployee,
    selectedChecklists,
    transferStartDate,
    transferEndDate,
  });
  const comparisonRows = buildComparisonRows(oldDisplay, newDisplay);
  const requestPayload = {
    transferType,
    fromEmployeeId: fromEmployee?._id || null,
    toEmployeeId: toEmployee?._id || null,
    checklistIds: selectedChecklists.map((checklist) => checklist._id),
    fromDate: transferStartDate,
    toDate: transferEndDate,
  };
  const request = await ChecklistAdminRequest.create({
    moduleKey: CHECKLIST_REQUEST_MODULE_KEYS.checklistTransfer,
    moduleName: getRequestModuleName(CHECKLIST_REQUEST_MODULE_KEYS.checklistTransfer),
    actionType,
    entryId: selectedChecklists
      .map((checklist) => normalizeText(checklist?.checklistNumber))
      .filter(Boolean)
      .join(", "),
    entryLabel: `${selectedChecklists.length} checklist${
      selectedChecklists.length === 1 ? "" : "s"
    } from ${formatEmployeeDisplayName(fromEmployee) || "-"} to ${
      formatEmployeeDisplayName(toEmployee) || "-"
    }`,
    requestSummary: `${
      transferType === "temporary" ? "Temporary" : "Permanent"
    } Transfer`,
    relatedChecklistIds: selectedChecklists.map((checklist) => checklist._id),
    moduleSiteIds: siteIds,
    requestedBy: requester?.id || null,
    requestedByName: getRequesterDisplayName(requester),
    requestedByEmail: normalizeText(requester?.email),
    requestPayload,
    oldPayload: {},
    oldDisplay,
    newDisplay,
    comparisonRows,
  });

  try {
    await createChecklistRequestNotifications({
      requestId: request._id,
      recipients: adminRecipients,
      recipientScope: "admin",
      notificationType: CHECKLIST_REQUEST_NOTIFICATION_TYPES.submitted,
      moduleKey: request.moduleKey,
      actionType: request.actionType,
      title: buildAdminRequestNotificationTitle(request),
      message: buildAdminRequestNotificationMessage(request),
      routePath: "/checklists/admin-approvals",
    });
  } catch (notificationError) {
    console.error("CHECKLIST TRANSFER REQUEST NOTIFICATION ERROR:", notificationError);
  }

  return request;
};

const ensurePendingReviewNotificationsForUser = async (user = {}) => {
  if (!canReviewChecklistRequests(user)) return;

  const pendingRequests = await ChecklistAdminRequest.find(
    { status: CHECKLIST_REQUEST_STATUS.pending },
    "_id moduleKey actionType entryLabel requestSummary requestedByName"
  ).lean();

  if (!pendingRequests.length) return;

  const requestIds = pendingRequests.map((request) => request._id);
  const existingNotifications = await ChecklistRequestNotification.find(
    {
      request: { $in: requestIds },
      recipientUser: user.id,
      recipientScope: "admin",
    },
    "request"
  ).lean();
  const existingRequestIds = new Set(
    existingNotifications.map((notification) => normalizeText(notification.request))
  );
  const missingRequests = pendingRequests.filter(
    (request) => !existingRequestIds.has(normalizeText(request._id))
  );

  if (!missingRequests.length) return;

  await Promise.all(
    missingRequests.map((request) =>
      createChecklistRequestNotifications({
        requestId: request._id,
        recipients: [{ _id: user.id }],
        recipientScope: "admin",
        notificationType: CHECKLIST_REQUEST_NOTIFICATION_TYPES.submitted,
        moduleKey: request.moduleKey,
        actionType: request.actionType,
        title: buildAdminRequestNotificationTitle(request),
        message: buildAdminRequestNotificationMessage(request),
        routePath: "/checklists/admin-approvals",
      })
    )
  );
};

const getPendingTransferRequestConflict = async (checklistIds = [], excludedRequestId = "") => {
  const normalizedChecklistIds = normalizeIdList(checklistIds);
  if (!normalizedChecklistIds.length) return null;

  const pendingRequests = await ChecklistAdminRequest.find(
    {
      moduleKey: CHECKLIST_REQUEST_MODULE_KEYS.checklistTransfer,
      status: CHECKLIST_REQUEST_STATUS.pending,
      relatedChecklistIds: { $in: normalizedChecklistIds },
      ...(excludedRequestId ? { _id: { $ne: excludedRequestId } } : {}),
    },
    "entryLabel requestSummary"
  ).lean();

  if (!pendingRequests.length) return null;

  return (
    normalizeText(pendingRequests[0]?.entryLabel) ||
    normalizeText(pendingRequests[0]?.requestSummary) ||
    "A pending transfer request"
  );
};

const loadPermanentTransferContext = async ({
  body,
  requesterUser = null,
  requesterAccess = null,
  skipTemporaryTransferConflictCheck = false,
}) => {
  const fromEmployeeId = normalizeText(body?.fromEmployeeId);
  const toEmployeeId = normalizeText(body?.toEmployeeId);
  const checklistIds = Array.isArray(body?.checklistIds)
    ? body.checklistIds.map((id) => normalizeText(id)).filter(Boolean)
    : [];
  const uniqueChecklistIds = [...new Set(checklistIds)];

  if (!isValidObjectId(fromEmployeeId)) {
    return { message: "Select a valid From Employee", status: 400 };
  }

  if (!isValidObjectId(toEmployeeId)) {
    return { message: "Select a valid To Employee", status: 400 };
  }

  if (fromEmployeeId === toEmployeeId) {
    return {
      message: "From Employee and To Employee cannot be the same",
      status: 400,
    };
  }

  if (!uniqueChecklistIds.length) {
    return { message: "Select at least one checklist to transfer", status: 400 };
  }

  if (uniqueChecklistIds.some((id) => !isValidObjectId(id))) {
    return {
      message: "One or more selected checklists are invalid",
      status: 400,
    };
  }

  const transferAccess = await getChecklistTransferAccessContext(requesterAccess || {});
  const scopedEmployeeFilter = transferAccess.accessIsAll
    ? {}
    : transferAccess.accessibleEmployeeIds.length
    ? { _id: { $in: transferAccess.accessibleEmployeeIds } }
    : { _id: null };
  const scopedSiteFilter = transferAccess.scopedSiteIds.length
    ? { sites: { $in: transferAccess.scopedSiteIds } }
    : {};
  const checklistScopeFilter = await buildChecklistMasterScopeFilter(requesterAccess || {});
  const [fromEmployee, toEmployee] = await Promise.all([
    Employee.findOne(
      mergeQueryFilters(
        {
          _id: fromEmployeeId,
        },
        scopedEmployeeFilter,
        scopedSiteFilter
      ),
      "employeeCode employeeName email isActive sites department"
    )
      .populate("sites", "name companyName")
      .populate("department", "name")
      .lean(),
    Employee.findOne(
      mergeQueryFilters(
        {
          _id: toEmployeeId,
          isActive: true,
        },
        scopedEmployeeFilter,
        scopedSiteFilter
      ),
      "employeeCode employeeName email isActive sites department"
    )
      .populate("sites", "name companyName")
      .populate("department", "name")
      .lean(),
  ]);

  if (!fromEmployee) {
    return { message: "From Employee was not found", status: 404 };
  }

  if (!toEmployee) {
    return {
      message: "To Employee was not found or is inactive",
      status: 404,
    };
  }

  const sharedSiteIds = getSharedEmployeeSiteIds(
    fromEmployee,
    toEmployee,
    transferAccess.scopedSiteIds
  );
  const sharedDepartmentIds = getSharedEmployeeDepartmentIds(fromEmployee, toEmployee);

  if (!sharedSiteIds.length) {
    return {
      message: "To Employee must belong to the same assigned site as the selected From Employee",
      status: 400,
    };
  }

  if (!sharedDepartmentIds.length) {
    return {
      message:
        "To Employee must belong to the same assigned department as the selected From Employee",
      status: 400,
    };
  }

  const selectedChecklists = await Checklist.find(
    mergeQueryFilters(
      {
        _id: { $in: uniqueChecklistIds },
        assignedToEmployee: fromEmployeeId,
      },
      checklistScopeFilter
    ),
    "checklistNumber checklistName employeeAssignedSite"
  )
    .populate("employeeAssignedSite", "name companyName")
    .sort({ checklistName: 1, checklistNumber: 1 })
    .lean();

  if (selectedChecklists.length !== uniqueChecklistIds.length) {
    return {
      message:
        "One or more selected checklists were not found for the selected From Employee",
      status: 404,
    };
  }

  const incompatibleChecklists = selectedChecklists.filter(
    (checklist) =>
      !employeeHasSite(
        toEmployee,
        checklist?.employeeAssignedSite?._id || checklist?.employeeAssignedSite
      )
  );

  if (incompatibleChecklists.length) {
    return {
      message: `To Employee is not mapped to the assigned site for: ${incompatibleChecklists
        .map((checklist) => checklist.checklistName || checklist.checklistNumber)
        .join(", ")}`,
      status: 400,
    };
  }

  const checklistObjectIds = selectedChecklists.map((checklist) => checklist._id);
  const siteIds = [
    ...new Set(
      selectedChecklists
        .map((checklist) =>
          normalizeText(checklist?.employeeAssignedSite?._id || checklist?.employeeAssignedSite)
        )
        .filter(Boolean)
    ),
  ];

  if (!skipTemporaryTransferConflictCheck) {
    const conflictingTemporaryTransfers = await findConflictingChecklistTemporaryTransfers({
      checklistIds: checklistObjectIds,
      includeAnyOutstandingWindow: true,
    });

    if (conflictingTemporaryTransfers.length) {
      const conflictingChecklistNames = buildConflictingChecklistNameList(
        conflictingTemporaryTransfers,
        checklistObjectIds
      );

      return {
        message: `Temporary transfer is already pending or active for: ${conflictingChecklistNames.join(
          ", "
        )}`,
        status: 400,
      };
    }
  }

  return {
    payload: {
      fromEmployee,
      toEmployee,
      selectedChecklists,
      checklistObjectIds,
      siteIds,
    },
  };
};

const applyPermanentTransferContext = async ({ actorUser, context }) => {
  const { fromEmployee, toEmployee, selectedChecklists, checklistObjectIds, siteIds } =
    context || {};

  await Checklist.updateMany(
    { _id: { $in: checklistObjectIds } },
    { $set: { assignedToEmployee: toEmployee._id } }
  );

  const taskUpdateResult = await ChecklistTask.updateMany(
    { checklist: { $in: checklistObjectIds } },
    { $set: { assignedEmployee: toEmployee._id } }
  );

  const history = await ChecklistTransferHistory.create({
    transferType: "permanent",
    fromEmployee: fromEmployee._id,
    fromEmployeeCode: normalizeText(fromEmployee.employeeCode),
    fromEmployeeName: normalizeText(fromEmployee.employeeName),
    toEmployee: toEmployee._id,
    toEmployeeCode: normalizeText(toEmployee.employeeCode),
    toEmployeeName: normalizeText(toEmployee.employeeName),
    checklistNames: selectedChecklists.map((checklist) => normalizeText(checklist.checklistName)),
    checklists: selectedChecklists.map((checklist) => ({
      checklist: checklist._id,
      checklistNumber: normalizeText(checklist.checklistNumber),
      checklistName: normalizeText(checklist.checklistName),
      assignedSite:
        checklist?.employeeAssignedSite?._id || checklist?.employeeAssignedSite || null,
      assignedSiteName: formatSiteDisplayName(checklist.employeeAssignedSite),
    })),
    siteIds,
    transferredBy: actorUser?.id || null,
    transferredByEmail: normalizeText(actorUser?.email),
    transferredAt: new Date(),
  });

  const populatedHistory = await ChecklistTransferHistory.findById(history._id).populate(
    checklistTransferHistoryPopulateQuery
  );

  return {
    history: populatedHistory,
    transferredCount: checklistObjectIds.length,
    updatedTaskCount: Number(taskUpdateResult.modifiedCount || 0),
    fromEmployee: {
      _id: fromEmployee._id,
      label: formatEmployeeDisplayName(fromEmployee),
    },
    toEmployee: {
      _id: toEmployee._id,
      label: formatEmployeeDisplayName(toEmployee),
    },
  };
};

const loadTemporaryTransferContext = async ({
  body,
  requesterUser = null,
  requesterAccess = null,
}) => {
  const transferContext = await loadPermanentTransferContext({
    body,
    requesterUser,
    requesterAccess,
    skipTemporaryTransferConflictCheck: true,
  });

  if (transferContext?.message) {
    return transferContext;
  }

  const transferStartDate = parseDateBoundary(body?.fromDate, "start");
  const transferEndDate = parseDateBoundary(body?.toDate, "end");

  if (!transferStartDate || !transferEndDate) {
    return { message: "Select valid From Date and To Date", status: 400 };
  }

  if (transferStartDate > transferEndDate) {
    return {
      message: "From Date must be less than or equal to To Date",
      status: 400,
    };
  }

  const conflictingTemporaryTransfers = await findConflictingChecklistTemporaryTransfers({
    checklistIds: transferContext.payload.checklistObjectIds,
    transferStartDate,
    transferEndDate,
  });

  if (conflictingTemporaryTransfers.length) {
    const conflictingChecklistNames = buildConflictingChecklistNameList(
      conflictingTemporaryTransfers,
      transferContext.payload.checklistObjectIds
    );

    return {
      message: `Temporary transfer already exists for the selected date range: ${conflictingChecklistNames.join(
        ", "
      )}`,
      status: 400,
    };
  }

  return {
    payload: {
      ...transferContext.payload,
      transferStartDate,
      transferEndDate,
    },
  };
};

const applyTemporaryTransferContext = async ({ actorUser, context }) => {
  const {
    fromEmployee,
    toEmployee,
    selectedChecklists,
    checklistObjectIds,
    siteIds,
    transferStartDate,
    transferEndDate,
  } = context || {};

  const history = await ChecklistTransferHistory.create({
    transferType: "temporary",
    transferStatus: "pending",
    fromEmployee: fromEmployee._id,
    fromEmployeeCode: normalizeText(fromEmployee.employeeCode),
    fromEmployeeName: normalizeText(fromEmployee.employeeName),
    toEmployee: toEmployee._id,
    toEmployeeCode: normalizeText(toEmployee.employeeCode),
    toEmployeeName: normalizeText(toEmployee.employeeName),
    checklistNames: selectedChecklists.map((checklist) => normalizeText(checklist.checklistName)),
    checklists: selectedChecklists.map((checklist) => ({
      checklist: checklist._id,
      checklistNumber: normalizeText(checklist.checklistNumber),
      checklistName: normalizeText(checklist.checklistName),
      assignedSite:
        checklist?.employeeAssignedSite?._id || checklist?.employeeAssignedSite || null,
      assignedSiteName: formatSiteDisplayName(checklist.employeeAssignedSite),
    })),
    siteIds,
    transferStartDate,
    transferEndDate,
    transferredBy: actorUser?.id || null,
    transferredByEmail: normalizeText(actorUser?.email),
    transferredAt: new Date(),
  });

  await runChecklistScheduler({ checklistIds: checklistObjectIds });

  const populatedHistory = await ChecklistTransferHistory.findById(history._id).populate(
    checklistTransferHistoryPopulateQuery
  );

  return {
    history: populatedHistory,
    transferredCount: checklistObjectIds.length,
    transferStatus: populatedHistory?.transferStatus || "pending",
    fromEmployee: {
      _id: fromEmployee._id,
      label: formatEmployeeDisplayName(fromEmployee),
    },
    toEmployee: {
      _id: toEmployee._id,
      label: formatEmployeeDisplayName(toEmployee),
    },
  };
};

const createRequesterDecisionNotification = async ({ request, status }) => {
  const requesterId = request?.requestedBy;
  if (!requesterId) return;

  const notificationType =
    status === CHECKLIST_REQUEST_STATUS.approved
      ? CHECKLIST_REQUEST_NOTIFICATION_TYPES.approved
      : CHECKLIST_REQUEST_NOTIFICATION_TYPES.rejected;
  const title = `${getRequestModuleName(request?.moduleKey)} ${getRequestActionLabel(
    request?.actionType
  )} ${status === CHECKLIST_REQUEST_STATUS.approved ? "Approved" : "Rejected"}`;
  const message = request?.entryLabel
    ? `${request.entryLabel} was ${
        status === CHECKLIST_REQUEST_STATUS.approved ? "approved" : "rejected"
      } by admin.`
    : `Your request was ${
        status === CHECKLIST_REQUEST_STATUS.approved ? "approved" : "rejected"
      } by admin.`;

  await createChecklistRequestNotifications({
    requestId: request._id,
    recipients: [{ _id: requesterId }],
    recipientScope: "requester",
    notificationType,
    moduleKey: request.moduleKey,
    actionType: request.actionType,
    title,
    message,
    routePath: buildRequesterNotificationRoute(request),
  });
};

const approveChecklistAdminRequestRecord = async ({ request, reviewer, remarks = "" }) => {
  let resultEntryId = null;
  let resultEntryModel = "";

  if (request.moduleKey === CHECKLIST_REQUEST_MODULE_KEYS.checklistMaster) {
    if (request.actionType === CHECKLIST_REQUEST_ACTIONS.add) {
      await releaseSoftDeletedChecklistNumber(request.requestPayload?.checklistNumber);

      const checklist = await Checklist.create({
        ...request.requestPayload,
        createdBy: request.requestedBy || null,
      });

      await runChecklistScheduler({ checklistIds: [checklist._id] });
      resultEntryId = checklist._id;
      resultEntryModel = "Checklist";
    } else {
      const checklist = await Checklist.findById(request.targetChecklist);

      if (!checklist) {
        throw new Error("Checklist master no longer exists");
      }

      const latestTask = await ChecklistTask.findOne({ checklist: checklist._id })
        .sort({ occurrenceDate: -1 })
        .lean();

      Object.assign(checklist, request.requestPayload, {
        lastGeneratedAt: latestTask?.occurrenceDate || null,
      });
      await releaseSoftDeletedChecklistNumber(checklist.checklistNumber);
      await checklist.save();
      await syncChecklistTaskDependencies({
        checklistIds: [checklist._id],
        dependencyChecklistIds: [checklist._id],
      });
      await runChecklistScheduler({ checklistIds: [checklist._id] });
      resultEntryId = checklist._id;
      resultEntryModel = "Checklist";
    }
  } else if (request.moduleKey === CHECKLIST_REQUEST_MODULE_KEYS.checklistTransfer) {
    const actorUser = {
      id: request.requestedBy || null,
      email: request.requestedByEmail || "",
    };

    if (request.actionType === CHECKLIST_REQUEST_ACTIONS.permanentTransfer) {
      const transferContext = await loadPermanentTransferContext({
        body: request.requestPayload,
        requesterUser: null,
      });

      if (transferContext?.message) {
        throw new Error(transferContext.message);
      }

      const transferResult = await applyPermanentTransferContext({
        actorUser,
        context: transferContext.payload,
      });
      resultEntryId = transferResult?.history?._id || null;
      resultEntryModel = "ChecklistTransferHistory";
    } else {
      const transferContext = await loadTemporaryTransferContext({
        body: request.requestPayload,
        requesterUser: null,
      });

      if (transferContext?.message) {
        throw new Error(transferContext.message);
      }

      const transferResult = await applyTemporaryTransferContext({
        actorUser,
        context: transferContext.payload,
      });
      resultEntryId = transferResult?.history?._id || null;
      resultEntryModel = "ChecklistTransferHistory";
    }
  }

  request.status = CHECKLIST_REQUEST_STATUS.approved;
  request.reviewedBy = reviewer?.id || null;
  request.reviewedByName = getRequesterDisplayName(reviewer);
  request.reviewedByEmail = normalizeText(reviewer?.email);
  request.reviewedAt = new Date();
  request.remarks = normalizeText(remarks);
  request.resultEntryId = resultEntryId || null;
  request.resultEntryModel = resultEntryModel;

  await request.save();

  try {
    await ChecklistRequestNotification.deleteMany({
      request: request._id,
      recipientScope: "admin",
    });
    await createRequesterDecisionNotification({
      request,
      status: CHECKLIST_REQUEST_STATUS.approved,
    });
  } catch (notificationError) {
    console.error("CHECKLIST APPROVAL NOTIFICATION ERROR:", notificationError);
  }

  return request;
};

const rejectChecklistAdminRequestRecord = async ({ request, reviewer, remarks = "" }) => {
  request.status = CHECKLIST_REQUEST_STATUS.rejected;
  request.reviewedBy = reviewer?.id || null;
  request.reviewedByName = getRequesterDisplayName(reviewer);
  request.reviewedByEmail = normalizeText(reviewer?.email);
  request.reviewedAt = new Date();
  request.remarks = normalizeText(remarks);

  await request.save();

  try {
    await ChecklistRequestNotification.deleteMany({
      request: request._id,
      recipientScope: "admin",
    });
    await createRequesterDecisionNotification({
      request,
      status: CHECKLIST_REQUEST_STATUS.rejected,
    });
  } catch (notificationError) {
    console.error("CHECKLIST REJECTION NOTIFICATION ERROR:", notificationError);
  }

  return request;
};

const extractCellValue = (value) => {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value;

  if (value && typeof value === "object") {
    if (Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text || "").join("");
    }

    if (Object.prototype.hasOwnProperty.call(value, "result")) {
      return extractCellValue(value.result);
    }

    if (Object.prototype.hasOwnProperty.call(value, "text")) {
      return value.text || "";
    }

    if (Object.prototype.hasOwnProperty.call(value, "hyperlink")) {
      return value.text || value.hyperlink || "";
    }
  }

  return value;
};

const getCellText = (value) => normalizeText(extractCellValue(value));

const CHECKLIST_IMPORT_DATE_TIME_ERROR =
  "Invalid date or time format. Use dd-mm-yyyy and HH:mm";
const checklistImportDateRegex = /^\d{2}-\d{2}-\d{4}$/;
const checklistImportTimeRegex = /^\d{2}:\d{2}$/;

const getChecklistImportDateString = (value) => {
  const extractedValue = extractCellValue(value);

  if (extractedValue instanceof Date && !Number.isNaN(extractedValue.getTime())) {
    return [
      pad(extractedValue.getUTCDate()),
      pad(extractedValue.getUTCMonth() + 1),
      extractedValue.getUTCFullYear(),
    ].join("-");
  }

  return normalizeText(extractedValue);
};

const getChecklistImportTimeString = (value) => {
  const extractedValue = extractCellValue(value);

  if (extractedValue instanceof Date && !Number.isNaN(extractedValue.getTime())) {
    return `${pad(extractedValue.getUTCHours())}:${pad(extractedValue.getUTCMinutes())}`;
  }

  if (typeof extractedValue === "number" && Number.isFinite(extractedValue)) {
    const normalizedSerialTime = extractedValue - Math.floor(extractedValue);
    const totalMinutes = Math.round(normalizedSerialTime * 24 * 60);
    if (totalMinutes < 0 || totalMinutes >= 24 * 60) return "";

    return `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`;
  }

  return normalizeText(extractedValue);
};

const parseChecklistImportDateTime = (dateValue, timeValue) => {
  const date = getChecklistImportDateString(dateValue);
  const time = getChecklistImportTimeString(timeValue);

  if (!checklistImportDateRegex.test(date) || !checklistImportTimeRegex.test(time)) {
    return null;
  }

  const [dayText, monthText, yearText] = date.split("-");
  const [hoursText, minutesText] = time.split(":");
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  const dateTime = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes)
  );

  if (
    dateTime.getFullYear() !== year ||
    dateTime.getMonth() !== month - 1 ||
    dateTime.getDate() !== day ||
    dateTime.getHours() !== hours ||
    dateTime.getMinutes() !== minutes
  ) {
    return null;
  }

  return {
    dateTime,
    date: `${pad(day)}-${pad(month)}-${year}`,
    serviceDate: `${year}-${pad(month)}-${pad(day)}`,
    time: `${pad(hours)}:${pad(minutes)}`,
  };
};

const parseChecklistImportDateTimeCell = (value) => {
  const extractedValue = extractCellValue(value);

  if (extractedValue instanceof Date && !Number.isNaN(extractedValue.getTime())) {
    return parseChecklistImportDateTime(extractedValue, extractedValue);
  }

  const normalized = normalizeText(extractedValue).replace(/\s+/g, " ");
  const match = normalized.match(/^(\d{2}-\d{2}-\d{4})\s+(\d{2}:\d{2})$/);
  if (!match) return null;

  return parseChecklistImportDateTime(match[1], match[2]);
};

const parseChecklistImportNumber = (value) => {
  const text = getCellText(value);
  if (!text) return null;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDelimitedCell = (value) =>
  getCellText(value)
    .split(/\r?\n|\|/)
    .map((item) => normalizeText(item))
    .filter(Boolean);

const parseBooleanCell = (value, fallback = false) => {
  const extractedValue = extractCellValue(value);
  if (typeof extractedValue === "boolean") return extractedValue;

  const normalizedValue = normalizeLookupKey(extractedValue);
  if (!normalizedValue) return fallback;
  if (["true", "1", "yes", "y", "required", "mandatory"].includes(normalizedValue)) {
    return true;
  }
  if (["false", "0", "no", "n", "optional"].includes(normalizedValue)) {
    return false;
  }

  return fallback;
};

const parseScoringCell = (value) => {
  const normalizedValue = normalizeLookupKey(value);
  if (["enabled", "enable", "yes", "true", "1"].includes(normalizedValue)) return true;
  if (["disabled", "disable", "no", "false", "0"].includes(normalizedValue)) return false;
  return parseBooleanCell(value, false);
};

const buildSiteLookup = (sites = []) => {
  const siteLookup = new Map();

  sites.forEach((site) => {
    [site?._id, site?.name, formatSiteDisplayName(site)]
      .map((value) => normalizeLookupKey(value))
      .filter(Boolean)
      .forEach((lookupKey) => {
        if (!siteLookup.has(lookupKey)) {
          siteLookup.set(lookupKey, site);
        }
      });
  });

  return siteLookup;
};

const buildEmployeeLookup = (employees = []) => {
  const employeeLookup = new Map();

  employees.forEach((employee) => {
    [
      employee?._id,
      employee?.employeeCode,
      employee?.email,
      `${employee?.employeeCode || ""} - ${employee?.employeeName || ""}`,
    ]
      .map((value) => normalizeLookupKey(value))
      .filter(Boolean)
      .forEach((lookupKey) => {
        if (!employeeLookup.has(lookupKey)) {
          employeeLookup.set(lookupKey, employee);
        }
      });
  });

  return employeeLookup;
};

const buildChecklistLookup = (checklists = []) => {
  const checklistLookup = new Map();

  checklists.forEach((checklist) => {
    [checklist?._id, checklist?.checklistNumber]
      .map((value) => normalizeLookupKey(value))
      .filter(Boolean)
      .forEach((lookupKey) => {
        if (!checklistLookup.has(lookupKey)) {
          checklistLookup.set(lookupKey, checklist);
        }
      });
  });

  return checklistLookup;
};

const normalizeDuplicateId = (value) =>
  normalizeText(value?._id || value).toLowerCase();

const normalizeDuplicateDate = (value) => {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString();
};

const normalizeDuplicateNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? Math.round(parsedValue * 100) / 100 : null;
};

const normalizeDuplicateItems = (items = []) =>
  (Array.isArray(items) ? items : []).map((item) => ({
    label: normalizeLookupKey(item?.label),
    detail: normalizeLookupKey(item?.detail),
    isRequired: item?.isRequired !== false,
  }));

const normalizeDuplicateApprovals = (approvals = []) =>
  (Array.isArray(approvals) ? approvals : [])
    .map((row) => ({
      approvalLevel: Number(row?.approvalLevel) || 0,
      approvalEmployee: normalizeDuplicateId(row?.approvalEmployee),
    }))
    .filter((row) => row.approvalEmployee)
    .sort((left, right) => left.approvalLevel - right.approvalLevel)
    .map((row) => row.approvalEmployee);

const buildChecklistImportDuplicateSignature = (checklist = {}) =>
  JSON.stringify({
    checklistName: normalizeLookupKey(checklist.checklistName),
    checklistSourceSite: normalizeDuplicateId(checklist.checklistSourceSite),
    assignedToEmployee: normalizeDuplicateId(checklist.assignedToEmployee),
    employeeAssignedSite: normalizeDuplicateId(checklist.employeeAssignedSite),
    priority: normalizeLookupKey(checklist.priority || "medium"),
    scheduleType: normalizeLookupKey(checklist.scheduleType),
    startDate: normalizeDuplicateDate(checklist.startDate),
    scheduleTime: normalizeLookupKey(checklist.scheduleTime),
    endDate: normalizeDuplicateDate(checklist.endDate),
    endTime: normalizeLookupKey(checklist.endTime),
    enableMark: checklist.enableMark === true,
    baseMark: checklist.enableMark ? normalizeDuplicateNumber(checklist.baseMark) : null,
    delayPenaltyPerDay: checklist.enableMark
      ? normalizeDuplicateNumber(checklist.delayPenaltyPerDay)
      : null,
    advanceBonusPerDay: checklist.enableMark
      ? normalizeDuplicateNumber(checklist.advanceBonusPerDay)
      : null,
    customRepeatInterval: Number(checklist.customRepeatInterval || 1) || 1,
    customRepeatUnit: normalizeLookupKey(checklist.customRepeatUnit || "daily"),
    repeatDayOfMonth: Number(checklist.repeatDayOfMonth || 0) || null,
    repeatDayOfWeek: normalizeLookupKey(checklist.repeatDayOfWeek),
    repeatMonthOfYear: Number(checklist.repeatMonthOfYear || 0) || null,
    approvalHierarchy: normalizeLookupKey(checklist.approvalHierarchy || "default"),
    approvals: normalizeDuplicateApprovals(checklist.approvals),
    isDependentTask: checklist.isDependentTask === true,
    dependencyChecklistId: normalizeDuplicateId(checklist.dependencyChecklistId),
    dependencyTaskNumber: normalizeLookupKey(checklist.dependencyTaskNumber),
    targetDayCount: checklist.isDependentTask
      ? normalizeDuplicateNumber(checklist.targetDayCount)
      : null,
    checklistItems: normalizeDuplicateItems(checklist.checklistItems),
    status: checklist.status !== false,
  });

const getWorksheetOrDefault = (workbook) =>
  workbook.getWorksheet(CHECKLIST_EXCEL_SHEET_NAME) || workbook.worksheets[0] || null;

const buildWorksheetHeaderMap = (worksheet) => {
  const headerMap = new Map();
  const headerRow = worksheet.getRow(1);

  headerRow.eachCell((cell, columnNumber) => {
    const headerName = normalizeLookupKey(cell.value);
    if (headerName) {
      headerMap.set(headerName, columnNumber);
    }
  });

  return headerMap;
};

const getWorksheetCellValue = (row, headerMap, key) => {
  const column = checklistExcelColumnMap.get(key);
  if (!column) return "";

  const headerCandidates = [column.header, ...(column.aliases || [])];
  const columnNumber = headerCandidates
    .map((header) => headerMap.get(normalizeLookupKey(header)))
    .find(Boolean);
  if (!columnNumber) return "";

  return row.getCell(columnNumber).value;
};

const hasWorksheetHeaderForKey = (headerMap, key) => {
  const column = checklistExcelColumnMap.get(key);
  if (!column) return false;

  return [column.header, ...(column.aliases || [])].some((header) =>
    headerMap.has(normalizeLookupKey(header))
  );
};

const parseChecklistImportDateTimeFromCells = (dateValue, timeValue) =>
  parseChecklistImportDateTime(dateValue, timeValue) ||
  parseChecklistImportDateTimeCell(dateValue) ||
  parseChecklistImportDateTimeCell(timeValue);

const isChecklistImportRowEmpty = (row, headerMap) =>
  checklistExcelColumns.every((column) => !getCellText(getWorksheetCellValue(row, headerMap, column.key)));

const isChecklistImportTemplateRow = (row, headerMap) => {
  const checklistNumber = normalizeLookupKey(
    getWorksheetCellValue(row, headerMap, "checklistNumber")
  );
  const checklistName = normalizeLookupKey(
    getWorksheetCellValue(row, headerMap, "checklistName")
  );
  const sourceSite = normalizeLookupKey(getWorksheetCellValue(row, headerMap, "sourceSite"));
  const assignedEmployee = normalizeLookupKey(
    getWorksheetCellValue(row, headerMap, "assignedEmployeeCode")
  );

  if (checklistNumber === "cl-001" && checklistName === "daily safety checklist") {
    return true;
  }

  return (
    ["auto number", "use existing or new checklist number"].includes(checklistNumber) ||
    checklistName === "enter checklist name" ||
    sourceSite === "use exact site name" ||
    assignedEmployee === "employee must exist"
  );
};

const isChecklistImportDataRow = (row, headerMap) => {
  if (isChecklistImportRowEmpty(row, headerMap)) return false;

  const checklistName = getCellText(getWorksheetCellValue(row, headerMap, "checklistName"));

  if (!checklistName) return false;
  return !isChecklistImportTemplateRow(row, headerMap);
};

const isChecklistImportPartialRow = (row, headerMap) =>
  !isChecklistImportRowEmpty(row, headerMap) &&
  !isChecklistImportTemplateRow(row, headerMap);

const buildChecklistItemsCellValue = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) =>
      [
        normalizeText(item?.label),
        normalizeText(item?.detail),
        item?.isRequired === false ? "no" : "yes",
      ].join("::")
    )
    .filter(Boolean)
    .join(" | ");

const parseChecklistItemsCellValue = (value) =>
  parseDelimitedCell(value)
    .map((item) => {
      const [label = "", detail = "", required = "yes"] = item
        .split("::")
        .map((token) => normalizeText(token));

      return {
        label,
        detail,
        isRequired: parseBooleanCell(required || "yes", true),
      };
    })
    .filter((item) => item.label);

const buildApprovalEmployeeDisplayCellValue = (approvals = []) =>
  (Array.isArray(approvals) ? approvals : [])
    .map((row) => formatEmployeeDisplayName(row?.approvalEmployee))
    .filter(Boolean)
    .join(" | ");

const formatExcelDateDisplay = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const shiftedDate = new Date(date.getTime() + IST_OFFSET_MS);
  return [
    pad(shiftedDate.getUTCDate()),
    pad(shiftedDate.getUTCMonth() + 1),
    shiftedDate.getUTCFullYear(),
  ].join("-");
};

const formatExcelTimeDisplay = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }

  const normalized = normalizeText(value);
  if (!normalized) return "";

  const meridiemMatch = normalized.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*([AP]M)$/i);
  if (meridiemMatch) {
    let hours = Number(meridiemMatch[1]);
    const minutes = Number(meridiemMatch[2] || 0);
    const suffix = meridiemMatch[3].toUpperCase();

    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return normalized;
    if (suffix === "PM" && hours !== 12) hours += 12;
    if (suffix === "AM" && hours === 12) hours = 0;

    return `${pad(hours)}:${pad(minutes)}`;
  }

  const timeMatch = normalized.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeMatch) {
    const hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return normalized;
    return `${pad(hours)}:${pad(minutes)}`;
  }

  const parsedDate = new Date(normalized);
  if (!Number.isNaN(parsedDate.getTime())) {
    return `${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}`;
  }

  return normalized;
};

const formatExcelDateTimeDisplay = (dateValue, timeValue) => {
  const date = formatExcelDateDisplay(dateValue);
  const time = formatExcelTimeDisplay(timeValue);

  if (!date && !time) return "";
  return [date, time].filter(Boolean).join(" ");
};

const formatExcelDateValueDateTimeDisplay = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const shiftedDate = new Date(date.getTime() + IST_OFFSET_MS);
  return [
    [
      pad(shiftedDate.getUTCDate()),
      pad(shiftedDate.getUTCMonth() + 1),
      shiftedDate.getUTCFullYear(),
    ].join("-"),
    `${pad(shiftedDate.getUTCHours())}:${pad(shiftedDate.getUTCMinutes())}`,
  ].join(" ");
};

const formatChecklistScoringLabel = (checklist = {}) =>
  checklist.enableMark ? "Enabled" : "Disabled";

const formatChecklistStatusLabel = (value) => (value ? "Active" : "Inactive");

const formatChecklistDependencyExcelLabel = (checklist = {}) => {
  if (!checklist.isDependentTask) return "No";

  const dependencyTaskNumber = normalizeText(checklist.dependencyTaskNumber) || "Yes";
  const targetDayCount = normalizeText(checklist.targetDayCount);

  return targetDayCount
    ? `${dependencyTaskNumber} | Target: ${targetDayCount}`
    : dependencyTaskNumber;
};

const getChecklistFilters = (query = {}) => {
  const search = normalizeText(query.search);
  const scheduleType = normalizeText(query.scheduleType).toLowerCase();
  const status = normalizeText(query.status).toLowerCase();
  const assignedToEmployee = normalizeText(query.assignedToEmployee);
  const filter = {};

  if (search) {
    filter.$or = [
      { checklistNumber: { $regex: search, $options: "i" } },
      { checklistName: { $regex: search, $options: "i" } },
    ];
  }

  if (scheduleType) {
    filter.scheduleType = scheduleType;
  }

  if (status === "active") {
    filter.status = true;
  }

  if (status === "inactive") {
    filter.status = false;
  }

  if (assignedToEmployee) {
    filter.assignedToEmployee = assignedToEmployee;
  }

  return filter;
};

const findNestedDepartmentNode = (rows = [], nodeId, trail = []) => {
  const targetId = normalizeText(nodeId);
  if (!targetId) return null;

  for (const row of rows || []) {
    const nextTrail = [...trail, normalizeText(row?.name)].filter(Boolean);

    if (normalizeText(row?._id) === targetId) {
      return {
        _id: targetId,
        name: normalizeText(row?.name),
        path: nextTrail.join(" > "),
      };
    }

    const child = findNestedDepartmentNode(row?.children || [], targetId, nextTrail);
    if (child) return child;
  }

  return null;
};

const getEmployeeDepartmentRows = (employee = {}) =>
  (Array.isArray(employee.department) ? employee.department : employee.department ? [employee.department] : [])
    .filter(Boolean);

const getEmployeeDepartmentDetails = (employee = {}) =>
  getEmployeeDepartmentRows(employee)
    .map((department) => ({
      _id: normalizeText(department?._id || department),
      name: normalizeText(department?.name),
      headNames: Array.isArray(department?.headNames) ? department.headNames : [],
    }))
    .filter((department) => department._id || department.name);

const getEmployeeSubDepartmentDetails = (employee = {}) => {
  const departmentRows = getEmployeeDepartmentRows(employee);

  return normalizeIdList(employee.subDepartment)
    .map((subDepartmentId) => {
      for (const department of departmentRows) {
        const match = findNestedDepartmentNode(department?.subDepartments || [], subDepartmentId);
        if (!match) continue;

        return {
          _id: subDepartmentId,
          departmentId: normalizeText(department?._id || department),
          departmentName: normalizeText(department?.name),
          name: match.name,
          path:
            normalizeText(department?.name) && match.path
              ? `${normalizeText(department.name)} > ${match.path}`
              : match.path || match.name,
        };
      }

      return null;
    })
    .filter(Boolean);
};

const mapChecklistSetupEmployee = (employeeDoc) => {
  const employee = toPlainObject(employeeDoc);
  const departmentDetails = getEmployeeDepartmentDetails(employee);
  const subDepartmentDetails = getEmployeeSubDepartmentDetails(employee);
  const departmentNames = departmentDetails.map((department) => department.name).filter(Boolean);
  const subDepartmentNames = subDepartmentDetails
    .map((subDepartment) => subDepartment.name)
    .filter(Boolean);
  const subDepartmentPaths = subDepartmentDetails
    .map((subDepartment) => subDepartment.path)
    .filter(Boolean);

  return {
    ...employee,
    departmentIds: departmentDetails.map((department) => department._id).filter(Boolean),
    departmentDetails,
    departmentName: departmentNames.join(", "),
    departmentDisplay: departmentNames.join(", "),
    subDepartment: normalizeIdList(employee.subDepartment),
    subDepartmentDetails,
    subDepartmentNames,
    subDepartmentPaths,
    subDepartmentName: subDepartmentNames.join(", "),
    subDepartmentPath: subDepartmentPaths.join(", "),
    subDepartmentDisplay: subDepartmentPaths.join(", "),
  };
};

const getTaskFilters = (query = {}) => {
  const search = normalizeText(query.search);
  const status = normalizeText(query.status).toLowerCase();
  const scheduleType = normalizeText(query.scheduleType).toLowerCase();
  const rawTimingStatus = normalizeText(
    query.submissionTimingStatus || query.timelinessStatus
  ).toLowerCase();
  const submissionTimingStatus =
    rawTimingStatus === "advanced"
      ? "advance"
      : rawTimingStatus === "delay"
      ? "delayed"
      : rawTimingStatus;
  const legacyTimelinessStatus =
    submissionTimingStatus === "advance"
      ? "advanced"
      : submissionTimingStatus === "delayed"
      ? "delay"
      : submissionTimingStatus;
  const filter = {};

  if (search) {
    filter.$or = [
      { taskNumber: { $regex: escapeRegex(search), $options: "i" } },
      { checklistNumber: { $regex: escapeRegex(search), $options: "i" } },
      { checklistName: { $regex: escapeRegex(search), $options: "i" } },
    ];
  }

  if (status) {
    filter.status = status;
  }

  if (scheduleType) {
    filter.scheduleType = scheduleType;
  }

  if (["pending", "advance", "on_time", "delayed"].includes(submissionTimingStatus)) {
    filter.$and = [
      ...(Array.isArray(filter.$and) ? filter.$and : []),
      {
        $or: [
          { submissionTimingStatus },
          ...(TASK_TIMELINESS_STATUSES.includes(legacyTimelinessStatus)
            ? [{ timelinessStatus: legacyTimelinessStatus }]
            : []),
        ],
      },
    ];
  }

  return filter;
};

const normalizeTaskTimingStatus = (value) => {
  const normalized = normalizeText(value).toLowerCase();

  if (normalized === "advanced") return "advance";
  if (normalized === "delay") return "delayed";
  return normalized || "pending";
};

const parseOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const roundMarkValue = (value) => {
  const parsedValue = parseOptionalNumber(value);
  if (parsedValue === null) return null;
  return Math.round(parsedValue * 100) / 100;
};

const formatReportDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
};

const formatDepartmentList = (departments = []) =>
  (Array.isArray(departments) ? departments : departments ? [departments] : [])
    .map((department) => normalizeText(department?.name || department))
    .filter(Boolean)
    .join(", ");

const formatTaskDepartmentLabel = (task = {}) =>
  formatDepartmentList(
    task?.assignedEmployee?.department || task?.departmentDetails || task?.department
  ) ||
  normalizeText(task?.departmentDisplay) ||
  "-";

const isNilChecklistTask = (task = {}) => {
  const normalizedStatus = normalizeText(task?.status).toLowerCase();
  const normalizedApprovalType = normalizeText(task?.approvalType).toLowerCase();

  return (
    task?.isNilApproval === true ||
    normalizedApprovalType === "nil" ||
    normalizedStatus === "nil_for_approval" ||
    normalizedStatus === "nil_approved"
  );
};

const getReportDayStartValue = (value) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const shiftedDate = new Date(date.getTime() + IST_OFFSET_MS);

  return Date.UTC(
    shiftedDate.getUTCFullYear(),
    shiftedDate.getUTCMonth(),
    shiftedDate.getUTCDate()
  );
};

const getReportDayDifference = (leftValue, rightValue) => {
  const leftDayStart = getReportDayStartValue(leftValue);
  const rightDayStart = getReportDayStartValue(rightValue);

  if (leftDayStart === null || rightDayStart === null) return 0;
  return Math.round((leftDayStart - rightDayStart) / (24 * 60 * 60 * 1000));
};

const getChecklistTaskTargetDateTime = (task = {}) =>
  task?.dependencyTargetDateTime || task?.targetDateTime || task?.endDateTime || null;

const getChecklistMarkConfig = (task = {}) => {
  if (isNilChecklistTask(task)) {
    return {
      enableMark: false,
      baseMark: null,
      delayPenaltyPerDay: null,
      advanceBonusPerDay: null,
      finalMark: roundMarkValue(parseOptionalNumber(task?.finalMark) ?? 0) ?? 0,
      isNilApproval: true,
    };
  }

  const explicitEnableMark =
    typeof task?.enableMark === "boolean" ? task.enableMark : null;
  const baseMark = parseOptionalNumber(task?.baseMark);
  const legacyChecklistMark = parseOptionalNumber(task?.checklistMark);
  const resolvedBaseMark = baseMark ?? legacyChecklistMark;
  const enableMark =
    explicitEnableMark !== null
      ? explicitEnableMark && resolvedBaseMark !== null
      : resolvedBaseMark !== null;

  if (!enableMark || resolvedBaseMark === null) {
    return {
      enableMark: false,
      baseMark: null,
      delayPenaltyPerDay: null,
      advanceBonusPerDay: null,
      finalMark: null,
      isNilApproval: false,
    };
  }

  return {
    enableMark: true,
    baseMark: roundMarkValue(resolvedBaseMark),
    delayPenaltyPerDay: roundMarkValue(
      parseOptionalNumber(task?.delayPenaltyPerDay) ?? 0.5
    ),
    advanceBonusPerDay: roundMarkValue(
      parseOptionalNumber(task?.advanceBonusPerDay) ?? 0.5
    ),
    finalMark: roundMarkValue(parseOptionalNumber(task?.finalMark)),
    isNilApproval: false,
  };
};

const getChecklistTaskMarkSummary = (task = {}) => {
  const markConfig = getChecklistMarkConfig(task);

  if (markConfig.isNilApproval) {
    return {
      ...markConfig,
      direction: "nil",
      dayCount: 0,
      delayDays: 0,
      advanceDays: 0,
      adjustment: null,
    };
  }

  if (!markConfig.enableMark) {
    return {
      ...markConfig,
      direction: "disabled",
      dayCount: 0,
      delayDays: 0,
      advanceDays: 0,
      adjustment: null,
    };
  }

  const targetDateTime = getChecklistTaskTargetDateTime(task);

  if (!task?.submittedAt || !targetDateTime) {
    return {
      ...markConfig,
      direction: "pending",
      dayCount: 0,
      delayDays: 0,
      advanceDays: 0,
      adjustment: null,
    };
  }

  const dayDifference = getReportDayDifference(task.submittedAt, targetDateTime);
  const isSameDayLate =
    dayDifference === 0 &&
    new Date(task.submittedAt).getTime() > new Date(targetDateTime).getTime();
  const delayDays = Math.max(0, dayDifference) + (isSameDayLate ? 1 : 0);
  const advanceDays = Math.max(0, dayDifference * -1);
  const calculatedAdjustment =
    advanceDays * (markConfig.advanceBonusPerDay || 0) -
    delayDays * (markConfig.delayPenaltyPerDay || 0);
  const finalMark =
    markConfig.finalMark !== null
      ? markConfig.finalMark
      : roundMarkValue(
          Math.max(0, (markConfig.baseMark || 0) + calculatedAdjustment)
        );
  const timingStatus = normalizeTaskTimingStatus(
    task?.submissionTimingStatus || task?.timelinessStatus
  );
  const direction =
    delayDays > 0
      ? "delay"
      : advanceDays > 0
      ? "advance"
      : timingStatus === "delayed"
      ? "delay"
      : "on_time";

  return {
    ...markConfig,
    finalMark,
    direction,
    dayCount: delayDays || advanceDays,
    delayDays,
    advanceDays,
    adjustment: roundMarkValue((finalMark || 0) - (markConfig.baseMark || 0)),
  };
};

const formatReportMarkValue = (value) => {
  const normalizedValue = roundMarkValue(value);
  return normalizedValue === null
    ? reportMarkFormatter.format(0)
    : reportMarkFormatter.format(normalizedValue);
};

const formatReportMarkAdjustment = (value) => {
  const normalizedValue = roundMarkValue(value);

  if (normalizedValue === null) return formatReportMarkValue(0);
  if (normalizedValue > 0) return `+${formatReportMarkValue(normalizedValue)}`;
  if (normalizedValue < 0) return `-${formatReportMarkValue(Math.abs(normalizedValue))}`;
  return formatReportMarkValue(0);
};

const formatChecklistTaskScoringLabel = (task = {}) => {
  const markConfig = getChecklistMarkConfig(task);

  if (markConfig.isNilApproval) return "Nil approval | No Mark";
  if (!markConfig.enableMark) return "Disabled";

  return `Base ${formatReportMarkValue(markConfig.baseMark)}`;
};

const formatChecklistTaskMarkDayLabel = (task = {}) => {
  const markSummary = getChecklistTaskMarkSummary(task);

  if (markSummary.isNilApproval) return "No Mark";
  if (!markSummary.enableMark) return "Not enabled";
  if (markSummary.direction === "pending") return "Pending";
  if (markSummary.direction === "delay") {
    return `${markSummary.delayDays} day${markSummary.delayDays === 1 ? "" : "s"} delay`;
  }
  if (markSummary.direction === "advance") {
    return `${markSummary.advanceDays} day${markSummary.advanceDays === 1 ? "" : "s"} advance`;
  }

  return "On time";
};

const formatChecklistTaskFinalMarkLabel = (task = {}) => {
  const markSummary = getChecklistTaskMarkSummary(task);

  if (markSummary.isNilApproval) return "No Mark";
  if (markSummary.enableMark) {
    return markSummary.finalMark !== null
      ? formatReportMarkValue(markSummary.finalMark)
      : "Pending";
  }

  return "Not enabled";
};

const formatChecklistTaskPriorityLabel = (task = {}) =>
  capitalizeLabel(task?.priority || task?.checklist?.priority) || "-";

const formatChecklistTaskScheduleLabel = (task = {}) => {
  const scheduleType = normalizeText(task?.scheduleType || task?.repeatType).toLowerCase();
  if (!scheduleType) return "-";

  if (scheduleType === "custom") {
    const repeatSummary = normalizeText(task?.repeatSummary);
    return repeatSummary ? `Custom (${repeatSummary})` : "Custom";
  }

  return capitalizeLabel(scheduleType) || "-";
};

const formatChecklistTaskStatusLabel = (status) => {
  const normalizedStatus = normalizeText(status).toLowerCase();

  switch (normalizedStatus) {
    case "waiting_dependency":
      return "Waiting for Dependency";
    case "open":
      return "Assigned";
    case "submitted":
      return "Under Approval";
    case "nil_for_approval":
      return "Nil For Approval";
    case "approved":
      return "Approved / Completed";
    case "nil_approved":
      return "Nil Approved";
    case "rejected":
      return "Rejected";
    default:
      return capitalizeLabel(normalizedStatus) || "-";
  }
};

const formatChecklistTaskTimelinessLabel = (value) => {
  const normalized = normalizeTaskTimingStatus(value);

  switch (normalized) {
    case "advance":
      return "Advance";
    case "on_time":
      return "On Time";
    case "delayed":
      return "Delay";
    case "pending":
    default:
      return "Pending";
  }
};

const formatChecklistTaskApprovalTypeLabel = (task = {}) =>
  isNilChecklistTask(task) ? "Nil" : "Normal";

const getCurrentApprover = (task = {}) => {
  if (task?.currentApprovalEmployee) {
    return task.currentApprovalEmployee;
  }

  const approvalSteps = Array.isArray(task?.approvalSteps) ? task.approvalSteps : [];
  const pendingStep = approvalSteps.find((step) => step?.status === "pending");

  if (pendingStep?.approverEmployee) {
    return pendingStep.approverEmployee;
  }

  const waitingStep = approvalSteps.find((step) => step?.status === "waiting");

  if (waitingStep?.approverEmployee) {
    return waitingStep.approverEmployee;
  }

  const lastActionedStep = [...approvalSteps]
    .filter((step) => step?.status && step.status !== "waiting")
    .sort(
      (left, right) =>
        (Number(left?.approvalLevel) || 0) - (Number(right?.approvalLevel) || 0)
    )
    .at(-1);

  return lastActionedStep?.approverEmployee || null;
};

const getChecklistTaskWorkflowEmployees = (task = {}) => {
  const approvalSteps = Array.isArray(task?.approvalSteps) ? task.approvalSteps : [];
  const seen = new Set();

  return approvalSteps
    .map((step) => step?.approverEmployee)
    .filter((employee) => {
      const employeeId = normalizeText(employee?._id || employee);

      if (!employeeId || seen.has(employeeId)) return false;

      seen.add(employeeId);
      return true;
    });
};

const formatChecklistTaskCurrentApproverLabel = (task = {}) =>
  formatEmployeeDisplayName(getCurrentApprover(task)) || "-";

const formatChecklistTaskWorkflowLabel = (task = {}) => {
  const labels = getChecklistTaskWorkflowEmployees(task)
    .map((employee) => formatEmployeeDisplayName(employee))
    .filter(Boolean);

  return labels.join(", ") || "-";
};

const buildChecklistTaskReportRow = (task = {}, index = 0) => {
  const markSummary = getChecklistTaskMarkSummary(task);

  return {
    serialNumber: index + 1,
    taskNumber: normalizeText(task.taskNumber) || "-",
    checklistNumber: normalizeText(task.checklistNumber) || "-",
    checklistName: normalizeText(task.checklistName) || "-",
    employee: formatEmployeeDisplayName(task.assignedEmployee) || "-",
    department: formatTaskDepartmentLabel(task),
    priority: formatChecklistTaskPriorityLabel(task),
    schedule: formatChecklistTaskScheduleLabel(task),
    start: formatReportDateTime(task.occurrenceDate),
    end: formatReportDateTime(task.endDateTime),
    targetDateTime: formatReportDateTime(getChecklistTaskTargetDateTime(task)),
    submittedAt: formatReportDateTime(task.submittedAt),
    submissionStatus: task?.submittedAt ? "Submitted" : "Pending Submission",
    approvalType: formatChecklistTaskApprovalTypeLabel(task),
    scoring: formatChecklistTaskScoringLabel(task),
    timeStatus: formatChecklistTaskTimelinessLabel(
      task?.submissionTimingStatus || task?.timelinessStatus
    ),
    delayAdvance: formatChecklistTaskMarkDayLabel(task),
    adjustment: markSummary.isNilApproval
      ? "No Mark"
      : markSummary.enableMark
      ? markSummary.adjustment !== null
        ? formatReportMarkAdjustment(markSummary.adjustment)
        : "Pending"
      : "Not enabled",
    finalMark: formatChecklistTaskFinalMarkLabel(task),
    currentApprover: formatChecklistTaskCurrentApproverLabel(task),
    approvalWorkflow: formatChecklistTaskWorkflowLabel(task),
    approvalStatus: formatChecklistTaskStatusLabel(task.status),
  };
};

const buildChecklistTaskReportFilterSummary = (query = {}) => {
  const parts = [];
  const search = normalizeText(query.search);
  const fromDate = normalizeText(query.fromDate);
  const toDate = normalizeText(query.toDate);
  const status = normalizeText(query.status);
  const scheduleType = normalizeText(query.scheduleType);
  const companyName = normalizeText(query.companyName);
  const department = normalizeText(query.department);
  const subDepartment = normalizeText(query.subDepartment);
  const assignedEmployee = normalizeText(query.assignedEmployee);
  const timelinessStatus = normalizeText(
    query.submissionTimingStatus || query.timelinessStatus
  );

  if (search) parts.push(`Search: ${search}`);
  if (fromDate) parts.push(`From: ${fromDate}`);
  if (toDate) parts.push(`To: ${toDate}`);
  if (status) parts.push(`Status: ${formatChecklistTaskStatusLabel(status)}`);
  if (scheduleType) parts.push(`Schedule: ${capitalizeLabel(scheduleType)}`);
  if (companyName) parts.push(`Company: ${companyName}`);
  if (department) parts.push(`Department Filter Applied`);
  if (subDepartment) parts.push(`Sub Department Filter Applied`);
  if (assignedEmployee) parts.push(`Employee Filter Applied`);
  if (timelinessStatus) {
    parts.push(`Time: ${formatChecklistTaskTimelinessLabel(timelinessStatus)}`);
  }

  return parts.join(" | ") || "All checklist tasks";
};

const buildChecklistTaskReportFilter = async (query = {}) => {
  const filter = getTaskFilters(query);
  const assignedEmployee = normalizeText(query.assignedEmployee);
  const approverEmployee = normalizeText(query.approverEmployee);
  const companyName = normalizeText(query.companyName);
  const department = normalizeText(query.department);
  const subDepartment = normalizeText(query.subDepartment);
  const fromDateRaw = normalizeText(query.fromDate);
  const toDateRaw = normalizeText(query.toDate);

  if (approverEmployee) {
    filter.currentApprovalEmployee = approverEmployee;
  }

  const fromDate = parseDateBoundary(fromDateRaw, "start");
  const toDate = parseDateBoundary(toDateRaw, "end");

  if (fromDateRaw && !fromDate) {
    return { error: "Invalid from date filter", status: 400 };
  }

  if (toDateRaw && !toDate) {
    return { error: "Invalid to date filter", status: 400 };
  }

  if (fromDate && toDate && fromDate > toDate) {
    return { error: "From date cannot be greater than to date", status: 400 };
  }

  if (fromDate || toDate) {
    filter.occurrenceDate = {};
    if (fromDate) filter.occurrenceDate.$gte = fromDate;
    if (toDate) filter.occurrenceDate.$lte = toDate;
  }

  if (companyName) {
    const matchingSites = await Site.find({ companyName }, "_id").lean();

    if (!matchingSites.length) {
      return { filter: null };
    }

    const matchingChecklists = await Checklist.find(
      {
        employeeAssignedSite: { $in: matchingSites.map((site) => site._id) },
      },
      "_id"
    ).lean();

    if (!matchingChecklists.length) {
      return { filter: null };
    }

    filter.checklist = {
      $in: matchingChecklists.map((checklist) => checklist._id),
    };
  }

  if (department || subDepartment) {
    const employeeFilter = {};

    if (assignedEmployee) {
      employeeFilter._id = assignedEmployee;
    }

    if (department) {
      employeeFilter.department = department;
    }

    if (subDepartment) {
      employeeFilter.subDepartment = subDepartment;
    }

    const matchingEmployees = await Employee.find(employeeFilter, "_id").lean();

    if (!matchingEmployees.length) {
      return { filter: null };
    }

    filter.assignedEmployee = {
      $in: matchingEmployees.map((employee) => employee._id),
    };
  } else if (assignedEmployee) {
    filter.assignedEmployee = assignedEmployee;
  }

  return { filter };
};

const loadChecklistTaskReportRows = async (query = {}) => {
  const filterResult = await buildChecklistTaskReportFilter(query);

  if (filterResult?.error) {
    return filterResult;
  }

  if (filterResult?.filter === null) {
    return { tasks: [] };
  }

  const tasks = await ChecklistTask.find(filterResult.filter)
    .populate(checklistTaskPopulateQuery)
    .sort({ occurrenceDate: -1, createdAt: -1 });

  return { tasks };
};

const buildGeneratedChecklistTaskScopeFilter = async (access = {}, user = {}) => {
  const restrictedSiteId = getRestrictedChecklistSiteId(user);

  if (isAdminRequester(user) || (isAllScope(access || {}) && !restrictedSiteId)) {
    return {};
  }

  const checklistScopeFilter = mergeQueryFilters(
    await buildChecklistMasterScopeFilter(access || {}),
    restrictedSiteId ? { employeeAssignedSite: restrictedSiteId } : {}
  );

  const [scopedChecklists, accessibleEmployeeIds] = await Promise.all([
    Checklist.find(checklistScopeFilter, "_id").lean(),
    resolveAccessibleEmployeeIds(access || {}),
  ]);

  const checklistFilter = scopedChecklists.length
    ? { checklist: { $in: scopedChecklists.map((checklist) => checklist._id) } }
    : null;
  const employeeFilter = accessibleEmployeeIds.length
    ? { assignedEmployee: { $in: accessibleEmployeeIds } }
    : null;

  const activeFilters = [checklistFilter, employeeFilter].filter(Boolean);

  if (!activeFilters.length) {
    return { _id: null };
  }

  return activeFilters.length === 1 ? activeFilters[0] : { $or: activeFilters };
};

const escapePdfText = (value) =>
  String(value === null || value === undefined ? "" : value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/[^\x20-\x7E]/g, "?");

const wrapPdfText = (text, maxChars = 96) => {
  const normalized = String(text || "").trim();
  if (!normalized) return [""];

  const words = normalized.split(/\s+/);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    if (!currentLine) {
      currentLine = word;
      return;
    }

    if (`${currentLine} ${word}`.length <= maxChars) {
      currentLine = `${currentLine} ${word}`;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

const buildPdfContentStream = (lines = []) => {
  let content = "BT\n40 560 Td\n";
  let currentFont = "";
  let currentSize = 0;

  lines.forEach((line, index) => {
    const font = line.font || "F1";
    const size = line.size || 10;
    const gap = Number(line.gap || 12);

    if (font !== currentFont || size !== currentSize) {
      content += `/${font} ${size} Tf\n`;
      currentFont = font;
      currentSize = size;
    }

    if (index > 0) {
      content += `0 -${gap} Td\n`;
    }

    content += `(${escapePdfText(line.text)}) Tj\n`;
  });

  content += "ET";
  return content;
};

const buildSimplePdfBuffer = (pageContents = []) => {
  const contents = pageContents.length ? pageContents : [buildPdfContentStream([])];
  const objectMap = {};
  let objectId = 1;

  const catalogId = objectId++;
  const pagesId = objectId++;
  const fontRegularId = objectId++;
  const fontBoldId = objectId++;
  const pageIds = contents.map(() => objectId++);
  const contentIds = contents.map(() => objectId++);

  objectMap[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objectMap[pagesId] = `<< /Type /Pages /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageIds.length} >>`;
  objectMap[fontRegularId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";
  objectMap[fontBoldId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  contents.forEach((content, index) => {
    objectMap[pageIds[index]] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentIds[index]} 0 R >>`;
    objectMap[contentIds[index]] = `<< /Length ${Buffer.byteLength(
      content,
      "utf8"
    )} >>\nstream\n${content}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let id = 1; id < objectId; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "utf8");
    pdf += `${id} 0 obj\n${objectMap[id]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objectId}\n0000000000 65535 f \n`;

  for (let id = 1; id < objectId; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objectId} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
};

const buildChecklistTaskPdfPages = (reportRows = [], query = {}) => {
  const pages = [];
  const maxLinesPerPage = 38;
  const generatedAtLabel = formatReportDateTime(new Date());
  const filterSummary = buildChecklistTaskReportFilterSummary(query);
  let currentPage = [];

  const createPageHeader = () => [
    { text: "Checklist Task Report", font: "F2", size: 16, gap: 0 },
    { text: `Generated: ${generatedAtLabel}`, font: "F1", size: 10, gap: 18 },
    { text: `Filters: ${filterSummary}`, font: "F1", size: 9, gap: 14 },
    { text: `Total Tasks: ${reportRows.length}`, font: "F1", size: 9, gap: 12 },
    { text: "", font: "F1", size: 10, gap: 12 },
  ];

  const startNewPage = () => {
    currentPage = createPageHeader();
  };

  const ensurePageCapacity = (requiredLineCount) => {
    if (!currentPage.length) {
      startNewPage();
      return;
    }

    if (currentPage.length + requiredLineCount > maxLinesPerPage) {
      pages.push(buildPdfContentStream(currentPage));
      startNewPage();
    }
  };

  if (!reportRows.length) {
    startNewPage();
    currentPage.push({
      text: "No checklist task records found for the selected filters.",
      font: "F1",
      size: 10,
      gap: 12,
    });
    pages.push(buildPdfContentStream(currentPage));
    return pages;
  }

  reportRows.forEach((row) => {
    const block = [];
    const addWrappedBlock = (text, font = "F1", size = 10, gap = 12) => {
      wrapPdfText(text).forEach((segment, index) => {
        block.push({
          text: segment,
          font,
          size,
          gap: index === 0 ? gap : 11,
        });
      });
    };

    addWrappedBlock(
      `${row.serialNumber}. ${row.taskNumber} | ${row.approvalStatus} | ${row.submissionStatus}`,
      "F2",
      11,
      12
    );
    addWrappedBlock(`Checklist: ${row.checklistName} (${row.checklistNumber})`);
    addWrappedBlock(`Employee: ${row.employee} | Department: ${row.department}`);
    addWrappedBlock(`Priority: ${row.priority} | Schedule: ${row.schedule}`);
    addWrappedBlock(`Start: ${row.start} | End: ${row.end}`);
    addWrappedBlock(`Target: ${row.targetDateTime} | Submitted: ${row.submittedAt}`);
    addWrappedBlock(
      `Approval Type: ${row.approvalType} | Current Approver: ${row.currentApprover}`
    );

    if (row.approvalWorkflow && row.approvalWorkflow !== "-") {
      addWrappedBlock(`Workflow: ${row.approvalWorkflow}`);
    }

    addWrappedBlock(`Scoring: ${row.scoring}`);
    addWrappedBlock(`Time Status: ${row.timeStatus} | Delay/Advance: ${row.delayAdvance}`);
    addWrappedBlock(`Adjustment: ${row.adjustment} | Final Mark: ${row.finalMark}`);
    block.push({ text: "", font: "F1", size: 10, gap: 12 });

    ensurePageCapacity(block.length);
    currentPage.push(...block);
  });

  if (currentPage.length) {
    pages.push(buildPdfContentStream(currentPage));
  }

  return pages;
};

exports.getChecklists = async (req, res) => {
  try {
    if (!hasChecklistMasterAccess(req.user)) {
      return res.status(403).json({ message: "Checklist Master access is required" });
    }

    const restrictedSiteId = getRestrictedChecklistSiteId(req.user);
    const filter = mergeQueryFilters(
      getChecklistFilters(req.query),
      await buildChecklistMasterScopeFilter(req.access || {}),
      restrictedSiteId ? { employeeAssignedSite: restrictedSiteId } : {}
    );

    const checklists = await Checklist.find(filter)
      .populate(checklistPopulateQuery)
      .sort({ createdAt: -1 });

    return res.json(checklists);
  } catch (err) {
    console.error("GET CHECKLISTS ERROR:", err);
    return res.status(500).json({ message: "Failed to load checklist master data" });
  }
};

exports.getChecklistSetupData = async (req, res) => {
  try {
    if (!hasChecklistMasterAccess(req.user)) {
      return res.status(403).json({ message: "Checklist Master access is required" });
    }

    const restrictedSiteId = getRestrictedChecklistSiteId(req.user);
    const [employees, departments, sites, checklists] = await Promise.all([
      Employee.find({
        ...(await buildEmployeeScopeFilter(req.access || {})),
        isActive: true,
      })
        .populate("department", "name subDepartments headNames")
        .populate("superiorEmployee", "employeeCode employeeName")
        .populate("sites", "name companyName subSites")
        .sort({ employeeCode: 1, employeeName: 1 }),
      Department.find({
        ...(await buildDepartmentScopeFilter(req.access || {})),
        isActive: { $ne: false },
      }).sort({ name: 1 }),
      Site.find({
        ...(await buildSiteScopeFilter(req.access || {})),
        isActive: { $ne: false },
      }).sort({ companyName: 1, name: 1 }),
      Checklist.find(
        mergeQueryFilters(
          await buildChecklistMasterScopeFilter(req.access || {}),
          restrictedSiteId ? { employeeAssignedSite: restrictedSiteId } : {}
        )
      )
        .populate(checklistPopulateQuery)
        .sort({ createdAt: -1 }),
    ]);

    return res.json({
      employees: employees.map(mapChecklistSetupEmployee),
      departments,
      sites,
      checklists,
    });
  } catch (err) {
    console.error("GET CHECKLIST SETUP DATA ERROR:", err);
    return res.status(500).json({ message: "Failed to load checklist setup data" });
  }
};

exports.getNextChecklistNumber = async (req, res) => {
  try {
    if (!hasChecklistMasterAccess(req.user)) {
      return res.status(403).json({
        message: "Checklist Master access is required to generate checklist numbers",
      });
    }

    const restrictedSiteId = getRestrictedChecklistSiteId(req.user);
    const requestedSiteId = normalizeText(req.query.employeeAssignedSite);
    const employeeAssignedSite = restrictedSiteId || requestedSiteId;

    if (restrictedSiteId && requestedSiteId && requestedSiteId !== restrictedSiteId) {
      return res.status(403).json({
        message: "You can only generate checklist numbers for your assigned site",
      });
    }

    if (!isValidObjectId(employeeAssignedSite)) {
      return res.status(400).json({
        message: "A valid assigned site is required to generate checklist number",
      });
    }

    const checklistNumber = await getPendingAwareChecklistNumber(employeeAssignedSite);

    if (!checklistNumber) {
      return res.status(404).json({ message: "Selected assigned site was not found" });
    }

    return res.json({ checklistNumber });
  } catch (err) {
    console.error("GET NEXT CHECKLIST NUMBER ERROR:", err);
    return res.status(500).json({ message: "Failed to generate checklist number" });
  }
};

exports.getChecklistById = async (req, res) => {
  try {
    if (!hasChecklistMasterAccess(req.user)) {
      return res.status(403).json({ message: "Checklist Master access is required" });
    }

    const restrictedSiteId = getRestrictedChecklistSiteId(req.user);
    const checklist = await Checklist.findOne(
      mergeQueryFilters(
        { _id: req.params.id },
        await buildChecklistMasterScopeFilter(req.access || {}),
        restrictedSiteId ? { employeeAssignedSite: restrictedSiteId } : {}
      )
    ).populate(checklistPopulateQuery);

    if (!checklist) {
      return res.status(404).json({ message: "Checklist master not found" });
    }

    return res.json(checklist);
  } catch (err) {
    console.error("GET CHECKLIST BY ID ERROR:", err);
    return res.status(500).json({ message: "Failed to load checklist master data" });
  }
};

exports.createChecklist = async (req, res) => {
  try {
    if (!hasChecklistMasterAccess(req.user)) {
      return res.status(403).json({ message: "Checklist Master access is required" });
    }

    const validationResult = await validateChecklistPayload({
      body: req.body,
      requesterSiteId: getRestrictedChecklistSiteId(req.user),
    });

    if (validationResult.message) {
      return res
        .status(validationResult.status || 400)
        .json({ message: validationResult.message });
    }

    if (!canBypassChecklistAdminApproval(req.user)) {
      const nextChecklistNumber = await getPendingAwareChecklistNumber(
        validationResult.payload?.employeeAssignedSite
      );

      if (!nextChecklistNumber) {
        return res.status(400).json({ message: "Failed to generate checklist number" });
      }

      validationResult.payload.checklistNumber = nextChecklistNumber;

      const existingPendingRequest = await ChecklistAdminRequest.findOne(
        buildPendingChecklistAddFilter({
          checklistNumber: validationResult.payload.checklistNumber,
          siteId: validationResult.payload?.employeeAssignedSite,
        }),
        "_id"
      ).lean();

      if (existingPendingRequest) {
        return res.status(409).json({
          message:
            "A pending checklist master request already exists for this generated checklist number. Please refresh and try again.",
        });
      }

      const request = await createChecklistMasterApprovalRequest({
        requester: req.user,
        actionType: CHECKLIST_REQUEST_ACTIONS.add,
        validatedPayload: validationResult.payload,
      });

      return res.status(201).json({
        message: "Checklist master saved as Pending Admin Approval",
        request,
      });
    }

    await releaseSoftDeletedChecklistNumber(validationResult.payload.checklistNumber);

    const checklist = await Checklist.create({
      ...validationResult.payload,
      createdBy: req.user?.id || null,
    });

    await runChecklistScheduler({ checklistIds: [checklist._id] });

    const populatedChecklist = await Checklist.findById(checklist._id).populate(
      checklistPopulateQuery
    );

    return res.status(201).json({
      message: "Checklist master created successfully",
      checklist: populatedChecklist,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Checklist number already exists" });
    }

    console.error("CREATE CHECKLIST ERROR:", err);
    return res.status(500).json({ message: "Failed to create checklist master" });
  }
};

exports.updateChecklist = async (req, res) => {
  try {
    if (!hasChecklistMasterAccess(req.user)) {
      return res.status(403).json({ message: "Checklist Master access is required" });
    }

    const checklist = await Checklist.findById(req.params.id);

    if (!checklist) {
      return res.status(404).json({ message: "Checklist master not found" });
    }

    const validationResult = await validateChecklistPayload({
      body: {
        ...req.body,
        currentChecklistId: checklist._id,
      },
    });

    if (validationResult.message) {
      return res
        .status(validationResult.status || 400)
        .json({ message: validationResult.message });
    }

    if (!canBypassChecklistAdminApproval(req.user)) {
      const existingPendingEditRequest = await ChecklistAdminRequest.findOne(
        {
          moduleKey: CHECKLIST_REQUEST_MODULE_KEYS.checklistMaster,
          actionType: CHECKLIST_REQUEST_ACTIONS.edit,
          status: CHECKLIST_REQUEST_STATUS.pending,
          targetChecklist: checklist._id,
        },
        "_id"
      ).lean();

      if (existingPendingEditRequest) {
        return res.status(409).json({
          message:
            "A pending admin approval request already exists for this checklist master",
        });
      }

      const populatedChecklist = await Checklist.findById(checklist._id).populate(
        checklistPopulateQuery
      );

      const request = await createChecklistMasterApprovalRequest({
        requester: req.user,
        actionType: CHECKLIST_REQUEST_ACTIONS.edit,
        checklist: populatedChecklist,
        validatedPayload: validationResult.payload,
      });

      return res.json({
        message: "Checklist master changes saved as Pending Admin Approval",
        request,
      });
    }

    const latestTask = await ChecklistTask.findOne({ checklist: checklist._id })
      .sort({ occurrenceDate: -1 })
      .lean();

    Object.assign(checklist, validationResult.payload, {
      lastGeneratedAt: latestTask?.occurrenceDate || null,
    });
    await releaseSoftDeletedChecklistNumber(checklist.checklistNumber);
    await checklist.save();
    await syncChecklistTaskDependencies({
      checklistIds: [checklist._id],
      dependencyChecklistIds: [checklist._id],
    });
    await runChecklistScheduler({ checklistIds: [checklist._id] });

    const updatedChecklist = await Checklist.findById(checklist._id).populate(
      checklistPopulateQuery
    );

    return res.json({
      message: "Checklist master updated successfully",
      checklist: updatedChecklist,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Checklist number already exists" });
    }

    console.error("UPDATE CHECKLIST ERROR:", err);
    return res.status(500).json({ message: "Failed to update checklist master" });
  }
};

exports.toggleChecklistStatus = async (req, res) => {
  try {
    if (!hasChecklistMasterAccess(req.user)) {
      return res.status(403).json({ message: "Checklist Master access is required" });
    }

    const restrictedSiteId = getRestrictedChecklistSiteId(req.user);
    const checklist = await Checklist.findOne(
      mergeQueryFilters(
        { _id: req.params.id },
        await buildChecklistMasterScopeFilter(req.access || {}),
        restrictedSiteId ? { employeeAssignedSite: restrictedSiteId } : {}
      )
    );

    if (!checklist) {
      return res.status(404).json({ message: "Checklist master not found" });
    }

    const requestedStatus = normalizeText(req.body?.status).toLowerCase();
    const nextStatus =
      typeof req.body?.isActive === "boolean"
        ? req.body.isActive
        : requestedStatus === "active"
        ? true
        : requestedStatus === "inactive"
        ? false
        : !checklist.status;

    checklist.status = nextStatus;
    checklist.isActive = nextStatus;
    checklist.updatedBy = req.user?.id || checklist.updatedBy || null;
    await checklist.save();

    if (checklist.status) {
      await runChecklistScheduler({ checklistIds: [checklist._id] });
    }

    return res.json({
      success: true,
      status: checklist.status,
      isActive: checklist.isActive,
      statusLabel: checklist.status ? "Active" : "Inactive",
    });
  } catch (err) {
    console.error("TOGGLE CHECKLIST STATUS ERROR:", err);
    return res.status(500).json({ message: "Failed to update checklist status" });
  }
};

exports.deleteChecklist = async (req, res) => {
  try {
    if (!hasChecklistMasterAccess(req.user)) {
      return res.status(403).json({ message: "Checklist Master access is required" });
    }

    const restrictedSiteId = getRestrictedChecklistSiteId(req.user);
    const checklist = await Checklist.findOne(
      mergeQueryFilters(
        { _id: req.params.id },
        await buildChecklistMasterScopeFilter(req.access || {}),
        restrictedSiteId ? { employeeAssignedSite: restrictedSiteId } : {}
      )
    );

    if (!checklist) {
      return res.status(404).json({ message: "Checklist master not found" });
    }

    const hasGeneratedTasks = await ChecklistTask.exists({ checklist: checklist._id });
    if (hasGeneratedTasks) {
      return res.status(400).json({
        message:
          "Generated employee tasks already exist for this checklist master. Disable it instead of deleting it.",
      });
    }

    checklist.status = false;
    checklist.isActive = false;
    checklist.isDeleted = true;
    checklist.deletedAt = new Date();
    checklist.checklistNumber = buildArchivedChecklistNumber(
      checklist.checklistNumber,
      checklist._id
    );
    checklist.updatedBy = req.user?.id || checklist.updatedBy || null;
    await checklist.save();

    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE CHECKLIST ERROR:", err);
    return res.status(500).json({ message: "Failed to delete checklist master" });
  }
};

exports.bulkDeleteChecklists = async (req, res) => {
  try {
    if (!hasChecklistMasterAccess(req.user)) {
      return res.status(403).json({ message: "Checklist Master access is required" });
    }

    const checklistIds = Array.isArray(req.body?.checklistIds)
      ? req.body.checklistIds.map((id) => normalizeText(id)).filter(Boolean)
      : [];
    const uniqueChecklistIds = [...new Set(checklistIds)];

    if (!uniqueChecklistIds.length) {
      return res.status(400).json({ message: "Select at least one checklist master to delete" });
    }

    if (uniqueChecklistIds.some((id) => !isValidObjectId(id))) {
      return res.status(400).json({ message: "One or more selected checklist masters are invalid" });
    }

    const restrictedSiteId = getRestrictedChecklistSiteId(req.user);
    const existingChecklists = await Checklist.find(
      mergeQueryFilters(
        { _id: { $in: uniqueChecklistIds } },
        await buildChecklistMasterScopeFilter(req.access || {}),
        restrictedSiteId ? { employeeAssignedSite: restrictedSiteId } : {}
      ),
      "_id checklistNumber"
    ).lean();

    if (!existingChecklists.length) {
      return res.status(404).json({ message: "Selected checklist masters were not found" });
    }

    const existingChecklistIds = existingChecklists.map((checklist) => checklist._id);
    const checklistsWithTasks = new Set(
      (
        await ChecklistTask.distinct("checklist", {
          checklist: { $in: existingChecklistIds },
        })
      ).map((checklistId) => normalizeText(checklistId))
    );
    const deletableChecklistIds = existingChecklistIds.filter(
      (checklistId) => !checklistsWithTasks.has(normalizeText(checklistId))
    );

    if (!deletableChecklistIds.length) {
      return res.status(400).json({
        message:
          "Selected checklist masters already have generated employee tasks. Disable them instead of deleting them.",
      });
    }

    const checklistById = new Map(
      existingChecklists.map((checklist) => [normalizeText(checklist._id), checklist])
    );
    const deletedAt = new Date();
    const bulkOperations = deletableChecklistIds.map((checklistId) => {
      const checklist = checklistById.get(normalizeText(checklistId)) || {};

      return {
        updateOne: {
          filter: { _id: checklistId },
          update: {
            $set: {
              status: false,
              isActive: false,
              isDeleted: true,
              deletedAt,
              checklistNumber: buildArchivedChecklistNumber(
                checklist.checklistNumber,
                checklistId
              ),
              updatedBy: req.user?.id || null,
            },
          },
        },
      };
    });

    await Checklist.bulkWrite(bulkOperations);

    return res.json({
      success: true,
      deletedCount: deletableChecklistIds.length,
      skippedCount: existingChecklistIds.length - deletableChecklistIds.length,
    });
  } catch (err) {
    console.error("BULK DELETE CHECKLISTS ERROR:", err);
    return res.status(500).json({ message: "Failed to delete selected checklist masters" });
  }
};

exports.exportChecklistsExcel = async (req, res) => {
  try {
    if (!hasChecklistMasterAccess(req.user)) {
      return res.status(403).json({ message: "Checklist Master access is required" });
    }

    const restrictedSiteId = getRestrictedChecklistSiteId(req.user);
    const filter = mergeQueryFilters(
      getChecklistFilters(req.query),
      await buildChecklistMasterScopeFilter(req.access || {}),
      restrictedSiteId ? { employeeAssignedSite: restrictedSiteId } : {}
    );

    const checklists = await Checklist.find(filter)
      .populate(checklistPopulateQuery)
      .sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Check List Workspace";

    const worksheet = workbook.addWorksheet(CHECKLIST_EXCEL_SHEET_NAME);
    const exportColumns = checklistExcelColumns;

    worksheet.columns = exportColumns;
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: exportColumns.length },
    };

    worksheet.addRow({
      serialNumber: 1,
      checklistNumber: "CL-001",
      checklistName: "Daily Safety Checklist",
      enableMark: "Enabled",
      baseMark: "10",
      delayPenaltyPerDay: "0.5",
      advanceBonusPerDay: "0.5",
      sourceSite: "Head Office",
      assignedSite: "Head Office",
      assignedEmployeeCode: "EMP001 - Priya Sharma",
      priority: "medium",
      scheduleType: "daily",
      startDate: "02-05-2026",
      startTime: "09:00",
      endDate: "31-05-2026",
      endTime: "18:00",
      nextTask: "",
      checklistItems: "Is the floor clean?::Check all work areas::yes | Record meter reading::::yes",
      approvalEmployeeCodes: "EMP002 - Ramesh Kumar",
      dependencyTaskNumber: "No",
      status: "Active",
    });

    worksheet.addRow({
      serialNumber: "Auto number",
      checklistNumber: "Use existing or new checklist number",
      checklistName: "Enter checklist name",
      enableMark: "Enabled / Disabled",
      baseMark: "Required when Task Scoring is Enabled",
      delayPenaltyPerDay: "Required when Scoring is Enabled",
      advanceBonusPerDay: "Required when Scoring is Enabled",
      sourceSite: "Use exact Site name",
      assignedSite: "Use exact employee assigned site name",
      assignedEmployeeCode: "Employee must exist",
      priority: "high / medium / low",
      scheduleType: "daily / weekly / monthly / yearly / custom",
      startDate: "Date format: dd-mm-yyyy",
      startTime: "Time format: HH:mm",
      endDate: "Date format: dd-mm-yyyy",
      endTime: "Time format: HH:mm",
      nextTask: "Leave blank during import",
      checklistItems: "Optional. Format: Question::Detail::yes/no. Separate multiple with |",
      approvalEmployeeCodes:
        "Custom approver employee(s), use Employee Code or Code - Name. Separate multiple with |",
      dependencyTaskNumber: "No or previous checklist number",
      status: "Active / Inactive",
    });
    worksheet.getRow(2).font = { italic: true };
    worksheet.getRow(3).font = { italic: true, color: { argb: "FF666666" } };

    checklists.forEach((checklist, index) => {
      worksheet.addRow({
        serialNumber: index + 1,
        checklistNumber: checklist.checklistNumber || "",
        checklistName: checklist.checklistName || "",
        enableMark: formatChecklistScoringLabel(checklist),
        baseMark: checklist.enableMark ? checklist.baseMark ?? "" : "",
        delayPenaltyPerDay: checklist.enableMark ? checklist.delayPenaltyPerDay ?? "" : "",
        advanceBonusPerDay: checklist.enableMark ? checklist.advanceBonusPerDay ?? "" : "",
        sourceSite:
          normalizeText(checklist.checklistSourceSite?.name) ||
          "",
        assignedSite: normalizeText(checklist.employeeAssignedSite?.name),
        assignedEmployeeCode: formatEmployeeDisplayName(checklist.assignedToEmployee),
        priority: normalizeText(checklist.priority),
        scheduleType: normalizeText(checklist.scheduleType),
        startDate: formatExcelDateDisplay(checklist.startDate),
        startTime: formatExcelTimeDisplay(checklist.scheduleTime),
        endDate: formatExcelDateDisplay(checklist.endDate),
        endTime: formatExcelTimeDisplay(checklist.endTime),
        nextTask: formatExcelDateValueDateTimeDisplay(checklist.nextOccurrenceAt),
        checklistItems: buildChecklistItemsCellValue(checklist.checklistItems),
        approvalEmployeeCodes:
          checklist.approvalHierarchy === "custom"
            ? buildApprovalEmployeeDisplayCellValue(checklist.approvals)
            : "Default",
        dependencyTaskNumber: formatChecklistDependencyExcelLabel(checklist),
        status: formatChecklistStatusLabel(checklist.status),
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="checklist-masters.xlsx"'
    );

    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    console.error("EXPORT CHECKLISTS EXCEL ERROR:", err);
    return res.status(500).json({ message: "Failed to export checklist masters" });
  }
};

exports.importChecklistsExcel = async (req, res) => {
  try {
    if (!hasChecklistMasterAccess(req.user)) {
      return res.status(403).json({ message: "Checklist Master access is required" });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({ message: "Upload an Excel file to import checklist masters" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = getWorksheetOrDefault(workbook);
    if (!worksheet) {
      return res.status(400).json({ message: "Checklist workbook is empty" });
    }

    const headerMap = buildWorksheetHeaderMap(worksheet);
    const missingHeaders = requiredChecklistImportKeys.filter((key) => {
      return !hasWorksheetHeaderForKey(headerMap, key);
    });

    if (missingHeaders.length) {
      return res.status(400).json({
        message: `Invalid checklist import template. Missing columns: ${missingHeaders
          .map((key) => checklistExcelColumnMap.get(key)?.header || key)
          .join(", ")}`,
      });
    }

    const restrictedSiteId = getRestrictedChecklistSiteId(req.user);
    const siteFilter = mergeQueryFilters(
      restrictedSiteId ? { _id: restrictedSiteId } : {},
      req.access?.scope?.siteIds?.length ? { _id: { $in: req.access.scope.siteIds } } : {}
    );

    const [sites, employees, checklists] = await Promise.all([
      Site.find(siteFilter, "name companyName").lean(),
      Employee.find(
        {
          isActive: true,
          ...(restrictedSiteId ? { sites: restrictedSiteId } : {}),
        },
        "_id employeeCode employeeName email superiorEmployee sites"
      ).lean(),
      Checklist.find(
        mergeQueryFilters(
          restrictedSiteId ? { employeeAssignedSite: restrictedSiteId } : {},
          await buildChecklistMasterScopeFilter(req.access || {})
        ),
        [
          "_id",
          "checklistNumber",
          "checklistName",
          "checklistSourceSite",
          "assignedToEmployee",
          "employeeAssignedSite",
          "priority",
          "scheduleType",
          "startDate",
          "scheduleTime",
          "endDate",
          "endTime",
          "enableMark",
          "baseMark",
          "delayPenaltyPerDay",
          "advanceBonusPerDay",
          "customRepeatInterval",
          "customRepeatUnit",
          "repeatDayOfMonth",
          "repeatDayOfWeek",
          "repeatMonthOfYear",
          "approvalHierarchy",
          "approvals",
          "isDependentTask",
          "dependencyChecklistId",
          "dependencyTaskNumber",
          "targetDayCount",
          "checklistItems",
          "status",
        ].join(" ")
      ).lean(),
    ]);

    const siteLookup = buildSiteLookup(sites);
    const employeeLookup = buildEmployeeLookup(employees);
    const checklistLookup = buildChecklistLookup(checklists);
    const checklistDuplicateLookup = new Map();

    checklists.forEach((checklist) => {
      const duplicateSignature = buildChecklistImportDuplicateSignature(checklist);

      if (!checklistDuplicateLookup.has(duplicateSignature)) {
        checklistDuplicateLookup.set(duplicateSignature, checklist);
      }
    });

    const defaultSite = restrictedSiteId && sites.length === 1 ? sites[0] : null;
    const failedRows = [];
    const skippedRows = [];
    const createdChecklistIds = [];
    let processedCount = 0;
    let ignoredRows = 0;

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);

      if (!isChecklistImportDataRow(row, headerMap)) {
        if (isChecklistImportPartialRow(row, headerMap)) {
          processedCount += 1;
          failedRows.push({
            rowNumber,
            message:
              "Checklist Name is required. Check that the row values are aligned under the correct headers.",
          });
        } else {
          ignoredRows += 1;
        }
        continue;
      }

      processedCount += 1;

      const checklistNumberValue = getWorksheetCellValue(row, headerMap, "checklistNumber");
      const checklistNumber = getCellText(checklistNumberValue);
      const existingChecklistForNumber = checklistNumber
        ? checklistLookup.get(normalizeLookupKey(checklistNumber))
        : null;

      const sourceSiteValue = getWorksheetCellValue(row, headerMap, "sourceSite");
      const assignedSiteValue = getWorksheetCellValue(row, headerMap, "assignedSite");
      const assignedEmployeeCodeValue = getWorksheetCellValue(
        row,
        headerMap,
        "assignedEmployeeCode"
      );
      const approvalEmployeeCodesValue = getWorksheetCellValue(
        row,
        headerMap,
        "approvalEmployeeCodes"
      );
      const dependencyTaskNumberValue = getWorksheetCellValue(
        row,
        headerMap,
        "dependencyTaskNumber"
      );

      const assignedSite =
        siteLookup.get(normalizeLookupKey(assignedSiteValue)) ||
        (!getCellText(assignedSiteValue) ? defaultSite : null);

      if (!assignedSite) {
        failedRows.push({
          rowNumber,
          message: "Assigned Site is invalid or not available to this user",
        });
        continue;
      }

      const sourceSiteText = getCellText(sourceSiteValue);
      const sourceSite = sourceSiteText
        ? siteLookup.get(normalizeLookupKey(sourceSiteValue))
        : null;

      if (sourceSiteText && !sourceSite) {
        failedRows.push({
          rowNumber,
          message: "Source Site is invalid or not available to this user",
        });
        continue;
      }

      const assignedEmployee = employeeLookup.get(
        normalizeLookupKey(assignedEmployeeCodeValue)
      );

      if (!assignedEmployee) {
        failedRows.push({
          rowNumber,
          message: "Assigned Employee Code is invalid or inactive",
        });
        continue;
      }

      const approvalRows = [];
      const invalidApprovalCodes = [];
      const approvalMappingText = getCellText(approvalEmployeeCodesValue);
      const approvalMappingIsDefault = ["", "default"].includes(
        normalizeLookupKey(approvalMappingText)
      );

      (approvalMappingIsDefault ? [] : parseDelimitedCell(approvalEmployeeCodesValue)).forEach((employeeCode) => {
        const approvalEmployee = employeeLookup.get(normalizeLookupKey(employeeCode));

        if (!approvalEmployee) {
          invalidApprovalCodes.push(employeeCode);
          return;
        }

        approvalRows.push({ approvalEmployee: approvalEmployee._id });
      });

      if (invalidApprovalCodes.length) {
        failedRows.push({
          rowNumber,
          message: `Invalid approval employee codes: ${invalidApprovalCodes.join(", ")}`,
        });
        continue;
      }

      const dependencyText = getCellText(dependencyTaskNumberValue);
      const dependencyParts = dependencyText
        .split("|")
        .map((item) => normalizeText(item))
        .filter(Boolean);
      const dependencyTaskNumberText = dependencyParts[0] || "";
      const dependencyTargetMatch = dependencyText.match(/target\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i);
      const isDependentTask = !["", "no", "n", "false", "0"].includes(
        normalizeLookupKey(dependencyTaskNumberText)
      );
      const dependencyTaskNumber = isDependentTask ? dependencyTaskNumberText : "";
      const targetDayCount = isDependentTask ? dependencyTargetMatch?.[1] || "1" : "";
      const dependencyChecklist = isDependentTask
        ? checklistLookup.get(normalizeLookupKey(dependencyTaskNumber))
        : null;

      if (isDependentTask && !dependencyTaskNumber) {
        failedRows.push({
          rowNumber,
          message: "Previous Task Number is required when Dependent Task is yes",
        });
        continue;
      }

      if (isDependentTask && !dependencyChecklist) {
        failedRows.push({
          rowNumber,
          message: "Previous Task Number is invalid or not available to this user",
        });
        continue;
      }

      const importedStartDateTime = parseChecklistImportDateTimeFromCells(
        getWorksheetCellValue(row, headerMap, "startDate"),
        getWorksheetCellValue(row, headerMap, "startTime")
      );
      const importedEndDateTime = parseChecklistImportDateTimeFromCells(
        getWorksheetCellValue(row, headerMap, "endDate"),
        getWorksheetCellValue(row, headerMap, "endTime")
      );

      if (!importedStartDateTime || !importedEndDateTime) {
        failedRows.push({
          rowNumber,
          message: "Invalid start or end format. Use dd-mm-yyyy for date and HH:mm for time",
        });
        continue;
      }

      const enableMark = parseScoringCell(getWorksheetCellValue(row, headerMap, "enableMark"));
      const statusText = normalizeLookupKey(getWorksheetCellValue(row, headerMap, "status"));
      const status =
        statusText === "inactive" || statusText === "disabled" || statusText === "false"
          ? false
          : true;
      const baseMark = parseChecklistImportNumber(
        getWorksheetCellValue(row, headerMap, "baseMark")
      );
      const delayPenalty = parseChecklistImportNumber(
        getWorksheetCellValue(row, headerMap, "delayPenaltyPerDay")
      );
      const advanceBonus = parseChecklistImportNumber(
        getWorksheetCellValue(row, headerMap, "advanceBonusPerDay")
      );

      if (
        enableMark &&
        (baseMark === null ||
          delayPenalty === null ||
          advanceBonus === null ||
          baseMark < 0 ||
          delayPenalty < 0 ||
          advanceBonus < 0)
      ) {
        failedRows.push({
          rowNumber,
          message:
            "Base Mark, Delay Penalty / Day, and Advance Bonus / Day are required valid numbers when Scoring is Enabled",
        });
        continue;
      }

      const importPayload = {
        checklistNumber: existingChecklistForNumber ? "" : checklistNumber,
        checklistName: getCellText(getWorksheetCellValue(row, headerMap, "checklistName")),
        checklistSourceSite: sourceSite?._id || "",
        assignedToEmployee: assignedEmployee._id,
        employeeAssignedSite: assignedSite._id,
        priority: getCellText(getWorksheetCellValue(row, headerMap, "priority")) || "medium",
        scheduleType: getCellText(getWorksheetCellValue(row, headerMap, "scheduleType")),
        startDate: importedStartDateTime.serviceDate,
        scheduleTime: importedStartDateTime.time,
        endDate: importedEndDateTime.serviceDate,
        endTime: importedEndDateTime.time,
        enableMark,
        baseMark: enableMark ? baseMark : "",
        delayPenaltyPerDay: enableMark ? delayPenalty : "",
        advanceBonusPerDay: enableMark ? advanceBonus : "",
        customRepeatInterval: "",
        customRepeatUnit: "",
        repeatDayOfWeek: "",
        repeatDayOfMonth: "",
        repeatMonthOfYear: "",
        approvalHierarchy: approvalRows.length ? "custom" : "default",
        approvalEmployeeCodes: approvalMappingIsDefault
          ? []
          : parseDelimitedCell(approvalEmployeeCodesValue),
        approvals: approvalRows,
        isDependentTask,
        dependencyChecklistId: dependencyChecklist?._id || "",
        dependencyTaskNumber,
        targetDayCount,
        checklistItems: parseChecklistItemsCellValue(
          getWorksheetCellValue(row, headerMap, "checklistItems")
        ),
      };

      const validationResult = await validateChecklistPayload({
        body: importPayload,
        requesterSiteId: restrictedSiteId,
      });

      if (validationResult.message) {
        failedRows.push({
          rowNumber,
          message: validationResult.message,
        });
        continue;
      }

      const duplicateSignature = buildChecklistImportDuplicateSignature({
        ...validationResult.payload,
        status,
      });
      const existingDuplicateChecklist = checklistDuplicateLookup.get(duplicateSignature);

      if (existingDuplicateChecklist) {
        const existingChecklistNumber = normalizeText(
          existingDuplicateChecklist.checklistNumber
        );

        skippedRows.push({
          rowNumber,
          checklistNumber:
            existingChecklistNumber ||
            normalizeText(validationResult.payload?.checklistNumber) ||
            checklistNumber ||
            "Unknown",
          message: existingChecklistNumber
            ? `Checklist "${existingChecklistNumber}" already has the same task details`
            : "A checklist with the same task details already exists",
        });
        continue;
      }

      try {
        await releaseSoftDeletedChecklistNumber(validationResult.payload.checklistNumber);

        const checklist = await Checklist.create({
          ...validationResult.payload,
          status,
          createdBy: req.user?.id || null,
        });

        createdChecklistIds.push(checklist._id);
        checklistLookup.set(normalizeLookupKey(checklist.checklistNumber), {
          _id: checklist._id,
          checklistNumber: checklist.checklistNumber,
          employeeAssignedSite: checklist.employeeAssignedSite,
        });
        checklistDuplicateLookup.set(duplicateSignature, {
          ...validationResult.payload,
          _id: checklist._id,
          checklistNumber: checklist.checklistNumber,
          status,
        });
      } catch (err) {
        if (err?.code === 11000) {
          skippedRows.push({
            rowNumber,
            checklistNumber:
              normalizeText(validationResult.payload?.checklistNumber) ||
              checklistNumber ||
              "Unknown",
            message: `Checklist "${
              normalizeText(validationResult.payload?.checklistNumber) ||
              checklistNumber ||
              "Unknown"
            }" already exists`,
          });
        } else {
          failedRows.push({
            rowNumber,
            message: "Failed to import row",
          });
        }
      }
    }

    if (!processedCount) {
      return res.status(400).json({ message: "No checklist rows found in the Excel file" });
    }

    const schedulerResult = createdChecklistIds.length
      ? await runChecklistScheduler({ checklistIds: createdChecklistIds })
      : { created: 0, processed: 0, skipped: false };

    return res.json({
      message: "Checklist import completed",
      processedCount,
      createdCount: createdChecklistIds.length,
      generatedTaskCount: Number(schedulerResult?.created || 0),
      schedulerSkipped: schedulerResult?.skipped === true,
      skippedCount: skippedRows.length,
      failedCount: failedRows.length,
      ignoredRows,
      skippedRows,
      failedRows,
      failures: failedRows,
    });
  } catch (err) {
    console.error("IMPORT CHECKLISTS EXCEL ERROR:", err);
    return res.status(500).json({ message: err.message || "Failed to import checklist masters" });
  }
};

exports.getChecklistTransferChecklists = async (req, res) => {
  try {
    if (!canViewChecklistTransfer(req.user)) {
      return res.status(403).json({ message: "Checklist Transfer access is required" });
    }

    const fromEmployeeId = normalizeText(req.query.fromEmployeeId);
    if (!isValidObjectId(fromEmployeeId)) {
      return res.status(400).json({ message: "Select a valid From Employee" });
    }

    const transferAccess = await getChecklistTransferAccessContext(req.access || {});
    const scopedEmployeeFilter = transferAccess.accessIsAll
      ? {}
      : transferAccess.accessibleEmployeeIds.length
      ? { _id: { $in: transferAccess.accessibleEmployeeIds } }
      : { _id: null };
    const scopedSiteFilter = transferAccess.scopedSiteIds.length
      ? { sites: { $in: transferAccess.scopedSiteIds } }
      : {};
    const checklistScopeFilter = await buildChecklistMasterScopeFilter(req.access || {});
    const fromEmployee = await Employee.findOne(
      mergeQueryFilters(
        { _id: fromEmployeeId },
        scopedEmployeeFilter,
        scopedSiteFilter
      ),
      "employeeCode employeeName email isActive sites department"
    )
      .populate("sites", "name companyName")
      .populate("department", "name")
      .lean();

    if (!fromEmployee) {
      return res.status(404).json({ message: "From Employee was not found" });
    }

    const fromEmployeeSiteIds = getEmployeeTransferSiteIds(
      fromEmployee,
      transferAccess.scopedSiteIds
    );
    const fromEmployeeDepartmentIds = getEmployeeTransferDepartmentIds(fromEmployee);

    const eligibleToEmployees =
      fromEmployeeSiteIds.length && fromEmployeeDepartmentIds.length
        ? await Employee.find(
            mergeQueryFilters(
              {
                _id: { $ne: fromEmployeeId },
                isActive: true,
                sites: { $in: fromEmployeeSiteIds },
                department: { $in: fromEmployeeDepartmentIds },
              },
              scopedEmployeeFilter,
              scopedSiteFilter
            ),
            "employeeCode employeeName email isActive sites department"
          )
            .populate("sites", "name companyName")
            .populate("department", "name")
            .sort({ employeeName: 1, employeeCode: 1 })
            .lean()
        : [];

    const checklists = await Checklist.find(
      mergeQueryFilters(
        {
        assignedToEmployee: fromEmployeeId,
        },
        checklistScopeFilter
      ),
      [
        "checklistNumber",
        "checklistName",
        "priority",
        "scheduleType",
        "repeatSummary",
        "status",
        "nextOccurrenceAt",
        "approvalHierarchy",
        "employeeAssignedSite",
        "checklistSourceSite",
      ].join(" ")
    )
      .populate("employeeAssignedSite", "name companyName")
      .populate("checklistSourceSite", "name companyName")
      .sort({ checklistName: 1, checklistNumber: 1 })
      .lean();

    return res.json({
      employee: mapChecklistTransferEmployee(fromEmployee, transferAccess.scopedSiteIds),
      toEmployees: eligibleToEmployees.map((employee) =>
        mapChecklistTransferEmployee(employee, transferAccess.scopedSiteIds)
      ),
      count: checklists.length,
      checklists,
    });
  } catch (err) {
    console.error("GET CHECKLIST TRANSFER CHECKLISTS ERROR:", err);
    return res.status(500).json({ message: "Failed to load employee checklist masters" });
  }
};

exports.createPermanentChecklistTransfer = async (req, res) => {
  try {
    if (!hasModulePermission(req.user?.permissions, "checklist_transfer", "transfer")) {
      return res.status(403).json({ message: "Checklist Transfer permission is required" });
    }

    const transferContext = await loadPermanentTransferContext({
      body: req.body,
      requesterUser: req.user,
      requesterAccess: req.access,
    });

    if (transferContext?.message) {
      return res
        .status(transferContext.status || 400)
        .json({ message: transferContext.message });
    }

    if (!canBypassChecklistAdminApproval(req.user)) {
      const pendingTransferConflict = await getPendingTransferRequestConflict(
        transferContext.payload?.checklistObjectIds
      );

      if (pendingTransferConflict) {
        return res.status(409).json({
          message:
            "A pending admin approval transfer request already exists for one or more selected checklists",
        });
      }

      const request = await createChecklistTransferApprovalRequest({
        requester: req.user,
        actionType: CHECKLIST_REQUEST_ACTIONS.permanentTransfer,
        transferType: "permanent",
        fromEmployee: transferContext.payload.fromEmployee,
        toEmployee: transferContext.payload.toEmployee,
        selectedChecklists: transferContext.payload.selectedChecklists,
        siteIds: transferContext.payload.siteIds,
      });

      return res.json({
        message: "Checklist transfer saved as Pending Admin Approval",
        request,
      });
    }

    const transferResult = await applyPermanentTransferContext({
      actorUser: req.user,
      context: transferContext.payload,
    });

    return res.json({
      message: "Checklist transfer completed successfully",
      transferredCount: transferResult.transferredCount,
      updatedTaskCount: transferResult.updatedTaskCount,
      fromEmployee: transferResult.fromEmployee,
      toEmployee: transferResult.toEmployee,
      history: transferResult.history,
    });
  } catch (err) {
    console.error("CREATE PERMANENT CHECKLIST TRANSFER ERROR:", err);
    return res.status(500).json({ message: "Failed to transfer selected checklists" });
  }
};

exports.createTemporaryChecklistTransfer = async (req, res) => {
  try {
    if (!hasModulePermission(req.user?.permissions, "checklist_transfer", "transfer")) {
      return res.status(403).json({ message: "Checklist Transfer permission is required" });
    }

    const transferContext = await loadTemporaryTransferContext({
      body: req.body,
      requesterUser: req.user,
      requesterAccess: req.access,
    });

    if (transferContext?.message) {
      return res
        .status(transferContext.status || 400)
        .json({ message: transferContext.message });
    }

    if (!canBypassChecklistAdminApproval(req.user)) {
      const pendingTransferConflict = await getPendingTransferRequestConflict(
        transferContext.payload?.checklistObjectIds
      );

      if (pendingTransferConflict) {
        return res.status(409).json({
          message:
            "A pending admin approval transfer request already exists for one or more selected checklists",
        });
      }

      const request = await createChecklistTransferApprovalRequest({
        requester: req.user,
        actionType: CHECKLIST_REQUEST_ACTIONS.temporaryTransfer,
        transferType: "temporary",
        fromEmployee: transferContext.payload.fromEmployee,
        toEmployee: transferContext.payload.toEmployee,
        selectedChecklists: transferContext.payload.selectedChecklists,
        transferStartDate: transferContext.payload.transferStartDate,
        transferEndDate: transferContext.payload.transferEndDate,
        siteIds: transferContext.payload.siteIds,
      });

      return res.json({
        message: "Temporary checklist transfer saved as Pending Admin Approval",
        request,
      });
    }

    const transferResult = await applyTemporaryTransferContext({
      actorUser: req.user,
      context: transferContext.payload,
    });

    return res.json({
      message: "Temporary checklist transfer saved successfully",
      transferType: "temporary",
      transferStatus: transferResult.transferStatus,
      transferredCount: transferResult.transferredCount,
      fromEmployee: transferResult.fromEmployee,
      toEmployee: transferResult.toEmployee,
      history: transferResult.history,
    });
  } catch (err) {
    console.error("CREATE TEMPORARY CHECKLIST TRANSFER ERROR:", err);
    return res.status(500).json({ message: "Failed to save temporary checklist transfer" });
  }
};

exports.getChecklistTransferHistory = async (req, res) => {
  try {
    if (!canViewChecklistTransfer(req.user)) {
      return res.status(403).json({ message: "Checklist Transfer access is required" });
    }

    const transferAccess = await getChecklistTransferAccessContext(req.access || {});
    const historyRows = await ChecklistTransferHistory.find(
      mergeQueryFilters(
        transferAccess.scopedSiteIds.length
          ? { siteIds: { $in: transferAccess.scopedSiteIds } }
          : {},
        transferAccess.accessibleEmployeeIds.length
          ? {
              $or: [
                { fromEmployee: { $in: transferAccess.accessibleEmployeeIds } },
                { toEmployee: { $in: transferAccess.accessibleEmployeeIds } },
              ],
            }
          : !transferAccess.accessIsAll && !transferAccess.hasScopedAccess
          ? { _id: null }
          : {}
      )
    )
      .populate(checklistTransferHistoryPopulateQuery)
      .sort({ transferredAt: -1, createdAt: -1 })
      .limit(parseTransferHistoryLimit(req.query.limit))
      .lean();

    return res.json(historyRows);
  } catch (err) {
    console.error("GET CHECKLIST TRANSFER HISTORY ERROR:", err);
    return res.status(500).json({ message: "Failed to load checklist transfer history" });
  }
};

const mapChecklistAdminRequestSummaryRow = (request) => {
  const comparisonRows = Array.isArray(request?.comparisonRows) ? request.comparisonRows : [];

  return {
    _id: request._id,
    moduleKey: normalizeText(request?.moduleKey),
    moduleName: getRequestModuleName(request?.moduleKey),
    actionType: normalizeText(request?.actionType),
    actionLabel: getRequestActionLabel(request?.actionType),
    entryId: normalizeText(request?.entryId),
    entryLabel: normalizeText(request?.entryLabel),
    requestSummary: normalizeText(request?.requestSummary),
    targetChecklist: request?.targetChecklist || null,
    relatedChecklistIds: normalizeIdList(request?.relatedChecklistIds),
    requestedBy: request?.requestedBy || null,
    requestedByName: normalizeText(request?.requestedByName),
    requestedByEmail: normalizeText(request?.requestedByEmail),
    status: normalizeText(request?.status),
    remarks: normalizeText(request?.remarks),
    reviewedBy: request?.reviewedBy || null,
    reviewedByName: normalizeText(request?.reviewedByName),
    reviewedByEmail: normalizeText(request?.reviewedByEmail),
    reviewedAt: request?.reviewedAt || null,
    createdAt: request?.createdAt || null,
    updatedAt: request?.updatedAt || null,
    changedFieldCount: comparisonRows.filter((row) => row?.changed).length,
    changedFields: comparisonRows.filter((row) => row?.changed).map((row) => row?.label),
    resultEntryId: request?.resultEntryId || null,
    resultEntryModel: normalizeText(request?.resultEntryModel),
  };
};

exports.getChecklistAdminRequests = async (req, res) => {
  try {
    if (!canReviewChecklistRequests(req.user)) {
      return res.status(403).json({ message: "Checklist approval review permission is required" });
    }

    const search = normalizeText(req.query?.search);
    const status = normalizeText(req.query?.status).toLowerCase();
    const moduleKey = normalizeText(req.query?.moduleKey).toLowerCase();
    const filter = {};

    if (status && Object.values(CHECKLIST_REQUEST_STATUS).includes(status)) {
      filter.status = status;
    }

    if (
      moduleKey &&
      Object.values(CHECKLIST_REQUEST_MODULE_KEYS).includes(moduleKey)
    ) {
      filter.moduleKey = moduleKey;
    }

    if (search) {
      filter.$or = [
        { entryId: { $regex: escapeRegex(search), $options: "i" } },
        { entryLabel: { $regex: escapeRegex(search), $options: "i" } },
        { requestSummary: { $regex: escapeRegex(search), $options: "i" } },
        { requestedByName: { $regex: escapeRegex(search), $options: "i" } },
        { requestedByEmail: { $regex: escapeRegex(search), $options: "i" } },
      ];
    }

    const requests = await ChecklistAdminRequest.find(filter)
      .sort({ createdAt: -1 })
      .limit(250)
      .lean();

    return res.json(requests.map(mapChecklistAdminRequestSummaryRow));
  } catch (err) {
    console.error("GET CHECKLIST ADMIN REQUESTS ERROR:", err);
    return res.status(500).json({ message: "Failed to load checklist admin approval requests" });
  }
};

exports.getChecklistAdminRequestById = async (req, res) => {
  try {
    if (!canReviewChecklistRequests(req.user)) {
      return res.status(403).json({ message: "Checklist approval review permission is required" });
    }

    const request = await ChecklistAdminRequest.findById(req.params.id).lean();

    if (!request) {
      return res.status(404).json({ message: "Checklist approval request not found" });
    }

    return res.json({
      ...mapChecklistAdminRequestSummaryRow(request),
      oldDisplay: request.oldDisplay || buildDisplaySnapshot([]),
      newDisplay: request.newDisplay || buildDisplaySnapshot([]),
      comparisonRows: Array.isArray(request.comparisonRows) ? request.comparisonRows : [],
      requestPayload: request.requestPayload || {},
    });
  } catch (err) {
    console.error("GET CHECKLIST ADMIN REQUEST BY ID ERROR:", err);
    return res.status(500).json({ message: "Failed to load checklist approval request" });
  }
};

exports.approveChecklistAdminRequest = async (req, res) => {
  try {
    if (!canApproveChecklistRequests(req.user)) {
      return res.status(403).json({ message: "Checklist approval permission is required" });
    }

    const request = await ChecklistAdminRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: "Checklist approval request not found" });
    }

    if (request.status !== CHECKLIST_REQUEST_STATUS.pending) {
      return res.status(400).json({ message: "This request has already been actioned" });
    }

    const approvedRequest = await approveChecklistAdminRequestRecord({
      request,
      reviewer: req.user,
      remarks: req.body?.remarks,
    });

    return res.json({
      message: "Checklist request approved successfully",
      request: mapChecklistAdminRequestSummaryRow(approvedRequest),
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        message: "A checklist with this number already exists. Update the request and try again.",
      });
    }

    console.error("APPROVE CHECKLIST ADMIN REQUEST ERROR:", err);
    return res
      .status(500)
      .json({ message: err?.message || "Failed to approve checklist request" });
  }
};

exports.rejectChecklistAdminRequest = async (req, res) => {
  try {
    if (!canRejectChecklistRequests(req.user)) {
      return res.status(403).json({ message: "Checklist rejection permission is required" });
    }

    const request = await ChecklistAdminRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: "Checklist approval request not found" });
    }

    if (request.status !== CHECKLIST_REQUEST_STATUS.pending) {
      return res.status(400).json({ message: "This request has already been actioned" });
    }

    const rejectedRequest = await rejectChecklistAdminRequestRecord({
      request,
      reviewer: req.user,
      remarks: req.body?.remarks,
    });

    return res.json({
      message: "Checklist request rejected successfully",
      request: mapChecklistAdminRequestSummaryRow(rejectedRequest),
    });
  } catch (err) {
    console.error("REJECT CHECKLIST ADMIN REQUEST ERROR:", err);
    return res.status(500).json({ message: "Failed to reject checklist request" });
  }
};

exports.getChecklistRequestNotifications = async (req, res) => {
  try {
    if (!hasChecklistMasterAccess(req.user)) {
      return res.status(403).json({ message: "Checklist Master access is required" });
    }

    await ensurePendingReviewNotificationsForUser(req.user);

    const filter = {
      recipientUser: req.user.id,
      readAt: null,
    };

    const [rows, unreadCount] = await Promise.all([
      ChecklistRequestNotification.find(filter).sort({ createdAt: -1 }).limit(10).lean(),
      ChecklistRequestNotification.countDocuments(filter),
    ]);

    return res.json({
      counts: {
        unread: unreadCount,
      },
      rows: rows.map(mapChecklistRequestNotificationRow),
    });
  } catch (err) {
    console.error("GET CHECKLIST REQUEST NOTIFICATIONS ERROR:", err);
    return res.status(500).json({ message: "Failed to load checklist notifications" });
  }
};

exports.markChecklistRequestNotificationRead = async (req, res) => {
  try {
    if (!hasChecklistMasterAccess(req.user)) {
      return res.status(403).json({ message: "Checklist Master access is required" });
    }

    const notification = await ChecklistRequestNotification.findOne({
      _id: req.params.id,
      recipientUser: req.user.id,
    });

    if (!notification) {
      return res.status(404).json({ message: "Checklist notification not found" });
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }

    return res.json({
      message: "Checklist notification marked as read",
      notification: mapChecklistRequestNotificationRow(notification),
    });
  } catch (err) {
    console.error("MARK CHECKLIST REQUEST NOTIFICATION READ ERROR:", err);
    return res.status(500).json({ message: "Failed to update checklist notification" });
  }
};

exports.markAllChecklistRequestNotificationsRead = async (req, res) => {
  try {
    if (!hasChecklistMasterAccess(req.user)) {
      return res.status(403).json({ message: "Checklist Master access is required" });
    }

    const readAt = new Date();
    const result = await ChecklistRequestNotification.updateMany(
      {
        recipientUser: req.user.id,
        readAt: null,
      },
      {
        $set: {
          readAt,
        },
      }
    );

    return res.json({
      message: "All checklist notifications marked as read",
      updatedCount: Number(result.modifiedCount || 0),
    });
  } catch (err) {
    console.error("MARK ALL CHECKLIST REQUEST NOTIFICATIONS READ ERROR:", err);
    return res.status(500).json({ message: "Failed to update checklist notifications" });
  }
};

exports.getMyChecklistTasks = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can view assigned checklist tasks" });
    }

    const filter = {
      ...getTaskFilters(req.query),
      assignedEmployee: req.user.id,
    };

    const tasks = await ChecklistTask.find(filter)
      .populate(checklistTaskPopulateQuery)
      .sort({ occurrenceDate: -1, createdAt: -1 });

    return res.json(tasks);
  } catch (err) {
    console.error("GET MY CHECKLIST TASKS ERROR:", err);
    return res.status(500).json({ message: "Failed to load assigned checklist tasks" });
  }
};

exports.getGeneratedChecklistTasks = async (req, res) => {
  try {
    if (!hasChecklistMasterAccess(req.user)) {
      return res.status(403).json({ message: "Checklist Master access is required" });
    }

    const filter = mergeQueryFilters(
      getTaskFilters(req.query),
      await buildGeneratedChecklistTaskScopeFilter(req.access || {}, req.user)
    );
    const tasks = await ChecklistTask.find(filter)
      .populate(checklistTaskPopulateQuery)
      .sort({ occurrenceDate: -1, createdAt: -1 });

    return res.json(tasks);
  } catch (err) {
    console.error("GET GENERATED CHECKLIST TASKS ERROR:", err);
    return res.status(500).json({ message: "Failed to load generated checklist tasks" });
  }
};

exports.deleteGeneratedChecklistTask = async (req, res) => {
  try {
    if (!hasChecklistMasterAccess(req.user)) {
      return res.status(403).json({ message: "Checklist Master access is required" });
    }

    const task = await ChecklistTask.findOne(
      mergeQueryFilters(
        { _id: req.params.id },
        await buildGeneratedChecklistTaskScopeFilter(req.access || {}, req.user)
      ),
      "_id checklist"
    ).lean();

    if (!task) {
      return res.status(404).json({ message: "Generated checklist task not found" });
    }

    await ChecklistTask.deleteOne({ _id: task._id });

    return res.json({
      success: true,
      message: "Generated checklist task deleted permanently",
    });
  } catch (err) {
    console.error("DELETE GENERATED CHECKLIST TASK ERROR:", err);
    return res.status(500).json({ message: "Failed to delete generated checklist task" });
  }
};

exports.bulkDeleteGeneratedChecklistTasks = async (req, res) => {
  try {
    if (!hasChecklistMasterAccess(req.user)) {
      return res.status(403).json({ message: "Checklist Master access is required" });
    }

    const taskIds = Array.isArray(req.body?.taskIds)
      ? [...new Set(req.body.taskIds.map((taskId) => normalizeText(taskId)).filter(Boolean))]
      : [];

    if (!taskIds.length) {
      return res.status(400).json({ message: "Select at least one generated task to delete" });
    }

    const scopedTasks = await ChecklistTask.find(
      mergeQueryFilters(
        { _id: { $in: taskIds } },
        await buildGeneratedChecklistTaskScopeFilter(req.access || {}, req.user)
      ),
      "_id"
    ).lean();

    if (!scopedTasks.length) {
      return res.status(404).json({ message: "Selected generated tasks were not found" });
    }

    const scopedTaskIds = scopedTasks.map((task) => task._id);
    const result = await ChecklistTask.deleteMany({ _id: { $in: scopedTaskIds } });

    return res.json({
      success: true,
      deletedCount: Number(result.deletedCount || scopedTaskIds.length),
      skippedCount: taskIds.length - scopedTaskIds.length,
      message: "Selected generated checklist tasks deleted permanently",
    });
  } catch (err) {
    console.error("BULK DELETE GENERATED CHECKLIST TASKS ERROR:", err);
    return res.status(500).json({ message: "Failed to delete selected generated checklist tasks" });
  }
};

exports.getApprovalTasks = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can view checklist approvals" });
    }

    const filter = {
      ...getTaskFilters(req.query),
      status: { $in: ["submitted", "nil_for_approval"] },
      currentApprovalEmployee: req.user.id,
    };

    const tasks = await ChecklistTask.find(filter)
      .populate(checklistTaskPopulateQuery)
      .sort({ submittedAt: -1, occurrenceDate: -1 });

    return res.json(tasks);
  } catch (err) {
    console.error("GET APPROVAL TASKS ERROR:", err);
    return res.status(500).json({ message: "Failed to load approval tasks" });
  }
};

exports.getChecklistTaskById = async (req, res) => {
  try {
    const task = await ChecklistTask.findById(req.params.id).populate(
      checklistTaskPopulateQuery
    );

    if (!task) {
      return res.status(404).json({ message: "Checklist task not found" });
    }

    if (!canAccessChecklistTask(task, req.user)) {
      return res.status(404).json({ message: "Checklist task not found" });
    }

    return res.json(task);
  } catch (err) {
    console.error("GET CHECKLIST TASK BY ID ERROR:", err);
    return res.status(500).json({ message: "Failed to load checklist task" });
  }
};

exports.submitChecklistTask = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only employees can submit checklist tasks" });
    }

    const task = await ChecklistTask.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Checklist task not found" });
    }

    if (String(task.assignedEmployee) !== String(req.user.id)) {
      return res.status(403).json({ message: "This checklist is not assigned to you" });
    }

    if (task.status === "waiting_dependency") {
      return res.status(400).json({ message: getDependencyBlockedMessage(task) });
    }

    if (task.status !== "open") {
      return res.status(400).json({ message: "Only assigned checklist tasks can be submitted" });
    }

    const submissionResult = applyTaskSubmission({
      task,
      body: req.body,
      files: req.files,
    });

    if (submissionResult.message) {
      return res
        .status(submissionResult.status || 400)
        .json({ message: submissionResult.message });
    }

    await task.save();

    const populatedTask = await ChecklistTask.findById(task._id).populate(
      checklistTaskPopulateQuery
    );

    return res.json({
      message:
        String(task.approvalType || "").trim().toLowerCase() === "nil"
          ? "Task submitted for nil approval successfully"
          : "Task answers submitted successfully",
      task: populatedTask,
    });
  } catch (err) {
    console.error("SUBMIT CHECKLIST TASK ERROR:", err);
    return res.status(500).json({ message: "Failed to submit checklist task" });
  }
};

exports.decideChecklistTask = async (req, res) => {
  try {
    if (!isEmployeeRequester(req.user)) {
      return res.status(403).json({ message: "Only approvers can action checklist tasks" });
    }

    const task = await ChecklistTask.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: "Checklist task not found" });
    }

    if (String(task.currentApprovalEmployee || "") !== String(req.user.id)) {
      return res.status(403).json({
        message: "This approval request is not mapped to your employee account",
      });
    }

    if (!["submitted", "nil_for_approval"].includes(String(task.status || "").trim())) {
      return res
        .status(400)
        .json({ message: "Only checklist tasks under approval can be actioned" });
    }

    const decisionResult = applyChecklistDecision({
      task,
      action: req.body.action,
      remarks: req.body.remarks,
      itemResponses: req.body.itemResponses,
    });

    if (decisionResult.message) {
      return res
        .status(decisionResult.status || 400)
        .json({ message: decisionResult.message });
    }

    await task.save();
    const normalizedTaskStatus = String(task.status || "").trim().toLowerCase();

    if (["approved", "nil_approved"].includes(normalizedTaskStatus)) {
      await runDependentChecklistScheduler({
        dependencyChecklistIds: [task.checklist],
        dependencyTaskIds: [task._id],
      });
    } else {
      await syncChecklistTaskDependencies({
        dependencyChecklistIds: [task.checklist],
      });
    }

    const populatedTask = await ChecklistTask.findById(task._id).populate(
      checklistTaskPopulateQuery
    );

    return res.json({
      message:
        String(populatedTask?.status || "").trim().toLowerCase() === "nil_approved"
          ? "Checklist nil approval completed successfully"
          : "Checklist approval completed successfully",
      task: populatedTask,
    });
  } catch (err) {
    console.error("DECIDE CHECKLIST TASK ERROR:", err);
    return res.status(500).json({ message: "Failed to update checklist approval" });
  }
};

exports.getChecklistTaskReport = async (req, res) => {
  try {
    if (!isAdminRequester(req.user) && !req.user?.permissions?.reports?.canReportView) {
      return res.status(403).json({ message: "Report view permission is required" });
    }

    const reportResult = await loadChecklistTaskReportRows(req.query);

    if (reportResult?.error) {
      return res
        .status(reportResult.status || 400)
        .json({ message: reportResult.error });
    }

    const tasks = isAllScope(req.access || {})
      ? reportResult.tasks || []
      : await filterRowsByAccessibleEmployees(
          reportResult.tasks || [],
          req.access || {},
          (task) => task?.assignedEmployee?._id || task?.assignedEmployee
        );

    return res.json(tasks);
  } catch (err) {
    console.error("GET CHECKLIST TASK REPORT ERROR:", err);
    return res.status(500).json({ message: "Failed to load checklist task report" });
  }
};

exports.exportChecklistTaskReportExcel = async (req, res) => {
  try {
    if (!isAdminRequester(req.user) && !req.user?.permissions?.reports?.canExport) {
      return res.status(403).json({ message: "Report export permission is required" });
    }

    const reportResult = await loadChecklistTaskReportRows(req.query);

    if (reportResult?.error) {
      return res
        .status(reportResult.status || 400)
        .json({ message: reportResult.error });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Check List Workspace";

    const worksheet = workbook.addWorksheet(CHECKLIST_TASK_REPORT_EXCEL_SHEET_NAME);
    worksheet.columns = checklistTaskReportExcelColumns;
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: checklistTaskReportExcelColumns.length },
    };

    const scopedTasks = isAllScope(req.access || {})
      ? reportResult.tasks || []
      : await filterRowsByAccessibleEmployees(
          reportResult.tasks || [],
          req.access || {},
          (task) => task?.assignedEmployee?._id || task?.assignedEmployee
        );

    scopedTasks.forEach((task, index) => {
      worksheet.addRow(buildChecklistTaskReportRow(task, index));
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="checklist-task-report.xlsx"'
    );

    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    console.error("EXPORT CHECKLIST TASK REPORT EXCEL ERROR:", err);
    return res
      .status(500)
      .json({ message: "Failed to export checklist task report in Excel format" });
  }
};

exports.exportChecklistTaskReportPdf = async (req, res) => {
  try {
    if (!isAdminRequester(req.user) && !req.user?.permissions?.reports?.canExport) {
      return res.status(403).json({ message: "Report export permission is required" });
    }

    const reportResult = await loadChecklistTaskReportRows(req.query);

    if (reportResult?.error) {
      return res
        .status(reportResult.status || 400)
        .json({ message: reportResult.error });
    }

    const scopedTasks = isAllScope(req.access || {})
      ? reportResult.tasks || []
      : await filterRowsByAccessibleEmployees(
          reportResult.tasks || [],
          req.access || {},
          (task) => task?.assignedEmployee?._id || task?.assignedEmployee
        );

    const reportRows = scopedTasks.map((task, index) =>
      buildChecklistTaskReportRow(task, index)
    );
    const pdfBuffer = buildSimplePdfBuffer(
      buildChecklistTaskPdfPages(reportRows, req.query)
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="checklist-task-report.pdf"'
    );

    return res.send(pdfBuffer);
  } catch (err) {
    console.error("EXPORT CHECKLIST TASK REPORT PDF ERROR:", err);
    return res
      .status(500)
      .json({ message: "Failed to export checklist task report in PDF format" });
  }
};

exports.runSchedulerManually = async (req, res) => {
  try {
    const result = await runChecklistScheduler();
    return res.json({
      message: "Checklist scheduler executed",
      ...result,
    });
  } catch (err) {
    console.error("RUN CHECKLIST SCHEDULER ERROR:", err);
    return res.status(500).json({ message: "Failed to run checklist scheduler" });
  }
};
