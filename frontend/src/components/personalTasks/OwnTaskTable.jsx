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
import Pagination from "../Pagination";
import { usePagination } from "../../hooks/usePagination";
import OwnTaskRowActions from "./OwnTaskRowActions";

export default function OwnTaskTable({
  completingTaskId,
  hasFilters,
  id,
  loading,
  onCompleteTask,
  onOpenShareModal,
  onViewTask,
  rows,
  sharingTaskId,
}) {
  const pagination = usePagination(rows);
  const { paginatedData } = pagination;
  return (
    <div className="table-shell own-tasks-table-shell">
      <div className="table-responsive">
        <table className="table table-bordered align-middle mb-0 own-tasks-table">
          <thead className="table-dark">
            <tr>
              <th>Sl.No</th>
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
                <td colSpan="7" className="text-center text-muted py-3">
                  {hasFilters ? "No tasks match the current filters." : "No tasks found."}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => {
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
                      <span className={`badge rounded-pill ${getNotificationStateBadgeClass(row.notificationState)}`}>
                        {formatNotificationStateLabel(row.notificationState)}
                      </span>
                      {row.notificationAt ? (
                        <div className="small text-muted mt-1">
                          {formatPersonalTaskDateTime(row.notificationAt)}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span className={`badge rounded-pill ${getPersonalTaskStatusBadgeClass(row.status)}`}>
                        {formatPersonalTaskStatus(row.status)}
                      </span>
                    </td>
                    <td>
                      <OwnTaskRowActions
                        row={row}
                        onViewTask={onViewTask}
                        onOpenShareModal={onOpenShareModal}
                        onCompleteTask={onCompleteTask}
                        completingTaskId={completingTaskId}
                        sharingTaskId={sharingTaskId}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Pagination {...pagination} />
    </div>
  );
}
