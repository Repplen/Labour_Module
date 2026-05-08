import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { usePermissions } from "../../context/usePermissions";
import { formatDepartmentList } from "../../utils/departmentDisplay";
import {
  formatApprovalWorkflowLabel,
  formatApprovalTypeLabel,
  formatChecklistScoreLabel,
  formatChecklistTaskStatus,
  formatCurrentApproverLabel,
  formatDateTime,
  formatEmployeeLabel,
  formatMarkAdjustment,
  formatPriorityLabel,
  formatScheduleLabel,
  formatTaskFinalMarkLabel,
  formatTaskMarkDayLabel,
  formatTimelinessLabel,
  getTaskTargetDateTime,
  getApprovalTypeBadgeClass,
  getApprovalWorkflowEmployees,
  getPriorityBadgeClass,
  getPriorityRowClass,
  getTaskMarkSummary,
  getTimelinessBadgeClass,
  getChecklistTaskStatusBadgeClass,
} from "../../utils/checklistDisplay";

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

const buildSubDepartmentOptions = (departmentRows = [], selectedDepartmentId = "") =>
  (departmentRows || [])
    .filter((department) => String(department._id) === String(selectedDepartmentId || ""))
    .flatMap((department) =>
      flattenSubDepartments(department.subDepartments || [], [], department)
    );

const buildDefaultFilters = (assignedEmployee = "") => ({
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

const getDepartmentLabel = (value) =>
  formatDepartmentList(value?.assignedEmployee?.department || value?.departmentDetails || value?.department) ||
  value?.departmentDisplay ||
  "-";

const formatReportChecklistTaskStatus = (status) =>
  String(status || "").trim().toLowerCase() === "approved"
    ? "Approved"
    : formatChecklistTaskStatus(status);

const formatEmployeeOptionLabel = (employee) => {
  const employeeLabel = formatEmployeeLabel(employee);
  const departmentLabel = getDepartmentLabel(employee);

  return departmentLabel && departmentLabel !== "-"
    ? `${employeeLabel} (${departmentLabel})`
    : employeeLabel;
};

const getDownloadFileName = (headers = {}, fallbackFileName) => {
  const contentDisposition = headers?.["content-disposition"] || "";
  const utfFileNameMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);

  if (utfFileNameMatch?.[1]) {
    return decodeURIComponent(utfFileNameMatch[1]);
  }

  const fileNameMatch = /filename="?([^"]+)"?/i.exec(contentDisposition);
  return fileNameMatch?.[1] || fallbackFileName;
};

