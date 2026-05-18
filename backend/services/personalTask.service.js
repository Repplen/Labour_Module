const Employee = require("../models/Employee");
const PersonalTask = require("../models/PersonalTask");
const { Types } = require("mongoose");

const PERSONAL_TASK_STATUSES = ["pending", "completed"];
const PERSONAL_TASK_REMINDER_TYPES = ["one_time", "daily", "weekly", "monthly"];
const DEFAULT_NOTIFICATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MINUTES = 330;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const schedulerIntervalMs = 60 * 1000;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

let schedulerTimer = null;
let schedulerInFlight = false;

const normalizeText = (value) => String(value || "").trim();
const normalizeId = (value) => String(value?._id || value || "").trim();
const isValidObjectId = (value) => Types.ObjectId.isValid(String(value || "").trim());
const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pad = (value) => String(value).padStart(2, "0");

const getRequesterRole = (user) =>
  String(user?.role || "")
    .trim()
    .toLowerCase();

const isEmployeeRequester = (user) => getRequesterRole(user) === "employee";

const formatEmployeeDisplayName = (employee) => {
  const employeeCode = normalizeText(employee?.employeeCode);
  const employeeName = normalizeText(employee?.employeeName);

  if (employeeCode && employeeName) {
    return `${employeeCode} - ${employeeName}`;
  }

  return employeeCode || employeeName;
};

const mapEmployeeSummary = (employee) => {
  if (!employee) return null;

  return {
    _id: normalizeId(employee),
    employeeCode: normalizeText(employee?.employeeCode),
    employeeName: normalizeText(employee?.employeeName),
    email: normalizeText(employee?.email),
    displayName: formatEmployeeDisplayName(employee),
  };
};

const mapShareableEmployee = (employee) => ({
  _id: normalizeId(employee),
  employeeCode: normalizeText(employee?.employeeCode),
  employeeName: normalizeText(employee?.employeeName),
  email: normalizeText(employee?.email),
  displayName:
    normalizeText(employee?.employeeCode) && normalizeText(employee?.employeeName)
      ? `${normalizeText(employee.employeeCode)} - ${normalizeText(employee.employeeName)}`
      : normalizeText(employee?.employeeCode) || normalizeText(employee?.employeeName),
});

const getCreatorEmployee = (task) => task?.employee || null;
const getAssignedEmployee = (task) => task?.assignedEmployee || task?.employee || null;
const getCompletedByEmployee = (task) => task?.completedBy || null;

const getCreatorEmployeeId = (task) => normalizeId(getCreatorEmployee(task));
const getAssignedEmployeeId = (task) => normalizeId(getAssignedEmployee(task));

const isTaskCreatedByEmployee = (task, employeeId) =>
  normalizeId(employeeId) && getCreatorEmployeeId(task) === normalizeId(employeeId);

const isTaskAssignedToEmployee = (task, employeeId) =>
  normalizeId(employeeId) && getAssignedEmployeeId(task) === normalizeId(employeeId);

const parseDateInput = (value) => {
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

  return {
    year,
    monthIndex: month - 1,
    day,
  };
};

const normalizeTimeInput = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return "";

  const directMatch = normalized.match(timePattern);
  if (directMatch) {
    return `${directMatch[1]}:${directMatch[2]}`;
  }

  const twelveHourMatch = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
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

const combineDateAndTime = (dateValue, timeValue) => {
  const date = parseDateInput(dateValue);
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

const getDaysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

const buildAnchoredDate = ({
  year,
  monthIndex,
  dayOfMonth,
  hours = 0,
  minutes = 0,
}) => {
  const safeDay = Math.min(Math.max(1, Number(dayOfMonth) || 1), getDaysInMonth(year, monthIndex));

  return buildIstDateTime({
    year,
    monthIndex,
    day: safeDay,
    hours,
    minutes,
  });
};

const parseWeekDayInput = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue) || parsedValue < 0 || parsedValue > 6) {
    return null;
  }

  return parsedValue;
};

const parseMonthDayInput = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 31) {
    return null;
  }

  return parsedValue;
};

