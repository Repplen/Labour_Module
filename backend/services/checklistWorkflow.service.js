const Checklist = require("../models/Checklist");
const ChecklistTask = require("../models/ChecklistTask");
const ChecklistTransferHistory = require("../models/ChecklistTransferHistory");
const Employee = require("../models/Employee");
const Site = require("../models/Site");

const SCHEDULE_TYPES = ["daily", "weekly", "monthly", "yearly", "custom"];
const CUSTOM_REPEAT_UNITS = ["daily", "weekly", "monthly", "yearly"];
const APPROVAL_HIERARCHIES = ["default", "custom"];
const TASK_STATUSES = [
  "waiting_dependency",
  "open",
  "submitted",
  "nil_for_approval",
  "approved",
  "nil_approved",
  "rejected",
];
const TASK_TIMELINESS_STATUSES = ["pending", "advanced", "on_time", "delay"];
const SUBMISSION_TIMING_STATUSES = ["pending", "advance", "on_time", "delayed"];
const APPROVAL_STEP_STATUSES = ["waiting", "pending", "approved", "rejected"];
const DEPENDENCY_STATUSES = ["not_required", "waiting", "unlocked"];
const TASK_COMPLETION_STATUSES = ["approved", "nil_approved"];
const PRIORITY_LEVELS = ["high", "medium", "low"];
const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const schedulerIntervalMs = 60 * 1000;
const maxOccurrencesPerRun = 366;
const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

let schedulerTimer = null;
let schedulerInFlight = false;

const WEEK_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const checklistPopulateQuery = [
  {
    path: "assignedToEmployee",
    select: "employeeCode employeeName department departmentDisplay superiorEmployee sites",
    populate: [
      { path: "department", select: "name" },
      { path: "superiorEmployee", select: "employeeCode employeeName" },
      { path: "sites", select: "name companyName" },
    ],
  },
  {
    path: "approvals.approvalEmployee",
    select: "employeeCode employeeName email",
  },
  {
    path: "employeeAssignedSite",
    select: "name companyName",
  },
  {
    path: "checklistSourceSite",
    select: "name companyName",
  },
  {
    path: "dependencyChecklistId",
    select: "checklistNumber checklistName assignedToEmployee status",
    populate: {
      path: "assignedToEmployee",
      select: "employeeCode employeeName",
    },
  },
];

const checklistTaskPopulateQuery = [
  {
    path: "checklist",
    select:
      "checklistNumber checklistName scheduleType scheduleTime startDate endDate endTime status approvalHierarchy priority employeeAssignedSite",
    populate: [
      {
        path: "employeeAssignedSite",
        select: "name companyName",
      },
    ],
  },
  {
    path: "assignedEmployee",
    select: "employeeCode employeeName department superiorEmployee",
    populate: [
      { path: "department", select: "name" },
      { path: "superiorEmployee", select: "employeeCode employeeName" },
    ],
  },
  {
    path: "currentApprovalEmployee",
    select: "employeeCode employeeName",
  },
  {
    path: "rejectedBy",
    select: "employeeCode employeeName",
  },
  {
    path: "approvedBy",
    select: "employeeCode employeeName",
  },
  {
    path: "approvalSteps.approverEmployee",
    select: "employeeCode employeeName",
  },
  {
    path: "approvalHistory.actorEmployee",
    select: "employeeCode employeeName",
  },
  {
    path: "approvalHistory.approverEmployee",
    select: "employeeCode employeeName",
  },
  {
    path: "dependencyChecklistId",
    select: "checklistNumber checklistName assignedToEmployee",
    populate: {
      path: "assignedToEmployee",
      select: "employeeCode employeeName",
    },
  },
  {
    path: "dependencyTaskId",
    select: "taskNumber checklistName assignedEmployee status completedAt",
    populate: {
      path: "assignedEmployee",
      select: "employeeCode employeeName",
    },
  },
];

const pad = (value) => String(value).padStart(2, "0");

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isValidObjectId = (value) =>
  objectIdPattern.test(String(value || "").trim());

const getRequesterRole = (user) =>
  String(user?.role || "")
    .trim()
    .toLowerCase();

const isAdminRequester = (user) => getRequesterRole(user) === "admin";

const isEmployeeRequester = (user) => getRequesterRole(user) === "employee";

const hasChecklistMasterAccess = (user) =>
  isAdminRequester(user) ||
  getRequesterRole(user) === "user" ||
  Boolean(user?.checklistMasterAccess);

const getRestrictedChecklistSiteId = (user) => {
  if (!hasChecklistMasterAccess(user) || isAdminRequester(user) || isEmployeeRequester(user)) {
    return "";
  }

  const siteId = normalizeText(user?.siteId);
  return isValidObjectId(siteId) ? siteId : "";
};

const normalizeText = (value) => String(value || "").trim();

const buildArchivedChecklistNumber = (checklistNumber, checklistId) => {
  const baseNumber = normalizeText(checklistNumber) || "deleted-checklist";
  const idPart = normalizeText(checklistId) || String(Date.now());
  return `${baseNumber}__deleted__${idPart}`;
};

const releaseSoftDeletedChecklistNumber = async (checklistNumber) => {
  const normalizedChecklistNumber = normalizeText(checklistNumber);
  if (!normalizedChecklistNumber) return null;

  const deletedChecklist = await Checklist.collection.findOne(
    {
      checklistNumber: normalizedChecklistNumber,
      isDeleted: true,
    },
    {
      projection: {
        _id: 1,
        checklistNumber: 1,
      },
    }
  );

  if (!deletedChecklist?._id) return null;

  const archivedChecklistNumber = buildArchivedChecklistNumber(
    deletedChecklist.checklistNumber,
    deletedChecklist._id
  );

  await Checklist.collection.updateOne(
    {
      _id: deletedChecklist._id,
      checklistNumber: deletedChecklist.checklistNumber,
      isDeleted: true,
    },
    {
      $set: {
        checklistNumber: archivedChecklistNumber,
      },
    }
  );

  return archivedChecklistNumber;
};

const normalizeIdList = (value) =>
  (Array.isArray(value) ? value : [value])
    .map((item) => normalizeText(item?._id || item))
    .filter(Boolean);

const capitalize = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const ordinal = (value) => {
  const day = Number(value);
  if (Number.isNaN(day)) return value;
  if (day % 10 === 1 && day % 100 !== 11) return `${day}st`;
  if (day % 10 === 2 && day % 100 !== 12) return `${day}nd`;
  if (day % 10 === 3 && day % 100 !== 13) return `${day}rd`;
  return `${day}th`;
};

const getWeekDayIndex = (value) =>
  WEEK_DAYS.findIndex(
    (day) => day.toLowerCase() === normalizeText(value).toLowerCase()
  );

const getWeekDayLabel = (value) => {
  const index = getWeekDayIndex(value);
  return index >= 0 ? WEEK_DAYS[index] : "";
};

const getMonthLabel = (value) => {
  const monthIndex = Number(value) - 1;
  return monthIndex >= 0 && monthIndex < MONTH_LABELS.length
    ? MONTH_LABELS[monthIndex]
    : "";
};

const parseBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  return ["true", "1", "yes", "on"].includes(normalized);
};

const normalizeApprovalType = (value) =>
  normalizeText(value).toLowerCase() === "nil" ? "nil" : "normal";

const isNilChecklistTask = (value = {}) => {
  const normalizedStatus = normalizeText(value?.status).toLowerCase();

  return (
    parseBoolean(value?.isNilApproval, false) ||
    normalizeApprovalType(value?.approvalType) === "nil" ||
    ["nil_for_approval", "nil_approved"].includes(normalizedStatus)
  );
};

const applyNilTaskMarkState = (task) => {
  task.approvalType = "nil";
  task.isNilApproval = true;
  task.enableMark = false;
  task.baseMark = null;
  task.delayPenaltyPerDay = null;
  task.advanceBonusPerDay = null;
  task.finalMark = null;
};

const parseOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const roundMarkValue = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return null;
  return Math.round(parsedValue * 100) / 100;
};

const parseJsonArray = (rawValue) => {
  if (Array.isArray(rawValue)) return rawValue;
  if (rawValue && typeof rawValue === "object") return [rawValue];
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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
    Date.UTC(year, monthIndex, day, hours, minutes, seconds, milliseconds) -
      IST_OFFSET_MS
  );

const getIstShiftedDate = (value) => new Date(new Date(value).getTime() + IST_OFFSET_MS);

const getIstDateParts = (value) => {
  const shiftedDate = getIstShiftedDate(value);

  return {
    year: shiftedDate.getUTCFullYear(),
    monthIndex: shiftedDate.getUTCMonth(),
    day: shiftedDate.getUTCDate(),
    hours: shiftedDate.getUTCHours(),
    minutes: shiftedDate.getUTCMinutes(),
    dayOfWeek: shiftedDate.getUTCDay(),
  };
};

const resolveDateParts = (value) => {
  if (!value) return null;

  if (
    typeof value === "object" &&
    value !== null &&
    Number.isInteger(value.year) &&
    Number.isInteger(value.monthIndex) &&
    Number.isInteger(value.day)
  ) {
    return value;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const { year, monthIndex, day } = getIstDateParts(value);
    return { year, monthIndex, day };
  }

  if (typeof value === "string") {
    const normalized = normalizeText(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

    const [year, month, day] = normalized.split("-").map(Number);
    if (!year || !month || !day) return null;

    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (
      candidate.getUTCFullYear() !== year ||
      candidate.getUTCMonth() !== month - 1 ||
      candidate.getUTCDate() !== day
    ) {
      return null;
    }

    return { year, monthIndex: month - 1, day };
  }

  return null;
};

const parseDateBoundary = (value, boundary = "start") => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;

  const [year, month, day] = normalized.split("-").map(Number);
  const parsed =
    boundary === "end"
      ? buildIstDateTime({
          year,
          monthIndex: month - 1,
          day,
          hours: 23,
          minutes: 59,
          seconds: 59,
          milliseconds: 999,
        })
      : buildIstDateTime({
          year,
          monthIndex: month - 1,
          day,
        });

  const parsedParts = getIstDateParts(parsed);
  if (
    parsedParts.year !== year ||
    parsedParts.monthIndex !== month - 1 ||
    parsedParts.day !== day
  ) {
    return null;
  }

  return parsed;
};

