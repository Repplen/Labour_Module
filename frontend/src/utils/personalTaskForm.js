import { formatMonthlyDayLabel } from "./personalTaskDisplay";

export const initialPersonalTaskFormState = {
  title: "",
  description: "",
  reminderDate: "",
  reminderTime: "",
  reminderType: "one_time",
  weeklyDayOfWeek: "",
  monthlyDayOfMonth: "",
};

export const weeklyReminderOptions = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
];

export const monthlyReminderOptions = Array.from({ length: 31 }, (_, index) => {
  const dayValue = String(index + 1);

  return {
    value: dayValue,
    label: formatMonthlyDayLabel(dayValue),
  };
});

export const getStoredUser = () => JSON.parse(localStorage.getItem("user") || "{}");

export const isOwnTaskEmployeeUser = (user) =>
  [user?.role, user?.roleKey, user?.principalType]
    .map((value) => String(value || "").trim().toLowerCase())
    .includes("employee");

export const getPermissionLabel = (value) => {
  if (value === "granted") return "Browser alerts on";
  if (value === "denied") return "Browser alerts blocked";
  if (value === "default") return "Browser alerts available";
  return "Browser alerts unsupported";
};

export const getRecurrenceDefaultsFromDate = (value) => {
  const normalizedValue = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    return {
      weeklyDayOfWeek: "",
      monthlyDayOfMonth: "",
    };
  }

  const [year, month, day] = normalizedValue.split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);

  if (Number.isNaN(parsedDate.getTime())) {
    return {
      weeklyDayOfWeek: "",
      monthlyDayOfMonth: "",
    };
  }

  return {
    weeklyDayOfWeek: String(parsedDate.getDay()),
    monthlyDayOfMonth: String(parsedDate.getDate()),
  };
};

export const getViewerTaskLabel = (task) => {
  const relationship = String(task?.viewerRelationship || "").trim().toLowerCase();

  if (relationship === "creator") return "Shared by you";
  if (relationship === "assignee") return "Assigned to you";
  return "Own task";
};

export const buildPersonalTaskFormData = (form, attachmentFile) => {
  const data = new FormData();

  data.append("title", form.title);
  data.append("description", form.description);
  data.append("date", form.reminderDate);
  data.append("time", form.reminderTime);
  data.append("reminderType", form.reminderType);

  if (form.reminderType === "weekly" && form.weeklyDayOfWeek) {
    data.append("weeklyDayOfWeek", form.weeklyDayOfWeek);
  }

  if (form.reminderType === "monthly" && form.monthlyDayOfMonth) {
    data.append("monthlyDayOfMonth", form.monthlyDayOfMonth);
  }

  if (typeof File !== "undefined" && attachmentFile instanceof File) {
    data.append("attachment", attachmentFile);
  }

  return data;
};