const getFirstReminderAt = ({
  reminderType,
  scheduledStart,
  weeklyDayOfWeek,
  monthlyDayOfMonth,
}) => {
  const normalizedReminderType = normalizeText(reminderType).toLowerCase() || "one_time";
  const startValue = scheduledStart ? new Date(scheduledStart) : null;

  if (!startValue || Number.isNaN(startValue.getTime())) {
    return null;
  }

  if (normalizedReminderType === "weekly") {
    const startParts = getIstDateParts(startValue);
    const targetDayOfWeek =
      parseWeekDayInput(weeklyDayOfWeek) ?? startParts.dayOfWeek;
    const dayOffset = (targetDayOfWeek - startParts.dayOfWeek + 7) % 7;

    return new Date(startValue.getTime() + dayOffset * DAY_IN_MS);
  }

  if (normalizedReminderType === "monthly") {
    const startParts = getIstDateParts(startValue);
    const targetDayOfMonth =
      parseMonthDayInput(monthlyDayOfMonth) ?? startParts.day;
    let occurrence = buildAnchoredDate({
      year: startParts.year,
      monthIndex: startParts.monthIndex,
      dayOfMonth: targetDayOfMonth,
      hours: startParts.hours,
      minutes: startParts.minutes,
    });

    if (occurrence.getTime() < startValue.getTime()) {
      let nextMonthIndex = startParts.monthIndex + 1;
      let nextYear = startParts.year;

      if (nextMonthIndex > 11) {
        nextMonthIndex = 0;
        nextYear += 1;
      }

      occurrence = buildAnchoredDate({
        year: nextYear,
        monthIndex: nextMonthIndex,
        dayOfMonth: targetDayOfMonth,
        hours: startParts.hours,
        minutes: startParts.minutes,
      });
    }

    return occurrence;
  }

  return startValue;
};

const getNextReminderAt = (task, currentOccurrence) => {
  const reminderType = normalizeText(task?.reminderType).toLowerCase() || "one_time";
  const currentValue = currentOccurrence ? new Date(currentOccurrence) : null;

  if (!currentValue || Number.isNaN(currentValue.getTime())) {
    return null;
  }

  if (reminderType === "one_time") {
    return null;
  }

  if (reminderType === "daily") {
    return new Date(currentValue.getTime() + DAY_IN_MS);
  }

  if (reminderType === "weekly") {
    return new Date(currentValue.getTime() + 7 * DAY_IN_MS);
  }

  if (reminderType === "monthly") {
    const anchorParts = getIstDateParts(task?.scheduledAt || currentValue);
    const currentParts = getIstDateParts(currentValue);
    const targetDayOfMonth = parseMonthDayInput(task?.monthlyDayOfMonth) ?? anchorParts.day;
    let nextMonthIndex = currentParts.monthIndex + 1;
    let nextYear = currentParts.year;

    if (nextMonthIndex > 11) {
      nextMonthIndex = 0;
      nextYear += 1;
    }

    return buildAnchoredDate({
      year: nextYear,
      monthIndex: nextMonthIndex,
      dayOfMonth: targetDayOfMonth,
      hours: anchorParts.hours,
      minutes: anchorParts.minutes,
    });
  }

  return null;
};

const advanceReminderUntilFuture = (task, now = new Date()) => {
  const startingPoint = task?.nextReminderAt || task?.scheduledAt;
  let currentOccurrence = startingPoint ? new Date(startingPoint) : null;
  let lastTriggeredAt = null;

  while (currentOccurrence && currentOccurrence.getTime() <= now.getTime()) {
    lastTriggeredAt = new Date(currentOccurrence);
    currentOccurrence = getNextReminderAt(task, currentOccurrence);
  }

  return {
    lastTriggeredAt,
    nextReminderAt: currentOccurrence,
  };
};