const parseDateInput = (value) => resolveDateParts(value);

const normalizeTimeInput = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return "";

  const match = normalized.match(timePattern);
  if (match) {
    return `${match[1]}:${match[2]}`;
  }

  const twelveHourMatch = normalized.match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  );
  if (!twelveHourMatch) return "";

  let hours = Number(twelveHourMatch[1]);
  const minutes = twelveHourMatch[2];
  const suffix = twelveHourMatch[3].toUpperCase();

  if (hours < 1 || hours > 12) return "";
  if (suffix === "AM") {
    hours = hours === 12 ? 0 : hours;
  } else if (hours !== 12) {
    hours += 12;
  }

  return `${pad(hours)}:${minutes}`;
};

const formatTimeLabel = (value) => {
  const normalized = normalizeTimeInput(value);
  if (!normalized) return "";

  const [hoursValue, minutesValue] = normalized.split(":").map(Number);
  const suffix = hoursValue >= 12 ? "PM" : "AM";
  const displayHour = hoursValue % 12 === 0 ? 12 : hoursValue % 12;

  return `${pad(displayHour)}:${pad(minutesValue)} ${suffix}`;
};

const combineDateAndTime = (dateValue, timeValue) => {
  const date = resolveDateParts(dateValue);
  const time = normalizeTimeInput(timeValue);

  if (!date || !time) {
    return null;
  }

  const [hours, minutes] = time.split(":").map(Number);
  return buildIstDateTime({
    year: date.year,
    monthIndex: date.monthIndex,
    day: date.day,
    hours,
    minutes,
  });
};

const compareIstCalendarDate = (leftValue, rightValue) => {
  const left = getIstDateParts(leftValue);
  const right = getIstDateParts(rightValue);

  if (left.year !== right.year) return left.year - right.year;
  if (left.monthIndex !== right.monthIndex) return left.monthIndex - right.monthIndex;
  return left.day - right.day;
};

const getIstDayDifference = (leftValue, rightValue) => {
  if (!leftValue || !rightValue) return 0;

  const left = getIstDateParts(leftValue);
  const right = getIstDateParts(rightValue);
  const leftDayStart = buildIstDateTime({
    year: left.year,
    monthIndex: left.monthIndex,
    day: left.day,
  });
  const rightDayStart = buildIstDateTime({
    year: right.year,
    monthIndex: right.monthIndex,
    day: right.day,
  });

  return Math.round((leftDayStart.getTime() - rightDayStart.getTime()) / DAY_IN_MS);
};

const normalizeSubmissionTimingStatus = (value) => {
  const normalized = normalizeText(value).toLowerCase();

  if (normalized === "advanced") return "advance";
  if (normalized === "delay") return "delayed";
  if (SUBMISSION_TIMING_STATUSES.includes(normalized)) return normalized;
  return "pending";
};

const toLegacyTimelinessStatus = (value) => {
  const normalized = normalizeSubmissionTimingStatus(value);

  if (normalized === "advance") return "advanced";
  if (normalized === "delayed") return "delay";
  return normalized;
};

const getTaskTargetDateTime = (source = {}) =>
  source?.dependencyTargetDateTime || source?.targetDateTime || source?.endDateTime || null;

const getSubmissionTimingStatus = ({
  submittedAt,
  targetDateTime,
  dependencyTargetDateTime,
  endDateTime,
}) => {
  const resolvedTargetDateTime =
    targetDateTime || dependencyTargetDateTime || endDateTime || null;

  if (!submittedAt || !resolvedTargetDateTime) return "pending";

  const dayComparison = compareIstCalendarDate(submittedAt, resolvedTargetDateTime);
  if (dayComparison < 0) return "advance";
  if (dayComparison > 0) return "delayed";

  return new Date(submittedAt).getTime() <= new Date(resolvedTargetDateTime).getTime()
    ? "on_time"
    : "delayed";
};

const buildDependencyTargetDateTime = (dependencyCompletedAt, targetDayCount) => {
  const completedAtDate = dependencyCompletedAt ? new Date(dependencyCompletedAt) : null;
  const normalizedTargetDayCount = parseOptionalNumber(targetDayCount);

  if (
    !completedAtDate ||
    Number.isNaN(completedAtDate.getTime()) ||
    normalizedTargetDayCount === null
  ) {
    return null;
  }

  return new Date(completedAtDate.getTime() + normalizedTargetDayCount * DAY_IN_MS);
};

const buildOccurrenceKey = (dateValue) => {
  const date = getIstDateParts(dateValue);
  return [
    date.year,
    pad(date.monthIndex + 1),
    pad(date.day),
    pad(date.hours),
    pad(date.minutes),
  ].join("");
};

const buildTaskNumberFromOccurrenceKey = (checklistNumber, occurrenceKey) =>
  `${normalizeText(checklistNumber)}-${normalizeText(occurrenceKey)}`;

const buildTaskNumber = (checklistNumber, dateValue) =>
  buildTaskNumberFromOccurrenceKey(checklistNumber, buildOccurrenceKey(dateValue));

const buildDependencyOccurrenceKey = (dependencyTask) => {
  const dependencyTaskId = normalizeText(dependencyTask?._id).slice(-6).toUpperCase();
  const sourceDate =
    dependencyTask?.completedAt || dependencyTask?.occurrenceDate || new Date();
  const baseKey = buildOccurrenceKey(sourceDate);

  return dependencyTaskId ? `DEP${baseKey}-${dependencyTaskId}` : `DEP${baseKey}`;
};

const buildDependentTaskNumber = (checklistNumber, dependencyTask) =>
  buildTaskNumberFromOccurrenceKey(
    checklistNumber,
    buildDependencyOccurrenceKey(dependencyTask)
  );

const getTemporaryTransferChecklistIds = (transfer) =>
  normalizeIdList((transfer?.checklists || []).map((row) => row?.checklist));

const applyTemporaryTransferActivation = async (transfer, now) => {
  const checklistIds = getTemporaryTransferChecklistIds(transfer);
  const transferStartDate = transfer?.transferStartDate || null;
  const transferEndDate = transfer?.transferEndDate || null;

  if (!checklistIds.length || !transferStartDate || !transferEndDate) {
    await ChecklistTransferHistory.updateOne(
      { _id: transfer._id },
      {
        $set: {
          transferStatus: "completed",
          revertedAt: now,
        },
      }
    );
    return;
  }

  await Checklist.updateMany(
    {
      _id: { $in: checklistIds },
      assignedToEmployee: transfer.fromEmployee,
    },
    {
      $set: {
        assignedToEmployee: transfer.toEmployee,
      },
    }
  );

  await ChecklistTask.updateMany(
    {
      checklist: { $in: checklistIds },
      occurrenceDate: {
        $gte: transferStartDate,
        $lte: transferEndDate,
      },
      completedAt: null,
      assignedEmployee: transfer.fromEmployee,
    },
    {
      $set: {
        assignedEmployee: transfer.toEmployee,
      },
    }
  );

  await ChecklistTransferHistory.updateOne(
    { _id: transfer._id },
    {
      $set: {
        transferStatus: "active",
        activatedAt: transfer.activatedAt || now,
        revertedAt: null,
      },
    }
  );
};

const applyTemporaryTransferRevert = async (transfer, now) => {
  const checklistIds = getTemporaryTransferChecklistIds(transfer);
  const transferStartDate = transfer?.transferStartDate || null;
  const transferEndDate = transfer?.transferEndDate || null;

  if (checklistIds.length) {
    await Checklist.updateMany(
      {
        _id: { $in: checklistIds },
        assignedToEmployee: transfer.toEmployee,
      },
      {
        $set: {
          assignedToEmployee: transfer.fromEmployee,
        },
      }
    );

    if (transferStartDate && transferEndDate) {
      await ChecklistTask.updateMany(
        {
          checklist: { $in: checklistIds },
          occurrenceDate: {
            $gte: transferStartDate,
            $lte: transferEndDate,
          },
          completedAt: null,
          assignedEmployee: transfer.toEmployee,
        },
        {
          $set: {
            assignedEmployee: transfer.fromEmployee,
          },
        }
      );
    }
  }

  await ChecklistTransferHistory.updateOne(
    { _id: transfer._id },
    {
      $set: {
        transferStatus: "completed",
        revertedAt: now,
      },
    }
  );
};

const processTemporaryChecklistTransfers = async (now = new Date()) => {
  const transfers = await ChecklistTransferHistory.find(
    {
      transferType: "temporary",
      transferStatus: { $in: ["pending", "active"] },
    },
    [
      "_id",
      "transferStatus",
      "fromEmployee",
      "toEmployee",
      "transferStartDate",
      "transferEndDate",
      "activatedAt",
      "checklists",
    ].join(" ")
  ).lean();

  for (const transfer of transfers) {
    const transferStartDate = transfer?.transferStartDate
      ? new Date(transfer.transferStartDate)
      : null;
    const transferEndDate = transfer?.transferEndDate
      ? new Date(transfer.transferEndDate)
      : null;

    if (!transferStartDate || !transferEndDate) {
      await applyTemporaryTransferRevert(transfer, now);
      continue;
    }

    if (transferEndDate < now) {
      await applyTemporaryTransferRevert(transfer, now);
      continue;
    }

    if (transferStartDate <= now && transferEndDate >= now) {
      await applyTemporaryTransferActivation(transfer, now);
    }
  }
};

const getChecklistWindowMs = (checklist) => {
  const scheduledStart = combineDateAndTime(checklist.startDate, checklist.scheduleTime);
  const scheduledEnd = combineDateAndTime(checklist.endDate, checklist.endTime);

  if (!scheduledStart || !scheduledEnd) return 0;
  return Math.max(0, scheduledEnd.getTime() - scheduledStart.getTime());
};

