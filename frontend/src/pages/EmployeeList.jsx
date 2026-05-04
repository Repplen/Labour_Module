import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";
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

export default function EmployeeList() {
  const { can } = usePermissions();
  const [employees, setEmployees] = useState([]);
  const [photoErrors, setPhotoErrors] = useState({});
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [statusConfirmation, setStatusConfirmation] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState("");

  const [params] = useSearchParams();
  const department = params.get("department");
  const paramsKey = params.toString();
  const canAddEmployee = can("employee_master", "add");
  const canEditEmployee = can("employee_master", "edit");
  const canDeleteEmployee = can("employee_master", "delete");
  const canToggleEmployeeStatus = can("employee_master", "status_update");
  const canExportEmployees = can("employee_master", "export");
  const uploadBaseUrl = useMemo(
    () => (api.defaults.baseURL || "http://localhost:5000/api").replace(/\/api\/?$/, ""),
    []
  );

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
        employees.some((employee) => String(employee._id) === String(selectedId))
      )
    );
  }, [canDeleteEmployee, employees]);

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
    const visibleEmployeeIds = employees.map((employee) => String(employee._id));

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

  const clearFilters = () => {
    setSearch("");
    setStatus("");
  };

  const allEmployeesSelected =
    employees.length > 0 &&
    employees.every((employee) => selectedEmployeeIds.includes(String(employee._id)));
  const activeCount = employees.filter((employee) => employee.isActive).length;
  const inactiveCount = employees.length - activeCount;
  const hasFilters = Boolean(search.trim() || status || department);
  const stats = [
    {
      label: "Employees Visible",
      value: employees.length,
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
              Narrow the list by keyword or status, then move directly into view, edit, export, or
              bulk clean-up actions.
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={clearFilters}
              disabled={!search && !status}
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

        {department ? (
          <div className="alert alert-info py-2 mt-3 mb-0">
            This list is currently filtered from a dashboard selection.
          </div>
        ) : hasFilters ? (
          <div className="form-help mt-3">
            Filtered results update automatically while you type or change the status.
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
                      disabled={!employees.length || bulkDeleteLoading}
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
                <th width="220">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canDeleteEmployee ? 12 : 11} className="text-center py-4">
                    Loading employees...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={canDeleteEmployee ? 12 : 11} className="text-center py-4">
                    No employees found for the current filters.
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
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

