import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { usePermissions } from "../../context/usePermissions";
import {
  formatPollAssignmentStatusLabel,
  formatPollDateTime,
  formatPollScopeTypeLabel,
  formatPollWindowStateLabel,
  getPollAssignmentBadgeClass,
  getPollWindowBadgeClass,
} from "../../utils/pollDisplay";

export default function PollList() {
  const { can } = usePermissions();
  const canManagePolls = can("poll_master", "view");
  const canCreatePolls = can("poll_master", "add");
  const canEditPolls = can("poll_master", "edit");
  const canDeletePolls = can("poll_master", "delete");
  const canTogglePollStatus = can("poll_master", "status_update");
  const canViewPollReports = can("poll_master", "report_view");
  const canViewAssignedPolls = can("assigned_polls", "view");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [scopeType, setScopeType] = useState("");

  useEffect(() => {
    const loadRows = async () => {
      setLoading(true);

      try {
        const response = await api.get(canManagePolls ? "/polls" : "/polls/my", {
          params: {
            search: search || undefined,
            status: status || undefined,
            scopeType: canManagePolls ? scopeType || undefined : undefined,
          },
        });

        setRows(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Poll list load failed:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    if (canManagePolls || canViewAssignedPolls) {
      void loadRows();
    }
  }, [canManagePolls, canViewAssignedPolls, scopeType, search, status]);

  const togglePollStatus = async (pollId) => {
    try {
      const response = await api.patch(`/polls/${pollId}/status`);
      const nextStatus = response.data?.status || "";
      const nextWindowState = response.data?.windowState || nextStatus;

      setRows((currentRows) =>
        currentRows.map((row) =>
          row._id === pollId
            ? {
                ...row,
                status: nextStatus || row.status,
                windowState: nextWindowState || row.windowState,
                isEnabled:
                  typeof response.data?.isEnabled === "boolean"
                    ? response.data.isEnabled
                    : row.isEnabled,
              }
            : row
        )
      );
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update poll status");
    }
  };

  const deletePoll = async (pollId) => {
    if (!window.confirm("Delete this poll?")) return;

    try {
      await api.delete(`/polls/${pollId}`);
      setRows((currentRows) => currentRows.filter((row) => row._id !== pollId));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete poll");
    }
  };

  if (!canManagePolls && !canViewAssignedPolls) {
    return <div className="container mt-4">You do not have access to this module.</div>;
  }

  return (
    <div className="container-fluid mt-4 mb-5" data-testid="poll-master-page">
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Polling</div>
            <h3 className="mb-1">{canManagePolls ? "Polling System" : "Assigned Polls"}</h3>
            <p className="page-subtitle mb-0">
              {canManagePolls
                ? "Create scoped polls, assign them automatically, and follow completion progress."
                : "Answer the polls assigned to you and keep track of your submission status."}
            </p>
          </div>

          <div className="d-flex flex-wrap gap-2">
            {canViewPollReports ? (
              <Link className="btn btn-outline-primary" to="/reports/polls">
                Poll Results
              </Link>
            ) : null}
            {canCreatePolls ? (
              <Link className="btn btn-success" to="/polls/create" data-testid="add-poll-button">
                Create Poll
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="soft-card mb-4">
        <div className="row g-3 align-items-end">
          <div className="col-lg-5">
            <label className="form-label fw-semibold">Search</label>
            <input
              className="form-control"
              placeholder={canManagePolls ? "Search poll title or description" : "Search assigned poll"}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="col-lg-3">
            <label className="form-label fw-semibold">
              {canManagePolls ? "Poll Status" : "Submission Status"}
            </label>
            <select
              className="form-select"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All</option>
              {canManagePolls ? (
                <>
                  <option value="upcoming">Upcoming</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="inactive">Inactive</option>
                </>
              ) : (
                <>
                  <option value="not_answered">Not Answered</option>
                  <option value="submitted">Submitted</option>
                </>
              )}
            </select>
          </div>

          {canManagePolls ? (
            <div className="col-lg-3">
              <label className="form-label fw-semibold">Scope</label>
              <select
                className="form-select"
                value={scopeType}
                onChange={(event) => setScopeType(event.target.value)}
              >
                <option value="">All</option>
                <option value="company">Company</option>
                <option value="site">Site</option>
                <option value="department">Department</option>
              </select>
            </div>
          ) : null}
        </div>
      </div>

      <div className="table-shell">
        <div className="table-responsive">
          <table className="table table-bordered align-middle" data-testid="poll-table">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Title</th>
                {canManagePolls ? <th>Scope</th> : null}
                <th>Window</th>
                <th>Status</th>
                {canManagePolls ? <th>Responses</th> : null}
                <th width={canManagePolls ? 260 : 150}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canManagePolls ? 7 : 5} className="text-center py-4">
                    Loading polls...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={canManagePolls ? 7 : 5} className="text-center py-4">
                    No poll records found
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row._id}>
                    <td>{index + 1}</td>
                    <td>
                      <div className="fw-semibold">{row.title}</div>
                      <div className="small text-muted">{row.description || "-"}</div>
                      {"questionCount" in row ? (
                        <div className="small text-muted">
                          {row.questionCount} question{row.questionCount === 1 ? "" : "s"}
                        </div>
                      ) : null}
                    </td>
                    {canManagePolls ? (
                      <td>
                        <div className="fw-semibold">
                          {formatPollScopeTypeLabel(row.scopeType)}
                        </div>
                        <div className="small text-muted">
                          {row.scopeSummary?.labelText || "-"}
                        </div>
                      </td>
                    ) : null}
                    <td>
                      <div>{formatPollDateTime(row.startDateTime || row.startDate)}</div>
                      <div className="small text-muted">
                        to {formatPollDateTime(row.endDateTime || row.endDate)}
                      </div>
                    </td>
                    <td>
                      <div className="d-flex flex-wrap gap-2">
                        <span className={`badge ${getPollWindowBadgeClass(row.windowState)}`}>
                          {formatPollWindowStateLabel(row.windowState)}
                        </span>
                        {canManagePolls ? (
                          <span
                            className={`badge ${
                              row.isEnabled === false
                                ? getPollWindowBadgeClass("inactive")
                                : "bg-light text-dark border"
                            }`}
                          >
                            {row.isEnabled === false ? "Inactive" : "Enabled"}
                          </span>
                        ) : (
                          <span className={`badge ${getPollAssignmentBadgeClass(row.assignmentStatus)}`}>
                            {formatPollAssignmentStatusLabel(row.assignmentStatus)}
                          </span>
                        )}
                      </div>
                      {!canManagePolls && row.submittedAt ? (
                        <div className="small text-muted mt-1">
                          Submitted: {formatPollDateTime(row.submittedAt)}
                        </div>
                      ) : null}
                    </td>
                    {canManagePolls ? (
                      <td>
                        <div className="fw-semibold">{row.counts?.submitted || 0} submitted</div>
                        <div className="small text-muted">
                          {row.counts?.pending || 0} pending of {row.counts?.total || 0}
                        </div>
                      </td>
                    ) : null}
                    <td>
                      <div className="d-flex flex-wrap gap-2">
                        {canManagePolls ? (
                          <>
                            {canEditPolls ? (
                              <Link className="btn btn-sm btn-outline-warning" to={`/polls/edit/${row._id}`}>
                                Edit
                              </Link>
                            ) : null}
                            {canViewPollReports ? (
                              <Link className="btn btn-sm btn-outline-primary" to={`/reports/polls?pollId=${row._id}`}>
                                Result
                              </Link>
                            ) : null}
                            {canTogglePollStatus ? (
                              <button
                                type="button"
                                className={`btn btn-sm ${
                                  row.isEnabled === false ? "btn-outline-success" : "btn-outline-secondary"
                                }`}
                                onClick={() => togglePollStatus(row._id)}
                              >
                                {row.isEnabled === false ? "Activate" : "Deactivate"}
                              </button>
                            ) : null}
                            {canDeletePolls ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => deletePoll(row._id)}
                              >
                                Delete
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <Link className="btn btn-sm btn-outline-primary" to={`/polls/my/${row._id}`}>
                            {row.canSubmit ? (row.assignmentStatus === "submitted" ? "Resubmit" : "Open") : "View"}
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

