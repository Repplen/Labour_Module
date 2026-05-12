import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import EmployeeQrCode from "../components/EmployeeQrCode";
import { usePermissions } from "../context/usePermissions";
import { formatDepartmentList } from "../utils/departmentDisplay";
import { formatSiteList } from "../utils/siteDisplay";

const getEmployeeInitials = (value = "") =>
  String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "EM";

const getStatusFilterLabel = (value) => {
  if (value === "active") return "Active only";
  if (value === "inactive") return "Inactive only";
  return "";
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const EMPTY_EMPLOYEE_ADVANCED_FILTERS = {
  code: "",
  nameEmail: "",
  mobile: "",
  department: "",
  subDepartment: "",
  superiorEmployee: "",
  site: "",
  subSite: "",
  designation: "",
  status: "",
};

const normalizeFilterText = (value) => String(value || "").trim().toLowerCase();

const textIncludesFilter = (value, filterValue) => {
  const normalizedFilter = normalizeFilterText(filterValue);
  if (!normalizedFilter) return true;
  return normalizeFilterText(value).includes(normalizedFilter);
};

const hasEmployeeAdvancedFilters = (filters = {}) =>
  Object.values(filters).some((value) => String(value || "").trim());

const splitDisplayList = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const getEmployeeDepartmentLabels = (employee = {}) => {
  const details = Array.isArray(employee.departmentDetails)
    ? employee.departmentDetails
    : [];
  const labels = details.map((department) => department?.name).filter(Boolean);

  return labels.length
    ? labels
    : splitDisplayList(
        employee.departmentDisplay ||
          formatDepartmentList(employee.departmentDetails || employee.department)
      );
};

const getEmployeeSubDepartmentLabels = (employee = {}) => {
  const details = Array.isArray(employee.subDepartmentDetails)
    ? employee.subDepartmentDetails
    : [];
  const labels = details
    .map((subDepartment) => subDepartment?.path || subDepartment?.name)
    .filter(Boolean);

  return labels.length
    ? labels
    : splitDisplayList(
        employee.subDepartmentDisplay ||
          employee.subDepartmentPath ||
          employee.subDepartmentName
      );
};

const getEmployeeSuperiorLabel = (employee = {}) =>
  String(employee.superiorEmployeeName || "").trim();

const getEmployeeSiteLabels = (employee = {}) => {
  const sites = Array.isArray(employee.sites) ? employee.sites : [];
  const labels = sites
    .map((site) => {
      const companyName = String(site?.companyName || "").trim();
      const name = String(site?.name || "").trim();
      if (companyName && name) return `${companyName} - ${name}`;
      return name || companyName;
    })
    .filter(Boolean);

  return labels.length ? labels : splitDisplayList(formatSiteList(employee.sites));
};

const getEmployeeSubSiteLabels = (employee = {}) => {
  const details = Array.isArray(employee.subSiteDetails) ? employee.subSiteDetails : [];
  const labels = details
    .map((subSite) => subSite?.subSitePath || subSite?.subSiteName)
    .filter(Boolean);

  return labels.length ? labels : splitDisplayList(employee.subSiteDisplay);
};

const getEmployeeDesignationLabel = (employee = {}) =>
  String(employee.designation?.name || "").trim();

const buildEmployeeAdvancedFilterOptions = (employees = []) => {
  const optionSets = {
    departments: new Set(),
    subDepartments: new Set(),
    superiorEmployees: new Set(),
    sites: new Set(),
    subSites: new Set(),
    designations: new Set(),
  };

  employees.forEach((employee) => {
    getEmployeeDepartmentLabels(employee).forEach((label) =>
      optionSets.departments.add(label)
    );
    getEmployeeSubDepartmentLabels(employee).forEach((label) =>
      optionSets.subDepartments.add(label)
    );
    getEmployeeSiteLabels(employee).forEach((label) => optionSets.sites.add(label));
    getEmployeeSubSiteLabels(employee).forEach((label) => optionSets.subSites.add(label));

    const superiorEmployee = getEmployeeSuperiorLabel(employee);
    const designation = getEmployeeDesignationLabel(employee);

    if (superiorEmployee) optionSets.superiorEmployees.add(superiorEmployee);
    if (designation) optionSets.designations.add(designation);
  });

  const sortLabels = (left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" });

  return Object.fromEntries(
    Object.entries(optionSets).map(([key, value]) => [key, [...value].sort(sortLabels)])
  );
};

const hasSelectedOption = (labels = [], selectedValue) => {
  if (!selectedValue) return true;
  const normalizedSelectedValue = normalizeFilterText(selectedValue);

  return labels.some((label) => normalizeFilterText(label) === normalizedSelectedValue);
};

const filterEmployeesByAdvancedFilters = (employees = [], filters = {}) => {
  if (!hasEmployeeAdvancedFilters(filters)) return employees;

  return employees.filter((employee) => {
    const nameEmailValue = [employee.employeeName, employee.email].filter(Boolean).join(" ");
    const statusValue = employee.isActive ? "active" : "inactive";

    return (
      textIncludesFilter(employee.employeeCode, filters.code) &&
      textIncludesFilter(nameEmailValue, filters.nameEmail) &&
      textIncludesFilter(employee.mobile, filters.mobile) &&
      hasSelectedOption(getEmployeeDepartmentLabels(employee), filters.department) &&
      hasSelectedOption(getEmployeeSubDepartmentLabels(employee), filters.subDepartment) &&
      hasSelectedOption([getEmployeeSuperiorLabel(employee)].filter(Boolean), filters.superiorEmployee) &&
      hasSelectedOption(getEmployeeSiteLabels(employee), filters.site) &&
      hasSelectedOption(getEmployeeSubSiteLabels(employee), filters.subSite) &&
      hasSelectedOption([getEmployeeDesignationLabel(employee)].filter(Boolean), filters.designation) &&
      (!filters.status || statusValue === normalizeFilterText(filters.status))
    );
  });
};

function ViewIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.087.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.12 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z" />
      <path d="M8 5.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5M4.5 8a3.5 3.5 0 1 1 7 0a3.5 3.5 0 0 1-7 0" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M12.854.146a.5.5 0 0 1 .707 0l2.586 2.586a.5.5 0 0 1 0 .707l-10 10L3 14l.561-3.146zM11.207 2L4 9.207V12h2.793L14 4.793z" />
      <path
        fillRule="evenodd"
        d="M1 13.5V16h2.5l7.373-7.373l-2.5-2.5zM15 3.793L12.207 1L13.5-.293a1 1 0 0 1 1.414 0l1.379 1.379a1 1 0 0 1 0 1.414z"
      />
    </svg>
  );
}

