import { formatDepartmentList } from "./departmentDisplay";
import {
  formatChecklistTaskStatus,
  formatEmployeeLabel,
} from "./checklistDisplay";

const flattenSubDepartments = (rows = [], trail = [], department = null) =>
  rows.flatMap((item) => {
    const nextTrail = [...trail, item.name];

    return [
      {
        _id: item._id,
        name: item.name,
        departmentId: department?._id || "",
        departmentName: department?.name || "",
        label: department?.name
          ? `${department.name} > ${nextTrail.join(" > ")}`
          : nextTrail.join(" > "),
      },
      ...flattenSubDepartments(item.children || [], nextTrail, department),
    ];
  });

export const buildSubDepartmentOptions = (departmentRows = [], selectedDepartmentId = "") =>
  (departmentRows || [])
    .filter((department) => String(department._id) === String(selectedDepartmentId || ""))
    .flatMap((department) =>
      flattenSubDepartments(department.subDepartments || [], [], department)
    );

export const buildDefaultChecklistReportFilters = (assignedEmployee = "") => ({
  fromDate: "",
  toDate: "",
  status: "",
  scheduleType: "",
  companyName: "",
  siteId: "",
  department: "",
  subDepartment: "",
  assignedEmployee,
  timelinessStatus: "",
});

export const getChecklistReportParams = (filters = {}, search = "") => ({
  search: search || undefined,
  fromDate: filters.fromDate || undefined,
  toDate: filters.toDate || undefined,
  status: filters.status || undefined,
  scheduleType: filters.scheduleType || undefined,
  companyName: filters.companyName || undefined,
  siteId: filters.siteId || undefined,
  department: filters.department || undefined,
  subDepartment: filters.subDepartment || undefined,
  assignedEmployee: filters.assignedEmployee || undefined,
  timelinessStatus: filters.timelinessStatus || undefined,
});

export const getDepartmentLabel = (value) =>
  formatDepartmentList(value?.assignedEmployee?.department || value?.departmentDetails || value?.department) ||
  value?.departmentDisplay ||
  "-";

export const formatReportChecklistTaskStatus = (status) =>
  String(status || "").trim().toLowerCase() === "approved"
    ? "Approved"
    : formatChecklistTaskStatus(status);

export const formatEmployeeOptionLabel = (employee) => {
  const employeeLabel = formatEmployeeLabel(employee);
  const departmentLabel = getDepartmentLabel(employee);

  return departmentLabel && departmentLabel !== "-"
    ? `${employeeLabel} (${departmentLabel})`
    : employeeLabel;
};

export const getDownloadFileName = (headers = {}, fallbackFileName) => {
  const contentDisposition = headers?.["content-disposition"] || "";
  const utfFileNameMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);

  if (utfFileNameMatch?.[1]) {
    return decodeURIComponent(utfFileNameMatch[1]);
  }

  const fileNameMatch = /filename="?([^"]+)"?/i.exec(contentDisposition);
  return fileNameMatch?.[1] || fallbackFileName;
};
