import { useEffect, useMemo, useState } from "react";
import {
  exportMonthlyAttendanceReport,
  getAttendanceOptions,
  getMonthlyAttendanceReport,
} from "../../api/attendanceApi";
import Pagination from "../../components/Pagination";
import { usePagination } from "../../hooks/usePagination";
import { usePermissions } from "../../context/usePermissions";
import {
  buildAttendanceQueryParams,
  getCurrentMonthValue,
} from "../../utils/attendance";

const defaultFilters = {
  month: getCurrentMonthValue(),
  search: "",
  companyName: "",
  siteId: "",
  departmentId: "",
  subDepartmentId: "",
  employeeId: "",
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

export default function AttendanceReport() {
  const { can } = usePermissions();
  const canExport = can("attendance_reports", "export");
  const [options, setOptions] = useState({
    companies: [],
    sites: [],
    departments: [],
    subDepartments: [],
    employees: [],
  });
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [report, setReport] = useState({
    summary: {},
    rows: [],
    month: "",
  });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const pagination = usePagination(report.rows, { initialPageSize: 25 });
  const { paginatedData } = pagination;

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const response = await getAttendanceOptions();
        setOptions({
          companies: Array.isArray(response.data?.companies) ? response.data.companies : [],
          sites: Array.isArray(response.data?.sites) ? response.data.sites : [],
          departments: Array.isArray(response.data?.departments) ? response.data.departments : [],
          subDepartments: Array.isArray(response.data?.subDepartments)
            ? response.data.subDepartments
            : [],
          employees: Array.isArray(response.data?.employees) ? response.data.employees : [],
        });
      } catch (error) {
        console.error("Attendance report options load failed:", error);
      }
    };

    void loadOptions();
  }, []);

  useEffect(() => {
    const loadReport = async () => {
      setLoading(true);

      try {
        const response = await getMonthlyAttendanceReport(
          buildAttendanceQueryParams(appliedFilters)
        );
        setReport({
          summary: response.data?.summary || {},
          rows: Array.isArray(response.data?.rows) ? response.data.rows : [],
          month: response.data?.month || appliedFilters.month,
        });
      } catch (error) {
        console.error("Attendance report load failed:", error);
        setReport({
          summary: {},
          rows: [],
          month: appliedFilters.month,
        });
      } finally {
        setLoading(false);
      }
    };

    void loadReport();
  }, [appliedFilters]);

  const filteredSites = useMemo(() => {
    if (!filters.companyName) return options.sites;
    return options.sites.filter((site) => site.companyName === filters.companyName);
  }, [filters.companyName, options.sites]);

  const filteredSubDepartments = useMemo(() => {
    if (!filters.departmentId) return options.subDepartments;
    return options.subDepartments.filter(
      (subDepartment) => subDepartment.departmentId === filters.departmentId
    );
  }, [filters.departmentId, options.subDepartments]);

  const filteredEmployees = useMemo(
    () =>
      options.employees.filter((employee) => {
        if (filters.companyName && !employee.companyNames.includes(filters.companyName)) {
          return false;
        }
        if (filters.siteId && !employee.sites.includes(filters.siteId)) return false;
        if (filters.departmentId && !employee.departments.includes(filters.departmentId)) {
          return false;
        }
        if (filters.subDepartmentId && !employee.subDepartments.includes(filters.subDepartmentId)) {
          return false;
        }
        return true;
      }),
    [
      filters.companyName,
      filters.departmentId,
      filters.siteId,
      filters.subDepartmentId,
      options.employees,
    ]
  );

  const handleExport = async () => {
    setExporting(true);

    try {
      const response = await exportMonthlyAttendanceReport(
        buildAttendanceQueryParams(appliedFilters)
      );
      const blob = new Blob([response.data], {
        type: response.headers?.["content-type"] || undefined,
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = downloadUrl;
      anchor.download = getDownloadFileName(
        response.headers,
        `attendance-report-${report.month || appliedFilters.month}.xlsx`
      );
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Attendance report export failed:", error);
      alert(error.response?.data?.message || "Failed to export attendance report");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="container-fluid mt-4 mb-5">
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="text-uppercase small fw-semibold text-muted">Attendance</div>
          <h2 className="mb-2">Monthly Attendance Report</h2>
          <div className="text-muted">
            Review monthly present, absent, leave, half day, late, and working day totals.
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-md-3 col-xl-2">
              <label className="form-label">Month</label>
              <input
                type="month"
                className="form-control"
                value={filters.month}
                onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))}
              />
            </div>
            <div className="col-12 col-md-3 col-xl-2">
              <label className="form-label">Company</label>
              <select
                className="form-select"
                value={filters.companyName}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    companyName: event.target.value,
                    siteId: "",
                  }))
                }
              >
                <option value="">All Companies</option>
                {options.companies.map((company) => (
                  <option key={company.value} value={company.value}>
                    {company.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-3 col-xl-2">
              <label className="form-label">Site</label>
              <select
                className="form-select"
                value={filters.siteId}
                onChange={(event) => setFilters((current) => ({ ...current, siteId: event.target.value }))}
              >
                <option value="">All Sites</option>
                {filteredSites.map((site) => (
                  <option key={site.value} value={site.value}>
                    {site.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-3 col-xl-2">
              <label className="form-label">Department</label>
              <select
                className="form-select"
                value={filters.departmentId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    departmentId: event.target.value,
                    subDepartmentId: "",
                    employeeId: "",
                  }))
                }
              >
                <option value="">All Departments</option>
                {options.departments.map((department) => (
                  <option key={department.value} value={department.value}>
                    {department.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-3 col-xl-2">
              <label className="form-label">Sub Department</label>
              <select
                className="form-select"
                value={filters.subDepartmentId}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    subDepartmentId: event.target.value,
                    employeeId: "",
                  }))
                }
              >
                <option value="">All Sub Departments</option>
                {filteredSubDepartments.map((subDepartment) => (
                  <option key={subDepartment.value} value={subDepartment.value}>
                    {subDepartment.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6 col-xl-4">
              <label className="form-label">Employee</label>
              <select
                className="form-select"
                value={filters.employeeId}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, employeeId: event.target.value }))
                }
              >
                <option value="">All Employees</option>
                {filteredEmployees.map((employee) => (
                  <option key={employee.value} value={employee.value}>
                    {employee.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6 col-xl-4">
              <label className="form-label">Search</label>
              <input
                className="form-control"
                placeholder="Employee, reporting head, department"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              />
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setAppliedFilters({ ...filters })}
            >
              Apply Filters
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => {
                setFilters(defaultFilters);
                setAppliedFilters(defaultFilters);
              }}
            >
              Reset
            </button>
            {canExport ? (
              <button
                type="button"
                className="btn btn-outline-success"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? "Downloading..." : "Download Excel"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-6 col-xl-2">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="small text-muted">Employees</div>
              <div className="display-6 fw-bold">{report.summary.totalEmployees || 0}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-2">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="small text-muted">Present Days</div>
              <div className="display-6 fw-bold">{report.summary.totalPresentDays || 0}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-2">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="small text-muted">Absent Days</div>
              <div className="display-6 fw-bold">{report.summary.totalAbsentDays || 0}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-2">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="small text-muted">Leave Days</div>
              <div className="display-6 fw-bold">{report.summary.totalLeaveDays || 0}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-2">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="small text-muted">Half Days</div>
              <div className="display-6 fw-bold">{report.summary.totalHalfDays || 0}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl-2">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="small text-muted">Late Days</div>
              <div className="display-6 fw-bold">{report.summary.totalLateDays || 0}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <h5 className="mb-3">Employee-wise Monthly Summary</h5>
          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-dark">
                <tr>
                  <th>Employee</th>
                  <th>Company</th>
                  <th>Site</th>
                  <th>Department</th>
                  <th>Reporting Head</th>
                  <th>Working Days</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Leave</th>
                  <th>Half Day</th>
                  <th>Late</th>
                  <th>Week Off</th>
                  <th>Holiday</th>
                  <th>On Duty</th>
                  <th>Pending</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="15" className="text-center">
                      Loading monthly attendance report...
                    </td>
                  </tr>
                ) : report.rows.length === 0 ? (
                  <tr>
                    <td colSpan="15" className="text-center text-muted">
                      No attendance summary rows found
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((row) => (
                    <tr key={row.employeeId}>
                      <td>{row.employeeDisplayName}</td>
                      <td>{row.companyName || "-"}</td>
                      <td>{row.siteName || "-"}</td>
                      <td>{row.departmentName || "-"}</td>
                      <td>{row.reportingHeadName || "-"}</td>
                      <td>{row.workingDays}</td>
                      <td>{row.totalPresentDays}</td>
                      <td>{row.totalAbsentDays}</td>
                      <td>{row.totalLeaveDays}</td>
                      <td>{row.totalHalfDays}</td>
                      <td>{row.totalLateDays}</td>
                      <td>{row.totalWeekOffDays}</td>
                      <td>{row.totalHolidayDays}</td>
                      <td>{row.totalOnDutyDays}</td>
                      <td>{row.totalPendingDays}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination {...pagination} />
        </div>
      </div>
    </div>
  );
}

