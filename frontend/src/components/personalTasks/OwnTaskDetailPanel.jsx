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

export default function OwnTaskDetailPanel({
  completingTaskId,
  detailLoading,
  id,
  markReminderRead,
  navigateToList,
  onCompleteTask,
  onOpenShareModal,
  sharingTaskId,
  taskAttachmentUrl,
  taskDetail,
}) {
  return (
    <div className="soft-card h-100 own-tasks-panel own-tasks-panel--detail">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
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
        <div className="empty-state py-4 own-tasks-detail-empty">
          Loading reminder details...
        </div>
      ) : taskDetail ? (
        <div className="d-flex flex-column gap-3">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 own-tasks-detail-header">
            <div>
              <h4 className="mb-1">{taskDetail.title || "-"}</h4>
              <div className="text-muted">
                {taskDetail.description || "No description added for this reminder."}
              </div>
              <div className="small text-muted mt-2">
                Shared by: {formatEmployeeLabel(taskDetail.creator)}
              </div>
              <div className="small text-muted">
                Assigned to: {formatEmployeeLabel(taskDetail.assignedEmployee)}
              </div>
            </div>

            <div className="d-flex flex-wrap gap-2 own-tasks-detail-badges">
              <span className="badge text-bg-light">{getViewerTaskLabel(taskDetail)}</span>
              <span className={`badge ${getPersonalTaskStatusBadgeClass(taskDetail.status)}`}>
                {formatPersonalTaskStatus(taskDetail.status)}
              </span>
              <span
                className={`badge ${getNotificationStateBadgeClass(
                  taskDetail.notificationState
                )}`}
              >
                {formatNotificationStateLabel(taskDetail.notificationState)}
              </span>
            </div>
          </div>

          {taskAttachmentUrl ? (
            <div className="own-tasks-detail-attachment">
              <div className="small text-muted mb-2">Attached Image</div>
              <a
                href={taskAttachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="d-inline-block own-tasks-detail-attachment__link"
              >
                <img
                  src={taskAttachmentUrl}
                  alt={taskDetail.title || "Own task attachment"}
                  className="own-tasks-detail-attachment__image"
                />
              </a>
            </div>
          ) : null}

          <div className="row g-3 own-tasks-detail-grid">
            <DetailField label="Reminder Date" value={formatPersonalTaskDate(taskDetail.scheduledAt)} />
            <DetailField
              label="Reminder Time"
              value={formatReminderTimeLabel(taskDetail.reminderTime)}
            />
            <DetailField
              label="Reminder Type"
              value={formatReminderTypeLabel(taskDetail.reminderType)}
            />
            <DetailField label="Shared By" value={formatEmployeeLabel(taskDetail.creator)} />
            <DetailField
              label="Assigned To"
              value={formatEmployeeLabel(taskDetail.assignedEmployee)}
            />
            <DetailField label="Repeat Rule" value={formatReminderRuleLabel(taskDetail)} />
            {taskDetail.reminderType === "weekly" ? (
              <DetailField
                label="Weekly On"
                value={formatWeeklyDayLabel(taskDetail.weeklyDayOfWeek)}
              />
            ) : null}
            {taskDetail.reminderType === "monthly" ? (
              <DetailField
                label="Monthly On"
                value={formatMonthlyDayLabel(taskDetail.monthlyDayOfMonth)}
              />
            ) : null}
            <DetailField label="Created" value={formatPersonalTaskDateTime(taskDetail.createdAt)} />
            <DetailField label="Shared At" value={formatPersonalTaskDateTime(taskDetail.sharedAt)} />
            <DetailField
              label="Next Reminder"
              value={formatPersonalTaskDateTime(taskDetail.nextReminderAt)}
            />
            <DetailField
              label="Last Triggered"
              value={formatPersonalTaskDateTime(taskDetail.lastTriggeredAt)}
            />
            <DetailField
              label="Completed At"
              value={formatPersonalTaskDateTime(taskDetail.completedAt)}
            />
            <DetailField label="Completed By" value={formatEmployeeLabel(taskDetail.completedBy)} />
            <DetailField
              label="Notification State"
              value={formatNotificationStateLabel(taskDetail.notificationState)}
            />
          </div>

          <div className="d-flex flex-wrap gap-2 own-tasks-detail-actions">
            {taskDetail.canShare && taskDetail.status !== "completed" ? (
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={() => {
                  void onOpenShareModal(taskDetail);
                }}
                disabled={String(sharingTaskId) === String(taskDetail._id)}
              >
                Sharing Employee
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
                className="btn btn-outline-primary"
                onClick={() => markReminderRead(taskDetail._id)}
              >
                Mark Notification Read
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="empty-state py-5 own-tasks-detail-empty">
          No task selected. Use the list below or the bell icon in the navbar to open one.
        </div>
      )}
    </div>
  );
}
