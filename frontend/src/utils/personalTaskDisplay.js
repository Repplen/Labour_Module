const indiaDateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "Asia/Kolkata",
});

const indiaDateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

const weekDayLabels = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

const formatOrdinal = (value) => {
  const day = Number(value);
  if (!Number.isInteger(day)) return "-";
  if (day % 10 === 1 && day % 100 !== 11) return `${day}st`;
  if (day % 10 === 2 && day % 100 !== 12) return `${day}nd`;
  if (day % 10 === 3 && day % 100 !== 13) return `${day}rd`;
  return `${day}th`;
};

export const formatPersonalTaskDate = (value) => {
  if (!value) return "-";

  const parsedValue = new Date(value);
  if (Number.isNaN(parsedValue.getTime())) return "-";

  return indiaDateFormatter.format(parsedValue);
};

export const formatPersonalTaskDateTime = (value) => {
  if (!value) return "-";

  const parsedValue = new Date(value);
  if (Number.isNaN(parsedValue.getTime())) return "-";

  return indiaDateTimeFormatter.format(parsedValue);
};

export const formatReminderTypeLabel = (value) => {
  const labels = {
    one_time: "One-time",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
  };

  return labels[String(value || "").trim().toLowerCase()] || "One-time";
};

export const formatWeeklyDayLabel = (value) => {
  const normalizedValue = Number(value);
  return Object.prototype.hasOwnProperty.call(weekDayLabels, normalizedValue)
    ? weekDayLabels[normalizedValue]
    : "-";
};

export const formatMonthlyDayLabel = (value) => {
  const normalizedValue = Number(value);
  return Number.isInteger(normalizedValue) && normalizedValue >= 1 && normalizedValue <= 31
    ? formatOrdinal(normalizedValue)
    : "-";
};

export const formatReminderRuleLabel = (task) => {
  const reminderType = String(task?.reminderType || "").trim().toLowerCase();

  if (reminderType === "weekly") {
    const dayLabel = formatWeeklyDayLabel(task?.weeklyDayOfWeek);
    return dayLabel !== "-" ? `Weekly on ${dayLabel}` : "Weekly";
  }

  if (reminderType === "monthly") {
    const dayLabel = formatMonthlyDayLabel(task?.monthlyDayOfMonth);
    return dayLabel !== "-" ? `Monthly on the ${dayLabel}` : "Monthly";
  }

  if (reminderType === "daily") {
    return "Daily";
  }

  return "One-time";
};

export const formatReminderTimeLabel = (value) => {
  const normalized = String(value || "").trim();
  if (!/^\d{2}:\d{2}$/.test(normalized)) return "-";

  const [hoursValue, minutesValue] = normalized.split(":").map(Number);
  const suffix = hoursValue >= 12 ? "PM" : "AM";
  const displayHour = hoursValue % 12 === 0 ? 12 : hoursValue % 12;

  return `${String(displayHour).padStart(2, "0")}:${String(minutesValue).padStart(2, "0")} ${suffix}`;
};

export const formatPersonalTaskStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "completed") return "Completed";
  return "Pending";
};

export const getPersonalTaskStatusBadgeClass = (value) => {
  const normalized = String(value || "").trim().toLowerCase();

  return normalized === "completed" ? "text-bg-success" : "text-bg-warning";
};

export const formatNotificationStateLabel = (value) => {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "due") return "Due now";
  if (normalized === "upcoming") return "Upcoming";
  return "Quiet";
};

export const getNotificationStateBadgeClass = (value) => {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "due") return "text-bg-danger";
  if (normalized === "upcoming") return "text-bg-primary";
  return "text-bg-secondary";
};

export const formatEmployeeLabel = (employee) => {
  if (!employee) return "-";

  const employeeCode = String(employee.employeeCode || "").trim();
  const employeeName = String(employee.employeeName || employee.name || "").trim();

  if (employeeCode && employeeName) {
    return `${employeeCode} - ${employeeName}`;
  }

  return employeeCode || employeeName || "-";
};

export const buildBrowserNotificationBody = (task) =>
  [
    task?.isSharedTask && task?.sharedByName ? `Shared by: ${task.sharedByName}` : "",
    task?.description || "",
    task?.notificationAt ? `Reminder: ${formatPersonalTaskDateTime(task.notificationAt)}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