const buildTaskEndDateTime = (checklist, occurrenceDate) => {
  const durationMs = getChecklistWindowMs(checklist);
  return new Date(new Date(occurrenceDate).getTime() + durationMs);
};

const resolveMarkConfig = (source = {}) => {
  if (isNilChecklistTask(source)) {
    return {
      enableMark: false,
      baseMark: null,
      delayPenaltyPerDay: null,
      advanceBonusPerDay: null,
    };
  }

  const explicitEnableMark =
    typeof source?.enableMark === "boolean" ? source.enableMark : null;
  const configuredBaseMark = parseOptionalNumber(source?.baseMark);
  const legacyChecklistMark = parseOptionalNumber(source?.checklistMark);
  const baseMark = configuredBaseMark ?? legacyChecklistMark;
  const enableMark =
    explicitEnableMark !== null ? explicitEnableMark && baseMark !== null : baseMark !== null;

  if (!enableMark || baseMark === null) {
    return {
      enableMark: false,
      baseMark: null,
      delayPenaltyPerDay: null,
      advanceBonusPerDay: null,
    };
  }

  return {
    enableMark: true,
    baseMark: roundMarkValue(baseMark),
    delayPenaltyPerDay: roundMarkValue(
      parseOptionalNumber(source?.delayPenaltyPerDay) ?? 0.5
    ),
    advanceBonusPerDay: roundMarkValue(
      parseOptionalNumber(source?.advanceBonusPerDay) ?? 0.5
    ),
  };
};

const calculateTaskMark = ({
  submittedAt,
  targetDateTime,
  dependencyTargetDateTime,
  endDateTime,
  enableMark,
  baseMark,
  delayPenaltyPerDay,
  advanceBonusPerDay,
}) => {
  const resolvedTargetDateTime =
    targetDateTime || dependencyTargetDateTime || endDateTime || null;

  if (!enableMark || baseMark === null || !submittedAt || !resolvedTargetDateTime) {
    return {
      finalMark: null,
    };
  }

  const dayDifference = getIstDayDifference(submittedAt, resolvedTargetDateTime);
  const isSameDayLate =
    dayDifference === 0 &&
    new Date(submittedAt).getTime() > new Date(resolvedTargetDateTime).getTime();
  const delayDays = Math.max(0, dayDifference) + (isSameDayLate ? 1 : 0);
  const advanceDays = Math.max(0, dayDifference * -1);
  const adjustment =
    advanceDays * (advanceBonusPerDay || 0) - delayDays * (delayPenaltyPerDay || 0);

  return {
    finalMark: roundMarkValue(Math.max(0, baseMark + adjustment)),
  };
};

const getTaskTimelinessStatus = (value = {}) =>
  toLegacyTimelinessStatus(getSubmissionTimingStatus(value));

const buildChecklistNumberPrefix = (siteName) => {
  const tokens =
    normalizeText(siteName)
      .match(/[A-Za-z0-9]+/g)
      ?.filter(Boolean) || [];

  if (!tokens.length) {
    return "CL";
  }

  if (tokens.length === 1) {
    const token = tokens[0].toUpperCase();
    return token.length <= 3 ? token : token.slice(0, 3);
  }

  return tokens
    .map((token) => token.charAt(0).toUpperCase())
    .join("")
    .slice(0, 4);
};

const buildCustomRepeatSummary = ({
  customRepeatInterval = 1,
  customRepeatUnit = "daily",
  repeatDayOfMonth = null,
  repeatDayOfWeek = "",
  repeatMonthOfYear = null,
}) => {
  const interval = Math.max(1, Number(customRepeatInterval) || 1);
  const unit = normalizeText(customRepeatUnit).toLowerCase() || "daily";
  const labels = {
    daily: { singular: "day", plural: "days", base: "Every day" },
    weekly: { singular: "week", plural: "weeks", base: "Every week" },
    monthly: { singular: "month", plural: "months", base: "Every month" },
    yearly: { singular: "year", plural: "years", base: "Every year" },
  };
  const unitLabel = labels[unit] || labels.daily;
  const baseSummary =
    interval === 1 ? unitLabel.base : `Every ${interval} ${unitLabel.plural}`;

  if (unit === "weekly" && repeatDayOfWeek) {
    return `${baseSummary} on ${repeatDayOfWeek}`;
  }

  if (unit === "monthly" && repeatDayOfMonth) {
    return `${baseSummary} on the ${ordinal(repeatDayOfMonth)}`;
  }

  if (unit === "yearly" && repeatMonthOfYear && repeatDayOfMonth) {
    return `${baseSummary} on ${getMonthLabel(repeatMonthOfYear)} ${ordinal(
      repeatDayOfMonth
    )}`;
  }

  if (unit === "yearly" && repeatMonthOfYear) {
    return `${baseSummary} in ${getMonthLabel(repeatMonthOfYear)}`;
  }

  return baseSummary;
};

const buildRepeatSummary = ({
  scheduleType,
  startDate,
  customRepeatInterval,
  customRepeatUnit,
  repeatDayOfMonth,
  repeatDayOfWeek,
  repeatMonthOfYear,
}) => {
  const normalizedScheduleType = normalizeText(scheduleType).toLowerCase();
  const anchorDate = startDate ? getIstDateParts(startDate) : null;

  if (normalizedScheduleType === "custom") {
    return buildCustomRepeatSummary({
      customRepeatInterval,
      customRepeatUnit,
      repeatDayOfMonth,
      repeatDayOfWeek,
      repeatMonthOfYear,
    });
  }

  if (normalizedScheduleType === "weekly" && anchorDate) {
    return `Every ${WEEK_DAYS[anchorDate.dayOfWeek]}`;
  }

  if (normalizedScheduleType === "monthly" && anchorDate) {
    return `${ordinal(anchorDate.day)} of every month`;
  }

  if (normalizedScheduleType === "yearly" && anchorDate) {
    return `Every year on ${MONTH_LABELS[anchorDate.monthIndex]} ${ordinal(
      anchorDate.day
    )}`;
  }

  if (normalizedScheduleType === "daily") {
    return "Every day";
  }

  return capitalize(normalizedScheduleType);
};

const getDaysInMonth = (year, monthIndex) =>
  new Date(year, monthIndex + 1, 0).getDate();

const buildAnchoredDate = ({
  year,
  monthIndex,
  dayOfMonth,
  scheduleTime,
}) => {
  const lastDay = getDaysInMonth(year, monthIndex);
  const safeDay = Math.min(dayOfMonth, lastDay);
  const [hours, minutes] = normalizeTimeInput(scheduleTime).split(":").map(Number);

  return buildIstDateTime({
    year,
    monthIndex,
    day: safeDay,
    hours,
    minutes,
  });
};