const getPersonalTaskNotificationState = (
  task,
  now = new Date(),
  upcomingWindowMs = DEFAULT_NOTIFICATION_WINDOW_MS,
  viewerEmployeeId = ""
) => {
  const status = normalizeText(task?.status).toLowerCase();
  const normalizedViewerEmployeeId = normalizeId(viewerEmployeeId);
  const isAssignedViewer =
    !normalizedViewerEmployeeId ||
    isTaskAssignedToEmployee(task, normalizedViewerEmployeeId);
  const lastTriggeredAt = task?.lastTriggeredAt ? new Date(task.lastTriggeredAt) : null;
  const lastNotificationReadAt = task?.lastNotificationReadAt
    ? new Date(task.lastNotificationReadAt)
    : null;
  const nextReminderAt = task?.nextReminderAt ? new Date(task.nextReminderAt) : null;
  const isPending = status === "pending";
  const hasUnreadNotification =
    isAssignedViewer &&
    isPending &&
    !!lastTriggeredAt &&
    (!lastNotificationReadAt ||
      lastNotificationReadAt.getTime() < lastTriggeredAt.getTime());
  const isUpcoming =
    isAssignedViewer &&
    isPending &&
    !!nextReminderAt &&
    nextReminderAt.getTime() > now.getTime() &&
    nextReminderAt.getTime() <= now.getTime() + upcomingWindowMs;

  return {
    hasUnreadNotification,
    isUpcoming,
    state: hasUnreadNotification ? "due" : isUpcoming ? "upcoming" : "none",
    notificationAt: hasUnreadNotification
      ? lastTriggeredAt
      : isUpcoming
      ? nextReminderAt
      : null,
  };
};

const mapPersonalTaskForResponse = (
  task,
  {
    now = new Date(),
    upcomingWindowMs = DEFAULT_NOTIFICATION_WINDOW_MS,
    viewerEmployeeId = "",
  } = {}
) => {
  const taskValue = task?.toObject ? task.toObject() : task;
  const creator = mapEmployeeSummary(getCreatorEmployee(taskValue));
  const assignedEmployee = mapEmployeeSummary(getAssignedEmployee(taskValue));
  const completedBy = mapEmployeeSummary(getCompletedByEmployee(taskValue));
  const normalizedViewerEmployeeId = normalizeId(viewerEmployeeId);
  const isSharedTask =
    Boolean(creator?._id) &&
    Boolean(assignedEmployee?._id) &&
    creator._id !== assignedEmployee._id;
  const viewerRelationship =
    normalizedViewerEmployeeId &&
    creator?._id === normalizedViewerEmployeeId &&
    assignedEmployee?._id === normalizedViewerEmployeeId
      ? "own"
      : normalizedViewerEmployeeId && creator?._id === normalizedViewerEmployeeId
      ? "creator"
      : normalizedViewerEmployeeId && assignedEmployee?._id === normalizedViewerEmployeeId
      ? "assignee"
      : "viewer";
  const notificationState = getPersonalTaskNotificationState(
    taskValue,
    now,
    upcomingWindowMs,
    viewerEmployeeId
  );

  return {
    ...taskValue,
    creator,
    assignedEmployee,
    completedBy,
    creatorId: creator?._id || "",
    assignedEmployeeId: assignedEmployee?._id || "",
    completedById: completedBy?._id || "",
    sharedByName: creator?.employeeName || "",
    assignedEmployeeName: assignedEmployee?.employeeName || "",
    completedByName: completedBy?.employeeName || "",
    isSharedTask,
    viewerRelationship,
    canShare: viewerRelationship === "own" || viewerRelationship === "creator",
    canComplete: viewerRelationship === "own" || viewerRelationship === "assignee",
    notificationState: notificationState.state,
    hasUnreadNotification: notificationState.hasUnreadNotification,
    isUpcomingNotification: notificationState.isUpcoming,
    notificationAt: notificationState.notificationAt,
  };
};

const populatePersonalTaskQuery = (query) =>
  query
    .populate("employee", "employeeCode employeeName email")
    .populate("assignedEmployee", "employeeCode employeeName email")
    .populate("completedBy", "employeeCode employeeName email");

const buildVisibleTaskFilter = (employeeId) => ({
  $or: [{ employee: employeeId }, { assignedEmployee: employeeId }],
});

const buildAssignedTaskFilter = (employeeId) => ({
  $or: [
    { assignedEmployee: employeeId },
    { assignedEmployee: null, employee: employeeId },
  ],
});

const getNotificationUrgencyRank = (task) => {
  if (task.notificationState === "due") return 0;
  if (task.notificationState === "upcoming") return 1;
  return 2;
};

