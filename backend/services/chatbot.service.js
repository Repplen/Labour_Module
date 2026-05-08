const Checklist = require("../models/Checklist");
const ChecklistTask = require("../models/ChecklistTask");
const ChecklistTransferHistory = require("../models/ChecklistTransferHistory");
const Employee = require("../models/Employee");
const PersonalTask = require("../models/PersonalTask");
const {
  checklistPopulateQuery,
  checklistTaskPopulateQuery,
  getRestrictedChecklistSiteId,
  hasChecklistMasterAccess,
  isAdminRequester,
  isEmployeeRequester,
} = require("./checklistWorkflow.service");
const {
  DEFAULT_NOTIFICATION_WINDOW_MS,
  mapPersonalTaskForResponse,
} = require("./personalTask.service");

const MAX_RESPONSE_ITEMS = 6;
const DEFAULT_HISTORY_LIMIT = 12;
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});
const markFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const normalizeText = (value) => String(value || "").trim();
const normalizeId = (value) => String(value?._id || value || "").trim();
const scoredChecklistTaskFilter = {
  finalMark: { $ne: null },
  approvalType: { $ne: "nil" },
  isNilApproval: { $ne: true },
  status: { $nin: ["nil_for_approval", "nil_approved"] },
};
const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getRoleLabel = (user) => {
  if (isAdminRequester(user)) return "Admin";
  if (isEmployeeRequester(user)) return "Employee";
  if (hasChecklistMasterAccess(user)) return "Checklist User";
  return "User";
};

const capitalize = (value) => {
  const normalizedValue = normalizeText(value).toLowerCase();
  if (!normalizedValue) return "";
  return normalizedValue.charAt(0).toUpperCase() + normalizedValue.slice(1);
};

const formatDate = (value) => {
  if (!value) return "-";

  const parsedValue = new Date(value);
  if (Number.isNaN(parsedValue.getTime())) return "-";

  return dateFormatter.format(parsedValue);
};

const formatDateTime = (value) => {
  if (!value) return "-";

  const parsedValue = new Date(value);
  if (Number.isNaN(parsedValue.getTime())) return "-";

  return dateTimeFormatter.format(parsedValue);
};

const formatMarkValue = (value) => {
  if (value === undefined || value === null || value === "") return "-";

  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return "-";

  return markFormatter.format(Math.round(parsedValue * 100) / 100);
};

const formatEmployeeLabel = (employee) => {
  const employeeCode = normalizeText(employee?.employeeCode);
  const employeeName = normalizeText(employee?.employeeName || employee?.name);

  if (employeeCode && employeeName) return `${employeeCode} - ${employeeName}`;
  return employeeCode || employeeName || "Employee";
};

const formatSiteLabel = (site) => {
  const companyName = normalizeText(site?.companyName || site?.siteCompanyName);
  const siteName = normalizeText(site?.name || site?.siteName || site?.assignedSiteName);

  if (companyName && siteName) return `${companyName} - ${siteName}`;
  return siteName || companyName || "Site";
};

const formatScheduleTypeLabel = (value = {}) => {
  const scheduleType = normalizeText(value?.scheduleType || value);

  if (!scheduleType) return "-";
  if (scheduleType.toLowerCase() === "custom") {
    return value?.repeatSummary
      ? `Custom (${normalizeText(value.repeatSummary)})`
      : "Custom";
  }

  return capitalize(scheduleType);
};

const formatChecklistTaskStatusLabel = (value) => {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (normalizedValue === "open") return "Assigned";
  if (normalizedValue === "submitted") return "Under Approval";
  if (normalizedValue === "approved") return "Approved";
  if (normalizedValue === "rejected") return "Rejected";
  return capitalize(normalizedValue) || "Open";
};

const formatReminderTypeLabel = (value) => {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (normalizedValue === "daily") return "Daily";
  if (normalizedValue === "weekly") return "Weekly";
  if (normalizedValue === "monthly") return "Monthly";
  return "One-time";
};

const formatReminderStateLabel = (value) => {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (normalizedValue === "due") return "Due now";
  if (normalizedValue === "upcoming") return "Upcoming";
  return "Pending";
};

