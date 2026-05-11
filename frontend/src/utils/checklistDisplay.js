import { getCustomRepeatSummary } from "./checklistRepeat";

const indiaTimeZone = "Asia/Kolkata";
const INDIA_OFFSET_MS = 330 * 60 * 1000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const markFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const normalizePriority = (value) =>
  String(
    typeof value === "string" ? value : value?.priority || value?.checklist?.priority || ""
  )
    .trim()
    .toLowerCase();

const normalizeText = (value) => String(value || "").trim();

const parseOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const normalizeTimingStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "advanced") return "advance";
  if (normalized === "delay") return "delayed";
  return normalized || "pending";
};

export const isNilChecklistTask = (value = {}) => {
  const normalizedStatus = String(value?.status || "").trim().toLowerCase();
  const normalizedApprovalType = String(value?.approvalType || "").trim().toLowerCase();

  return (
    value?.isNilApproval === true ||
    normalizedApprovalType === "nil" ||
    normalizedStatus === "nil_for_approval" ||
    normalizedStatus === "nil_approved"
  );
};

const roundMarkValue = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return null;
  return Math.round(parsedValue * 100) / 100;
};

const getIndiaDayStartValue = (value) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const shiftedDate = new Date(date.getTime() + INDIA_OFFSET_MS);
  return Date.UTC(
    shiftedDate.getUTCFullYear(),
    shiftedDate.getUTCMonth(),
    shiftedDate.getUTCDate()
  );
};

const getIndiaDayDifference = (leftValue, rightValue) => {
  const leftDayStart = getIndiaDayStartValue(leftValue);
  const rightDayStart = getIndiaDayStartValue(rightValue);

  if (leftDayStart === null || rightDayStart === null) return 0;
  return Math.round((leftDayStart - rightDayStart) / DAY_IN_MS);
};

export const getTaskTargetDateTime = (value = {}) =>
  value?.dependencyTargetDateTime || value?.targetDateTime || value?.endDateTime || null;

export const getTaskTimeStatusSummary = (task = {}) => {
  const targetDateTime = getTaskTargetDateTime(task);
  const submittedAt = task?.submittedAt;

  if (!submittedAt) {
    return { status: "pending", dayCount: 0 };
  }

  if (!targetDateTime) {
    const fallbackStatus = normalizeTimingStatus(
      task?.submissionTimingStatus || task?.timelinessStatus
    );

    return { status: fallbackStatus, dayCount: 0 };
  }

  const submittedDate = new Date(submittedAt);
  const targetDate = new Date(targetDateTime);
  if (Number.isNaN(submittedDate.getTime()) || Number.isNaN(targetDate.getTime())) {
    const fallbackStatus = normalizeTimingStatus(
      task?.submissionTimingStatus || task?.timelinessStatus
    );

    return { status: fallbackStatus, dayCount: 0 };
  }

  const dayDifference = getIndiaDayDifference(submittedAt, targetDateTime);

  if (submittedDate.getTime() > targetDate.getTime()) {
    return { status: "delayed", dayCount: Math.max(1, dayDifference) };
  }

  if (submittedDate.getTime() < targetDate.getTime()) {
    const advanceDays = Math.max(0, dayDifference * -1);

    if (advanceDays > 0) {
      return { status: "advance", dayCount: advanceDays };
    }
  }

  return { status: "on_time", dayCount: 0 };
};

const formatTimeStatusDayCount = (value) =>
  `${value} day${value === 1 ? "" : "s"}`;

export const formatTaskTimeStatusLabel = (task = {}) => {
  const summary = getTaskTimeStatusSummary(task);

  switch (normalizeTimingStatus(summary.status)) {
    case "advance":
      return summary.dayCount > 0
        ? `Advance - ${formatTimeStatusDayCount(summary.dayCount)}`
        : "Advance";
    case "delayed":
      return summary.dayCount > 0
        ? `Delay - ${formatTimeStatusDayCount(summary.dayCount)}`
        : "Delay";
    case "on_time":
      return "On Time";
    case "pending":
    default:
      return "Pending";
  }
};

export const getTaskTimeStatusBadgeClass = (task = {}) =>
  ({
    advance: "bg-info text-dark",
    delayed: "bg-danger",
    on_time: "bg-success",
    pending: "bg-secondary",
  }[normalizeTimingStatus(getTaskTimeStatusSummary(task).status)] || "bg-secondary");

export const formatTargetDayCountLabel = (value) => {
  const normalizedValue = parseOptionalNumber(value);

  if (normalizedValue === null || normalizedValue <= 0) return "-";
  return `${markFormatter.format(normalizedValue)} day${
    normalizedValue === 1 ? "" : "s"
  }`;
};

