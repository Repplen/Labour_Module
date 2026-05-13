import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import {
  formatChecklistTaskStatus,
  formatDate,
  formatScheduleLabel,
  getChecklistTaskStatusBadgeClass,
} from "../../utils/checklistDisplay";

const statusOptions = [
  { value: "open", label: "Assigned" },
  { value: "submitted", label: "Under Approval" },
  { value: "nil_for_approval", label: "Nil For Approval" },
  { value: "approved", label: "Approved / Completed" },
  { value: "nil_approved", label: "Nil Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "waiting_dependency", label: "Waiting for Dependency" },
];

const scheduleOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

const formatTimeFromDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
};

const getSummary = (rows = []) => ({
  total: rows.length,
  assigned: rows.filter((row) => row.status === "open").length,
  underApproval: rows.filter((row) =>
    ["submitted", "nil_for_approval"].includes(String(row.status || ""))
  ).length,
  completed: rows.filter((row) =>
    ["approved", "nil_approved"].includes(String(row.status || ""))
  ).length,
  rejected: rows.filter((row) => row.status === "rejected").length,
});

const buildParams = ({ search, status, scheduleType, fromDate, toDate }) => {
  const params = {};
  if (search.trim()) params.search = search.trim();
  if (status) params.status = status;
  if (scheduleType) params.scheduleType = scheduleType;
  if (fromDate) params.fromDate = fromDate;
  if (toDate) params.toDate = toDate;
  return params;
};

function StatusBadge({ status }) {
  return (
    <span className={`badge ${getChecklistTaskStatusBadgeClass(status)}`}>
      {formatChecklistTaskStatus(status)}
    </span>
  );
}

function YourChecklistMobileCard({ row, index }) {
  return (
    <div className="your-checklist-card">
      <div className="d-flex justify-content-between align-items-start gap-3">
        <div>
          <div className="small text-muted">#{index + 1}</div>
          <div className="fw-semibold">{row.checklistName || "-"}</div>
          <div className="small text-muted">{row.checklistNumber || "-"}</div>
        </div>
        <StatusBadge status={row.status} />
      </div>

      <div className="your-checklist-card__grid mt-3">
        <div>
          <div className="small text-muted">Start Date</div>
          <div>{formatDate(row.startDateTime)}</div>
        </div>
        <div>
          <div className="small text-muted">Start Time</div>
          <div>{formatTimeFromDateTime(row.startDateTime)}</div>
        </div>
        <div>
          <div className="small text-muted">End Date</div>
          <div>{formatDate(row.endDateTime)}</div>
        </div>
        <div>
          <div className="small text-muted">End Time</div>
          <div>{formatTimeFromDateTime(row.endDateTime)}</div>
        </div>
        <div>
          <div className="small text-muted">Schedule</div>
          <div>{formatScheduleLabel(row)}</div>
        </div>
      </div>

      <div className="mt-3">
        <Link className="btn btn-sm btn-info" to={`/checklists/tasks/${row._id}`}>
          View
        </Link>
      </div>
    </div>
  );
}

export default function YourChecklist() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [scheduleType, setScheduleType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const summary = useMemo(() => getSummary(rows), [rows]);
  const hasFilters = Boolean(search.trim() || status || scheduleType || fromDate || toDate);

  useEffect(() => {
    let active = true;

    const loadRows = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/checklist-tasks/your-checklist", {
          params: buildParams({ search, status, scheduleType, fromDate, toDate }),
        });
        const taskRows = Array.isArray(response.data?.tasks) ? response.data.tasks : [];

        if (active) {
          setRows(taskRows);
        }
      } catch (err) {
        if (active) {
          setRows([]);
          setError(err.response?.data?.message || "Failed to load your checklist.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadRows();

    return () => {
      active = false;
    };
  }, [fromDate, scheduleType, search, status, toDate]);

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setScheduleType("");
    setFromDate("");
    setToDate("");
  };

  return (
    <div className="container-fluid mt-4 mb-5 your-checklist-page">
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Checklists</div>
            <h3 className="mb-1">Your Checklist</h3>
            <div className="page-subtitle">
              View your assigned checklist list and open the existing task detail when needed.
            </div>
          </div>
        </div>

        <div className="list-summary mt-3">
          <span className="summary-chip">{summary.total} checklists</span>
          <span className="summary-chip summary-chip--neutral">{summary.assigned} assigned</span>
          <span className="summary-chip summary-chip--neutral">
            {summary.underApproval} under approval
          </span>
          <span className="summary-chip summary-chip--neutral">{summary.completed} completed</span>
          <span className="summary-chip summary-chip--neutral">{summary.rejected} rejected</span>
        </div>
      </div>

      <div className="filter-card mb-4">
        <div className="list-toolbar">
          <div>
            <h6 className="mb-1">Filters</h6>
            <div className="form-help">Narrow your checklist list by name, status, schedule, or date.</div>
          </div>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={clearFilters}
            disabled={!hasFilters}
          >
            Clear Filters
          </button>
        </div>

        <div className="row g-2 mt-1">
          <div className="col-12 col-lg-4">
            <input
              className="form-control"
              placeholder="Search checklist number or checklist name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="col-12 col-md-6 col-lg-2">
            <select
              className="form-select"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-6 col-lg-2">
            <select
              className="form-select"
              value={scheduleType}
              onChange={(event) => setScheduleType(event.target.value)}
            >
              <option value="">All schedules</option>
              {scheduleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-6 col-lg-2">
            <input
              className="form-control"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              aria-label="From date"
            />
          </div>
          <div className="col-12 col-md-6 col-lg-2">
            <input
              className="form-control"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              aria-label="To date"
            />
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="table-shell d-none d-lg-block">
        <div className="table-responsive">
          <table className="table table-bordered table-striped align-middle">
            <thead className="table-dark">
              <tr>
                <th>S.No</th>
                <th>Checklist Number</th>
                <th>Checklist Name</th>
                <th>Start Date</th>
                <th>Start Time</th>
                <th>End Date</th>
                <th>End Time</th>
                <th>Schedule</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" className="text-center">
                    Loading your checklist...
                  </td>
                </tr>
              ) : null}

              {!loading && !rows.length ? (
                <tr>
                  <td colSpan="10" className="text-center">
                    No checklist records found
                  </td>
                </tr>
              ) : null}

              {!loading
                ? rows.map((row, index) => (
                    <tr key={row._id}>
                      <td>{index + 1}</td>
                      <td>{row.checklistNumber || "-"}</td>
                      <td className="fw-semibold">{row.checklistName || "-"}</td>
                      <td>{formatDate(row.startDateTime)}</td>
                      <td>{formatTimeFromDateTime(row.startDateTime)}</td>
                      <td>{formatDate(row.endDateTime)}</td>
                      <td>{formatTimeFromDateTime(row.endDateTime)}</td>
                      <td>{formatScheduleLabel(row)}</td>
                      <td>
                        <StatusBadge status={row.status} />
                      </td>
                      <td>
                        <Link className="btn btn-sm btn-info" to={`/checklists/tasks/${row._id}`}>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="d-lg-none">
        {loading ? <div className="empty-state py-4">Loading your checklist...</div> : null}
        {!loading && !rows.length ? (
          <div className="empty-state py-4">No checklist records found</div>
        ) : null}
        {!loading
          ? rows.map((row, index) => (
              <YourChecklistMobileCard key={row._id} row={row} index={index} />
            ))
          : null}
      </div>
    </div>
  );
}