const sortTasksForList = (rows = []) =>
  [...rows].sort((leftTask, rightTask) => {
    const leftStatusRank = leftTask.status === "pending" ? 0 : 1;
    const rightStatusRank = rightTask.status === "pending" ? 0 : 1;

    if (leftStatusRank !== rightStatusRank) {
      return leftStatusRank - rightStatusRank;
    }

    if (leftTask.status === "pending") {
      const leftUrgency = getNotificationUrgencyRank(leftTask);
      const rightUrgency = getNotificationUrgencyRank(rightTask);

      if (leftUrgency !== rightUrgency) {
        return leftUrgency - rightUrgency;
      }
    }

    const leftTime = new Date(
      leftTask.nextReminderAt ||
        leftTask.lastTriggeredAt ||
        leftTask.scheduledAt ||
        leftTask.createdAt ||
        0
    ).getTime();
    const rightTime = new Date(
      rightTask.nextReminderAt ||
        rightTask.lastTriggeredAt ||
        rightTask.scheduledAt ||
        rightTask.createdAt ||
        0
    ).getTime();

    if (leftTask.status === "pending") {
      return leftTime - rightTime;
    }

    return rightTime - leftTime;
  });

const findVisibleTaskById = async (taskId, employeeId) => {
  if (!isValidObjectId(taskId)) return null;

  return populatePersonalTaskQuery(
    PersonalTask.findOne({
      _id: taskId,
      ...buildVisibleTaskFilter(employeeId),
    })
  );
};

const findCreatorTaskById = async (taskId, employeeId) => {
  if (!isValidObjectId(taskId)) return null;

  return populatePersonalTaskQuery(
    PersonalTask.findOne({
      _id: taskId,
      employee: employeeId,
    })
  );
};

const findAssignedTaskById = async (taskId, employeeId) => {
  if (!isValidObjectId(taskId)) return null;

  return populatePersonalTaskQuery(
    PersonalTask.findOne({
      _id: taskId,
      ...buildAssignedTaskFilter(employeeId),
    })
  );
};

const mapTaskForViewer = (task, employeeId) =>
  mapPersonalTaskForResponse(task, {
    viewerEmployeeId: employeeId,
  });

const listPersonalTasks = async ({ employeeId, search = "", status = "" }) => {
  const normalizedStatus = normalizeText(status).toLowerCase();
  const normalizedSearch = normalizeText(search);
  const filterClauses = [buildVisibleTaskFilter(employeeId)];

  if (normalizedStatus) {
    filterClauses.push({ status: normalizedStatus });
  }

  if (normalizedSearch) {
    filterClauses.push({
      $or: [
        { title: { $regex: escapeRegex(normalizedSearch), $options: "i" } },
        { description: { $regex: escapeRegex(normalizedSearch), $options: "i" } },
      ],
    });
  }

  const filter =
    filterClauses.length === 1 ? filterClauses[0] : { $and: filterClauses };
  const rows = await populatePersonalTaskQuery(
    PersonalTask.find(filter).sort({ createdAt: -1 })
  );

  return sortTasksForList(rows.map((row) => mapTaskForViewer(row, employeeId)));
};

const getPersonalTaskForViewer = async ({ taskId, employeeId }) => {
  const task = await findVisibleTaskById(taskId, employeeId);
  return task ? mapTaskForViewer(task, employeeId) : null;
};

const listShareableEmployees = async ({ search = "" } = {}) => {
  const normalizedSearch = normalizeText(search);
  const filter = {
    isActive: true,
  };

  if (normalizedSearch) {
    filter.$or = [
      { employeeCode: { $regex: escapeRegex(normalizedSearch), $options: "i" } },
      { employeeName: { $regex: escapeRegex(normalizedSearch), $options: "i" } },
      { email: { $regex: escapeRegex(normalizedSearch), $options: "i" } },
    ];
  }

  const rows = await Employee.find(
    filter,
    "employeeCode employeeName email"
  ).sort({ employeeName: 1, employeeCode: 1 });

  return rows.map((employee) => mapShareableEmployee(employee));
};

