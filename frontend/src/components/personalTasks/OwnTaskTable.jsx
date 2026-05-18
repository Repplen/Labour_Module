import {
  formatEmployeeLabel,
  formatNotificationStateLabel,
  formatPersonalTaskDateTime,
  formatPersonalTaskStatus,
  formatReminderRuleLabel,
  getNotificationStateBadgeClass,
  getPersonalTaskStatusBadgeClass,
} from "../../utils/personalTaskDisplay";
import { getViewerTaskLabel } from "../../utils/personalTaskForm";

export default function OwnTaskTable({
  completingTaskId,
  id,
  loading,
  onCompleteTask,
  onOpenShareModal,
  onViewTask,
  rows,
  sharingTaskId,
}) {
  return (
    <div className="table-shell own-tasks-table-shell">
      <div className="table-responsive">
        <table className="table table-bordered align-middle mb-0 own-tasks-table">
          <thead className="table-dark">
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Reminder</th>
              <th>Type</th>
              <th>Notification</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center">
                  Loading tasks...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center">
                  No tasks found
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const isSelected = String(row._id) === String(id || "");

                return (
                  <tr
                    key={row._id}
                    className={`own-task-row${isSelected ? " own-task-row--selected" : ""}${
                      row.notificationState === "due" ? " own-task-row--due" : ""
                    }`}
                  >
                    <td>{index + 1}</td>
                    <td>
                      <div className="own-tasks-title-cell">
                        <div className="fw-semibold">{row.title || "-"}</div>
                        <div className="small text-muted">
                          {row.description || "No description added"}
                        </div>
                        <div className="d-flex flex-wrap gap-2 mt-2">
                          <span className="badge text-bg-light">{getViewerTaskLabel(row)}</span>
                          {row.isSharedTask ? (
                            <span className="small text-muted">
                              Shared by: {formatEmployeeLabel(row.creator)}
                            </span>
                          ) : null}
                        </div>
                        <div className="small text-muted mt-1">
                          Assigned to: {formatEmployeeLabel(row.assignedEmployee)}
                        </div>
                        {row.status === "completed" ? (
                          <div className="small text-muted">
                            Completed: {formatPersonalTaskDateTime(row.completedAt)}
                          </div>
                        ) : null}
                        {row.attachment ? (
                          <div className="small text-primary mt-1">Image attached</div>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div>{formatPersonalTaskDateTime(row.scheduledAt)}</div>
                      <div className="small text-muted">
                        Next: {formatPersonalTaskDateTime(row.nextReminderAt)}
                      </div>
                    </td>
                    <td>{formatReminderRuleLabel(row)}</td>
                    <td>
                      <div className="d-flex flex-column gap-1">
                        <span
                          className={`badge align-self-start ${getNotificationStateBadgeClass(
                            row.notificationState
                          )}`}
                        >
                          {formatNotificationStateLabel(row.notificationState)}
                        </span>
                        <span className="small text-muted">
                          {formatPersonalTaskDateTime(row.notificationAt)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getPersonalTaskStatusBadgeClass(row.status)}`}>
                        {formatPersonalTaskStatus(row.status)}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex flex-wrap gap-2 own-tasks-row-actions">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => onViewTask(row._id)}
                        >
                          View
                        </button>
                        {row.canShare && row.status !== "completed" ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => {
                              void onOpenShareModal(row);
                            }}
                            disabled={String(sharingTaskId) === String(row._id)}
                          >
                            Sharing Employee
                          </button>
                        ) : null}
                        {row.canComplete || row.status === "completed" ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success"
                            onClick={() => onCompleteTask(row._id)}
                            disabled={
                              row.status === "completed" ||
                              !row.canComplete ||
                              String(completingTaskId) === String(row._id)
                            }
                          >
                            {String(completingTaskId) === String(row._id)
                              ? "Updating..."
                              : row.status === "completed"
                              ? "Completed"
                              : "Complete"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