export const getChecklistMarkConfig = (value = {}) => {
  if (isNilChecklistTask(value)) {
    return {
      enableMark: false,
      baseMark: null,
      delayPenaltyPerDay: null,
      advanceBonusPerDay: null,
      finalMark: roundMarkValue(parseOptionalNumber(value?.finalMark) ?? 0) ?? 0,
      isNilApproval: true,
    };
  }

  const explicitEnableMark =
    typeof value?.enableMark === "boolean" ? value.enableMark : null;
  const baseMark = parseOptionalNumber(value?.baseMark);
  const legacyChecklistMark = parseOptionalNumber(value?.checklistMark);
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
      parseOptionalNumber(value?.delayPenaltyPerDay) ?? 0.5
    ),
    advanceBonusPerDay: roundMarkValue(
      parseOptionalNumber(value?.advanceBonusPerDay) ?? 0.5
    ),
    finalMark: roundMarkValue(parseOptionalNumber(value?.finalMark)),
    isNilApproval: false,
  };
};

export const formatMarkValue = (value) => {
  const normalizedValue = roundMarkValue(value);
  return normalizedValue === null ? markFormatter.format(0) : markFormatter.format(normalizedValue);
};

export const formatMarkAdjustment = (value) => {
  const normalizedValue = roundMarkValue(value);

  if (normalizedValue === null) return formatMarkValue(0);
  if (normalizedValue > 0) return `+${formatMarkValue(normalizedValue)}`;
  if (normalizedValue < 0) return `-${formatMarkValue(Math.abs(normalizedValue))}`;
  return formatMarkValue(0);
};

export const formatChecklistScoreLabel = (value) => {
  const markConfig = getChecklistMarkConfig(value);

  if (markConfig.isNilApproval) return "Nil approval | No Mark";
  if (!markConfig.enableMark) return "Disabled";

  return `Base ${formatMarkValue(markConfig.baseMark)}`;
};

export const getTaskMarkSummary = (task = {}) => {
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

  const targetDateTime = getTaskTargetDateTime(task);

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

  const dayDifference = getIndiaDayDifference(task.submittedAt, targetDateTime);
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
  const timingStatus = normalizeTimingStatus(
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

export const formatTaskMarkDayLabel = (task) => {
  const markSummary = getTaskMarkSummary(task);

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

export const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: indiaTimeZone,
  });
};

export const formatDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: indiaTimeZone,
  });
};