const getFirstCustomOccurrence = (checklist) => {
  const startOccurrence = combineDateAndTime(checklist.startDate, checklist.scheduleTime);
  if (!startOccurrence) return null;

  const unit = normalizeText(checklist.customRepeatUnit).toLowerCase() || "daily";

  if (unit === "weekly") {
    const targetDayIndex = getWeekDayIndex(checklist.repeatDayOfWeek);
    if (targetDayIndex < 0) return startOccurrence;

    const dayOffset =
      (targetDayIndex - getIstDateParts(startOccurrence).dayOfWeek + 7) % 7;
    return new Date(startOccurrence.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  }

  if (unit === "monthly") {
    const targetDayOfMonth = Number(checklist.repeatDayOfMonth || 0);
    if (!targetDayOfMonth) return startOccurrence;

    let { year, monthIndex } = getIstDateParts(startOccurrence);
    let occurrence = buildAnchoredDate({
      year,
      monthIndex,
      dayOfMonth: targetDayOfMonth,
      scheduleTime: checklist.scheduleTime,
    });

    if (occurrence < startOccurrence) {
      monthIndex += 1;
      if (monthIndex > 11) {
        monthIndex = 0;
        year += 1;
      }

      occurrence = buildAnchoredDate({
        year,
        monthIndex,
        dayOfMonth: targetDayOfMonth,
        scheduleTime: checklist.scheduleTime,
      });
    }

    return occurrence;
  }

  if (unit === "yearly") {
    const targetDayOfMonth = Number(checklist.repeatDayOfMonth || 0);
    const targetMonthOfYear = Number(checklist.repeatMonthOfYear || 0);
    if (!targetDayOfMonth || !targetMonthOfYear) return startOccurrence;

    let { year } = getIstDateParts(startOccurrence);
    let occurrence = buildAnchoredDate({
      year,
      monthIndex: targetMonthOfYear - 1,
      dayOfMonth: targetDayOfMonth,
      scheduleTime: checklist.scheduleTime,
    });

    if (occurrence < startOccurrence) {
      year += 1;
      occurrence = buildAnchoredDate({
        year,
        monthIndex: targetMonthOfYear - 1,
        dayOfMonth: targetDayOfMonth,
        scheduleTime: checklist.scheduleTime,
      });
    }

    return occurrence;
  }

  return startOccurrence;
};

const getFirstOccurrence = (checklist) => {
  const normalizedScheduleType = normalizeText(checklist.scheduleType).toLowerCase();

  if (normalizedScheduleType === "custom") {
    return getFirstCustomOccurrence(checklist);
  }

  return combineDateAndTime(checklist.startDate, checklist.scheduleTime);
};

const getNextOccurrence = (checklist, currentOccurrence) => {
  const occurrence = new Date(currentOccurrence);
  const anchorDate = getIstDateParts(checklist.startDate);
  const normalizedScheduleType = normalizeText(checklist.scheduleType).toLowerCase();

  if (normalizedScheduleType === "custom") {
    const interval = Math.max(1, Number(checklist.customRepeatInterval) || 1);
    const unit = normalizeText(checklist.customRepeatUnit).toLowerCase() || "daily";

    if (unit === "weekly") {
      return new Date(occurrence.getTime() + interval * 7 * 24 * 60 * 60 * 1000);
    }

    if (unit === "monthly") {
      const occurrenceParts = getIstDateParts(occurrence);
      const totalMonths = occurrenceParts.monthIndex + interval;
      const year = occurrenceParts.year + Math.floor(totalMonths / 12);
      const monthIndex = ((totalMonths % 12) + 12) % 12;
      return buildAnchoredDate({
        year,
        monthIndex,
        dayOfMonth: Number(checklist.repeatDayOfMonth || anchorDate.day),
        scheduleTime: checklist.scheduleTime,
      });
    }

    if (unit === "yearly") {
      const occurrenceParts = getIstDateParts(occurrence);
      return buildAnchoredDate({
        year: occurrenceParts.year + interval,
        monthIndex: Number(checklist.repeatMonthOfYear || anchorDate.monthIndex + 1) - 1,
        dayOfMonth: Number(checklist.repeatDayOfMonth || anchorDate.day),
        scheduleTime: checklist.scheduleTime,
      });
    }

    return new Date(occurrence.getTime() + interval * 24 * 60 * 60 * 1000);
  }

  switch (normalizedScheduleType) {
    case "weekly":
      return new Date(occurrence.getTime() + 7 * 24 * 60 * 60 * 1000);
    case "monthly":
      {
        const occurrenceParts = getIstDateParts(occurrence);
        const totalMonths = occurrenceParts.monthIndex + 1;
        const year = occurrenceParts.year + Math.floor(totalMonths / 12);
        const monthIndex = totalMonths % 12;
        return buildAnchoredDate({
          year,
          monthIndex,
          dayOfMonth: anchorDate.day,
          scheduleTime: checklist.scheduleTime,
        });
      }
    case "yearly":
      return buildAnchoredDate({
        year: getIstDateParts(occurrence).year + 1,
        monthIndex: anchorDate.monthIndex,
        dayOfMonth: anchorDate.day,
        scheduleTime: checklist.scheduleTime,
      });
    case "daily":
    default:
      return new Date(occurrence.getTime() + 24 * 60 * 60 * 1000);
  }
};

const getPendingOccurrences = (checklist, now = new Date()) => {
  const firstOccurrence = getFirstOccurrence(checklist);
  if (!firstOccurrence) {
    return { occurrences: [], nextOccurrenceAt: null };
  }

  let nextOccurrence = checklist.lastGeneratedAt
    ? getNextOccurrence(checklist, checklist.lastGeneratedAt)
    : firstOccurrence;

  const occurrences = [];

  while (nextOccurrence && nextOccurrence <= now && occurrences.length < maxOccurrencesPerRun) {
    occurrences.push(nextOccurrence);
    nextOccurrence = getNextOccurrence(checklist, nextOccurrence);
  }

  return {
    occurrences,
    nextOccurrenceAt: nextOccurrence,
  };
};

const buildTaskItemsFromChecklist = (checklist) =>
  (checklist.checklistItems || []).map((item) => ({
    checklistItemId: item._id,
    label: item.label,
    detail: item.detail || "",
    isRequired: item.isRequired !== false,
    answer: "",
    employeeAnswerRemark: "",
    superiorAnswerRemark: "",
    verified: false,
    remarks: "",
  }));

const buildApprovalStepsFromChecklist = (checklist) =>
  (checklist.approvals || []).map((row) => ({
    approvalLevel: Number(row.approvalLevel) || 1,
    approverEmployee: row.approvalEmployee,
    status: "waiting",
    remarks: "",
    actedAt: null,
  }));

const getDependentTaskTriggerStart = (checklist) =>
  combineDateAndTime(checklist?.startDate, checklist?.scheduleTime) ||
  (checklist?.startDate ? new Date(checklist.startDate) : null);

const findCompletedDependencyTasks = async ({
  checklist,
  dependencyTaskIds = [],
}) => {
  const dependencyChecklistId = getChecklistDependencyId(checklist);
  if (!isValidObjectId(dependencyChecklistId)) {
    return [];
  }

  const filter = {
    checklist: dependencyChecklistId,
    status: { $in: TASK_COMPLETION_STATUSES },
    completedAt: { $ne: null },
  };
  const normalizedDependencyTaskIds = normalizeIdList(dependencyTaskIds);
  const triggerStart = getDependentTaskTriggerStart(checklist);

  if (normalizedDependencyTaskIds.length) {
    filter._id = { $in: normalizedDependencyTaskIds };
  }

  if (triggerStart) {
    filter.completedAt.$gte = triggerStart;
  }

  return ChecklistTask.find(
    filter,
    "_id taskNumber checklist checklistNumber checklistName completedAt occurrenceDate"
  )
    .sort({ completedAt: 1, occurrenceDate: 1, createdAt: 1 })
    .lean();
};

const createDependentChecklistTask = async ({
  checklist,
  dependencyTask,
}) => {
  const dependencyTaskId = normalizeText(dependencyTask?._id);
  if (!isValidObjectId(dependencyTaskId)) {
    return 0;
  }

  const existingTask = await ChecklistTask.findOne(
    {
      checklist: checklist._id,
      dependencyTaskId,
    },
    "_id"
  ).lean();

  if (existingTask) {
    return 0;
  }

  const dependencyCompletedAt = dependencyTask?.completedAt
    ? new Date(dependencyTask.completedAt)
    : null;
  const dependencyTriggeredAt = dependencyCompletedAt || new Date();
  const dependencyTargetDateTime = buildDependencyTargetDateTime(
    dependencyCompletedAt,
    checklist?.targetDayCount
  );
  const markConfig = resolveMarkConfig(checklist);
  const occurrenceKey = buildDependencyOccurrenceKey(dependencyTask);

  const taskPayload = {
    taskNumber: buildDependentTaskNumber(checklist.checklistNumber, dependencyTask),
    checklist: checklist._id,
    checklistNumber: checklist.checklistNumber,
    checklistName: checklist.checklistName,
    scheduleType: checklist.scheduleType,
    repeatSummary: checklist.repeatSummary || "",
    priority: checklist.priority || "medium",
    occurrenceDate: dependencyTriggeredAt,
    occurrenceKey,
    endDateTime: dependencyTargetDateTime,
    enableMark: markConfig.enableMark,
    baseMark: markConfig.baseMark,
    delayPenaltyPerDay: markConfig.delayPenaltyPerDay,
    advanceBonusPerDay: markConfig.advanceBonusPerDay,
    finalMark: null,
    approvalType: "normal",
    isNilApproval: false,
    assignedEmployee: checklist.assignedToEmployee,
    isDependentTask: true,
    dependencyChecklistId: checklist.dependencyChecklistId,
    dependencyChecklistNumber: normalizeText(
      checklist.dependencyTaskNumber || dependencyTask?.checklistNumber
    ),
    dependencyTaskId: dependencyTask._id,
    dependencyTaskNumber: normalizeText(dependencyTask?.taskNumber),
    targetDayCount: roundMarkValue(checklist?.targetDayCount),
    dependencyCompletedAt,
    dependencyTargetDateTime,
    autoCreatedFromDependency: true,
    dependencyTriggeredAt,
    dependencyStatus: "unlocked",
    unlockedAt: dependencyCompletedAt,
    currentApprovalEmployee: null,
    status: "open",
    checklistItems: buildTaskItemsFromChecklist(checklist),
    employeeRemarks: "",
    employeeAttachments: [],
    submittedAt: null,
    timelinessStatus: "pending",
    submissionTimingStatus: "pending",
    approvalSteps: buildApprovalStepsFromChecklist(checklist),
    completedAt: null,
  };

  try {
    await ChecklistTask.create(taskPayload);
    await Checklist.updateOne(
      { _id: checklist._id },
      {
        $set: {
          lastGeneratedAt: dependencyTriggeredAt,
          nextOccurrenceAt: null,
        },
      }
    );
    return 1;
  } catch (err) {
    if (err?.code === 11000) return 0;
    throw err;
  }
};

const runDependentChecklistScheduler = async ({
  checklistIds = [],
  dependencyChecklistIds = [],
  dependencyTaskIds = [],
} = {}) => {
  const normalizedChecklistIds = normalizeIdList(checklistIds);
  const normalizedDependencyChecklistIds = normalizeIdList(dependencyChecklistIds);
  const normalizedDependencyTaskIds = normalizeIdList(dependencyTaskIds);
  const filter = {
    status: true,
    isDependentTask: true,
    dependencyChecklistId: { $ne: null },
    targetDayCount: { $gt: 0 },
  };

  if (normalizedChecklistIds.length && normalizedDependencyChecklistIds.length) {
    filter.$or = [
      { _id: { $in: normalizedChecklistIds } },
      { dependencyChecklistId: { $in: normalizedDependencyChecklistIds } },
    ];
  } else if (normalizedChecklistIds.length) {
    filter._id = { $in: normalizedChecklistIds };
  } else if (normalizedDependencyChecklistIds.length) {
    filter.dependencyChecklistId = { $in: normalizedDependencyChecklistIds };
  }

  const checklists = await Checklist.find(filter);
  let created = 0;

  for (const checklist of checklists) {
    const dependencyTasks = await findCompletedDependencyTasks({
      checklist,
      dependencyTaskIds: normalizedDependencyTaskIds,
    });

    for (const dependencyTask of dependencyTasks) {
      created += await createDependentChecklistTask({
        checklist,
        dependencyTask,
      });
    }
  }

  return {
    processed: checklists.length,
    created,
  };
};

const getChecklistDependencyId = (value) =>
  normalizeText(value?.dependencyChecklistId?._id || value?.dependencyChecklistId);

const getChecklistDependencyNumber = (value) =>
  normalizeText(value?.dependencyChecklistNumber || value?.dependencyTaskNumber);

const isDependencyUnlocked = (task) =>
  TASK_COMPLETION_STATUSES.includes(normalizeText(task?.status).toLowerCase());

const getDependencyBlockedMessage = (task) => {
  const dependencyReference =
    normalizeText(task?.dependencyTaskNumber) ||
    getChecklistDependencyNumber(task) ||
    normalizeText(task?.dependencyTaskId?.taskNumber) ||
    normalizeText(task?.dependencyChecklistId?.checklistNumber);

  return dependencyReference
    ? `Waiting for Previous Task Completion (${dependencyReference})`
    : "Waiting for Previous Task Completion";
};

const resolveDependencyTaskForOccurrence = async ({
  dependencyChecklistId,
  occurrenceDate,
  excludeTaskId = "",
}) => {
  const normalizedDependencyChecklistId = normalizeText(dependencyChecklistId);
  if (!isValidObjectId(normalizedDependencyChecklistId) || !occurrenceDate) {
    return null;
  }

  const filter = {
    checklist: normalizedDependencyChecklistId,
    occurrenceDate: { $lte: new Date(occurrenceDate) },
  };

  if (isValidObjectId(excludeTaskId)) {
    filter._id = { $ne: excludeTaskId };
  }

  return ChecklistTask.findOne(
    filter,
    "_id taskNumber checklistName status completedAt occurrenceDate"
  )
    .sort({ occurrenceDate: -1, createdAt: -1 })
    .lean();
};

const buildTaskDependencyState = async ({
  checklist,
  occurrenceDate,
  existingTask = null,
}) => {
  const isDependentTask = parseBoolean(checklist?.isDependentTask, false);
  const dependencyChecklistId = getChecklistDependencyId(checklist);
  const dependencyChecklistNumber =
    normalizeText(checklist?.dependencyTaskNumber) ||
    normalizeText(checklist?.dependencyChecklistId?.checklistNumber);

  if (!isDependentTask || !isValidObjectId(dependencyChecklistId)) {
    return {
      isDependentTask: false,
      dependencyChecklistId: null,
      dependencyChecklistNumber: "",
      dependencyTaskId: null,
      dependencyTaskNumber: "",
      dependencyStatus: "not_required",
      unlockedAt: null,
      status: "open",
    };
  }

  const dependencyTask = await resolveDependencyTaskForOccurrence({
    dependencyChecklistId,
    occurrenceDate,
    excludeTaskId: existingTask?._id,
  });
  const dependencyComplete = isDependencyUnlocked(dependencyTask);

  return {
    isDependentTask: true,
    dependencyChecklistId,
    dependencyChecklistNumber,
    dependencyTaskId: dependencyTask?._id || null,
    dependencyTaskNumber: normalizeText(dependencyTask?.taskNumber),
    dependencyStatus: dependencyComplete ? "unlocked" : "waiting",
    unlockedAt: dependencyComplete ? existingTask?.unlockedAt || new Date() : null,
    status: dependencyComplete ? "open" : "waiting_dependency",
  };
};

const applyTaskDependencyState = (task, dependencyState = {}) => {
  task.isDependentTask = dependencyState.isDependentTask === true;
  task.dependencyChecklistId = dependencyState.dependencyChecklistId || null;
  task.dependencyChecklistNumber = dependencyState.dependencyChecklistNumber || "";
  task.dependencyTaskId = dependencyState.dependencyTaskId || null;
  task.dependencyTaskNumber = dependencyState.dependencyTaskNumber || "";
  task.dependencyStatus = DEPENDENCY_STATUSES.includes(dependencyState.dependencyStatus)
    ? dependencyState.dependencyStatus
    : "not_required";
  task.unlockedAt = dependencyState.unlockedAt || null;
  task.status =
    TASK_STATUSES.includes(dependencyState.status) ? dependencyState.status : task.status;
};

const parseChecklistItems = (rawValue) =>
  parseJsonArray(rawValue)
    .map((item) => ({
      label: normalizeText(item?.label || item?.title || item?.name),
      detail: normalizeText(item?.detail || item?.description),
      isRequired: parseBoolean(item?.isRequired, true),
    }))
    .filter((item) => item.label);

const normalizeApprovalRows = (rows = []) =>
  rows
    .map((row, index) => ({
      approvalLevel: Number(row?.approvalLevel) || index + 1,
      approvalEmployee: normalizeText(
        row?.approvalEmployee?._id || row?.approvalEmployee || row?.approverEmployee
      ),
    }))
    .filter((row) => row.approvalEmployee);

const employeeHasSite = (employee, siteId) =>
  (employee?.sites || []).some((site) => String(site?._id || site) === String(siteId));

const resolveApprovalRows = async ({
  assignedEmployee,
  approvalHierarchy,
  approvals,
}) => {
  const normalizedHierarchy = normalizeText(approvalHierarchy).toLowerCase() || "default";

  if (!APPROVAL_HIERARCHIES.includes(normalizedHierarchy)) {
    return { message: "Invalid approval hierarchy", status: 400 };
  }

  if (normalizedHierarchy === "default") {
    const superiorEmployeeId = normalizeText(
      assignedEmployee?.superiorEmployee?._id || assignedEmployee?.superiorEmployee
    );

    if (!superiorEmployeeId) {
      return {
        message:
          "Approval mapping is incomplete. Configure a Department Head or Superior Employee for the selected employee.",
        status: 400,
      };
    }

    return {
      approvalHierarchy: "default",
      approvals: [
        {
          approvalLevel: 1,
          approvalEmployee: superiorEmployeeId,
        },
      ],
    };
  }

  const normalizedRows = normalizeApprovalRows(parseJsonArray(approvals));

  if (!normalizedRows.length) {
    return {
      message: "At least one approval employee is required for custom workflow mapping",
      status: 400,
    };
  }

  const approverIds = normalizedRows.map((row) => row.approvalEmployee);
  const uniqueApproverIds = [...new Set(approverIds)];

  if (approverIds.length !== uniqueApproverIds.length) {
    return {
      message: "Approval workflow cannot contain duplicate approvers",
      status: 400,
    };
  }

  if (uniqueApproverIds.includes(String(assignedEmployee._id))) {
    return {
      message: "Assigned employee cannot approve their own checklist",
      status: 400,
    };
  }

  const approvers = await Employee.find(
    { _id: { $in: uniqueApproverIds }, isActive: true },
    "_id"
  ).lean();

  if (approvers.length !== uniqueApproverIds.length) {
    return {
      message: "One or more selected approval employees are invalid or inactive",
      status: 400,
    };
  }

  return {
    approvalHierarchy: "custom",
    approvals: uniqueApproverIds.map((employeeId, index) => ({
      approvalLevel: index + 1,
      approvalEmployee: employeeId,
    })),
  };
};

const getNextChecklistNumberValue = async (siteId) => {
  const site = await Site.findById(siteId, "name").lean();

  if (!site) return null;

  const prefix = buildChecklistNumberPrefix(site.name);
  const pattern = new RegExp(`^${escapeRegex(prefix)}\\s*-\\s*(\\d+)$`, "i");

  const existingChecklists = await Checklist.find(
    {
      employeeAssignedSite: siteId,
      checklistNumber: { $regex: `^${escapeRegex(prefix)}\\s*-\\s*` },
    },
    "checklistNumber"
  ).lean();

  const maxSequence = existingChecklists.reduce((maxValue, row) => {
    const match = pattern.exec(normalizeText(row.checklistNumber));
    if (!match) return maxValue;

    const parsedValue = Number(match[1]);
    return Number.isNaN(parsedValue) ? maxValue : Math.max(maxValue, parsedValue);
  }, 0);

  return `${prefix} - ${String(maxSequence + 1).padStart(3, "0")}`;
};

const validateChecklistPayload = async ({ body, requesterSiteId = "" }) => {
  const currentChecklistId = normalizeText(body.currentChecklistId || body._id || body.id);
  const checklistName = normalizeText(body.checklistName);
  const enableMark =
    body.enableMark === undefined
      ? parseOptionalNumber(body.baseMark ?? body.checklistMark) !== null
      : parseBoolean(body.enableMark, false);
  const baseMark = parseOptionalNumber(body.baseMark ?? body.checklistMark);
  const delayPenaltyPerDay = parseOptionalNumber(body.delayPenaltyPerDay);
  const advanceBonusPerDay = parseOptionalNumber(body.advanceBonusPerDay);
  const checklistSourceSite = normalizeText(body.checklistSourceSite);
  const assignedToEmployee = normalizeText(body.assignedToEmployee);
  const employeeAssignedSite = normalizeText(body.employeeAssignedSite);
  const scheduleType = normalizeText(body.scheduleType).toLowerCase();
  const priority = normalizeText(body.priority).toLowerCase() || "medium";
  const isDependentTask = parseBoolean(body.isDependentTask, false);
  const dependencyChecklistId = normalizeText(
    body.dependencyChecklistId || body.dependencyTaskId || body.oldTaskNumber
  );
  const targetDayCount = parseOptionalNumber(
    body.targetDayCount ?? body.targetDays ?? body.targetDay
  );
  const startDate = parseDateInput(body.startDate);
  const scheduleTime = normalizeTimeInput(body.scheduleTime);
  const endDate = parseDateInput(body.endDate);
  const endTime = normalizeTimeInput(body.endTime);
  const customRepeatInterval = Math.max(1, Number(body.customRepeatInterval || 1) || 1);
  const customRepeatUnit = normalizeText(body.customRepeatUnit).toLowerCase() || "daily";
  const repeatDayOfMonth = Number(body.repeatDayOfMonth || 0) || null;
  const repeatDayOfWeek = getWeekDayLabel(body.repeatDayOfWeek);
  const repeatMonthOfYear = Number(body.repeatMonthOfYear || 0) || null;
  const checklistItems = parseChecklistItems(body.checklistItems);
  const normalizedRequesterSiteId = normalizeText(requesterSiteId);

  if (
    !checklistName ||
    !assignedToEmployee ||
    !employeeAssignedSite ||
    !scheduleType ||
    !startDate ||
    !scheduleTime ||
    !endDate ||
    !endTime
  ) {
    return {
      message:
        "Checklist name, assigned site, employee, schedule, start date, start time, end date, and end time are required",
      status: 400,
    };
  }

  if (!SCHEDULE_TYPES.includes(scheduleType)) {
    return { message: "Invalid schedule type", status: 400 };
  }

  if (!PRIORITY_LEVELS.includes(priority)) {
    return { message: "Invalid checklist priority", status: 400 };
  }

  if (isDependentTask && !dependencyChecklistId) {
    return {
      message: "Old Task Number / Previous Task Number is required when Dependent Task is Yes",
      status: 400,
    };
  }

  if (isDependentTask && (targetDayCount === null || targetDayCount <= 0)) {
    return {
      message: "Target Day Count is required and must be greater than 0",
      status: 400,
    };
  }

  if (dependencyChecklistId && !isValidObjectId(dependencyChecklistId)) {
    return { message: "Selected previous task is invalid", status: 400 };
  }

  if (
    isDependentTask &&
    currentChecklistId &&
    isValidObjectId(currentChecklistId) &&
    dependencyChecklistId === currentChecklistId
  ) {
    return { message: "The same task cannot depend on itself", status: 400 };
  }

  if (enableMark && (baseMark === null || baseMark < 0)) {
    return { message: "Base mark is required when task scoring is enabled", status: 400 };
  }

  if (enableMark && delayPenaltyPerDay !== null && delayPenaltyPerDay < 0) {
    return { message: "Delay penalty per day cannot be negative", status: 400 };
  }

  if (enableMark && advanceBonusPerDay !== null && advanceBonusPerDay < 0) {
    return { message: "Advance bonus per day cannot be negative", status: 400 };
  }

  if (
    scheduleType === "custom" &&
    (!CUSTOM_REPEAT_UNITS.includes(customRepeatUnit) || customRepeatInterval < 1)
  ) {
    return {
      message: "Custom schedule must include a valid repeat interval and unit",
      status: 400,
    };
  }

  if (scheduleType === "custom" && customRepeatUnit === "weekly" && !repeatDayOfWeek) {
    return {
      message: "Select a day of week for custom weekly schedule",
      status: 400,
    };
  }

  if (
    scheduleType === "custom" &&
    customRepeatUnit === "monthly" &&
    (!repeatDayOfMonth || repeatDayOfMonth < 1 || repeatDayOfMonth > 31)
  ) {
    return {
      message: "Select a valid day of month for custom monthly schedule",
      status: 400,
    };
  }

  if (
    scheduleType === "custom" &&
    customRepeatUnit === "yearly" &&
    (!repeatMonthOfYear ||
      repeatMonthOfYear < 1 ||
      repeatMonthOfYear > 12 ||
      !repeatDayOfMonth ||
      repeatDayOfMonth < 1 ||
      repeatDayOfMonth > 31)
  ) {
    return {
      message: "Select a valid month and day for custom yearly schedule",
      status: 400,
    };
  }

  const assignedEmployee = await Employee.findById(
    assignedToEmployee,
    "employeeCode employeeName superiorEmployee sites isActive"
  );

  if (!assignedEmployee || !assignedEmployee.isActive) {
    return { message: "Assigned employee is invalid or inactive", status: 400 };
  }

  if (!isValidObjectId(employeeAssignedSite)) {
    return { message: "Selected assigned site is invalid", status: 400 };
  }

  if (checklistSourceSite && !isValidObjectId(checklistSourceSite)) {
    return { message: "Selected checklist source site is invalid", status: 400 };
  }

  const [assignedSite, sourceSite, dependencyChecklist] = await Promise.all([
    Site.findById(employeeAssignedSite, "name companyName").lean(),
    checklistSourceSite
      ? Site.findById(checklistSourceSite, "name companyName").lean()
      : Promise.resolve(null),
    isDependentTask
      ? Checklist.findById(
          dependencyChecklistId,
          "checklistNumber checklistName employeeAssignedSite"
        ).lean()
      : Promise.resolve(null),
  ]);

  if (!assignedSite) {
    return { message: "Selected assigned site was not found", status: 400 };
  }

  if (checklistSourceSite && !sourceSite) {
    return { message: "Selected checklist source site was not found", status: 400 };
  }

  if (isDependentTask && !dependencyChecklist) {
    return { message: "Selected previous task was not found", status: 400 };
  }

  if (!employeeHasSite(assignedEmployee, employeeAssignedSite)) {
    return {
      message: "Selected employee is not mapped to the selected assigned site",
      status: 400,
    };
  }

  if (normalizedRequesterSiteId && String(employeeAssignedSite) !== normalizedRequesterSiteId) {
    return {
      message: "You can only create checklists for your assigned site",
      status: 403,
    };
  }

  if (
    normalizedRequesterSiteId &&
    isDependentTask &&
    String(dependencyChecklist?.employeeAssignedSite || "") !== normalizedRequesterSiteId
  ) {
    return {
      message: "You can only map dependent tasks within your assigned site",
      status: 403,
    };
  }

  const approvalResult = await resolveApprovalRows({
    assignedEmployee,
    approvalHierarchy: body.approvalHierarchy,
    approvals: body.approvals,
  });

  if (approvalResult.message) {
    return approvalResult;
  }

  const checklistNumber =
    normalizeText(body.checklistNumber) ||
    (await getNextChecklistNumberValue(employeeAssignedSite));

  if (!checklistNumber) {
    return { message: "Failed to generate checklist number", status: 400 };
  }

  const scheduledStart = combineDateAndTime(startDate, scheduleTime);
  const scheduledEnd = combineDateAndTime(endDate, endTime);

  if (!scheduledStart || !scheduledEnd || scheduledEnd <= scheduledStart) {
    return {
      message: "End date and end time must be later than start date and start task time",
      status: 400,
    };
  }

  const repeatSummary = buildRepeatSummary({
    scheduleType,
    startDate: scheduledStart,
    customRepeatInterval,
    customRepeatUnit,
    repeatDayOfMonth,
    repeatDayOfWeek,
    repeatMonthOfYear,
  });

  return {
    payload: {
      checklistNumber,
      checklistName,
      checklistMark: 1,
      enableMark,
      baseMark: enableMark ? roundMarkValue(baseMark) : null,
      delayPenaltyPerDay: enableMark
        ? roundMarkValue(delayPenaltyPerDay ?? 0.5)
        : null,
      advanceBonusPerDay: enableMark
        ? roundMarkValue(advanceBonusPerDay ?? 0.5)
        : null,
      checklistSourceSite: checklistSourceSite || null,
      assignedToEmployee,
      employeeAssignedSite: employeeAssignedSite || null,
      scheduleType,
      priority,
      isDependentTask,
      dependencyChecklistId: isDependentTask ? dependencyChecklist._id : null,
      dependencyTaskNumber: isDependentTask
        ? normalizeText(dependencyChecklist?.checklistNumber)
        : "",
      targetDayCount: isDependentTask ? roundMarkValue(targetDayCount) : null,
      startDate: scheduledStart,
      scheduleTime,
      endDate: scheduledEnd,
      endTime,
      customRepeatInterval: scheduleType === "custom" ? customRepeatInterval : 1,
      customRepeatUnit: scheduleType === "custom" ? customRepeatUnit : "daily",
      repeatDayOfMonth:
        scheduleType === "custom" && ["monthly", "yearly"].includes(customRepeatUnit)
          ? repeatDayOfMonth
          : null,
      repeatDayOfWeek:
        scheduleType === "custom" && customRepeatUnit === "weekly" ? repeatDayOfWeek : "",
      repeatMonthOfYear:
        scheduleType === "custom" && customRepeatUnit === "yearly" ? repeatMonthOfYear : null,
      repeatSummary,
      checklistItems,
      approvalHierarchy: approvalResult.approvalHierarchy,
      approvals: approvalResult.approvals,
    },
  };
};

const createChecklistTask = async (checklist, occurrenceDate) => {
  if (parseBoolean(checklist?.isDependentTask, false)) {
    return 0;
  }

  const endDateTime = buildTaskEndDateTime(checklist, occurrenceDate);
  const markConfig = resolveMarkConfig(checklist);
  const dependencyState = await buildTaskDependencyState({
    checklist,
    occurrenceDate,
  });
  const taskPayload = {
    taskNumber: buildTaskNumber(checklist.checklistNumber, occurrenceDate),
    checklist: checklist._id,
    checklistNumber: checklist.checklistNumber,
    checklistName: checklist.checklistName,
    scheduleType: checklist.scheduleType,
    repeatSummary: checklist.repeatSummary || "",
    priority: checklist.priority || "medium",
    occurrenceDate,
    occurrenceKey: buildOccurrenceKey(occurrenceDate),
    endDateTime,
    enableMark: markConfig.enableMark,
    baseMark: markConfig.baseMark,
    delayPenaltyPerDay: markConfig.delayPenaltyPerDay,
    advanceBonusPerDay: markConfig.advanceBonusPerDay,
    finalMark: null,
    approvalType: "normal",
    isNilApproval: false,
    assignedEmployee: checklist.assignedToEmployee,
    currentApprovalEmployee: null,
    isDependentTask: dependencyState.isDependentTask,
    dependencyChecklistId: dependencyState.dependencyChecklistId,
    dependencyChecklistNumber: dependencyState.dependencyChecklistNumber,
    dependencyTaskId: dependencyState.dependencyTaskId,
    dependencyTaskNumber: dependencyState.dependencyTaskNumber,
    targetDayCount: null,
    dependencyCompletedAt: null,
    dependencyTargetDateTime: null,
    autoCreatedFromDependency: false,
    dependencyTriggeredAt: null,
    dependencyStatus: dependencyState.dependencyStatus,
    unlockedAt: dependencyState.unlockedAt,
    status: dependencyState.status,
    checklistItems: buildTaskItemsFromChecklist(checklist),
    employeeRemarks: "",
    employeeAttachments: [],
    submittedAt: null,
    timelinessStatus: "pending",
    submissionTimingStatus: "pending",
    approvalSteps: buildApprovalStepsFromChecklist(checklist),
    completedAt: null,
  };

  try {
    await ChecklistTask.create(taskPayload);
    return 1;
  } catch (err) {
    if (err?.code === 11000) return 0;
    throw err;
  }
};

const syncChecklistTaskDependencies = async ({
  checklistIds = [],
  dependencyChecklistIds = [],
} = {}) => {
  const normalizedChecklistIds = normalizeIdList(checklistIds);
  const normalizedDependencyChecklistIds = normalizeIdList(dependencyChecklistIds);
  const filter = {
    status: { $in: ["open", "waiting_dependency"] },
  };

  if (!normalizedChecklistIds.length && !normalizedDependencyChecklistIds.length) {
    return { updated: 0 };
  }

  filter.$or = [];

  if (normalizedChecklistIds.length) {
    filter.$or.push({ checklist: { $in: normalizedChecklistIds } });
  }

  if (normalizedDependencyChecklistIds.length) {
    filter.$or.push({ dependencyChecklistId: { $in: normalizedDependencyChecklistIds } });
  }

  const tasks = await ChecklistTask.find(
    filter,
    [
      "_id",
      "checklist",
      "occurrenceDate",
      "status",
      "isDependentTask",
      "dependencyChecklistId",
      "dependencyChecklistNumber",
      "dependencyTaskId",
      "dependencyTaskNumber",
      "dependencyStatus",
      "unlockedAt",
    ].join(" ")
  );

  if (!tasks.length) {
    return { updated: 0 };
  }

  const checklistMap = new Map();
  const taskChecklistIds = [
    ...new Set(
      tasks.map((task) => normalizeText(task.checklist)).filter(Boolean)
    ),
  ];

  if (taskChecklistIds.length) {
    const checklistRows = await Checklist.find(
      { _id: { $in: taskChecklistIds } },
      "_id isDependentTask dependencyChecklistId dependencyTaskNumber"
    ).lean();

    checklistRows.forEach((checklist) => {
      checklistMap.set(normalizeText(checklist._id), checklist);
    });
  }

  let updated = 0;

  for (const task of tasks) {
    const checklist = checklistMap.get(normalizeText(task.checklist));
    if (!checklist) continue;

    const dependencyState = await buildTaskDependencyState({
      checklist,
      occurrenceDate: task.occurrenceDate,
      existingTask: task,
    });

    const currentDependencyChecklistId = normalizeText(task.dependencyChecklistId);
    const currentDependencyTaskId = normalizeText(task.dependencyTaskId);
    const nextDependencyChecklistId = normalizeText(dependencyState.dependencyChecklistId);
    const nextDependencyTaskId = normalizeText(dependencyState.dependencyTaskId);
    const shouldUpdate =
      task.isDependentTask !== dependencyState.isDependentTask ||
      currentDependencyChecklistId !== nextDependencyChecklistId ||
      normalizeText(task.dependencyChecklistNumber) !==
        normalizeText(dependencyState.dependencyChecklistNumber) ||
      currentDependencyTaskId !== nextDependencyTaskId ||
      normalizeText(task.dependencyTaskNumber) !==
        normalizeText(dependencyState.dependencyTaskNumber) ||
      normalizeText(task.dependencyStatus) !==
        normalizeText(dependencyState.dependencyStatus) ||
      normalizeText(task.status) !== normalizeText(dependencyState.status) ||
      Boolean(task.unlockedAt) !== Boolean(dependencyState.unlockedAt);

    if (!shouldUpdate) continue;

    applyTaskDependencyState(task, dependencyState);
    await task.save();
    updated += 1;
  }

  return { updated };
};

const runChecklistScheduler = async ({ checklistIds = [] } = {}) => {
  if (schedulerInFlight) {
    return { processed: 0, created: 0, skipped: true };
  }

  schedulerInFlight = true;

  try {
    const now = new Date();
    await processTemporaryChecklistTransfers(now);

    const filter = {
      status: true,
      isDependentTask: { $ne: true },
      scheduleType: { $in: SCHEDULE_TYPES },
      startDate: { $ne: null },
      scheduleTime: { $ne: "" },
    };

    if (Array.isArray(checklistIds) && checklistIds.length) {
      filter._id = { $in: checklistIds };
    }

    const checklists = await Checklist.find(filter);
    let created = 0;

    for (const checklist of checklists) {
      const { occurrences, nextOccurrenceAt } = getPendingOccurrences(checklist, now);

      for (const occurrenceDate of occurrences) {
        created += await createChecklistTask(checklist, occurrenceDate);
      }

      const firstOccurrence = getFirstOccurrence(checklist);
      const updatedNextOccurrenceAt = nextOccurrenceAt || firstOccurrence;

      if (occurrences.length) {
        checklist.lastGeneratedAt = occurrences[occurrences.length - 1];
      }

      checklist.nextOccurrenceAt = updatedNextOccurrenceAt;
      await checklist.save();
    }

    await syncChecklistTaskDependencies({
      checklistIds: checklists.map((checklist) => checklist._id),
      dependencyChecklistIds: checklists.map((checklist) => checklist._id),
    });

    const dependencySchedulerResult = await runDependentChecklistScheduler({
      checklistIds,
      dependencyChecklistIds: checklistIds,
    });

    return {
      processed: checklists.length + Number(dependencySchedulerResult?.processed || 0),
      created: created + Number(dependencySchedulerResult?.created || 0),
      skipped: false,
    };
  } finally {
    schedulerInFlight = false;
  }
};

const startChecklistScheduler = () => {
  if (schedulerTimer) return;

  void runChecklistScheduler();

  schedulerTimer = setInterval(() => {
    void runChecklistScheduler();
  }, schedulerIntervalMs);
};

const stopChecklistScheduler = () => {
  if (!schedulerTimer) return;
  clearInterval(schedulerTimer);
  schedulerTimer = null;
};

const parseTaskItemResponses = (rawValue) =>
  parseJsonArray(rawValue).map((item) => ({
    checklistItemId: normalizeText(item?.checklistItemId || item?.id),
    verified: parseBoolean(item?.verified, false),
    employeeAnswerRemark: normalizeText(
      item?.employeeAnswerRemark || item?.answer || item?.remarks || item?.response
    ),
    superiorAnswerRemark: normalizeText(
      item?.superiorAnswerRemark ||
        item?.superiorAnswer ||
        item?.headAnswerRemark ||
        item?.headAnswer ||
        item?.superiorRemark
    ),
  }));

const toPlainObject = (value) =>
  value && typeof value.toObject === "function" ? value.toObject() : { ...(value || {}) };

const buildTaskItemHistorySnapshot = (items = []) =>
  (Array.isArray(items) ? items : []).map((item) => {
    const plainItem = toPlainObject(item);

    return {
      checklistItemId: normalizeText(plainItem.checklistItemId || plainItem._id),
      label: normalizeText(plainItem.label),
      employeeAnswerRemark: normalizeText(
        plainItem.employeeAnswerRemark || plainItem.answer || plainItem.remarks
      ),
      superiorAnswerRemark: normalizeText(plainItem.superiorAnswerRemark),
    };
  });

const appendTaskApprovalHistory = (task, entry = {}) => {
  const existingHistory = Array.isArray(task.approvalHistory)
    ? task.approvalHistory.map((historyEntry) => toPlainObject(historyEntry))
    : [];

  task.approvalHistory = [
    ...existingHistory,
    {
      action: entry.action,
      approvalType: normalizeApprovalType(entry.approvalType || task.approvalType),
      status: normalizeText(entry.status || task.status),
      actorEmployee: entry.actorEmployee || null,
      approverEmployee: entry.approverEmployee || null,
      approvalLevel: entry.approvalLevel || null,
      remarks: normalizeText(entry.remarks),
      actedAt: entry.actedAt || new Date(),
      itemResponses: buildTaskItemHistorySnapshot(entry.itemResponses || task.checklistItems),
    },
  ];
};

const applyTaskSubmission = ({ task, body, files = [] }) => {
  const wasRejected = normalizeText(task?.status).toLowerCase() === "rejected";
  const submissionType = normalizeApprovalType(body?.submissionType || body?.approvalType);
  const responses = parseTaskItemResponses(body.itemResponses);
  const responseMap = new Map(
    responses
      .filter((item) => item.checklistItemId)
      .map((item) => [String(item.checklistItemId), item])
  );

  const nextItems = task.checklistItems.map((item) => {
    const response = responseMap.get(String(item.checklistItemId || item._id)) || {};
    const employeeAnswerRemark = response.employeeAnswerRemark || "";
    const legacyEmployeeAnswer = normalizeText(
      item.employeeAnswerRemark || item.answer || item.remarks
    );
    const resolvedEmployeeAnswer = employeeAnswerRemark || legacyEmployeeAnswer;

    return {
      ...item.toObject(),
      answer: resolvedEmployeeAnswer,
      employeeAnswerRemark: resolvedEmployeeAnswer,
      superiorAnswerRemark: wasRejected ? "" : normalizeText(item.superiorAnswerRemark),
      verified: resolvedEmployeeAnswer ? true : response.verified === true,
      remarks: resolvedEmployeeAnswer,
    };
  });

  const missingRequiredItem = nextItems.find(
    (item) =>
      item.isRequired &&
      !normalizeText(item.employeeAnswerRemark || item.answer || item.remarks)
  );

  if (missingRequiredItem) {
    return {
      message: `Required question "${missingRequiredItem.label}" must be answered before submission`,
      status: 400,
    };
  }

  const approvalSteps = Array.isArray(task.approvalSteps) ? task.approvalSteps : [];
  const nextApprovalSteps = wasRejected
    ? approvalSteps.map((step) => ({
        ...toPlainObject(step),
        status: "waiting",
        remarks: "",
        actedAt: null,
      }))
    : approvalSteps.map((step) => toPlainObject(step));
  const firstPendingStepIndex = nextApprovalSteps.findIndex(
    (step) => step.status === "waiting"
  );

  if (firstPendingStepIndex === -1) {
    return {
      message: "Approval workflow mapping is not configured for this checklist",
      status: 400,
    };
  }

  task.checklistItems = nextItems;
  task.employeeRemarks = normalizeText(body.employeeRemarks);
  const uploadedAttachments = (files || []).map((file) => ({
    fileName: file.filename,
    originalName: file.originalname,
    filePath: file.filename ? `/uploads/${file.filename}` : "",
    mimeType: normalizeText(file.mimetype),
    size: Number(file.size || 0),
  }));
  task.employeeAttachments = wasRejected
    ? [
        ...(Array.isArray(task.employeeAttachments)
          ? task.employeeAttachments.map((file) => toPlainObject(file))
          : []),
        ...uploadedAttachments,
      ]
    : uploadedAttachments;
  task.submittedAt = new Date();
  if (wasRejected) {
    task.resubmittedAt = task.submittedAt;
  }
  task.rejectedBy = null;
  task.rejectedAt = null;
  task.rejectionRemarks = "";
  task.approvedBy = null;
  task.approvedAt = null;
  task.completedAt = null;
  task.submissionTimingStatus = getSubmissionTimingStatus({
    submittedAt: task.submittedAt,
    dependencyTargetDateTime: task.dependencyTargetDateTime,
    endDateTime: task.endDateTime,
  });
  task.timelinessStatus = getTaskTimelinessStatus({
    submittedAt: task.submittedAt,
    dependencyTargetDateTime: task.dependencyTargetDateTime,
    endDateTime: task.endDateTime,
  });

  if (submissionType === "nil") {
    applyNilTaskMarkState(task);
    task.status = "nil_for_approval";
  } else {
    const markConfig = resolveMarkConfig(task);
    const markResult = calculateTaskMark({
      submittedAt: task.submittedAt,
      dependencyTargetDateTime: task.dependencyTargetDateTime,
      endDateTime: task.endDateTime,
      ...markConfig,
    });

    task.approvalType = "normal";
    task.isNilApproval = false;
    task.enableMark = markConfig.enableMark;
    task.baseMark = markConfig.baseMark;
    task.delayPenaltyPerDay = markConfig.delayPenaltyPerDay;
    task.advanceBonusPerDay = markConfig.advanceBonusPerDay;
    task.finalMark = markResult.finalMark;
    task.status = "submitted";
  }

  task.currentApprovalEmployee = nextApprovalSteps[firstPendingStepIndex].approverEmployee;
  task.approvalSteps = nextApprovalSteps.map((step, index) => ({
    ...step,
    status: index === firstPendingStepIndex ? "pending" : step.status,
  }));
  appendTaskApprovalHistory(task, {
    action: wasRejected ? "resubmitted" : "submitted",
    actorEmployee: task.assignedEmployee,
    status: task.status,
    approvalType: task.approvalType,
    actedAt: task.submittedAt,
    itemResponses: task.checklistItems,
  });

  return { payload: task, wasResubmission: wasRejected };
};

const canAccessChecklistTask = (task, user) => {
  if (isAdminRequester(user)) return true;

  const requesterId = normalizeText(user?.id);
  if (!requesterId) return false;

  if (String(task.assignedEmployee?._id || task.assignedEmployee) === requesterId) {
    return true;
  }

  if (
    String(task.currentApprovalEmployee?._id || task.currentApprovalEmployee) ===
    requesterId
  ) {
    return true;
  }

  return (task.approvalSteps || []).some((step) => {
    const approverId = String(step.approverEmployee?._id || step.approverEmployee);
    return approverId === requesterId && step.status !== "waiting";
  });
};

const applyChecklistDecision = ({ task, action, remarks, itemResponses }) => {
  const normalizedAction = normalizeText(action).toLowerCase();
  const normalizedRemarks = normalizeText(remarks);
  const taskIsNil = isNilChecklistTask(task);
  const allowedActions = taskIsNil
    ? ["nil_approve", "reject"]
    : ["approve", "reject"];

  if (!allowedActions.includes(normalizedAction)) {
    return {
      message: taskIsNil
        ? "Nil approval tasks can only be nil approved or rejected"
        : "Normal approval tasks can only be approved or rejected",
      status: 400,
    };
  }

  if (normalizedAction === "reject" && !normalizedRemarks) {
    return {
      message: "Rejection remark is required",
      status: 400,
    };
  }

  const currentStepIndex = task.approvalSteps.findIndex(
    (step) => step.status === "pending"
  );

  if (currentStepIndex === -1) {
    return { message: "No pending approval step found for this checklist", status: 400 };
  }

  const responses = parseTaskItemResponses(itemResponses);
  const responseMap = new Map(
    responses
      .filter((item) => item.checklistItemId)
      .map((item) => [String(item.checklistItemId), item])
  );

  const nextItems = task.checklistItems.map((item) => {
    const response = responseMap.get(String(item.checklistItemId || item._id)) || {};
    const superiorAnswerRemark = response.superiorAnswerRemark || "";
    const legacySuperiorAnswer = normalizeText(item.superiorAnswerRemark);
    const resolvedSuperiorAnswer = superiorAnswerRemark || legacySuperiorAnswer;
    const employeeAnswerRemark = normalizeText(
      item.employeeAnswerRemark || item.answer || item.remarks
    );

    return {
      ...item.toObject(),
      answer: employeeAnswerRemark,
      employeeAnswerRemark,
      superiorAnswerRemark: resolvedSuperiorAnswer,
      remarks: employeeAnswerRemark,
    };
  });

  const missingRequiredItem = nextItems.find(
    (item) => item.isRequired && !normalizeText(item.superiorAnswerRemark)
  );

  if (normalizedAction !== "reject" && missingRequiredItem) {
    return {
      message: `Required question "${missingRequiredItem.label}" must include the superior answer or remark before approval action`,
      status: 400,
    };
  }

  task.checklistItems = nextItems;

  const now = new Date();
  const nextSteps = task.approvalSteps.map((step, index) => {
    if (index !== currentStepIndex) return toPlainObject(step);

    return {
      ...toPlainObject(step),
      status: normalizedAction === "reject" ? "rejected" : "approved",
      remarks: normalizedRemarks,
      actedAt: now,
    };
  });

  task.approvalSteps = nextSteps;

  if (normalizedAction === "reject") {
    if (taskIsNil) {
      applyNilTaskMarkState(task);
    }

    task.status = "rejected";
    task.rejectedBy = task.currentApprovalEmployee || nextSteps[currentStepIndex]?.approverEmployee || null;
    task.rejectedAt = now;
    task.rejectionRemarks = normalizedRemarks;
    task.currentApprovalEmployee = null;
    task.completedAt = null;
    appendTaskApprovalHistory(task, {
      action: "rejected",
      actorEmployee: task.rejectedBy,
      approverEmployee: nextSteps[currentStepIndex]?.approverEmployee,
      approvalLevel: nextSteps[currentStepIndex]?.approvalLevel,
      remarks: normalizedRemarks,
      status: task.status,
      approvalType: task.approvalType,
      actedAt: now,
      itemResponses: task.checklistItems,
    });
    return { payload: task };
  }

  if (normalizedAction === "nil_approve") {
    applyNilTaskMarkState(task);
  }

  const nextWaitingStep = nextSteps.find((step) => step.status === "waiting");

  if (nextWaitingStep) {
    task.approvalSteps = nextSteps.map((step) => ({
      ...step,
      status:
        step.approvalLevel === nextWaitingStep.approvalLevel ? "pending" : step.status,
    }));
    task.currentApprovalEmployee = nextWaitingStep.approverEmployee;
    task.status = taskIsNil || normalizedAction === "nil_approve"
      ? "nil_for_approval"
      : "submitted";
    task.completedAt = null;
    appendTaskApprovalHistory(task, {
      action: normalizedAction === "nil_approve" ? "nil_approved" : "approved",
      actorEmployee: nextSteps[currentStepIndex]?.approverEmployee,
      approverEmployee: nextSteps[currentStepIndex]?.approverEmployee,
      approvalLevel: nextSteps[currentStepIndex]?.approvalLevel,
      remarks: normalizedRemarks,
      status: task.status,
      approvalType: task.approvalType,
      actedAt: now,
      itemResponses: task.checklistItems,
    });
    return { payload: task };
  }

  task.status =
    taskIsNil || normalizedAction === "nil_approve" ? "nil_approved" : "approved";
  task.currentApprovalEmployee = null;
  task.approvedBy = nextSteps[currentStepIndex]?.approverEmployee || null;
  task.approvedAt = now;
  task.completedAt = now;
  appendTaskApprovalHistory(task, {
    action: task.status === "nil_approved" ? "nil_approved" : "approved",
    actorEmployee: task.approvedBy,
    approverEmployee: nextSteps[currentStepIndex]?.approverEmployee,
    approvalLevel: nextSteps[currentStepIndex]?.approvalLevel,
    remarks: normalizedRemarks,
    status: task.status,
    approvalType: task.approvalType,
    actedAt: now,
    itemResponses: task.checklistItems,
  });
  return { payload: task };
};

module.exports = {
  APPROVAL_STEP_STATUSES,
  SCHEDULE_TYPES,
  TASK_STATUSES,
  TASK_TIMELINESS_STATUSES,
  applyChecklistDecision,
  applyTaskSubmission,
  buildArchivedChecklistNumber,
  buildTaskNumber,
  canAccessChecklistTask,
  checklistPopulateQuery,
  checklistTaskPopulateQuery,
  formatTimeLabel,
  getRestrictedChecklistSiteId,
  getNextChecklistNumberValue,
  hasChecklistMasterAccess,
  isAdminRequester,
  isEmployeeRequester,
  isValidObjectId,
  calculateTaskMark,
  parseDateBoundary,
  getDependencyBlockedMessage,
  resolveMarkConfig,
  runDependentChecklistScheduler,
  runChecklistScheduler,
  releaseSoftDeletedChecklistNumber,
  syncChecklistTaskDependencies,
  startChecklistScheduler,
  stopChecklistScheduler,
  validateChecklistPayload,
};
