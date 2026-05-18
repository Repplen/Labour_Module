const Checklist = require("../models/Checklist");
const ChecklistAdminRequest = require("../models/ChecklistAdminRequest");
const ChecklistRequestNotification = require("../models/ChecklistRequestNotification");
const ChecklistTask = require("../models/ChecklistTask");
const ChecklistTransferHistory = require("../models/ChecklistTransferHistory");
const Employee = require("../models/Employee");
const User = require("../models/User");
const {
  buildChecklistMasterScopeFilter,
  isAllScope,
  resolveAccessibleEmployeeIds,
  uniqueIdList,
} = require("./accessScope.service");
const {
  hasModulePermission,
  resolvePrincipalAccess,
} = require("./permissionResolver.service");
const {
  isValidObjectId,
  parseDateBoundary,
  runChecklistScheduler,
} = require("./checklistWorkflow.service");
const {
  buildComparisonRows,
  buildCurrentTransferDisplaySnapshot,
  buildTransferDisplaySnapshot,
  employeeHasSite,
  formatEmployeeDisplayName,
  formatSiteDisplayName,
  getEmployeeTransferDepartmentIds,
  getEmployeeTransferSiteIds,
  getSharedEmployeeDepartmentIds,
  getSharedEmployeeSiteIds,
  mapChecklistTransferEmployee,
  mergeQueryFilters,
  normalizeIdList,
  normalizeText,
} = require("../helpers/checklistTransfer.helper");
const {
  parseTransferHistoryLimit,
  validateTransferPayload,
} = require("../validators/checklistTransfer.validator");

const CHECKLIST_REQUEST_MODULE_KEYS = {
  checklistMaster: "checklist_master",
  checklistTransfer: "checklist_transfer",
};
const CHECKLIST_TRANSFER_REQUEST_ACTIONS = {
  permanentTransfer: "permanent_transfer",
  temporaryTransfer: "temporary_transfer",
};
const CHECKLIST_REQUEST_STATUS = {
  pending: "pending_admin_approval",
};
const CHECKLIST_REQUEST_NOTIFICATION_TYPES = {
  submitted: "request_submitted",
};
const ACTIVE_TEMPORARY_TRANSFER_STATUSES = ["pending", "active"];

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

const getRequestModuleName = (moduleKey) =>
  moduleKey === CHECKLIST_REQUEST_MODULE_KEYS.checklistTransfer
    ? "Checklist Transfer"
    : "Checklist Master";

const getRequestActionLabel = (actionType) => {
  if (actionType === CHECKLIST_TRANSFER_REQUEST_ACTIONS.permanentTransfer) {
    return "Permanent Transfer";
  }

  if (actionType === CHECKLIST_TRANSFER_REQUEST_ACTIONS.temporaryTransfer) {
    return "Temporary Transfer";
  }

  return actionType === "edit" ? "Edit" : "Add";
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

const buildScopedEmployeeFilter = (transferAccess) =>
  transferAccess.accessIsAll
    ? {}
    : transferAccess.accessibleEmployeeIds.length
    ? { _id: { $in: transferAccess.accessibleEmployeeIds } }
    : { _id: null };

const buildScopedSiteFilter = (transferAccess) =>
  transferAccess.scopedSiteIds.length ? { sites: { $in: transferAccess.scopedSiteIds } } : {};

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

const getChecklistTransferSetup = async ({ fromEmployeeId, requesterAccess = {} }) => {
  const normalizedFromEmployeeId = normalizeText(fromEmployeeId);
  if (!isValidObjectId(normalizedFromEmployeeId)) {
    return { message: "Select a valid From Employee", status: 400 };
  }

  const transferAccess = await getChecklistTransferAccessContext(requesterAccess || {});
  const scopedEmployeeFilter = buildScopedEmployeeFilter(transferAccess);
  const scopedSiteFilter = buildScopedSiteFilter(transferAccess);
  const checklistScopeFilter = await buildChecklistMasterScopeFilter(requesterAccess || {});
  const fromEmployee = await Employee.findOne(
    mergeQueryFilters(
      { _id: normalizedFromEmployeeId },
      scopedEmployeeFilter,
      scopedSiteFilter
    ),
    "employeeCode employeeName email isActive sites department"
  )
    .populate("sites", "name companyName")
    .populate("department", "name")
    .lean();

  if (!fromEmployee) {
    return { message: "From Employee was not found", status: 404 };
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
              _id: { $ne: normalizedFromEmployeeId },
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
        assignedToEmployee: normalizedFromEmployeeId,
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

  return {
    payload: {
      employee: mapChecklistTransferEmployee(fromEmployee, transferAccess.scopedSiteIds),
      toEmployees: eligibleToEmployees.map((employee) =>
        mapChecklistTransferEmployee(employee, transferAccess.scopedSiteIds)
      ),
      count: checklists.length,
      checklists,
    },
  };
};

const getChecklistTransferHistoryRows = async ({ requesterAccess = {}, limit }) => {
  const transferAccess = await getChecklistTransferAccessContext(requesterAccess || {});
  return ChecklistTransferHistory.find(
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
    .limit(parseTransferHistoryLimit(limit))
    .lean();
};

const loadPermanentTransferContext = async ({
  body,
  requesterAccess = null,
  skipTemporaryTransferConflictCheck = false,
}) => {
  const validation = validateTransferPayload(body);
  if (validation.message) return validation;

  const { fromEmployeeId, toEmployeeId, checklistIds: uniqueChecklistIds } = validation.value;
  const transferAccess = await getChecklistTransferAccessContext(requesterAccess || {});
  const scopedEmployeeFilter = buildScopedEmployeeFilter(transferAccess);
  const scopedSiteFilter = buildScopedSiteFilter(transferAccess);
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

const loadTemporaryTransferContext = async ({ body, requesterAccess = null }) => {
  const transferContext = await loadPermanentTransferContext({
    body,
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

module.exports = {
  CHECKLIST_TRANSFER_REQUEST_ACTIONS,
  applyPermanentTransferContext,
  applyTemporaryTransferContext,
  createChecklistTransferApprovalRequest,
  getChecklistTransferHistoryRows,
  getChecklistTransferSetup,
  getPendingTransferRequestConflict,
  loadPermanentTransferContext,
  loadTemporaryTransferContext,
};