const truncateText = (value, maxLength = 180) => {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) return "";
  if (normalizedValue.length <= maxLength) return normalizedValue;

  return `${normalizedValue.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const buildIstDateTime = ({
  year,
  monthIndex,
  day,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0,
}) =>
  new Date(
    Date.UTC(year, monthIndex, day, hours, minutes, seconds, milliseconds) - IST_OFFSET_MS
  );

const getIstDateParts = (value = new Date()) => {
  const shiftedDate = new Date(new Date(value).getTime() + IST_OFFSET_MS);

  return {
    year: shiftedDate.getUTCFullYear(),
    monthIndex: shiftedDate.getUTCMonth(),
    day: shiftedDate.getUTCDate(),
  };
};

const getTodayRangeInIst = (value = new Date()) => {
  const todayParts = getIstDateParts(value);
  const start = buildIstDateTime({
    year: todayParts.year,
    monthIndex: todayParts.monthIndex,
    day: todayParts.day,
  });

  return {
    start,
    end: new Date(start.getTime() + DAY_IN_MS),
  };
};

const buildResponse = ({
  title,
  message,
  stats = [],
  items = [],
  actions = [],
  emptyMessage = "",
}) => ({
  title: normalizeText(title),
  message: normalizeText(message),
  stats: Array.isArray(stats) ? stats.filter((item) => normalizeText(item?.label)) : [],
  items: Array.isArray(items) ? items.filter((item) => normalizeText(item?.title)) : [],
  actions: Array.isArray(actions) ? actions.filter((item) => normalizeText(item?.label)) : [],
  emptyMessage: normalizeText(emptyMessage),
});

const buildQuickActions = (user) => {
  if (isEmployeeRequester(user)) {
    return [
      {
        id: "pending_tasks",
        label: "Pending Tasks",
        command: "Show my pending tasks",
        description: "View assigned checklist tasks and active reminders.",
      },
      {
        id: "today_tasks",
        label: "Today Tasks",
        command: "Show today tasks",
        description: "List everything scheduled for today.",
      },
      {
        id: "completed_tasks",
        label: "Completed Tasks",
        command: "Show completed tasks",
        description: "Review recent completed checklist tasks and reminders.",
      },
      {
        id: "pending_approvals",
        label: "Pending Approvals",
        command: "Show pending approvals",
        description: "Check submissions waiting for your approval.",
      },
      {
        id: "checklist_details",
        label: "Checklist Details",
        command: "Show checklist details",
        description: "Open recent checklist details or search by name.",
      },
    ];
  }

  if (isAdminRequester(user)) {
    return [
      {
        id: "today_tasks",
        label: "Today Tasks",
        command: "Show today tasks",
        description: "See checklist tasks scheduled for today.",
      },
      {
        id: "employee_marks",
        label: "Employee Marks",
        command: "Show employee marks",
        description: "Review employee mark totals and scored checklist counts.",
      },
      {
        id: "site_department_summary",
        label: "Site Summary",
        command: "Show site/department summary",
        description: "Summarize employee distribution across sites and departments.",
      },
      {
        id: "checklist_details",
        label: "Checklist Details",
        command: "Show checklist details",
        description: "Look up checklist masters by name or number.",
      },
      {
        id: "transfer_details",
        label: "Transfer Details",
        command: "Show transfer details",
        description: "Review recent permanent and temporary transfers.",
      },
    ];
  }

  return [
    {
      id: "today_tasks",
      label: "Today Tasks",
      command: "Show today tasks",
      description: "See checklist tasks available in your checklist scope.",
    },
    {
      id: "completed_tasks",
      label: "Completed Tasks",
      command: "Show completed tasks",
      description: "Review approved checklist work in your scope.",
    },
    {
      id: "pending_approvals",
      label: "Pending Approvals",
      command: "Show pending approvals",
      description: "Summarize checklist submissions waiting for review.",
    },
    {
      id: "checklist_details",
      label: "Checklist Details",
      command: "Show checklist details",
      description: "Search checklist masters by name or number.",
    },
    {
      id: "transfer_details",
      label: "Transfer Details",
      command: "Show transfer details",
      description: "Review recent checklist transfer activity.",
    },
  ];
};

const containsAll = (value, tokens = []) =>
  tokens.every((token) => normalizeText(value).includes(token));

const extractChecklistSearchTerm = (message) =>
  normalizeText(message)
    .replace(
      /\b(show|me|my|the|please|can you|could you|tell me|give me|about|open)\b/gi,
      " "
    )
    .replace(/\b(checklist|details|detail|of)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const detectIntent = (message) => {
  const normalizedMessage = normalizeText(message).toLowerCase();

  if (
    !normalizedMessage ||
    ["help", "menu", "commands", "hi", "hello", "hey"].includes(normalizedMessage)
  ) {
    return { intent: "help", searchTerm: "" };
  }

  if (containsAll(normalizedMessage, ["pending", "approval"])) {
    return { intent: "pending_approvals", searchTerm: "" };
  }

  if (
    normalizedMessage.includes("site/department summary") ||
    normalizedMessage.includes("site department summary") ||
    containsAll(normalizedMessage, ["site", "summary"]) ||
    containsAll(normalizedMessage, ["department", "summary"])
  ) {
    return { intent: "site_department_summary", searchTerm: "" };
  }

  if (containsAll(normalizedMessage, ["employee", "mark"]) || normalizedMessage === "marks") {
    return { intent: "employee_marks", searchTerm: "" };
  }

  if (normalizedMessage.includes("transfer")) {
    return { intent: "transfer_details", searchTerm: "" };
  }

  if (
    normalizedMessage.includes("checklist") &&
    (normalizedMessage.includes("detail") || normalizedMessage.includes("details"))
  ) {
    return {
      intent: "checklist_details",
      searchTerm: extractChecklistSearchTerm(message),
    };
  }

  if (containsAll(normalizedMessage, ["today", "task"])) {
    return { intent: "today_tasks", searchTerm: "" };
  }

  if (containsAll(normalizedMessage, ["completed", "task"])) {
    return { intent: "completed_tasks", searchTerm: "" };
  }

  if (containsAll(normalizedMessage, ["pending", "task"])) {
    return { intent: "pending_tasks", searchTerm: "" };
  }

  return { intent: "help", searchTerm: "" };
};

const buildTaskSearchConditions = (searchTerm, fields = []) => {
  const normalizedSearchTerm = normalizeText(searchTerm);
  if (!normalizedSearchTerm) return [];

  const searchPattern = new RegExp(escapeRegex(normalizedSearchTerm), "i");
  return fields.map((field) => ({ [field]: searchPattern }));
};

const buildManagerChecklistFilter = (user) => {
  const restrictedSiteId = getRestrictedChecklistSiteId(user);
  return restrictedSiteId ? { employeeAssignedSite: restrictedSiteId } : {};
};

const buildManagerScopeLabel = (user) =>
  getRestrictedChecklistSiteId(user) ? "in your assigned site scope" : "across the workspace";

const buildManagerTaskScope = async (user) => {
  if (!hasChecklistMasterAccess(user) || isEmployeeRequester(user)) {
    return { _id: null };
  }

  const restrictedSiteId = getRestrictedChecklistSiteId(user);
  if (!restrictedSiteId) {
    return {};
  }

  const accessibleChecklistRows = await Checklist.find(
    { employeeAssignedSite: restrictedSiteId },
    "_id"
  ).lean();
  const accessibleChecklistIds = accessibleChecklistRows.map((row) => row._id).filter(Boolean);

  return accessibleChecklistIds.length
    ? { checklist: { $in: accessibleChecklistIds } }
    : { _id: null };
};

const mapChecklistTaskItem = (task) => ({
  id: normalizeId(task),
  label: "Checklist Task",
  title: [normalizeText(task?.taskNumber), normalizeText(task?.checklistName)]
    .filter(Boolean)
    .join(" | "),
  subtitle: [
    task?.occurrenceDate ? `Occurrence: ${formatDate(task.occurrenceDate)}` : "",
    normalizeText(task?.priority) ? `Priority: ${capitalize(task.priority)}` : "",
  ]
    .filter(Boolean)
    .join(" | "),
  meta: [
    `Status: ${formatChecklistTaskStatusLabel(task?.status)}`,
    task?.currentApprovalEmployee
      ? `Approver: ${formatEmployeeLabel(task.currentApprovalEmployee)}`
      : "",
  ]
    .filter(Boolean)
    .join(" | "),
  detail: [
    task?.assignedEmployee ? `Employee: ${formatEmployeeLabel(task.assignedEmployee)}` : "",
    task?.submittedAt
      ? `Submitted: ${formatDateTime(task.submittedAt)}`
      : task?.completedAt
      ? `Completed: ${formatDateTime(task.completedAt)}`
      : "",
  ]
    .filter(Boolean)
    .join(" | "),
  route: `/checklists/tasks/${normalizeId(task)}`,
  routeLabel: "Open Task",
});

const mapPersonalTaskItem = (task) => ({
  id: normalizeId(task),
  label: "Reminder",
  title: normalizeText(task?.title) || "Personal Reminder",
  subtitle: [
    task?.notificationAt
      ? `Reminder: ${formatDateTime(task.notificationAt)}`
      : task?.nextReminderAt
      ? `Next reminder: ${formatDateTime(task.nextReminderAt)}`
      : task?.scheduledAt
      ? `Scheduled: ${formatDateTime(task.scheduledAt)}`
      : "",
    `Rule: ${formatReminderTypeLabel(task?.reminderType)}`,
  ]
    .filter(Boolean)
    .join(" | "),
  meta: [
    `Status: ${capitalize(task?.status) || "Pending"}`,
    task?.notificationState ? `Alert: ${formatReminderStateLabel(task.notificationState)}` : "",
  ]
    .filter(Boolean)
    .join(" | "),
  detail: truncateText(task?.description || ""),
  route: `/own-tasks/${normalizeId(task)}`,
  routeLabel: "Open Reminder",
});

const mapChecklistMasterItem = (checklist) => ({
  id: normalizeId(checklist),
  label: "Checklist",
  title: [normalizeText(checklist?.checklistNumber), normalizeText(checklist?.checklistName)]
    .filter(Boolean)
    .join(" | "),
  subtitle: [
    `Schedule: ${formatScheduleTypeLabel(checklist)}`,
    checklist?.scheduleTime ? `Time: ${normalizeText(checklist.scheduleTime)}` : "",
  ]
    .filter(Boolean)
    .join(" | "),
  meta: [
    checklist?.assignedToEmployee
      ? `Assigned: ${formatEmployeeLabel(checklist.assignedToEmployee)}`
      : "",
    checklist?.employeeAssignedSite
      ? `Site: ${formatSiteLabel(checklist.employeeAssignedSite)}`
      : "",
  ]
    .filter(Boolean)
    .join(" | "),
  detail: truncateText(
    Array.isArray(checklist?.approvals) && checklist.approvals.length
      ? `Approvals: ${checklist.approvals
          .map((row) => formatEmployeeLabel(row?.approvalEmployee))
          .filter(Boolean)
          .join(", ")}`
      : "No approvers mapped"
  ),
  route: `/checklists/${normalizeId(checklist)}`,
  routeLabel: "Open Checklist",
});

const mapTransferItem = (row) => ({
  id: normalizeId(row),
  label: "Transfer",
  title: `${capitalize(row?.transferType) || "Checklist"} Transfer`,
  subtitle: `${formatEmployeeLabel(row?.fromEmployee || row)} -> ${formatEmployeeLabel(
    row?.toEmployee || row
  )}`,
  meta: [
    `Status: ${capitalize(row?.transferStatus) || "Completed"}`,
    `Checklists: ${Array.isArray(row?.checklists) ? row.checklists.length : 0}`,
  ].join(" | "),
  detail:
    normalizeText(row?.transferType).toLowerCase() === "temporary"
      ? [
          row?.transferStartDate ? `From: ${formatDate(row.transferStartDate)}` : "",
          row?.transferEndDate ? `To: ${formatDate(row.transferEndDate)}` : "",
        ]
          .filter(Boolean)
          .join(" | ")
      : truncateText((row?.checklistNames || []).join(", "), 150),
  route: "/masters/checklist-transfer",
  routeLabel: "Open Transfer Master",
});

const buildSummaryItem = ({ label, title, subtitle, meta, route = "", routeLabel = "" }) => ({
  id: `${label}:${title}`,
  label,
  title: normalizeText(title),
  subtitle: normalizeText(subtitle),
  meta: normalizeText(meta),
  detail: "",
  route: normalizeText(route),
  routeLabel: normalizeText(routeLabel),
});

const buildHelpReply = (user) =>
  buildResponse({
    title: "Checklist Assistant",
    message: `I can help you with checklist questions for your ${getRoleLabel(
      user
    ).toLowerCase()} workspace. Use a quick action or type a command like "Show today tasks" or "Show checklist details Safety".`,
    stats: [
      { label: "Role", value: getRoleLabel(user) },
      { label: "Quick Actions", value: buildQuickActions(user).length },
    ],
    items: [],
    actions:
      isAdminRequester(user) || isEmployeeRequester(user)
        ? [{ label: "Open Dashboard", route: "/dashboard-1" }]
        : [{ label: "Open Checklist Masters", route: "/checklists" }],
    emptyMessage: "Ask about tasks, approvals, marks, summaries, checklist details, or transfers.",
  });

const buildEmployeePendingTasksReply = async (user) => {
  const checklistFilter = {
    assignedEmployee: user.id,
    status: { $in: ["open", "rejected"] },
  };
  const reminderFilter = {
    assignedEmployee: user.id,
    status: "pending",
  };
  const [checklistRows, checklistCount, reminderRows, reminderCount] = await Promise.all([
    ChecklistTask.find(checklistFilter)
      .populate(checklistTaskPopulateQuery)
      .sort({ occurrenceDate: 1, createdAt: -1 })
      .limit(4)
      .lean(),
    ChecklistTask.countDocuments(checklistFilter),
    PersonalTask.find(reminderFilter)
      .populate("employee assignedEmployee completedBy", "employeeCode employeeName email")
      .sort({ nextReminderAt: 1, createdAt: -1 })
      .limit(4),
    PersonalTask.countDocuments(reminderFilter),
  ]);

  const mappedReminderRows = reminderRows.map((row) =>
    mapPersonalTaskForResponse(row, {
      viewerEmployeeId: user.id,
      upcomingWindowMs: DEFAULT_NOTIFICATION_WINDOW_MS,
    })
  );

  return buildResponse({
    title: "Pending Tasks",
    message:
      checklistCount || reminderCount
        ? `You have ${checklistCount} pending checklist task${
            checklistCount === 1 ? "" : "s"
          } and ${reminderCount} active reminder${reminderCount === 1 ? "" : "s"}.`
        : "You have no pending checklist tasks or active reminders right now.",
    stats: [
      { label: "Checklist Tasks", value: checklistCount },
      { label: "Reminders", value: reminderCount },
      {
        label: "Due Alerts",
        value: mappedReminderRows.filter((row) => row.notificationState === "due").length,
      },
    ],
    items: [
      ...checklistRows.map(mapChecklistTaskItem),
      ...mappedReminderRows.map(mapPersonalTaskItem),
    ].slice(0, MAX_RESPONSE_ITEMS),
    actions: [
      { label: "Open My Checklist Tasks", route: "/checklists" },
      { label: "Open Own Tasks", route: "/own-tasks" },
    ],
    emptyMessage: "No pending tasks were found for your account.",
  });
};

const buildManagerPendingTasksReply = async (user) => {
  const taskScope = await buildManagerTaskScope(user);
  const filter = {
    ...taskScope,
    status: { $in: ["open", "rejected"] },
  };
  const [rows, count] = await Promise.all([
    ChecklistTask.find(filter)
      .populate(checklistTaskPopulateQuery)
      .sort({ occurrenceDate: 1, createdAt: -1 })
      .limit(MAX_RESPONSE_ITEMS)
      .lean(),
    ChecklistTask.countDocuments(filter),
  ]);

  return buildResponse({
    title: "Pending Tasks",
    message: count
      ? `There are ${count} pending checklist task${
          count === 1 ? "" : "s"
        } ${buildManagerScopeLabel(user)}.`
      : `No pending checklist tasks were found ${buildManagerScopeLabel(user)}.`,
    stats: [
      { label: "Pending Tasks", value: count },
      { label: "Scope", value: buildManagerScopeLabel(user) },
    ],
    items: rows.map(mapChecklistTaskItem),
    actions: [{ label: "Open Checklists", route: "/checklists" }],
    emptyMessage: "No pending checklist tasks are waiting in the current scope.",
  });
};

const buildPendingTasksReply = async (user) =>
  isEmployeeRequester(user)
    ? buildEmployeePendingTasksReply(user)
    : buildManagerPendingTasksReply(user);

const buildEmployeeTodayTasksReply = async (user) => {
  const todayRange = getTodayRangeInIst();
  const checklistFilter = {
    assignedEmployee: user.id,
    occurrenceDate: {
      $gte: todayRange.start,
      $lt: todayRange.end,
    },
  };
  const reminderFilter = {
    assignedEmployee: user.id,
    status: "pending",
    nextReminderAt: {
      $gte: todayRange.start,
      $lt: todayRange.end,
    },
  };
  const [checklistRows, checklistCount, reminderRows, reminderCount] = await Promise.all([
    ChecklistTask.find(checklistFilter)
      .populate(checklistTaskPopulateQuery)
      .sort({ occurrenceDate: 1, createdAt: -1 })
      .limit(4)
      .lean(),
    ChecklistTask.countDocuments(checklistFilter),
    PersonalTask.find(reminderFilter)
      .populate("employee assignedEmployee completedBy", "employeeCode employeeName email")
      .sort({ nextReminderAt: 1, createdAt: -1 })
      .limit(4),
    PersonalTask.countDocuments(reminderFilter),
  ]);

  const mappedReminderRows = reminderRows.map((row) =>
    mapPersonalTaskForResponse(row, {
      viewerEmployeeId: user.id,
      upcomingWindowMs: DEFAULT_NOTIFICATION_WINDOW_MS,
    })
  );

  return buildResponse({
    title: "Today Tasks",
    message:
      checklistCount || reminderCount
        ? `For ${formatDate(todayRange.start)}, you have ${checklistCount} checklist task${
            checklistCount === 1 ? "" : "s"
          } and ${reminderCount} reminder${reminderCount === 1 ? "" : "s"}.`
        : `No checklist tasks or reminders are scheduled for ${formatDate(todayRange.start)}.`,
    stats: [
      { label: "Checklist Tasks", value: checklistCount },
      { label: "Reminders", value: reminderCount },
    ],
    items: [
      ...checklistRows.map(mapChecklistTaskItem),
      ...mappedReminderRows.map(mapPersonalTaskItem),
    ].slice(0, MAX_RESPONSE_ITEMS),
    actions: [
      { label: "Open My Checklist Tasks", route: "/checklists" },
      { label: "Open Own Tasks", route: "/own-tasks" },
    ],
    emptyMessage: "Nothing is scheduled for today.",
  });
};

const buildManagerTodayTasksReply = async (user) => {
  const todayRange = getTodayRangeInIst();
  const taskScope = await buildManagerTaskScope(user);
  const filter = {
    ...taskScope,
    occurrenceDate: {
      $gte: todayRange.start,
      $lt: todayRange.end,
    },
  };
  const [rows, count] = await Promise.all([
    ChecklistTask.find(filter)
      .populate(checklistTaskPopulateQuery)
      .sort({ occurrenceDate: 1, createdAt: -1 })
      .limit(MAX_RESPONSE_ITEMS)
      .lean(),
    ChecklistTask.countDocuments(filter),
  ]);

  return buildResponse({
    title: "Today Tasks",
    message: count
      ? `${count} checklist task${count === 1 ? "" : "s"} are scheduled for ${formatDate(
          todayRange.start
        )} ${buildManagerScopeLabel(user)}.`
      : `No checklist tasks are scheduled for ${formatDate(todayRange.start)} ${buildManagerScopeLabel(
          user
        )}.`,
    stats: [
      { label: "Today Tasks", value: count },
      { label: "Scope", value: buildManagerScopeLabel(user) },
    ],
    items: rows.map(mapChecklistTaskItem),
    actions: [{ label: "Open Checklists", route: "/checklists" }],
    emptyMessage: "No tasks are scheduled for today in the current scope.",
  });
};

const buildTodayTasksReply = async (user) =>
  isEmployeeRequester(user)
    ? buildEmployeeTodayTasksReply(user)
    : buildManagerTodayTasksReply(user);

const buildEmployeeCompletedTasksReply = async (user) => {
  const checklistFilter = {
    assignedEmployee: user.id,
    status: "approved",
  };
  const reminderFilter = {
    assignedEmployee: user.id,
    status: "completed",
  };
  const [checklistRows, checklistCount, reminderRows, reminderCount] = await Promise.all([
    ChecklistTask.find(checklistFilter)
      .populate(checklistTaskPopulateQuery)
      .sort({ completedAt: -1, occurrenceDate: -1 })
      .limit(4)
      .lean(),
    ChecklistTask.countDocuments(checklistFilter),
    PersonalTask.find(reminderFilter)
      .populate("employee assignedEmployee completedBy", "employeeCode employeeName email")
      .sort({ completedAt: -1, updatedAt: -1 })
      .limit(4),
    PersonalTask.countDocuments(reminderFilter),
  ]);

  const mappedReminderRows = reminderRows.map((row) =>
    mapPersonalTaskForResponse(row, {
      viewerEmployeeId: user.id,
      upcomingWindowMs: DEFAULT_NOTIFICATION_WINDOW_MS,
    })
  );

  return buildResponse({
    title: "Completed Tasks",
    message:
      checklistCount || reminderCount
        ? `You have completed ${checklistCount} checklist task${
            checklistCount === 1 ? "" : "s"
          } and ${reminderCount} reminder${reminderCount === 1 ? "" : "s"}.`
        : "You do not have any completed checklist tasks or reminders yet.",
    stats: [
      { label: "Checklist Tasks", value: checklistCount },
      { label: "Reminders", value: reminderCount },
    ],
    items: [
      ...checklistRows.map(mapChecklistTaskItem),
      ...mappedReminderRows.map(mapPersonalTaskItem),
    ].slice(0, MAX_RESPONSE_ITEMS),
    actions: [
      { label: "Open My Checklist Tasks", route: "/checklists" },
      { label: "Open Own Tasks", route: "/own-tasks" },
    ],
    emptyMessage: "No completed tasks were found.",
  });
};

const buildManagerCompletedTasksReply = async (user) => {
  const taskScope = await buildManagerTaskScope(user);
  const filter = {
    ...taskScope,
    status: "approved",
  };
  const [rows, count] = await Promise.all([
    ChecklistTask.find(filter)
      .populate(checklistTaskPopulateQuery)
      .sort({ completedAt: -1, occurrenceDate: -1 })
      .limit(MAX_RESPONSE_ITEMS)
      .lean(),
    ChecklistTask.countDocuments(filter),
  ]);

  return buildResponse({
    title: "Completed Tasks",
    message: count
      ? `${count} checklist task${count === 1 ? "" : "s"} are approved ${buildManagerScopeLabel(
          user
        )}.`
      : `No approved checklist tasks were found ${buildManagerScopeLabel(user)}.`,
    stats: [
      { label: "Approved Tasks", value: count },
      { label: "Scope", value: buildManagerScopeLabel(user) },
    ],
    items: rows.map(mapChecklistTaskItem),
    actions: [{ label: "Open Checklists", route: "/checklists" }],
    emptyMessage: "No completed checklist tasks are available in the current scope.",
  });
};

const buildCompletedTasksReply = async (user) =>
  isEmployeeRequester(user)
    ? buildEmployeeCompletedTasksReply(user)
    : buildManagerCompletedTasksReply(user);

const buildEmployeePendingApprovalsReply = async (user) => {
  const filter = {
    status: "submitted",
    currentApprovalEmployee: user.id,
  };
  const [rows, count] = await Promise.all([
    ChecklistTask.find(filter)
      .populate(checklistTaskPopulateQuery)
      .sort({ submittedAt: -1, occurrenceDate: -1 })
      .limit(MAX_RESPONSE_ITEMS)
      .lean(),
    ChecklistTask.countDocuments(filter),
  ]);

  return buildResponse({
    title: "Pending Approvals",
    message: count
      ? `${count} checklist submission${count === 1 ? "" : "s"} are waiting for your approval.`
      : "No checklist submissions are waiting for your approval right now.",
    stats: [{ label: "Pending Approvals", value: count }],
    items: rows.map(mapChecklistTaskItem),
    actions: [{ label: "Open Approval Inbox", route: "/checklists/approvals" }],
    emptyMessage: "Approval inbox is clear right now.",
  });
};

const buildManagerPendingApprovalsReply = async (user) => {
  const taskScope = await buildManagerTaskScope(user);
  const filter = {
    ...taskScope,
    status: "submitted",
  };
  const [rows, count] = await Promise.all([
    ChecklistTask.find(filter)
      .populate(checklistTaskPopulateQuery)
      .sort({ submittedAt: -1, occurrenceDate: -1 })
      .limit(MAX_RESPONSE_ITEMS)
      .lean(),
    ChecklistTask.countDocuments(filter),
  ]);

  return buildResponse({
    title: "Pending Approvals",
    message: count
      ? `${count} checklist submission${count === 1 ? "" : "s"} are under approval ${buildManagerScopeLabel(
          user
        )}.`
      : `No checklist submissions are currently under approval ${buildManagerScopeLabel(user)}.`,
    stats: [
      { label: "Submitted Tasks", value: count },
      { label: "Scope", value: buildManagerScopeLabel(user) },
    ],
    items: rows.map(mapChecklistTaskItem),
    actions: [{ label: "Open Checklists", route: "/checklists" }],
    emptyMessage: "No approval work is waiting in the current scope.",
  });
};

const buildPendingApprovalsReply = async (user) =>
  isEmployeeRequester(user)
    ? buildEmployeePendingApprovalsReply(user)
    : buildManagerPendingApprovalsReply(user);

const buildEmployeeMarksReply = async (user) => {
  const markRows = await ChecklistTask.find(
    {
      assignedEmployee: user.id,
      ...scoredChecklistTaskFilter,
    },
    "taskNumber checklistName finalMark completedAt occurrenceDate"
  )
    .sort({ completedAt: -1, occurrenceDate: -1 })
    .lean();

  const scoredChecklistCount = markRows.length;
  const totalMark = markRows.reduce(
    (sum, row) => sum + (Number(row?.finalMark) || 0),
    0
  );
  const averageMark = scoredChecklistCount ? totalMark / scoredChecklistCount : 0;

  return buildResponse({
    title: "Employee Marks",
    message: scoredChecklistCount
      ? `You have ${scoredChecklistCount} scored checklist${
          scoredChecklistCount === 1 ? "" : "s"
        } with an average mark of ${formatMarkValue(averageMark)}.`
      : "No scored checklist marks are available for your account yet.",
    stats: [
      { label: "Scored Checklists", value: scoredChecklistCount },
      { label: "Total Mark", value: formatMarkValue(totalMark) },
      { label: "Average Mark", value: formatMarkValue(averageMark) },
    ],
    items: markRows.slice(0, MAX_RESPONSE_ITEMS).map((row) =>
      buildSummaryItem({
        label: "Mark",
        title: [normalizeText(row?.taskNumber), normalizeText(row?.checklistName)]
          .filter(Boolean)
          .join(" | "),
        subtitle: row?.completedAt
          ? `Completed: ${formatDateTime(row.completedAt)}`
          : `Occurrence: ${formatDate(row?.occurrenceDate)}`,
        meta: `Final mark: ${formatMarkValue(row?.finalMark)}`,
        route: "/dashboard-1",
        routeLabel: "Open Dashboard",
      })
    ),
    actions: [{ label: "Open Dashboard", route: "/dashboard-1" }],
    emptyMessage: "Marks will appear here after checklist tasks are scored.",
  });
};

const buildManagerMarksReply = async (user) => {
  const taskScope = await buildManagerTaskScope(user);
  const markRows = await ChecklistTask.find(
    {
      ...taskScope,
      assignedEmployee: { $ne: null },
      ...scoredChecklistTaskFilter,
    },
    "assignedEmployee finalMark"
  ).lean();

  const groupedRows = new Map();

  markRows.forEach((row) => {
    const employeeId = normalizeId(row?.assignedEmployee);
    if (!employeeId) return;

    const currentValue = groupedRows.get(employeeId) || {
      employeeId,
      totalMark: 0,
      scoredChecklistCount: 0,
    };

    currentValue.totalMark += Number(row?.finalMark) || 0;
    currentValue.scoredChecklistCount += 1;
    groupedRows.set(employeeId, currentValue);
  });

  const rankedRows = [...groupedRows.values()]
    .map((row) => ({
      ...row,
      averageMark: row.scoredChecklistCount
        ? row.totalMark / row.scoredChecklistCount
        : 0,
    }))
    .sort(
      (left, right) =>
        right.totalMark - left.totalMark ||
        right.averageMark - left.averageMark ||
        right.scoredChecklistCount - left.scoredChecklistCount
    );

  const employeeRows = await Employee.find(
    { _id: { $in: rankedRows.map((row) => row.employeeId) } },
    "employeeCode employeeName"
  ).lean();
  const employeeMap = new Map(employeeRows.map((row) => [normalizeId(row), row]));

  return buildResponse({
    title: "Employee Marks",
    message: rankedRows.length
      ? `${rankedRows.length} employee${rankedRows.length === 1 ? "" : "s"} have scored checklist marks ${buildManagerScopeLabel(
          user
        )}.`
      : `No employee marks were found ${buildManagerScopeLabel(user)}.`,
    stats: [
      { label: "Employees With Marks", value: rankedRows.length },
      { label: "Scored Tasks", value: markRows.length },
      { label: "Scope", value: buildManagerScopeLabel(user) },
    ],
    items: rankedRows.slice(0, MAX_RESPONSE_ITEMS).map((row) =>
      buildSummaryItem({
        label: "Employee Mark",
        title: formatEmployeeLabel(employeeMap.get(row.employeeId)),
        subtitle: `Scored checklists: ${row.scoredChecklistCount}`,
        meta: `Total mark: ${formatMarkValue(row.totalMark)} | Average: ${formatMarkValue(
          row.averageMark
        )}`,
        route: isAdminRequester(user) ? "/dashboard-1" : "",
        routeLabel: isAdminRequester(user) ? "Open Dashboard" : "",
      })
    ),
    actions: isAdminRequester(user) ? [{ label: "Open Dashboard", route: "/dashboard-1" }] : [],
    emptyMessage: "Employee marks will appear after checklist tasks are scored.",
  });
};

const buildEmployeeMarksSummaryReply = async (user) =>
  isEmployeeRequester(user) ? buildEmployeeMarksReply(user) : buildManagerMarksReply(user);

const buildSiteDepartmentSummaryReply = async (user) => {
  if (isEmployeeRequester(user)) {
    const employee = await Employee.findById(user.id, "employeeCode employeeName sites department")
      .populate("sites", "name companyName")
      .populate("department", "name")
      .lean();
    const siteRows = Array.isArray(employee?.sites) ? employee.sites : [];
    const departmentRows = Array.isArray(employee?.department) ? employee.department : [];

    return buildResponse({
      title: "Site and Department Summary",
      message: employee
        ? `${formatEmployeeLabel(employee)} is mapped to ${siteRows.length} site${
            siteRows.length === 1 ? "" : "s"
          } and ${departmentRows.length} department${departmentRows.length === 1 ? "" : "s"}.`
        : "Employee site and department mapping could not be found.",
      stats: [
        { label: "Sites", value: siteRows.length },
        { label: "Departments", value: departmentRows.length },
      ],
      items: [
        ...siteRows.map((row) =>
          buildSummaryItem({
            label: "Site",
            title: formatSiteLabel(row),
            subtitle: "Assigned site",
            meta: "",
            route: "/dashboard-1",
            routeLabel: "Open Dashboard",
          })
        ),
        ...departmentRows.map((row) =>
          buildSummaryItem({
            label: "Department",
            title: normalizeText(row?.name) || "Department",
            subtitle: "Assigned department",
            meta: "",
            route: "/dashboard-1",
            routeLabel: "Open Dashboard",
          })
        ),
      ].slice(0, MAX_RESPONSE_ITEMS),
      actions: [{ label: "Open Dashboard", route: "/dashboard-1" }],
      emptyMessage: "No site or department mappings are available for your account.",
    });
  }

  const restrictedSiteId = getRestrictedChecklistSiteId(user);
  const employeeFilter = restrictedSiteId ? { sites: restrictedSiteId } : {};
  const employeeRows = await Employee.find(
    employeeFilter,
    "employeeCode employeeName isActive sites department"
  )
    .populate("sites", "name companyName")
    .populate("department", "name")
    .lean();

  const siteCounts = new Map();
  const departmentCounts = new Map();
  let activeCount = 0;

  employeeRows.forEach((employee) => {
    if (employee?.isActive !== false) {
      activeCount += 1;
    }

    (Array.isArray(employee?.sites) ? employee.sites : []).forEach((site) => {
      const key = normalizeId(site) || normalizeText(site?.name);
      if (!key) return;

      const currentValue = siteCounts.get(key) || {
        title: formatSiteLabel(site),
        count: 0,
        meta: normalizeText(site?.companyName),
      };
      currentValue.count += 1;
      siteCounts.set(key, currentValue);
    });

    (Array.isArray(employee?.department) ? employee.department : []).forEach((department) => {
      const key = normalizeId(department) || normalizeText(department?.name);
      if (!key) return;

      const currentValue = departmentCounts.get(key) || {
        title: normalizeText(department?.name) || "Department",
        count: 0,
      };
      currentValue.count += 1;
      departmentCounts.set(key, currentValue);
    });
  });

  const rankedSites = [...siteCounts.values()].sort(
    (left, right) => right.count - left.count || left.title.localeCompare(right.title, "en")
  );
  const rankedDepartments = [...departmentCounts.values()].sort(
    (left, right) => right.count - left.count || left.title.localeCompare(right.title, "en")
  );
  const showDashboardRoute = isAdminRequester(user);

  return buildResponse({
    title: "Site and Department Summary",
    message: employeeRows.length
      ? `${employeeRows.length} employee${employeeRows.length === 1 ? "" : "s"} are mapped ${buildManagerScopeLabel(
          user
        )}.`
      : `No employee site or department mappings were found ${buildManagerScopeLabel(user)}.`,
    stats: [
      { label: "Employees", value: employeeRows.length },
      { label: "Active", value: activeCount },
      { label: "Sites", value: rankedSites.length },
      { label: "Departments", value: rankedDepartments.length },
    ],
    items: [
      ...rankedSites.slice(0, 3).map((row) =>
        buildSummaryItem({
          label: "Site",
          title: row.title,
          subtitle: `Employees: ${row.count}`,
          meta: row.meta ? `Company: ${row.meta}` : "",
          route: showDashboardRoute ? "/dashboard-1" : "",
          routeLabel: showDashboardRoute ? "Open Dashboard" : "",
        })
      ),
      ...rankedDepartments.slice(0, 3).map((row) =>
        buildSummaryItem({
          label: "Department",
          title: row.title,
          subtitle: `Employees: ${row.count}`,
          meta: "",
          route: showDashboardRoute ? "/dashboard-1" : "",
          routeLabel: showDashboardRoute ? "Open Dashboard" : "",
        })
      ),
    ].slice(0, MAX_RESPONSE_ITEMS),
    actions: showDashboardRoute ? [{ label: "Open Dashboard", route: "/dashboard-1" }] : [],
    emptyMessage: "No site or department summary data is available right now.",
  });
};

const buildChecklistDetailsReply = async (user, searchTerm = "") => {
  const normalizedSearchTerm = normalizeText(searchTerm);

  if (isEmployeeRequester(user)) {
    const accessFilter = {
      $or: [{ assignedEmployee: user.id }, { currentApprovalEmployee: user.id }],
    };
    const searchConditions = buildTaskSearchConditions(normalizedSearchTerm, [
      "taskNumber",
      "checklistNumber",
      "checklistName",
    ]);
    const filter = searchConditions.length
      ? {
          $and: [accessFilter, { $or: searchConditions }],
        }
      : accessFilter;

    const rows = await ChecklistTask.find(filter)
      .populate(checklistTaskPopulateQuery)
      .sort({ occurrenceDate: -1, createdAt: -1 })
      .limit(MAX_RESPONSE_ITEMS)
      .lean();

    return buildResponse({
      title: "Checklist Details",
      message: normalizedSearchTerm
        ? rows.length
          ? `I found ${rows.length} checklist task${rows.length === 1 ? "" : "s"} matching "${normalizedSearchTerm}".`
          : `No checklist task matched "${normalizedSearchTerm}".`
        : rows.length
        ? "Here are your latest checklist tasks. Add a checklist number or name to narrow it further."
        : "No checklist tasks are available for your account right now.",
      stats: [{ label: "Matches", value: rows.length }],
      items: rows.map(mapChecklistTaskItem),
      actions: [{ label: "Open My Checklist Tasks", route: "/checklists" }],
      emptyMessage: "Try a checklist number, task number, or checklist name.",
    });
  }

  const searchConditions = buildTaskSearchConditions(normalizedSearchTerm, [
    "checklistNumber",
    "checklistName",
  ]);
  const filter = searchConditions.length
    ? {
        ...buildManagerChecklistFilter(user),
        $or: searchConditions,
      }
    : buildManagerChecklistFilter(user);

  const rows = await Checklist.find(filter)
    .populate(checklistPopulateQuery)
    .sort({ updatedAt: -1, createdAt: -1 })
    .limit(MAX_RESPONSE_ITEMS)
    .lean();

  return buildResponse({
    title: "Checklist Details",
    message: normalizedSearchTerm
      ? rows.length
        ? `I found ${rows.length} checklist master${rows.length === 1 ? "" : "s"} matching "${normalizedSearchTerm}".`
        : `No checklist master matched "${normalizedSearchTerm}" ${buildManagerScopeLabel(user)}.`
      : rows.length
      ? `Here are the latest checklist masters ${buildManagerScopeLabel(user)}.`
      : `No checklist masters were found ${buildManagerScopeLabel(user)}.`,
    stats: [{ label: "Matches", value: rows.length }],
    items: rows.map(mapChecklistMasterItem),
    actions: [{ label: "Open Checklists", route: "/checklists" }],
    emptyMessage: "Try a checklist number or checklist name for a more specific search.",
  });
};

const buildTransferDetailsReply = async (user) => {
  if (isEmployeeRequester(user)) {
    return buildResponse({
      title: "Transfer Details",
      message: "Checklist transfer details are available only for admins and checklist master users.",
      stats: [{ label: "Role", value: getRoleLabel(user) }],
      items: [],
      actions: [{ label: "Open My Checklist Tasks", route: "/checklists" }],
      emptyMessage: "Switch to an admin or checklist master account to review transfer history.",
    });
  }

  const restrictedSiteId = getRestrictedChecklistSiteId(user);
  const filter = restrictedSiteId ? { siteIds: restrictedSiteId } : {};
  const [rows, count] = await Promise.all([
    ChecklistTransferHistory.find(filter)
      .populate([
        { path: "fromEmployee", select: "employeeCode employeeName" },
        { path: "toEmployee", select: "employeeCode employeeName" },
      ])
      .sort({ transferredAt: -1, createdAt: -1 })
      .limit(MAX_RESPONSE_ITEMS)
      .lean(),
    ChecklistTransferHistory.countDocuments(filter),
  ]);

  return buildResponse({
    title: "Transfer Details",
    message: count
      ? `${count} checklist transfer record${count === 1 ? "" : "s"} are available ${buildManagerScopeLabel(
          user
        )}.`
      : `No checklist transfer history was found ${buildManagerScopeLabel(user)}.`,
    stats: [
      { label: "Transfers", value: count },
      { label: "Scope", value: buildManagerScopeLabel(user) },
    ],
    items: rows.map(mapTransferItem),
    actions: [{ label: "Open Transfer Master", route: "/masters/checklist-transfer" }],
    emptyMessage: "Transfer history will appear here after checklist transfers are created.",
  });
};

const intentHandlers = {
  pending_tasks: buildPendingTasksReply,
  today_tasks: buildTodayTasksReply,
  completed_tasks: buildCompletedTasksReply,
  pending_approvals: buildPendingApprovalsReply,
  employee_marks: buildEmployeeMarksSummaryReply,
  site_department_summary: buildSiteDepartmentSummaryReply,
  checklist_details: buildChecklistDetailsReply,
  transfer_details: buildTransferDetailsReply,
  help: async (user) => buildHelpReply(user),
};

const generateChatbotResponse = async ({ user, message }) => {
  const prompt = normalizeText(message);
  const { intent, searchTerm } = detectIntent(prompt);
  const handler = intentHandlers[intent] || intentHandlers.help;
  const response =
    intent === "checklist_details"
      ? await handler(user, searchTerm)
      : await handler(user);

  return {
    intent,
    response,
  };
};

module.exports = {
  DEFAULT_HISTORY_LIMIT,
  buildQuickActions,
  generateChatbotResponse,
  getRoleLabel,
};