export default function ChecklistReport() {
  const { can, canAny, scope } = usePermissions();
  const canReadReports = canAny([
    { moduleKey: "reports", actionKey: "view" },
    { moduleKey: "reports", actionKey: "report_view" },
  ]);
  const canExportReports = canReadReports && can("reports", "export");
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sites, setSites] = useState([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(() => buildDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState(() => buildDefaultFilters());
  const [loading, setLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState("");
  const [reportScopeStrategy, setReportScopeStrategy] = useState(
    String(scope?.strategy || "").trim().toLowerCase()
  );
  const [ownEmployeeId, setOwnEmployeeId] = useState("");
  const isOwnDataScope = reportScopeStrategy === "own";

  useEffect(() => {
    const loadMasters = async () => {
      try {
        const response = await api.get("/checklists/tasks/report/options");
        const nextEmployees = Array.isArray(response.data?.employees)
          ? response.data.employees
          : [];
        const nextDepartments = Array.isArray(response.data?.departments)
          ? response.data.departments
          : [];
        const nextSites = Array.isArray(response.data?.sites) ? response.data.sites : [];
        const nextScopeStrategy = String(
          response.data?.scopeStrategy || scope?.strategy || ""
        )
          .trim()
          .toLowerCase();
        const nextOwnEmployeeId = String(response.data?.currentPrincipalEmployeeId || "");

        setEmployees(nextEmployees);
        setDepartments(nextDepartments);
        setSites(nextSites);
        setReportScopeStrategy(nextScopeStrategy);
        setOwnEmployeeId(nextOwnEmployeeId);

        if (nextScopeStrategy === "own" && nextOwnEmployeeId) {
          const ownFilters = buildDefaultFilters(nextOwnEmployeeId);
          setFilters(ownFilters);
          setAppliedFilters(ownFilters);
        }
      } catch (err) {
        console.error("Checklist report master load failed:", err);
        setEmployees([]);
        setDepartments([]);
        setSites([]);
      }
    };

    void loadMasters();
  }, [scope?.strategy]);

  useEffect(() => {
    const loadReport = async () => {
      setLoading(true);

      try {
        const response = await api.get("/checklists/tasks/report", {
          params: {
            search: search || undefined,
            fromDate: appliedFilters.fromDate || undefined,
            toDate: appliedFilters.toDate || undefined,
            status: appliedFilters.status || undefined,
            scheduleType: appliedFilters.scheduleType || undefined,
            companyName: appliedFilters.companyName || undefined,
            siteId: appliedFilters.siteId || undefined,
            department: appliedFilters.department || undefined,
            subDepartment: appliedFilters.subDepartment || undefined,
            assignedEmployee: appliedFilters.assignedEmployee || undefined,
            timelinessStatus: appliedFilters.timelinessStatus || undefined,
          },
        });

        setRows(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Checklist report load failed:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    void loadReport();
  }, [appliedFilters, search]);

  const applyFilters = () => {
    if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
      alert("From date cannot be greater than to date");
      return;
    }

    const nextFilters =
      isOwnDataScope && ownEmployeeId
        ? { ...filters, assignedEmployee: ownEmployeeId }
        : { ...filters };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
  };

  const clearFilters = () => {
    const resetFilters = buildDefaultFilters(
      isOwnDataScope && ownEmployeeId ? ownEmployeeId : ""
    );
    setFilters(resetFilters);
    setAppliedFilters(resetFilters);
  };

  const subDepartmentOptions = buildSubDepartmentOptions(departments, filters.department);
  const companyOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (sites || [])
            .map((site) => String(site?.companyName || "").trim())
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" })),
    [sites]
  );
  const filteredSites = useMemo(() => {
    if (!filters.companyName) return sites;
    return sites.filter((site) => String(site?.companyName || "") === filters.companyName);
  }, [filters.companyName, sites]);
  const ownEmployeeOption = employees.find(
    (employee) => String(employee?._id || "") === String(ownEmployeeId || "")
  );
  const filteredEmployees = employees.filter((employee) => {
    const siteIds = Array.isArray(employee.sites)
      ? employee.sites.map((site) => String(site?._id || site))
      : [];
    const companyNames = Array.from(
      new Set(
        (Array.isArray(employee.sites) ? employee.sites : [])
          .map((site) => String(site?.companyName || "").trim())
          .filter(Boolean)
      )
    );
    const departmentIds = Array.isArray(employee.departmentIds)
      ? employee.departmentIds.map((item) => String(item))
      : [];
    const subDepartmentIds = Array.isArray(employee.subDepartment)
      ? employee.subDepartment.map((item) => String(item))
      : [];

    if (filters.companyName && !companyNames.includes(String(filters.companyName))) {
      return false;
    }

    if (filters.siteId && !siteIds.includes(String(filters.siteId))) {
      return false;
    }

    if (filters.department && !departmentIds.includes(String(filters.department))) {
      return false;
    }

    if (filters.subDepartment && !subDepartmentIds.includes(String(filters.subDepartment))) {
      return false;
    }

    return true;
  });

  const handleExport = async (format) => {
    setExportingFormat(format);

    try {
      const response = await api.get(`/checklists/tasks/report/export/${format}`, {
        params: {
          search: search || undefined,
          fromDate: appliedFilters.fromDate || undefined,
          toDate: appliedFilters.toDate || undefined,
          status: appliedFilters.status || undefined,
          scheduleType: appliedFilters.scheduleType || undefined,
          companyName: appliedFilters.companyName || undefined,
          siteId: appliedFilters.siteId || undefined,
          department: appliedFilters.department || undefined,
          subDepartment: appliedFilters.subDepartment || undefined,
          assignedEmployee: appliedFilters.assignedEmployee || undefined,
          timelinessStatus: appliedFilters.timelinessStatus || undefined,
        },
        responseType: "blob",
      });

      const fallbackFileName =
        format === "excel" ? "checklist-task-report.xlsx" : "checklist-task-report.pdf";
      const blob = new Blob([response.data], {
        type: response.headers?.["content-type"] || undefined,
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = downloadUrl;
      anchor.download = getDownloadFileName(response.headers, fallbackFileName);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(`Checklist report ${format} export failed:`, err);
      alert(
        format === "excel"
          ? "Failed to download checklist task report in Excel format"
          : "Failed to download checklist task report in PDF format"
      );
    } finally {
      setExportingFormat("");
    }
  };

  return (
    <div className="container-fluid mt-4 mb-5 checklist-report">
      <div className="checklist-report__header mb-3">
        <div className="checklist-report__intro">
          <h3 className="mb-1">Checklist Task Report</h3>
          <div className="text-muted">
            Track generated tasks, submission status, and approval movement across employees.
          </div>
        </div>

        <div className="checklist-report__toolbar">
          {canExportReports ? (
            <div className="checklist-report__toolbar-actions">
              <button
                type="button"
                className="btn btn-outline-success"
                onClick={() => handleExport("excel")}
                disabled={exportingFormat === "excel"}
              >
                {exportingFormat === "excel" ? "Downloading Excel..." : "Download Excel"}
              </button>
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={() => handleExport("pdf")}
                disabled={exportingFormat === "pdf"}
              >
                {exportingFormat === "pdf" ? "Downloading PDF..." : "Download PDF"}
              </button>
            </div>
          ) : null}

          <div className="checklist-report__search">
            <input
              className="form-control checklist-report__search-input"
              placeholder="Search task number or checklist name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-3 checklist-report__filter-card">
        <div className="card-body">
          <div className="row g-3 checklist-report__filter-grid">
            <div className="col-12 col-md-6 col-xl-2">
              <label className="form-label mb-1">From Date</label>
              <input
                type="date"
                className="form-control"
                value={filters.fromDate}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, fromDate: event.target.value }))
                }
              />
            </div>
            <div className="col-12 col-md-6 col-xl-2">
              <label className="form-label mb-1">To Date</label>
              <input
                type="date"
                className="form-control"
                value={filters.toDate}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, toDate: event.target.value }))
                }
              />
            </div>
            <div className="col-12 col-md-6 col-xl-2">
              <label className="form-label mb-1">Status</label>
              <select
                className="form-select"
                value={filters.status}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, status: event.target.value }))
                }
              >
                <option value="">All</option>
                <option value="waiting_dependency">Waiting for Dependency</option>
                <option value="open">Assigned</option>
                <option value="submitted">Under Approval</option>
                <option value="nil_for_approval">Nil For Approval</option>
                <option value="approved">Approved / Completed</option>
                <option value="nil_approved">Nil Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="col-12 col-md-6 col-xl-2">
              <label className="form-label mb-1">Schedule</label>
              <select
                className="form-select"
                value={filters.scheduleType}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, scheduleType: event.target.value }))
                }
              >
                <option value="">All</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="col-12 col-md-6 col-xl-2">
              <label className="form-label mb-1">Company Name</label>
              <select
                className="form-select"
                value={filters.companyName}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    companyName: event.target.value,
                    siteId: "",
                    assignedEmployee: isOwnDataScope ? prev.assignedEmployee : "",
                  }))
                }
              >
                <option value="">All Companies</option>
                {companyOptions.map((companyName) => (
                  <option key={companyName} value={companyName}>
                    {companyName}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6 col-xl-2">
              <label className="form-label mb-1">Site</label>
              <select
                className="form-select"
                value={filters.siteId}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    siteId: event.target.value,
                    assignedEmployee: isOwnDataScope ? prev.assignedEmployee : "",
                  }))
                }
              >
                <option value="">All Sites</option>
                {filteredSites.map((site) => (
                  <option key={site._id} value={site._id}>
                    {[site.companyName, site.name].filter(Boolean).join(" - ") || site.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6 col-xl-2">
              <label className="form-label mb-1">Department</label>
              <select
                className="form-select"
                value={filters.department}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    department: event.target.value,
                    subDepartment: "",
                    assignedEmployee: isOwnDataScope ? prev.assignedEmployee : "",
                  }))
                }
              >
                <option value="">All Departments</option>
                {departments.map((department) => (
                  <option key={department._id} value={department._id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label mb-1">Sub Department</label>
              <select
                className="form-select"
                value={filters.subDepartment}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    subDepartment: event.target.value,
                    assignedEmployee: isOwnDataScope ? prev.assignedEmployee : "",
                  }))
                }
                disabled={!filters.department || !subDepartmentOptions.length}
              >
                <option value="">All Sub Departments</option>
                {subDepartmentOptions.map((subDepartment) => (
                  <option key={subDepartment._id} value={subDepartment._id}>
                    {subDepartment.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6 col-xl-5">
              <label className="form-label mb-1">Employee</label>
              {isOwnDataScope ? (
                <select className="form-select" value={ownEmployeeId} disabled>
                  <option value={ownEmployeeId}>
                    {ownEmployeeOption
                      ? formatEmployeeOptionLabel(ownEmployeeOption)
                      : "Logged-in employee"}
                  </option>
                </select>
              ) : (
                <select
                  className="form-select"
                  value={filters.assignedEmployee}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, assignedEmployee: event.target.value }))
                  }
                >
                  <option value="">All Employees</option>
                  {filteredEmployees.map((employee) => (
                    <option key={employee._id} value={employee._id}>
                      {formatEmployeeOptionLabel(employee)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="col-12 col-md-4 col-xl-2">
              <label className="form-label mb-1">Time</label>
              <select
                className="form-select"
                value={filters.timelinessStatus}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, timelinessStatus: event.target.value }))
                }
              >
                <option value="">All</option>
                <option value="advance">Advance</option>
                <option value="on_time">On Time</option>
                <option value="delayed">Delay</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="checklist-report__filter-actions">
            <button type="button" className="btn btn-primary" onClick={applyFilters}>
              Apply Filters
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={clearFilters}>
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-bordered table-striped align-middle">
          <thead className="table-dark">
            <tr>
              <th>#</th>
              <th>Task Number</th>
              <th>Checklist</th>
              <th>Employee</th>
              <th>Department</th>
              <th>Priority</th>
              <th>Schedule</th>
              <th>Start</th>
              <th>End</th>
              <th>Target Date / Time</th>
              <th>Submitted At</th>
              <th>Submission Status</th>
              <th>Approval Type</th>
              <th>Scoring</th>
              <th>Time Status</th>
              <th>Delay/Advance</th>
              <th>Adjustment</th>
              <th>Final Mark</th>
              <th>Current Approver</th>
              <th>Approval Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="21" className="text-center">
                  Loading checklist task report...
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan="21" className="text-center">
                  No checklist task records found
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row, index) => {
                const currentApproverLabel = formatCurrentApproverLabel(row);
                const approvalWorkflowLabel = formatApprovalWorkflowLabel(row);
                const workflowCount = getApprovalWorkflowEmployees(row).length;
                const markSummary = getTaskMarkSummary(row);
                const approverPrimaryLabel =
                  currentApproverLabel && currentApproverLabel !== "-"
                    ? currentApproverLabel
                    : approvalWorkflowLabel;
                const showWorkflowLabel =
                  workflowCount > 1 &&
                  approvalWorkflowLabel &&
                  approvalWorkflowLabel !== "-";

                return (
                  <tr key={row._id} className={getPriorityRowClass(row)}>
                  <td>{index + 1}</td>
                  <td>{row.taskNumber}</td>
                  <td>
                    <div className="fw-semibold">{row.checklistName}</div>
                    <div className="small text-muted">{row.checklistNumber}</div>
                  </td>
                  <td>{formatEmployeeLabel(row.assignedEmployee)}</td>
                  <td>{getDepartmentLabel(row)}</td>
                  <td>
                    <span className={`badge ${getPriorityBadgeClass(row)}`}>
                      {formatPriorityLabel(row)}
                    </span>
                  </td>
                  <td>{formatScheduleLabel(row)}</td>
                  <td>{formatDateTime(row.occurrenceDate)}</td>
                  <td>{formatDateTime(row.endDateTime)}</td>
                  <td>{formatDateTime(getTaskTargetDateTime(row))}</td>
                  <td>{formatDateTime(row.submittedAt)}</td>
                  <td>{row.submittedAt ? "Submitted" : "Pending Submission"}</td>
                  <td>
                    <span className={`badge ${getApprovalTypeBadgeClass(row)}`}>
                      {formatApprovalTypeLabel(row)}
                    </span>
                  </td>
                  <td>{formatChecklistScoreLabel(row)}</td>
                  <td>
                    <span
                      className={`badge ${getTimelinessBadgeClass(
                        row.submissionTimingStatus || row.timelinessStatus
                      )}`}
                    >
                      {formatTimelinessLabel(
                        row.submissionTimingStatus || row.timelinessStatus
                      )}
                    </span>
                  </td>
                  <td>{formatTaskMarkDayLabel(row)}</td>
                  <td>
                    {markSummary.isNilApproval
                      ? "No Mark"
                      : markSummary.enableMark
                      ? markSummary.adjustment !== null
                        ? formatMarkAdjustment(markSummary.adjustment)
                        : "Pending"
                      : "Not enabled"}
                  </td>
                  <td>{formatTaskFinalMarkLabel(row)}</td>
                  <td>
                    <div>{approverPrimaryLabel || "-"}</div>
                    {showWorkflowLabel && (
                      <div className="small text-muted">Workflow: {approvalWorkflowLabel}</div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${getChecklistTaskStatusBadgeClass(row.status)}`}>
                      {formatReportChecklistTaskStatus(row.status)}
                    </span>
                  </td>
                  <td>
                    <Link className="btn btn-sm btn-info" to={`/checklists/tasks/${row._id}`}>
                      View
                    </Link>
                  </td>
                </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

