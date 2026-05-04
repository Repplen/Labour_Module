import { useEffect, useMemo, useState } from "react";
import { getAttendanceDashboard, getAttendanceOptions } from "../../api/attendanceApi";
import {
  ATTENDANCE_STATUS_OPTIONS,
  buildAttendanceQueryParams,
  formatAttendanceDuration,
  getAttendanceStatusBadgeClass,
  getTodayDateInputValue,
} from "../../utils/attendance";

const defaultFilters = {
  date: getTodayDateInputValue(),
  search: "",
  companyName: "",
  siteId: "",
  departmentId: "",
  subDepartmentId: "",
  employeeId: "",
  status: "",
};

function SummaryCard({ label, value, meta, className = "bg-white" }) {
  return (
    <div className={`card shadow-sm border-0 h-100 ${className}`}>
      <div className="card-body">
        <div className="text-uppercase small text-muted fw-semibold">{label}</div>
        <div className="display-6 fw-bold mb-1">{value}</div>
        <div className="text-muted small">{meta}</div>
      </div>
    </div>
  );
}

export default function AttendanceDashboard() {
  const [options, setOptions] = useState({
    companies: [],
    sites: [],
    departments: [],
    subDepartments: [],
    employees: [],
  });
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [dashboard, setDashboard] = useState({
    cards: {},
    siteWise: [],
    departmentWise: [],
    employeeWise: [],
    alertRows: [],
    employeesInScope: 0,
    dateLabel: "",
  });
  const [loading, setLoading] = useState(false);

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
        console.error("Attendance options load failed:", error);
        setOptions({
          companies: [],
          sites: [],
          departments: [],
          subDepartments: [],
          employees: [],
        });
      }
    };

    void loadOptions();
  }, []);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);

      try {
        const response = await getAttendanceDashboard(
          buildAttendanceQueryParams(appliedFilters)
        );
        setDashboard({
          cards: response.data?.cards || {},
          siteWise: Array.isArray(response.data?.siteWise) ? response.data.siteWise : [],
          departmentWise: Array.isArray(response.data?.departmentWise)
            ? response.data.departmentWise
            : [],
          employeeWise: Array.isArray(response.data?.employeeWise)
            ? response.data.employeeWise
            : [],
          alertRows: Array.isArray(response.data?.alertRows) ? response.data.alertRows : [],
          employeesInScope: Number(response.data?.employeesInScope || 0),
          dateLabel: response.data?.dateLabel || "",
        });
      } catch (error) {
        console.error("Attendance dashboard load failed:", error);
        setDashboard({
          cards: {},
          siteWise: [],
          departmentWise: [],
          employeeWise: [],
          alertRows: [],
          employeesInScope: 0,
          dateLabel: "",
        });
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
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

  return (
    <div className="container-fluid mt-4 mb-5" data-testid="attendance-page">
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="text-uppercase small fw-semibold text-muted">Attendance</div>
          <h2 className="mb-2">Employee Attendance Dashboard</h2>
          <div className="text-muted">
            Track today&apos;s attendance, site-wise coverage, department split, and live alerts.
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-md-3 col-xl-2">
              <label className="form-label">Date</label>
              <input
                type="date"
                className="form-control"
                value={filters.date}
                onChange={(event) => setFilters((current) => ({ ...current, date: event.target.value }))}
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
            <div className="col-12 col-md-3 col-xl-2">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="">All Statuses</option>
                {ATTENDANCE_STATUS_OPTIONS.map((statusOption) => (
                  <option key={statusOption.value} value={statusOption.value}>
                    {statusOption.label}
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
                placeholder="Employee, department, status"
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
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-6 col-xl-3">
          <SummaryCard
            label="Present"
            value={dashboard.cards.presentCount || 0}
            meta={`For ${dashboard.dateLabel || "selected date"}`}
            className="bg-success-subtle"
          />
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <SummaryCard
            label="Absent"
            value={dashboard.cards.absentCount || 0}
            meta="Includes missing check-in based on current rule"
            className="bg-danger-subtle"
          />
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <SummaryCard
            label="Late"
            value={dashboard.cards.lateCount || 0}
            meta="Employees who checked in after grace time"
            className="bg-warning-subtle"
          />
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <SummaryCard
            label="Leave"
            value={dashboard.cards.leaveCount || 0}
            meta={`${dashboard.employeesInScope || 0} employees in current scope`}
            className="bg-primary-subtle"
          />
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-6 col-xl-3">
          <SummaryCard
            label="Half Day"
            value={dashboard.cards.halfDayCount || 0}
            meta="Calculated from minimum half-day hours"
          />
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <SummaryCard
            label="On Duty"
            value={dashboard.cards.onDutyCount || 0}
            meta="Field work and out-of-office duty"
          />
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <SummaryCard
            label="Pending"
            value={dashboard.cards.pendingCount || 0}
            meta="Missing punch still waiting for closure"
          />
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <SummaryCard
            label="Missing Check-Out"
            value={dashboard.cards.missingCheckOutCount || 0}
            meta="Records with check-in but no check-out"
          />
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h5 className="mb-3">Site-wise Attendance</h5>
              <div className="table-responsive">
                <table className="table table-sm align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Site</th>
                      <th>Total</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>Late</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && dashboard.siteWise.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center text-muted">
                          No site summary available
                        </td>
                      </tr>
                    ) : null}
                    {dashboard.siteWise.map((row) => (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        <td>{row.total}</td>
                        <td>{row.present}</td>
                        <td>{row.absent}</td>
                        <td>{row.late}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <h5 className="mb-3">Department-wise Attendance</h5>
              <div className="table-responsive">
                <table className="table table-sm align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Department</th>
                      <th>Total</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>Late</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && dashboard.departmentWise.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center text-muted">
                          No department summary available
                        </td>
                      </tr>
                    ) : null}
                    {dashboard.departmentWise.map((row) => (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        <td>{row.total}</td>
                        <td>{row.present}</td>
                        <td>{row.absent}</td>
                        <td>{row.late}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12">
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body">
              <h5 className="mb-3">Employee Attendance Summary</h5>
              <div className="table-responsive">
                <table className="table table-bordered align-middle" data-testid="attendance-table">
                  <thead className="table-dark">
                    <tr>
                      <th>Employee</th>
                      <th>Site</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Working Hours</th>
                      <th>Late Minutes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="8" className="text-center">
                          Loading attendance dashboard...
                        </td>
                      </tr>
                    ) : dashboard.employeeWise.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="text-center text-muted">
                          No attendance rows found for the selected filters
                        </td>
                      </tr>
                    ) : (
                      dashboard.employeeWise.map((row) => (
                        <tr key={row._id}>
                          <td>{row.employeeDisplayName}</td>
                          <td>{row.siteDisplayName || "-"}</td>
                          <td>{row.departmentName || "-"}</td>
                          <td>
                            <span
                              className={`badge ${getAttendanceStatusBadgeClass(
                                row.status,
                                row.isLate
                              )}`}
                            >
                              {row.statusLabel}
                            </span>
                          </td>
                          <td>{row.checkInLabel || "-"}</td>
                          <td>{row.checkOutLabel || "-"}</td>
                          <td>{row.totalWorkingHoursLabel || formatAttendanceDuration(row.totalWorkingMinutes)}</td>
                          <td>{Number(row.lateMinutes || 0)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              <h5 className="mb-3">Late / Missing Checkout Alerts</h5>
              <div className="table-responsive">
                <table className="table table-sm align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Employee</th>
                      <th>Status</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Late Minutes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.alertRows.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center text-muted">
                          No late or missing checkout alerts right now
                        </td>
                      </tr>
                    ) : (
                      dashboard.alertRows.map((row) => (
                        <tr key={`alert-${row._id}`}>
                          <td>{row.employeeDisplayName}</td>
                          <td>
                            <span
                              className={`badge ${getAttendanceStatusBadgeClass(
                                row.status,
                                row.isLate
                              )}`}
                            >
                              {row.statusLabel}
                            </span>
                          </td>
                          <td>{row.checkInLabel || "-"}</td>
                          <td>{row.checkOutLabel || "-"}</td>
                          <td>{Number(row.lateMinutes || 0)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
