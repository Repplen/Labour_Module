export const COMPLAINT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const COMPLAINT_DUE_SOON_THRESHOLD_MS = 2 * 60 * 60 * 1000;
export const COMPLAINT_PROCESS_OVERDUE_MS = 22 * 60 * 60 * 1000;

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

const normalizeText = (value) => String(value || "").trim().toLowerCase();

export const toComplaintDate = (value) => {
  if (!value) return null;

  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatComplaintDateTime = (value) => {
  const parsed = toComplaintDate(value);
  if (!parsed) return "-";

  return DATE_TIME_FORMATTER.format(parsed);
};

export const formatComplaintDuration = (durationMs) => {
  const safeDurationMs = Math.max(0, Number(durationMs || 0));
  const totalSeconds = Math.floor(safeDurationMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;
  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!parts.length || (!days && !hours && seconds)) {
    parts.push(`${seconds}s`);
  }

  return parts.slice(0, 3).join(" ");
};

export const getComplaintTimeState = (complaint, now = new Date()) => {
  const nowDate = toComplaintDate(now) || new Date();
  const raisedAt = toComplaintDate(complaint?.raisedAt || complaint?.createdAt) || nowDate;
  const deadlineAt =
    toComplaintDate(complaint?.deadlineAt) ||
    new Date(raisedAt.getTime() + COMPLAINT_WINDOW_MS);
  const completedAt = toComplaintDate(complaint?.completedAt);
  const completed =
    normalizeText(complaint?.status) === "completed" ||
    normalizeText(complaint?.currentLevel) === "completed" ||
    Boolean(completedAt);
  const referenceEndAt = completed && completedAt ? completedAt : nowDate;
  const elapsedMs = Math.max(0, referenceEndAt.getTime() - raisedAt.getTime());
  const overdueMs = Math.max(0, referenceEndAt.getTime() - deadlineAt.getTime());
  const remainingMs =
    !completed && nowDate.getTime() < deadlineAt.getTime()
      ? deadlineAt.getTime() - nowDate.getTime()
      : 0;
  const isOverdue = Boolean(complaint?.isOverdue) || overdueMs > 0;
  const isDueSoon =
    !completed &&
    !isOverdue &&
    remainingMs > 0 &&
    remainingMs <= COMPLAINT_DUE_SOON_THRESHOLD_MS;

  let statusLabel = "In Progress";
  let tone = "info";

  if (completed) {
    statusLabel = "Resolved / Completed";
    tone = "success";
  } else if (isOverdue) {
    statusLabel = "Overdue";
    tone = "danger";
  } else if (isDueSoon) {
    statusLabel = "Due Soon";
    tone = "warning";
  }

  return {
    raisedAt,
    deadlineAt,
    completedAt,
    completed,
    elapsedMs,
    overdueMs,
    remainingMs,
    isOverdue,
    isDueSoon,
    statusLabel,
    tone,
  };
};

export const getComplaintProcessState = (complaint, now = new Date()) => {
  const nowDate = toComplaintDate(now) || new Date();
  const raisedAt = toComplaintDate(complaint?.raisedAt || complaint?.createdAt) || nowDate;
  const completedAt = toComplaintDate(complaint?.completedAt);
  const completed =
    normalizeText(complaint?.status) === "completed" ||
    normalizeText(complaint?.currentLevel) === "completed" ||
    Boolean(completedAt);
  const processDeadlineAt = new Date(raisedAt.getTime() + COMPLAINT_PROCESS_OVERDUE_MS);
  const referenceEndAt = completed && completedAt ? completedAt : nowDate;
  const elapsedMs = Math.max(0, referenceEndAt.getTime() - raisedAt.getTime());
  const remainingMs = Math.max(0, processDeadlineAt.getTime() - nowDate.getTime());
  const isOverdue = !completed && (Boolean(complaint?.isOverdue) || nowDate >= processDeadlineAt);
  const isOnProcess = !completed && !isOverdue;
  const finalStepLabel = isOverdue ? "Overdue" : "Completed";
  const progressPercent = completed || isOverdue ? 100 : elapsedMs > 0 ? 55 : 12;
  const tone = completed ? "success" : isOverdue ? "danger" : "info";
  const statusLabel = completed
    ? "Completed"
    : isOverdue
    ? "Overdue"
    : "On Process";
  const helperLabel = completed
    ? `Completed in ${formatComplaintDuration(elapsedMs)}`
    : isOverdue
    ? `Overdue after ${formatComplaintDuration(COMPLAINT_PROCESS_OVERDUE_MS)}`
    : `Overdue if not completed in ${formatComplaintDuration(remainingMs)}`;

  return {
    raisedAt,
    processDeadlineAt,
    completedAt,
    completed,
    elapsedMs,
    remainingMs,
    isOverdue,
    isOnProcess,
    finalStepLabel,
    progressPercent,
    tone,
    statusLabel,
    helperLabel,
    steps: [
      {
        key: "submitted",
        label: "Complaint Submitted",
        state: "done",
      },
      {
        key: "process",
        label: "On Process",
        state: completed || isOverdue ? "done" : "active",
      },
      {
        key: completed ? "completed" : isOverdue ? "overdue" : "final",
        label: finalStepLabel,
        state: completed || isOverdue ? "done" : "pending",
      },
    ],
  };
};
