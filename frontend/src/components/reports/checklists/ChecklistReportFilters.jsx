import { formatEmployeeOptionLabel } from "../../../utils/checklistReportFilters";

export default function ChecklistReportFilters({
  filters,
  setFilters,
  onApply,
  onReset,
  options,
}) {
  const {
    companyOptions,
    departments,
    filteredEmployees,
    filteredSites,
    isOwnDataScope,
    ownEmployeeId,
    ownEmployeeOption,
    subDepartmentOptions,
  } = options;

  return (
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
          <button type="button" className="btn btn-primary" onClick={onApply}>
            Apply Filters
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