const createPersonalTaskForEmployee = async ({ body, employeeId, file = null }) => {
  const validationResult = await validatePersonalTaskPayload({
    body,
    employeeId,
    file,
  });

  if (validationResult.message) {
    return validationResult;
  }

  const task = await PersonalTask.create(validationResult.payload);
  const hydratedTask = await populatePersonalTaskQuery(PersonalTask.findById(task._id));

  return {
    task: mapTaskForViewer(hydratedTask, employeeId),
  };
};

const sharePersonalTaskForEmployee = async ({ taskId, employeeId, assignedEmployeeId }) => {
  const normalizedAssignedEmployeeId = normalizeText(assignedEmployeeId);

  if (!isValidObjectId(normalizedAssignedEmployeeId)) {
    return { status: 400, message: "Select a valid employee" };
  }

  const task = await findCreatorTaskById(taskId, employeeId);

  if (!task) {
    return { status: 404, message: "Personal reminder not found" };
  }

  if (task.status === "completed") {
    return { status: 400, message: "Completed tasks cannot be reassigned" };
  }

  const assignedEmployee = await Employee.findOne(
    {
      _id: normalizedAssignedEmployeeId,
      isActive: true,
    },
    "employeeCode employeeName email"
  );

  if (!assignedEmployee) {
    return { status: 400, message: "Selected employee is invalid" };
  }

  const isAssigningBackToCreator = normalizeId(assignedEmployee) === normalizeId(task.employee);

  task.assignedEmployee = assignedEmployee._id;
  task.sharedAt = isAssigningBackToCreator ? null : new Date();
  task.completedAt = null;
  task.completedBy = null;
  task.lastNotificationReadAt = null;
  await task.save();

  await task.populate("assignedEmployee", "employeeCode employeeName email");

  return {
    message: isAssigningBackToCreator
      ? "Task assigned back to you"
      : "Task shared successfully",
    task: mapTaskForViewer(task, employeeId),
  };
};

const completePersonalTaskForEmployee = async ({ taskId, employeeId }) => {
  const task = await findAssignedTaskById(taskId, employeeId);

  if (!task) {
    return { status: 404, message: "Personal reminder not found" };
  }

  if (task.status === "completed") {
    return {
      message: "Personal reminder already completed",
      task: mapTaskForViewer(task, employeeId),
    };
  }

  const now = new Date();
  task.status = "completed";
  task.completedAt = now;
  task.completedBy = employeeId;
  task.nextReminderAt = null;
  task.lastNotificationReadAt = now;
  await task.save();
  await task.populate("completedBy", "employeeCode employeeName email");

  return {
    message: "Personal reminder marked as completed",
    task: mapTaskForViewer(task, employeeId),
  };
};

const findOwnedTaskById = async (taskId, employeeId) => {
  if (!isValidObjectId(taskId)) return null;
  return populatePersonalTaskQuery(
    PersonalTask.findOne({ _id: taskId, employee: employeeId })
  );
};

const updatePersonalTaskForEmployee = async ({ taskId, employeeId, body, file = null }) => {
  const task = await findOwnedTaskById(taskId, employeeId);

  if (!task) {
    return { status: 404, message: "Personal reminder not found" };
  }

  if (task.status === "completed") {
    return { status: 400, message: "Completed tasks cannot be edited" };
  }

  const title = normalizeText(body?.title);
  const description = normalizeText(body?.description);
  const reminderDate = normalizeText(body?.date || body?.reminderDate);
  const reminderTime = normalizeTimeInput(body?.time || body?.reminderTime);
  const reminderType = normalizeText(body?.reminderType).toLowerCase() || "one_time";
  const weeklyDayOfWeek = parseWeekDayInput(body?.weeklyDayOfWeek);
  const monthlyDayOfMonth = parseMonthDayInput(body?.monthlyDayOfMonth);
  const scheduledStart = combineDateAndTime(reminderDate, reminderTime);
  const scheduledAt = getFirstReminderAt({ reminderType, scheduledStart, weeklyDayOfWeek, monthlyDayOfMonth });

  if (!title || !reminderDate || !reminderTime) {
    return { status: 400, message: "Title, date, and time are required" };
  }

  if (!PERSONAL_TASK_REMINDER_TYPES.includes(reminderType)) {
    return { status: 400, message: "Invalid reminder type" };
  }

  if (reminderType === "weekly" && weeklyDayOfWeek === null) {
    return { status: 400, message: "Select the weekday for weekly reminders" };
  }

  if (reminderType === "monthly" && monthlyDayOfMonth === null) {
    return { status: 400, message: "Select the day of month for monthly reminders" };
  }

  task.title = title;
  task.description = description;
  task.reminderDate = reminderDate;
  task.reminderTime = reminderTime;
  task.reminderType = reminderType;
  task.weeklyDayOfWeek = reminderType === "weekly" ? weeklyDayOfWeek : null;
  task.monthlyDayOfMonth = reminderType === "monthly" ? monthlyDayOfMonth : null;
  task.scheduledAt = scheduledAt || scheduledStart;
  task.nextReminderAt = scheduledAt || scheduledStart;
  if (file) task.attachment = file.filename;

  await task.save();

  return {
    message: "Task updated successfully",
    task: mapTaskForViewer(task, employeeId),
  };
};