export const formatTimeLabel = (value) => {
  if (!value) return "-";

  const [hoursText = "00", minutesText = "00"] = String(value).split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;

  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;

  return `${String(displayHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

export const formatScheduleLabel = (value) => {
  const scheduleTypeSource =
    typeof value === "string" ? value : value?.scheduleType || value?.repeatType || "";
  const normalized = String(scheduleTypeSource || "").trim().toLowerCase();
  if (!normalized) return "-";

  if (normalized === "custom") {
    const summary =
      String(value?.repeatSummary || "").trim() ||
      getCustomRepeatSummary(value || {});
    return summary ? `Custom (${summary})` : "Custom";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const formatEmployeeLabel = (employee) =>
  [employee?.employeeCode, employee?.employeeName].filter(Boolean).join(" - ") || "-";

export const formatApprovalTypeLabel = (value) =>
  isNilChecklistTask(value) ? "Nil" : "Normal";

export const getApprovalTypeBadgeClass = (value) =>
  isNilChecklistTask(value) ? "bg-info text-dark" : "bg-light text-dark border";

export const formatTaskFinalMarkLabel = (task = {}) => {
  const markSummary = getTaskMarkSummary(task);

  if (markSummary.isNilApproval) return "No Mark";
  if (markSummary.enableMark) {
    return markSummary.finalMark !== null ? formatMarkValue(markSummary.finalMark) : "Pending";
  }

  return "Not enabled";
};

export const getCurrentApprover = (task) => {
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
    .sort((left, right) => (Number(left?.approvalLevel) || 0) - (Number(right?.approvalLevel) || 0))
    .at(-1);

  return lastActionedStep?.approverEmployee || null;
};

export const formatCurrentApproverLabel = (task) =>
  formatEmployeeLabel(getCurrentApprover(task));

export const getApprovalWorkflowEmployees = (task) => {
  const approvalSteps = Array.isArray(task?.approvalSteps) ? task.approvalSteps : [];
  const seen = new Set();

  return approvalSteps
    .map((step) => step?.approverEmployee)
    .filter((employee) => {
      const employeeId = String(employee?._id || employee || "").trim();
      if (!employeeId || seen.has(employeeId)) return false;
      seen.add(employeeId);
      return true;
    });
};

export const formatApprovalWorkflowLabel = (task) => {
  const labels = getApprovalWorkflowEmployees(task)
    .map((employee) => formatEmployeeLabel(employee))
    .filter((label) => label && label !== "-");

  return labels.join(", ") || "-";
};

export const formatApprovalLabel = (checklist) => {
  const approvals = Array.isArray(checklist?.approvals) ? checklist.approvals : [];

  if (!approvals.length) return "Not mapped";

  return approvals
    .map((row) => formatEmployeeLabel(row?.approvalEmployee))
    .filter(Boolean)
    .join(", ");
};

export const getChecklistDependencyReference = (value = {}) =>
  normalizeText(value?.dependencyTaskId?.taskNumber) ||
  normalizeText(value?.dependencyTaskNumber) ||
  normalizeText(value?.dependencyChecklistId?.checklistNumber) ||
  normalizeText(value?.dependencyChecklistNumber);

export const formatChecklistDependencyLabel = (value = {}) => {
  if (value?.isDependentTask !== true) return "No";

  const dependencyReference = getChecklistDependencyReference(value);
  const dependencyName =
    normalizeText(value?.dependencyChecklistId?.checklistName) ||
    normalizeText(value?.dependencyTaskId?.checklistName);

  if (dependencyReference && dependencyName) {
    return `${dependencyReference} - ${dependencyName}`;
  }

  return dependencyReference || dependencyName || "Yes";
};

export const formatChecklistDependencyStatus = (value = {}) => {
  if (value?.isDependentTask !== true) return "No Dependency";

  const normalizedDependencyStatus = normalizeText(value?.dependencyStatus).toLowerCase();
  const normalizedTaskStatus = normalizeText(value?.status).toLowerCase();

  if (normalizedDependencyStatus === "unlocked") {
    return normalizedTaskStatus === "open" ? "Unlocked / Active" : "Unlocked";
  }

  return "Locked";
};

export const getChecklistDependencyStatusBadgeClass = (value = {}) => {
  if (value?.isDependentTask !== true) return "bg-light text-dark border";

  const normalizedDependencyStatus = normalizeText(value?.dependencyStatus).toLowerCase();

  if (normalizedDependencyStatus === "unlocked") {
    return "bg-success";
  }

  return "bg-secondary";
};

export const formatPriorityLabel = (value) => {
  const normalized = normalizePriority(value);
  if (!normalized) return "-";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const getPriorityBadgeClass = (value) => {
  switch (normalizePriority(value)) {
    case "high":
      return "bg-danger";
    case "medium":
      return "bg-warning text-dark";
    case "low":
      return "bg-success";
    default:
      return "bg-secondary";
  }
};

export const getPriorityRowClass = (value) => {
  switch (normalizePriority(value)) {
    case "high":
      return "table-danger";
    case "medium":
      return "table-warning";
    case "low":
      return "table-success";
    default:
      return "";
  }
};

export const getTaskStatusBadgeClass = (status) => {
  switch (String(status || "").trim().toLowerCase()) {
    case "approved":
      return "bg-success";
    case "rejected":
      return "bg-danger";
    case "submitted":
      return "bg-warning text-dark";
    case "open":
    default:
      return "bg-primary";
  }
};

export const formatTaskStatus = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return "-";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const getChecklistTaskStatusBadgeClass = (status) => {
  switch (String(status || "").trim().toLowerCase()) {
    case "waiting_dependency":
      return "bg-secondary";
    case "nil_approved":
      return "bg-secondary";
    case "approved":
      return "bg-success";
    case "nil_for_approval":
      return "bg-info text-dark";
    case "rejected":
      return "bg-danger";
    case "submitted":
      return "bg-warning text-dark";
    case "open":
    default:
      return "bg-primary";
  }
};

export const formatChecklistTaskStatus = (status) => {
  switch (String(status || "").trim().toLowerCase()) {
    case "waiting_dependency":
      return "Waiting for Dependency";
    case "open":
      return "Assigned";
    case "nil_for_approval":
      return "Nil For Approval";
    case "submitted":
      return "Under Approval";
    case "nil_approved":
      return "Nil Approved";
    case "approved":
      return "Approved / Completed";
    case "rejected":
      return "Rejected";
    default:
      return formatTaskStatus(status);
  }
};

export const formatTimelinessLabel = (status) => {
  switch (normalizeTimingStatus(status)) {
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

export const getTimelinessBadgeClass = (status) => {
  switch (normalizeTimingStatus(status)) {
    case "advance":
      return "bg-info text-dark";
    case "on_time":
      return "bg-success";
    case "delayed":
      return "bg-danger";
    case "pending":
    default:
      return "bg-secondary";
  }
};
