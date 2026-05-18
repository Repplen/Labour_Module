import {
  formatEmployeeLabel,
  formatMonthlyDayLabel,
  formatNotificationStateLabel,
  formatPersonalTaskDate,
  formatPersonalTaskDateTime,
  formatPersonalTaskStatus,
  formatReminderRuleLabel,
  formatReminderTimeLabel,
  formatReminderTypeLabel,
  formatWeeklyDayLabel,
  getNotificationStateBadgeClass,
  getPersonalTaskStatusBadgeClass,
} from "../../utils/personalTaskDisplay";
import { getViewerTaskLabel } from "../../utils/personalTaskForm";
import DetailField from "./DetailField";

const canEdit = (task) =>
  (task.viewerRelationship === "own" || task.viewerRelationship === "creator") &&
  task.status !== "completed";

const canDelete = (task) =>
  task.viewerRelationship === "own" || task.viewerRelationship === "creator";

export default function OwnTaskDetailPanel({
  completingTaskId,
  detailLoading,
  id,
  markReminderRead,
  navigateToList,
  onCompleteTask,
  onDeleteTask,
  onEditTask,
  onOpenShareModal,
  sharingTaskId,
  taskAttachmentUrl,
  taskDetail,
}) {
  return (
    <div className="soft-card h-100">
      <div className="d-flex justify-content-between align-items-start gap-3 pb-3 mb-3 border-bottom">
        <div>
          <h5 className="mb-1">Task Details</h5>
          <div className="form-help">
            Open a task from the list or notification bell to review sharing, reminders, and completion.
          </div>
        </div>

        {id ? (
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={navigateToList}
          >
            Close
          </button>
        ) : null}
      </div>

      {detailLoading ? (
        <div className="empty-state py-4">Loading reminder details...</div>
      ) : taskDetail ? (
        <div className="d-flex flex-column gap-3">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div className="flex-grow-1">
              <h4 className="mb-2" style={{ fontWeight: 800, letterSpacing: "-0.025em", color: "var(--ink)", lineHeight: 1.2 }}>
                {taskDetail.title || "-"}
              </h4>
              <p className="mb-0" style={{ fontSize: "var(--text-sm)", color: "var(--ink-soft)", lineHeight: 1.65, maxWidth: "42rem" }}>
                {taskDetail.description || "No description added for this reminder."}
              </p>
            </div>

            <div className="d-flex flex-wrap gap-2">
              <span className="badge text-bg-light">{getViewerTaskLabel(taskDetail)}</span>
              <span className={`badge ${getPersonalTaskStatusBadgeClass(taskDetail.status)}`}>
                {formatPersonalTaskStatus(taskDetail.status)}
              </span>
              <span className={`badge ${getNotificationStateBadgeClass(taskDetail.notificationState)}`}>
                {formatNotificationStateLabel(taskDetail.notificationState)}
              </span>
            </div>
          </div>

          {taskAttachmentUrl ? (
            <div>
              <div className="detail-field__label mb-2">Attached Image</div>
              <a href={taskAttachmentUrl} target="_blank" rel="noreferrer" className="d-inline-block">
                <img
                  src={taskAttachmentUrl}
                  alt={taskDetail.title || "Own task attachment"}
                  className="detail-attachment__image"
                />
              </a>
            </div>
          ) : null}

          <div className="row g-3">
            <DetailField label="Reminder Date" value={formatPersonalTaskDate(taskDetail.scheduledAt)} />
            <DetailField label="Reminder Time" value={formatReminderTimeLabel(taskDetail.reminderTime)} />
            <DetailField label="Reminder Type" value={formatReminderTypeLabel(taskDetail.reminderType)} />
            <DetailField label="Repeat Rule" value={formatReminderRuleLabel(taskDetail)} />
            {taskDetail.reminderType === "weekly" ? (
              <DetailField label="Weekly On" value={formatWeeklyDayLabel(taskDetail.weeklyDayOfWeek)} />
            ) : null}
            {taskDetail.reminderType === "monthly" ? (
              <DetailField label="Monthly On" value={formatMonthlyDayLabel(taskDetail.monthlyDayOfMonth)} />
            ) : null}
            <DetailField label="Shared By" value={formatEmployeeLabel(taskDetail.creator)} />
            <DetailField label="Assigned To" value={formatEmployeeLabel(taskDetail.assignedEmployee)} />
            <DetailField label="Created" value={formatPersonalTaskDateTime(taskDetail.createdAt)} />
            <DetailField label="Shared At" value={formatPersonalTaskDateTime(taskDetail.sharedAt)} />
            <DetailField label="Next Reminder" value={formatPersonalTaskDateTime(taskDetail.nextReminderAt)} />
            <DetailField label="Last Triggered" value={formatPersonalTaskDateTime(taskDetail.lastTriggeredAt)} />
            <DetailField label="Completed At" value={formatPersonalTaskDateTime(taskDetail.completedAt)} />
            <DetailField label="Completed By" value={formatEmployeeLabel(taskDetail.completedBy)} />
            <DetailField label="Notification State" value={formatNotificationStateLabel(taskDetail.notificationState)} />
          </div>

          <div className="d-flex flex-wrap gap-2">
            {canEdit(taskDetail) ? (
              <button
                type="button"
                className="btn btn-outline-warning"
                onClick={() => onEditTask(taskDetail)}
              >
                <i className="bi bi-pencil me-1" />
                Edit
              </button>
            ) : null}

            {taskDetail.canShare && taskDetail.status !== "completed" ? (
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={() => { void onOpenShareModal(taskDetail); }}
                disabled={String(sharingTaskId) === String(taskDetail._id)}
              >
                {String(sharingTaskId) === String(taskDetail._id) ? "Sharing..." : "Share Task"}
              </button>
            ) : null}

            {taskDetail.canComplete || taskDetail.status === "completed" ? (
              <button
                type="button"
                className="btn btn-success"
                onClick={() => onCompleteTask(taskDetail._id)}
                disabled={
                  taskDetail.status === "completed" ||
                  !taskDetail.canComplete ||
                  String(completingTaskId) === String(taskDetail._id)
                }
              >
                {String(completingTaskId) === String(taskDetail._id)
                  ? "Updating..."
                  : taskDetail.status === "completed"
                  ? "Completed"
                  : "Mark Completed"}
              </button>
            ) : null}

            {taskDetail.hasUnreadNotification ? (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => markReminderRead(taskDetail._id)}
              >
                Mark Notification Read
              </button>
            ) : null}

            {canDelete(taskDetail) ? (
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={() => onDeleteTask(taskDetail._id)}
              >
                <i className="bi bi-trash me-1" />
                Delete
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="empty-state py-5">
          No task selected. Use the list below or the bell icon in the navbar to open one.
        </div>
      )}
    </div>
  );
}