const deletePersonalTaskForEmployee = async ({ taskId, employeeId }) => {
  const task = await findOwnedTaskById(taskId, employeeId);

  if (!task) {
    return { status: 404, message: "Personal reminder not found" };
  }

  await PersonalTask.deleteOne({ _id: taskId });

  return { message: "Task deleted successfully" };
};

const markPersonalTaskNotificationReadForEmployee = async ({ taskId, employeeId }) => {
  const task = await findAssignedTaskById(taskId, employeeId);

  if (!task) {
    return { status: 404, message: "Personal reminder not found" };
  }

  const notificationState = getPersonalTaskNotificationState(
    task,
    new Date(),
    DEFAULT_NOTIFICATION_WINDOW_MS,
    employeeId
  );

  if (notificationState.hasUnreadNotification) {
    task.lastNotificationReadAt = new Date();
    await task.save();
  }

  return {
    message: "Reminder notification updated",
    task: mapTaskForViewer(task, employeeId),
  };
};

const listPersonalTaskNotifications = async ({ employeeId }) => {
  const rows = await populatePersonalTaskQuery(
    PersonalTask.find({
      status: "pending",
      ...buildAssignedTaskFilter(employeeId),
    }).sort({ nextReminderAt: 1, createdAt: -1 })
  );
  const due = [];
  const upcoming = [];

  for (const row of rows) {
    const mappedRow = mapTaskForViewer(row, employeeId);

    if (mappedRow.notificationState === "due") {
      due.push(mappedRow);
    } else if (mappedRow.notificationState === "upcoming") {
      upcoming.push(mappedRow);
    }
  }

  due.sort(
    (leftTask, rightTask) =>
      new Date(rightTask.notificationAt || 0).getTime() -
      new Date(leftTask.notificationAt || 0).getTime()
  );
  upcoming.sort(
    (leftTask, rightTask) =>
      new Date(leftTask.notificationAt || 0).getTime() -
      new Date(rightTask.notificationAt || 0).getTime()
  );

  return {
    counts: {
      due: due.length,
      upcoming: upcoming.length,
      total: due.length + upcoming.length,
    },
    due,
    upcoming,
  };
};