function ToggleIcon({ active }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      {active ? (
        <>
          <path d="M11 9a3 3 0 1 0 0-6a3 3 0 0 0 0 6" />
          <path
            fillRule="evenodd"
            d="M0 4a4 4 0 0 1 4-4h7a4 4 0 1 1 0 8H4a4 4 0 0 1-4-4m4-3a3 3 0 0 0 0 6h7a3 3 0 1 0 0-6z"
          />
        </>
      ) : (
        <>
          <path d="M5 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6" />
          <path
            fillRule="evenodd"
            d="M0 8a4 4 0 0 1 4-4h7a4 4 0 1 1 0 8H4a4 4 0 0 1-4-4m4-3a3 3 0 0 0 0 6h7a3 3 0 1 0 0-6z"
          />
        </>
      )}
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0A.5.5 0 0 1 8.5 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
      <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 1 1 0-2H5V1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1h2.5a1 1 0 0 1 1 1M6 1v1h4V1z" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M2 2h4v4H2zM1 1v6h6V1zm2 2h2v2H3z" />
      <path d="M10 2h4v4h-4zM9 1v6h6V1zm2 2h2v2h-2z" />
      <path d="M2 10h4v4H2zM1 9v6h6V9zm2 2h2v2H3z" />
      <path d="M9 9h2v1h1V9h3v2h-1v1h1v3h-2v-1h-1v1H9v-2h1v-1H9zm2 2v1h1v1h1v-1h1v-1h-2v-1h-1z" />
    </svg>
  );
}