const validatePersonalTaskPayload = async ({ body, employeeId, file = null }) => {
  const title = normalizeText(body?.title);
  const description = normalizeText(body?.description);
  const reminderDate = normalizeText(body?.date || body?.reminderDate);
  const reminderTime = normalizeTimeInput(body?.time || body?.reminderTime);
  const reminderType = normalizeText(body?.reminderType).toLowerCase() || "one_time";
  const weeklyDayOfWeek = parseWeekDayInput(body?.weeklyDayOfWeek);
  const monthlyDayOfMonth = parseMonthDayInput(body?.monthlyDayOfMonth);
  const scheduledStart = combineDateAndTime(reminderDate, reminderTime);
  const scheduledAt = getFirstReminderAt({
    reminderType,
    scheduledStart,
    weeklyDayOfWeek,
    monthlyDayOfMonth,
  });

  if (!title || !reminderDate || !reminderTime) {
    return {
      message: "Title, date, and time are required",
      status: 400,
    };
  }

  if (!PERSONAL_TASK_REMINDER_TYPES.includes(reminderType)) {
    return {
      message: "Reminder type must be one_time, daily, weekly, or monthly",
      status: 400,
    };
  }

  if (!scheduledStart || !scheduledAt) {
    return {
      message: "Invalid reminder date or time",
      status: 400,
    };
  }

  if (reminderType === "weekly" && weeklyDayOfWeek === null) {
    return {
      message: "Select the weekday for weekly reminders",
      status: 400,
    };
  }

  if (reminderType === "monthly" && monthlyDayOfMonth === null) {
    return {
      message: "Select the day of month for monthly reminders",
      status: 400,
    };
  }

  if (scheduledAt.getTime() < Date.now() - 60 * 1000) {
    return {
      message: "Reminder date and time must be current or future",
      status: 400,
    };
  }

  const employee = await Employee.findById(employeeId, "_id isActive").lean();
  if (!employee || employee.isActive === false) {
    return {
      message: "Only active employees can create personal reminders",
      status: 400,
    };
  }

  return {
    payload: {
      employee: employeeId,
      assignedEmployee: employeeId,
      title,
      description,
      attachment: file?.filename || null,
      reminderDate,
      reminderTime,
      reminderType,
      weeklyDayOfWeek: reminderType === "weekly" ? weeklyDayOfWeek : null,
      monthlyDayOfMonth: reminderType === "monthly" ? monthlyDayOfMonth : null,
      scheduledAt,
      nextReminderAt: scheduledAt,
      lastTriggeredAt: null,
      lastNotificationReadAt: null,
      sharedAt: null,
      status: "pending",
      completedAt: null,
      completedBy: null,
    },
  };
};

const runPersonalTaskScheduler = async () => {
  if (schedulerInFlight) {
    return {
      processed: 0,
      triggered: 0,
      skipped: true,
    };
  }

  schedulerInFlight = true;

  try {
    const now = new Date();
    const dueTasks = await PersonalTask.find({
      status: "pending",
      nextReminderAt: { $ne: null, $lte: now },
    });
    let triggered = 0;

    for (const task of dueTasks) {
      const { lastTriggeredAt, nextReminderAt } = advanceReminderUntilFuture(task, now);

      if (!lastTriggeredAt) {
        continue;
      }

      const previousTriggeredAt = task.lastTriggeredAt ? new Date(task.lastTriggeredAt) : null;
      const hasFreshTrigger =
        !previousTriggeredAt ||
        previousTriggeredAt.getTime() !== lastTriggeredAt.getTime();

      task.lastTriggeredAt = lastTriggeredAt;
      task.nextReminderAt = nextReminderAt;

      if (hasFreshTrigger) {
        task.lastNotificationReadAt = null;
        triggered += 1;
      }

      await task.save();
    }

    return {
      processed: dueTasks.length,
      triggered,
      skipped: false,
    };
  } finally {
    schedulerInFlight = false;
  }
};

const startPersonalTaskScheduler = () => {
  if (schedulerTimer) return;

  void runPersonalTaskScheduler();

  schedulerTimer = setInterval(() => {
    void runPersonalTaskScheduler();
  }, schedulerIntervalMs);
};

const stopPersonalTaskScheduler = () => {
  if (!schedulerTimer) return;
  clearInterval(schedulerTimer);
  schedulerTimer = null;
};

module.exports = {
  DEFAULT_NOTIFICATION_WINDOW_MS,
  PERSONAL_TASK_REMINDER_TYPES,
  PERSONAL_TASK_STATUSES,
  advanceReminderUntilFuture,
  completePersonalTaskForEmployee,
  createPersonalTaskForEmployee,
  deletePersonalTaskForEmployee,
  getPersonalTaskForViewer,
  getPersonalTaskNotificationState,
  isEmployeeRequester,
  listPersonalTaskNotifications,
  listPersonalTasks,
  listShareableEmployees,
  mapPersonalTaskForResponse,
  markPersonalTaskNotificationReadForEmployee,
  runPersonalTaskScheduler,
  sharePersonalTaskForEmployee,
  startPersonalTaskScheduler,
  stopPersonalTaskScheduler,
  updatePersonalTaskForEmployee,
  validatePersonalTaskPayload,
};