export default function EmployeeList() {
  const { can } = usePermissions();
  const [employees, setEmployees] = useState([]);
  const [photoErrors, setPhotoErrors] = useState({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [advancedFiltersVisible, setAdvancedFiltersVisible] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState(EMPTY_EMPLOYEE_ADVANCED_FILTERS);
  const [appliedAdvancedFilters, setAppliedAdvancedFilters] = useState(
    EMPTY_EMPLOYEE_ADVANCED_FILTERS
  );
  const [loading, setLoading] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [statusConfirmation, setStatusConfirmation] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState("");
  const [qrModalEmployee, setQrModalEmployee] = useState(null);
  const [qrDetails, setQrDetails] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrActionLoading, setQrActionLoading] = useState("");
  const [qrError, setQrError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrCopyMessage, setQrCopyMessage] = useState("");

  const [params] = useSearchParams();
  const department = params.get("department");
  const paramsKey = params.toString();
  const canAddEmployee = can("employee_master", "add");
  const canEditEmployee = can("employee_master", "edit");
  const canDeleteEmployee = can("employee_master", "delete");
  const canToggleEmployeeStatus = can("employee_master", "status_update");
  const canExportEmployees = can("employee_master", "export");
  const canManageEmployeeQr = can("employee_master", "view");
  const uploadBaseUrl = useMemo(
    () => (api.defaults.baseURL || "http://localhost:5000/api").replace(/\/api\/?$/, ""),
    []
  );
  const filteredEmployees = useMemo(
    () => filterEmployeesByAdvancedFilters(employees, appliedAdvancedFilters),
    [appliedAdvancedFilters, employees]
  );
  const advancedFilterOptions = useMemo(
    () => buildEmployeeAdvancedFilterOptions(employees),
    [employees]
  );
  const hasAdvancedFilters =
    hasEmployeeAdvancedFilters(advancedFilters) ||
    hasEmployeeAdvancedFilters(appliedAdvancedFilters);

  const loadEmployees = useCallback(async () => {
    setLoading(true);

    try {
      const res = await api.get("/employees", {
        params: {
          search: search || undefined,
          status: status || undefined,
          department: department || undefined,
        },
      });

      setEmployees(Array.isArray(res.data) ? res.data : []);
      setPhotoErrors({});
    } catch (err) {
      console.error("Load employees failed:", err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [department, search, status]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees, paramsKey]);

  useEffect(() => {
    if (!canDeleteEmployee) {
      setSelectedEmployeeIds([]);
      return;
    }

    setSelectedEmployeeIds((currentValue) =>
      currentValue.filter((selectedId) =>
        filteredEmployees.some((employee) => String(employee._id) === String(selectedId))
      )
    );
  }, [canDeleteEmployee, filteredEmployees]);

  const removeEmployeesFromState = (employeeIds) => {
    const normalizedIds = employeeIds.map((id) => String(id));

    setEmployees((currentValue) =>
      currentValue.filter((employee) => !normalizedIds.includes(String(employee._id)))
    );
    setSelectedEmployeeIds((currentValue) =>
      currentValue.filter((selectedId) => !normalizedIds.includes(String(selectedId)))
    );
  };

  const toggleEmployeeSelection = (id) => {
    const normalizedId = String(id);

    setSelectedEmployeeIds((currentValue) =>
      currentValue.includes(normalizedId)
        ? currentValue.filter((selectedId) => selectedId !== normalizedId)
        : [...currentValue, normalizedId]
    );
  };

  const toggleAllEmployeeSelections = () => {
    const visibleEmployeeIds = filteredEmployees.map((employee) => String(employee._id));

    if (
      visibleEmployeeIds.length &&
      visibleEmployeeIds.every((employeeId) => selectedEmployeeIds.includes(employeeId))
    ) {
      setSelectedEmployeeIds([]);
      return;
    }

    setSelectedEmployeeIds(visibleEmployeeIds);
  };

  const removeEmployee = async (id) => {
    if (!window.confirm("Delete employee?")) return;

    try {
      await api.delete(`/employees/${id}`);
      removeEmployeesFromState([id]);
    } catch (err) {
      console.error("Delete employee failed:", err);
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const removeSelectedEmployees = async () => {
    if (!selectedEmployeeIds.length) return;

    const employeeIdsToDelete = [...selectedEmployeeIds];

    if (
      !window.confirm(
        `Delete ${employeeIdsToDelete.length} selected employee${
          employeeIdsToDelete.length === 1 ? "" : "s"
        }?`
      )
    ) {
      return;
    }

    setBulkDeleteLoading(true);

    try {
      const res = await api.post("/employees/bulk-delete", {
        employeeIds: employeeIdsToDelete,
      });
      const deletedCount = Number(res.data?.deletedCount || employeeIdsToDelete.length);

      removeEmployeesFromState(employeeIdsToDelete);
      alert(
        `${deletedCount} employee${deletedCount === 1 ? "" : "s"} deleted successfully.`
      );
    } catch (err) {
      console.error("Bulk delete employees failed:", err);
      alert(err.response?.data?.message || "Bulk delete failed");
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const openStatusConfirmation = (employee) => {
    setStatusMessage("");
    setStatusError("");
    setStatusConfirmation(employee);
  };

  const closeStatusConfirmation = () => {
    if (statusSaving) return;
    setStatusConfirmation(null);
    setStatusError("");
  };

  const confirmStatusChange = async () => {
    if (!statusConfirmation) return;

    const nextIsActive = !statusConfirmation.isActive;
    setStatusSaving(true);
    setStatusError("");

    try {
      await api.patch(`/employees/${statusConfirmation._id}/status`, {
        isActive: nextIsActive,
      });
      await loadEmployees();
      setStatusConfirmation(null);
      setStatusMessage("Employee status updated successfully");
    } catch (err) {
      setStatusError(err.response?.data?.message || "Status update failed");
    } finally {
      setStatusSaving(false);
    }
  };

  const exportExcel = async () => {
    try {
      const res = await api.get("/employees/export/excel", {
        params: { status },
        responseType: "blob",
      });

      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "employees.xlsx";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Excel export failed");
    }
  };

  const updateEmployeeQrState = (employeeId, details = {}) => {
    setEmployees((currentValue) =>
      currentValue.map((employee) =>
        String(employee._id) === String(employeeId)
          ? {
              ...employee,
              qrCodeUrl: details.qrCodeUrl,
              qrGeneratedAt: details.qrGeneratedAt,
              qrEnabled: details.qrEnabled,
            }
          : employee
      )
    );
    setQrModalEmployee((currentValue) =>
      currentValue && String(currentValue._id) === String(employeeId)
        ? {
            ...currentValue,
            qrCodeUrl: details.qrCodeUrl,
            qrGeneratedAt: details.qrGeneratedAt,
            qrEnabled: details.qrEnabled,
          }
        : currentValue
    );
  };

  const loadEmployeeQr = async (employee) => {
    setQrModalEmployee(employee);
    setQrDetails(null);
    setQrDataUrl("");
    setQrCopyMessage("");
    setQrError("");
    setQrLoading(true);

    try {
      const response = await api.post(`/employees/${employee._id}/qr`, {
        publicBaseUrl: window.location.origin,
      });
      setQrDetails(response.data || null);
      updateEmployeeQrState(employee._id, response.data || {});
    } catch (err) {
      console.error("Employee QR load failed:", err);
      setQrError(err.response?.data?.message || "Failed to load employee QR code");
    } finally {
      setQrLoading(false);
    }
  };

  const closeQrModal = () => {
    if (qrActionLoading) return;
    setQrModalEmployee(null);
    setQrDetails(null);
    setQrDataUrl("");
    setQrCopyMessage("");
    setQrError("");
  };

  const toggleQrAccess = async () => {
    if (!qrModalEmployee || !qrDetails) return;

    setQrActionLoading("access");
    setQrError("");
    setQrCopyMessage("");

    try {
      const response = await api.patch(`/employees/${qrModalEmployee._id}/qr/access`, {
        publicBaseUrl: window.location.origin,
        qrEnabled: !qrDetails.qrEnabled,
      });
      setQrDetails(response.data || null);
      updateEmployeeQrState(qrModalEmployee._id, response.data || {});
    } catch (err) {
      console.error("Employee QR access update failed:", err);
      setQrError(err.response?.data?.message || "Failed to update employee QR access");
    } finally {
      setQrActionLoading("");
    }
  };

  const downloadQr = () => {
    if (!qrDataUrl || !qrDetails) return;

    const anchor = document.createElement("a");
    anchor.href = qrDataUrl;
    anchor.download = `${qrDetails.employeeCode || "employee"}-qr.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const printQr = () => {
    if (!qrDataUrl || !qrDetails) return;

    const printWindow = window.open("", "_blank", "width=420,height=620");
    if (!printWindow) {
      alert("Please allow popups to print the QR code.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${escapeHtml(qrDetails.employeeCode || "Employee")} QR</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; text-align: center; color: #111827; }
            img { width: 280px; height: 280px; }
            .code { color: #4b5563; margin-top: 4px; }
            .link { margin-top: 18px; font-size: 11px; word-break: break-all; color: #4b5563; }
          </style>
        </head>
        <body>
          <h2>${escapeHtml(qrDetails.employeeName || "Employee")}</h2>
          <div class="code">${escapeHtml(qrDetails.employeeCode || "")}</div>
          <img src="${qrDataUrl}" alt="Employee QR code" />
          <div class="link">${escapeHtml(qrDetails.qrCodeUrl || "")}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const copyQrLink = async () => {
    if (!qrDetails?.qrCodeUrl) return;

    try {
      await navigator.clipboard.writeText(qrDetails.qrCodeUrl);
      setQrCopyMessage("QR link copied");
    } catch {
      const input = document.createElement("input");
      input.value = qrDetails.qrCodeUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      setQrCopyMessage("QR link copied");
    }
  };

  const updateAdvancedFilter = (field, value) => {
    setAdvancedFilters((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  };

  const applyAdvancedFilters = () => {
    setAppliedAdvancedFilters(advancedFilters);
  };

  const clearAdvancedFilters = () => {
    setAdvancedFilters(EMPTY_EMPLOYEE_ADVANCED_FILTERS);
    setAppliedAdvancedFilters(EMPTY_EMPLOYEE_ADVANCED_FILTERS);
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    clearAdvancedFilters();
  };

  const allEmployeesSelected =
    filteredEmployees.length > 0 &&
    filteredEmployees.every((employee) => selectedEmployeeIds.includes(String(employee._id)));
  const activeCount = filteredEmployees.filter((employee) => employee.isActive).length;
  const inactiveCount = filteredEmployees.length - activeCount;
  const hasFilters = Boolean(search.trim() || status || department || hasAdvancedFilters);
  const canClearFilters = Boolean(search.trim() || status || hasAdvancedFilters);
  const stats = [
    {
      label: "Employees Visible",
      value: filteredEmployees.length,
      meta: "Current search result set",
      accentClass: "employee-directory-stat-card--primary",
    },
    {
      label: "Currently Active",
      value: activeCount,
      meta: "Ready for assignments",
      accentClass: "employee-directory-stat-card--success",
    },
    {
      label: "Inactive Profiles",
      value: inactiveCount,
      meta: "Need review or reactivation",
      accentClass: "employee-directory-stat-card--neutral",
    },
  ];
  const activeFilterPills = [
    department ? "Department focus applied" : "",
    search.trim() ? `Search: ${search.trim()}` : "",
    getStatusFilterLabel(status),
    hasEmployeeAdvancedFilters(appliedAdvancedFilters) ? "Advanced filters applied" : "",
  ].filter(Boolean);

  if (canDeleteEmployee) {
    stats.push({
      label: "Selected Rows",
      value: selectedEmployeeIds.length,
      meta: "Bulk actions ready",
      accentClass: "employee-directory-stat-card--accent",
    });
  }

  return (
    <div className="container-fluid mt-4 mb-5 px-4" data-testid="employee-master-page">
      <div className="page-intro-card employee-directory-hero mb-4">
        <div className="list-toolbar align-items-start">
          <div>
            <div className="page-kicker">Employees</div>
            <h4 className="mb-2">Employee Directory</h4>
            <p className="page-subtitle mb-0 employee-directory-hero__subtitle">
              Review workforce coverage, open profiles quickly, and manage employee records from a
              single control panel.
            </p>

            {activeFilterPills.length ? (
              <div className="employee-directory-filter-pills mt-3">
                {activeFilterPills.map((pill) => (
                  <span key={pill} className="employee-directory-filter-pill">
                    {pill}
                  </span>
                ))}
              </div>
            ) : (
              <div className="form-help mt-3">
                Search, status, and dashboard filters will appear here for quick reference.
              </div>
            )}
          </div>

          {canAddEmployee || canDeleteEmployee ? (
            <div className="d-flex flex-wrap gap-2">
              {canDeleteEmployee ? (
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={removeSelectedEmployees}
                  disabled={!selectedEmployeeIds.length || bulkDeleteLoading}
                >
                  {bulkDeleteLoading
                    ? "Deleting..."
                    : `Delete Selected${
                        selectedEmployeeIds.length ? ` (${selectedEmployeeIds.length})` : ""
                      }`}
                </button>
              ) : null}
              {canAddEmployee ? (
                <Link to="/add" className="btn btn-primary" data-testid="add-employee-button">
                  Add Employee
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>

        {statusMessage ? (
          <div className="alert alert-success py-2 mt-3 mb-0" role="status">
            {statusMessage}
          </div>
        ) : null}

        <div className="employee-directory-stats mt-4">
          {stats.map((stat) => (
            <div key={stat.label} className={`employee-directory-stat-card ${stat.accentClass}`}>
              <div className="employee-directory-stat-card__label">{stat.label}</div>
              <div className="employee-directory-stat-card__value">{stat.value}</div>
              <div className="employee-directory-stat-card__meta">{stat.meta}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="filter-card employee-directory-filter-card mb-4">
        <div className="list-toolbar">
          <div>
            <h6 className="mb-1">Filters</h6>
            <div className="form-help">
              Narrow the list by keyword, status, or advanced employee mapping filters.
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn ${
                advancedFiltersVisible ? "btn-primary" : "btn-outline-primary"
              }`}
              onClick={() => setAdvancedFiltersVisible((currentValue) => !currentValue)}
              aria-expanded={advancedFiltersVisible}
              aria-controls="employee-advanced-filters"
            >
              {advancedFiltersVisible ? "Hide Filters" : "Filter"}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={clearFilters}
              disabled={!canClearFilters}
            >
              Clear Filters
            </button>
            {canExportEmployees ? (
              <button type="button" className="btn btn-success" onClick={exportExcel}>
                Export Excel
              </button>
            ) : null}
          </div>
        </div>

        <div className="row g-3 mt-1">
          <div className="col-md-8 col-xl-6">
            <label className="form-label fw-semibold small text-uppercase text-muted">
              Search Employee
            </label>
            <input
              className="form-control"
              placeholder="Search by code, name, or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="col-md-4 col-xl-3">
            <label className="form-label fw-semibold small text-uppercase text-muted">
              Status
            </label>
            <select
              className="form-select"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {advancedFiltersVisible ? (
          <EmployeeAdvancedFilters
            filters={advancedFilters}
            options={advancedFilterOptions}
            onChange={updateAdvancedFilter}
            onApply={applyAdvancedFilters}
            onClear={clearAdvancedFilters}
            hasFilters={hasAdvancedFilters}
          />
        ) : null}

        {department ? (
          <div className="alert alert-info py-2 mt-3 mb-0">
            This list is currently filtered from a dashboard selection.
          </div>
        ) : hasFilters ? (
          <div className="form-help mt-3">
            Top filters update automatically. Advanced filters update after Apply.
          </div>
        ) : null}
      </div>

      <div className="table-shell employee-directory-table-shell">
        <div className="table-responsive">
          <table
            className="table table-bordered table-striped align-middle employee-directory-table"
            data-testid="employee-table"
          >
            <thead className="table-dark">
              <tr>
                {canDeleteEmployee ? (
                  <th className="text-center" style={{ width: "56px" }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={allEmployeesSelected}
                      onChange={toggleAllEmployeeSelections}
                      disabled={!filteredEmployees.length || bulkDeleteLoading}
                      aria-label="Select all employees"
                    />
                  </th>
                ) : null}
                <th>Photo</th>
                <th>Code</th>
                <th>Name</th>
                <th>Departments</th>
                <th>Sub Departments</th>
                <th>Superior Employee</th>
                <th>Sites</th>
                <th>Sub Sites</th>
                <th>Designation</th>
                <th>Status</th>
                <th width="270">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canDeleteEmployee ? 12 : 11} className="text-center py-4">
                    Loading employees...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={canDeleteEmployee ? 12 : 11} className="text-center py-4">
                    No employees found for the current filters.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr key={employee._id}>
                    {canDeleteEmployee ? (
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={selectedEmployeeIds.includes(String(employee._id))}
                          onChange={() => toggleEmployeeSelection(employee._id)}
                          disabled={bulkDeleteLoading}
                          aria-label={`Select employee ${
                            employee.employeeCode || employee.employeeName || ""
                          }`}
                        />
                      </td>
                    ) : null}
                    <td>
                      {employee.photo && !photoErrors[employee._id] ? (
                        <img
                          src={`${uploadBaseUrl}/uploads/${employee.photo}`}
                          alt="emp"
                          width="48"
                          height="48"
                          className="employee-directory-avatar"
                          onError={() =>
                            setPhotoErrors((prev) => ({ ...prev, [employee._id]: true }))
                          }
                        />
                      ) : (
                        <div className="employee-directory-avatar-fallback">
                          {getEmployeeInitials(
                            employee.employeeName || employee.employeeCode || employee.email
                          )}
                        </div>
                      )}
                    </td>

                    <td>
                      <span className="employee-directory-code">
                        {employee.employeeCode || "-"}
                      </span>
                    </td>
                    <td>
                      <div className="employee-directory-cell-stack">
                        <div className="employee-directory-primary">
                          {employee.employeeName || "-"}
                        </div>
                        <div className="employee-directory-secondary">
                          {employee.email || employee.designation?.name || "Employee profile"}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="employee-directory-cell-stack">
                        <div className="employee-directory-primary">
                          {employee.departmentDisplay ||
                            formatDepartmentList(
                              employee.departmentDetails || employee.department
                            ) ||
                            "-"}
                        </div>
                        <div className="employee-directory-secondary">
                          {Array.isArray(employee.departmentIds) && employee.departmentIds.length
                            ? `${employee.departmentIds.length} mapped department${
                                employee.departmentIds.length === 1 ? "" : "s"
                              }`
                            : "Department mapping pending"}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="employee-directory-cell-stack">
                        <div className="employee-directory-primary">
                          {employee.subDepartmentDisplay ||
                            employee.subDepartmentPath ||
                            employee.subDepartmentName ||
                            "-"}
                        </div>
                        <div className="employee-directory-secondary">
                          {employee.subDepartmentDisplay ||
                          employee.subDepartmentPath ||
                          employee.subDepartmentName
                            ? "Sub department assigned"
                            : "No sub department"}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="employee-directory-cell-stack">
                        <div className="employee-directory-primary">
                          {employee.superiorEmployeeName || "-"}
                        </div>
                        <div className="employee-directory-secondary">
                          {employee.superiorEmployeeName
                            ? "Reporting chain connected"
                            : "Superior not assigned"}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="employee-directory-cell-stack">
                        <div className="employee-directory-primary">
                          {formatSiteList(employee.sites) || "-"}
                        </div>
                        <div className="employee-directory-secondary">
                          {Array.isArray(employee.sites) && employee.sites.length
                            ? `${employee.sites.length} mapped site${
                                employee.sites.length === 1 ? "" : "s"
                              }`
                            : "Site mapping pending"}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="employee-directory-cell-stack">
                        <div className="employee-directory-primary">
                          {employee.subSiteDisplay || "-"}
                        </div>
                        <div className="employee-directory-secondary">
                          {employee.subSiteDisplay ? "Sub site available" : "No sub site"}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="employee-directory-pill">
                        {employee.designation?.name || "Not assigned"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`badge ${employee.isActive ? "bg-success" : "bg-secondary"}`}
                      >
                        {employee.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td>
                      <div className="employee-directory-actions app-icon-action-group">
                        <Link
                          className="btn btn-sm btn-info app-icon-action-btn"
                          to={`/view/${employee._id}`}
                          title={`View ${employee.employeeName || employee.employeeCode || "employee"}`}
                          aria-label={`View ${employee.employeeName || employee.employeeCode || "employee"}`}
                        >
                          <ViewIcon />
                        </Link>
                        {canManageEmployeeQr ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-dark app-icon-action-btn"
                            onClick={() => loadEmployeeQr(employee)}
                            title={`${
                              employee.qrCodeUrl ? "View" : "Generate"
                            } QR for ${
                              employee.employeeName || employee.employeeCode || "employee"
                            }`}
                            aria-label={`${
                              employee.qrCodeUrl ? "View" : "Generate"
                            } QR for ${
                              employee.employeeName || employee.employeeCode || "employee"
                            }`}
                          >
                            <QrIcon />
                          </button>
                        ) : null}

                        {canEditEmployee || canToggleEmployeeStatus || canDeleteEmployee ? (
                          <>
                            {canEditEmployee ? (
                              <Link
                                className="btn btn-sm btn-warning app-icon-action-btn"
                                to={`/edit/${employee._id}`}
                                title={`Edit ${employee.employeeName || employee.employeeCode || "employee"}`}
                                aria-label={`Edit ${employee.employeeName || employee.employeeCode || "employee"}`}
                              >
                                <EditIcon />
                              </Link>
                            ) : null}

                            {canToggleEmployeeStatus ? (
                              <button
                                type="button"
                                data-testid="employee-status-toggle"
                                className={`btn btn-sm app-icon-action-btn ${
                                  employee.isActive ? "btn-secondary" : "btn-success"
                                }`}
                                onClick={() => openStatusConfirmation(employee)}
                                title={`${
                                  employee.isActive ? "Deactivate" : "Activate"
                                } ${employee.employeeName || employee.employeeCode || "employee"}`}
                                aria-label={`${
                                  employee.isActive ? "Deactivate" : "Activate"
                                } ${employee.employeeName || employee.employeeCode || "employee"}`}
                              >
                                <ToggleIcon active={employee.isActive} />
                              </button>
                            ) : null}

                            {canDeleteEmployee ? (
                              <button
                                className="btn btn-sm btn-danger app-icon-action-btn"
                                onClick={() => removeEmployee(employee._id)}
                                title={`Delete ${employee.employeeName || employee.employeeCode || "employee"}`}
                                aria-label={`Delete ${employee.employeeName || employee.employeeCode || "employee"}`}
                              >
                                <DeleteIcon />
                              </button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {statusConfirmation ? (
        <EmployeeStatusConfirmationModal
          employee={statusConfirmation}
          saving={statusSaving}
          error={statusError}
          onCancel={closeStatusConfirmation}
          onConfirm={confirmStatusChange}
        />
      ) : null}

      {qrModalEmployee ? (
        <EmployeeQrModal
          employee={qrModalEmployee}
          details={qrDetails}
          loading={qrLoading}
          actionLoading={qrActionLoading}
          error={qrError}
          copyMessage={qrCopyMessage}
          onClose={closeQrModal}
          onToggleAccess={toggleQrAccess}
          onDownload={downloadQr}
          onPrint={printQr}
          onCopy={copyQrLink}
          onQrDataUrl={setQrDataUrl}
          canEditQr={canEditEmployee}
        />
      ) : null}
    </div>
  );
}

function EmployeeAdvancedFilters({ filters, options, onChange, onApply, onClear, hasFilters }) {
  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      onApply();
    }
  };

  const renderOptions = (rows = []) =>
    rows.map((row) => (
      <option key={row} value={row}>
        {row}
      </option>
    ));

  return (
    <div
      id="employee-advanced-filters"
      className="employee-directory-advanced-filters mt-3"
    >
      <div className="employee-directory-advanced-filter-grid">
        <div>
          <label className="form-label fw-semibold small text-uppercase text-muted">
            Employee Code
          </label>
          <input
            className="form-control form-control-sm"
            placeholder="Code"
            value={filters.code}
            onChange={(event) => onChange("code", event.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Advanced filter by employee code"
          />
        </div>

        <div>
          <label className="form-label fw-semibold small text-uppercase text-muted">
            Employee Name / Email
          </label>
          <input
            className="form-control form-control-sm"
            placeholder="Name or email"
            value={filters.nameEmail}
            onChange={(event) => onChange("nameEmail", event.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Advanced filter by employee name or email"
          />
        </div>

        <div>
          <label className="form-label fw-semibold small text-uppercase text-muted">
            Mobile Number
          </label>
          <input
            className="form-control form-control-sm"
            placeholder="Mobile"
            value={filters.mobile}
            onChange={(event) => onChange("mobile", event.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Advanced filter by mobile number"
          />
        </div>

        <div>
          <label className="form-label fw-semibold small text-uppercase text-muted">
            Department
          </label>
          <select
            className="form-select form-select-sm"
            value={filters.department}
            onChange={(event) => onChange("department", event.target.value)}
            aria-label="Advanced filter by department"
          >
            <option value="">All departments</option>
            {renderOptions(options.departments)}
          </select>
        </div>

        <div>
          <label className="form-label fw-semibold small text-uppercase text-muted">
            Sub Department
          </label>
          <select
            className="form-select form-select-sm"
            value={filters.subDepartment}
            onChange={(event) => onChange("subDepartment", event.target.value)}
            aria-label="Advanced filter by sub department"
          >
            <option value="">All sub departments</option>
            {renderOptions(options.subDepartments)}
          </select>
        </div>

        <div>
          <label className="form-label fw-semibold small text-uppercase text-muted">
            Superior Employee
          </label>
          <select
            className="form-select form-select-sm"
            value={filters.superiorEmployee}
            onChange={(event) => onChange("superiorEmployee", event.target.value)}
            aria-label="Advanced filter by superior employee"
          >
            <option value="">All superiors</option>
            {renderOptions(options.superiorEmployees)}
          </select>
        </div>

        <div>
          <label className="form-label fw-semibold small text-uppercase text-muted">
            Site
          </label>
          <select
            className="form-select form-select-sm"
            value={filters.site}
            onChange={(event) => onChange("site", event.target.value)}
            aria-label="Advanced filter by site"
          >
            <option value="">All sites</option>
            {renderOptions(options.sites)}
          </select>
        </div>

        <div>
          <label className="form-label fw-semibold small text-uppercase text-muted">
            Sub Site
          </label>
          <select
            className="form-select form-select-sm"
            value={filters.subSite}
            onChange={(event) => onChange("subSite", event.target.value)}
            aria-label="Advanced filter by sub site"
          >
            <option value="">All sub sites</option>
            {renderOptions(options.subSites)}
          </select>
        </div>

        <div>
          <label className="form-label fw-semibold small text-uppercase text-muted">
            Designation
          </label>
          <select
            className="form-select form-select-sm"
            value={filters.designation}
            onChange={(event) => onChange("designation", event.target.value)}
            aria-label="Advanced filter by designation"
          >
            <option value="">All designations</option>
            {renderOptions(options.designations)}
          </select>
        </div>

        <div>
          <label className="form-label fw-semibold small text-uppercase text-muted">
            Status
          </label>
          <select
            className="form-select form-select-sm"
            value={filters.status}
            onChange={(event) => onChange("status", event.target.value)}
            aria-label="Advanced filter by status"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="employee-directory-advanced-filter-actions">
        <button type="button" className="btn btn-primary" onClick={onApply}>
          Apply
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onClear}
          disabled={!hasFilters}
        >
          Clear Advanced
        </button>
      </div>
    </div>
  );
}

function EmployeeQrModal({
  employee,
  details,
  loading,
  actionLoading,
  error,
  copyMessage,
  onClose,
  onToggleAccess,
  onDownload,
  onPrint,
  onCopy,
  onQrDataUrl,
  canEditQr,
}) {
  const qrUrl = details?.qrCodeUrl || "";
  const employeeName = details?.employeeName || employee.employeeName || "Employee";
  const employeeCode = details?.employeeCode || employee.employeeCode || "";
  const generatedLabel = details?.qrGeneratedAt
    ? new Date(details.qrGeneratedAt).toLocaleString()
    : "";
  const isActionBusy = Boolean(actionLoading);

  return (
    <div
      className="modal fade show d-block app-modal-overlay"
      tabIndex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="employee-qr-modal-title"
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content employee-qr-modal">
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-1" id="employee-qr-modal-title">
                Employee QR Code
              </h5>
              <div className="text-muted small">
                {employeeName} {employeeCode ? `| ${employeeCode}` : ""}
              </div>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onClose}
              disabled={isActionBusy}
            />
          </div>

          <div className="modal-body">
            {loading ? (
              <div className="text-center py-5">Preparing employee QR code...</div>
            ) : error ? (
              <div className="alert alert-danger mb-0">{error}</div>
            ) : details ? (
              <div className="employee-qr-modal__layout">
                <div className="employee-qr-modal__preview">
                  <EmployeeQrCode
                    value={qrUrl}
                    size={260}
                    className="employee-qr-modal__canvas"
                    onDataUrl={onQrDataUrl}
                  />
                  <span
                    className={`badge ${
                      details.qrEnabled ? "bg-success" : "bg-secondary"
                    } mt-3`}
                  >
                    {details.qrEnabled ? "QR Active" : "QR Disabled"}
                  </span>
                </div>

                <div className="employee-qr-modal__details">
                  <div className="employee-qr-modal__employee">{employeeName}</div>
                  <div className="employee-qr-modal__code">{employeeCode || "No code"}</div>
                  <label className="form-label mt-3">QR Link</label>
                  <input className="form-control" value={qrUrl} readOnly />
                  <div className="form-help mt-2">
                    This QR stores only the secure URL. Scans fetch the latest employee master
                    data from the database.
                  </div>
                  {generatedLabel ? (
                    <div className="small text-muted mt-2">Generated: {generatedLabel}</div>
                  ) : null}
                  {copyMessage ? (
                    <div className="alert alert-success py-2 mt-3 mb-0">{copyMessage}</div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="modal-footer d-flex flex-wrap justify-content-between gap-2">
            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={onCopy}
                disabled={!qrUrl || isActionBusy}
              >
                Copy Link
              </button>
              <button
                type="button"
                className="btn btn-outline-success"
                onClick={onDownload}
                disabled={!qrUrl || isActionBusy}
              >
                Download QR
              </button>
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={onPrint}
                disabled={!qrUrl || isActionBusy}
              >
                Print QR
              </button>
            </div>

            <div className="d-flex flex-wrap gap-2">
              {canEditQr ? (
                <button
                  type="button"
                  className={`btn ${details?.qrEnabled ? "btn-outline-danger" : "btn-success"}`}
                  onClick={onToggleAccess}
                  disabled={!details || isActionBusy}
                >
                  {actionLoading === "access"
                    ? "Updating..."
                    : details?.qrEnabled
                    ? "Disable QR"
                    : "Enable QR"}
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={onClose}
                disabled={isActionBusy}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmployeeStatusConfirmationModal({ employee, saving, error, onCancel, onConfirm }) {
  const isDeactivation = employee.isActive;
  const employeeLabel = employee.employeeName || employee.employeeCode || "this employee";

  return (
    <div
      className="modal fade show d-block app-modal-overlay"
      data-testid="confirm-status-modal"
      tabIndex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="employee-status-confirmation-title"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-1" id="employee-status-confirmation-title">
                {isDeactivation
                  ? "Are you sure you want to deactivate this employee?"
                  : "Do you want to activate this employee?"}
              </h5>
              <div className="text-muted small">{employeeLabel}</div>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onCancel}
              disabled={saving}
            />
          </div>
          <div className="modal-body">
            <div
              className={`alert ${
                isDeactivation ? "alert-warning" : "alert-info"
              } d-flex gap-3 align-items-start mb-0`}
              role="alert"
            >
              <span className="fs-4 lh-1" aria-hidden="true">
                ⚠️
              </span>
              <div>
                {isDeactivation
                  ? "This employee will not be able to login, access tasks, or receive assignments."
                  : "This employee will regain access to the system."}
              </div>
            </div>

            {error ? (
              <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">
                {error}
              </div>
            ) : null}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              data-testid="confirm-cancel-button"
              onClick={onCancel}
              disabled={saving}
            >
              No, Cancel
            </button>
            <button
              type="button"
              className={`btn ${isDeactivation ? "btn-danger" : "btn-success"}`}
              data-testid="confirm-ok-button"
              onClick={onConfirm}
              disabled={saving}
            >
              {saving
                ? "Updating..."
                : isDeactivation
                ? "Yes, Deactivate"
                : "Yes, Activate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

