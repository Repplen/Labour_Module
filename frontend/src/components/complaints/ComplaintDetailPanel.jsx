import {
  formatComplaintDateTime,
  formatComplaintDuration,
  getComplaintTimeState,
} from "../../utils/complaintLifecycle";
import ComplaintProcessTracker from "./ComplaintProcessTracker";

const getStatusBadgeClass = (timeState) => {
  if (timeState?.isOverdue) return "text-bg-danger";
  if (timeState?.tone === "success") {
    return "bg-success-subtle text-success border border-success-subtle";
  }
  if (timeState?.tone === "warning") {
    return "bg-warning-subtle text-warning-emphasis border border-warning-subtle";
  }
  return "bg-info-subtle text-info-emphasis border border-info-subtle";
};

const getActionBadgeClass = (value) =>
  value
    ? "bg-primary-subtle text-primary border border-primary-subtle"
    : "bg-light text-muted border";

const getTimerTextClass = (timeState) => {
  if (timeState?.isOverdue) return "text-danger fw-semibold";
  if (timeState?.isDueSoon) return "text-warning-emphasis fw-semibold";
  if (timeState?.completed) return "text-success fw-semibold";
  return "text-info-emphasis fw-semibold";
};

const getTimerSummaryLabel = (timeState) => {
  if (!timeState) return "-";
  if (timeState.completed && timeState.isOverdue) {
    return `Overdue by ${formatComplaintDuration(timeState.overdueMs)} before completion`;
  }
  if (timeState.completed) {
    return `Resolved in ${formatComplaintDuration(timeState.elapsedMs)}`;
  }
  if (timeState.isOverdue) {
    return `Overdue by ${formatComplaintDuration(timeState.overdueMs)}`;
  }
  return `Remaining ${formatComplaintDuration(timeState.remainingMs)}`;
};

const normalizeComplaintName = (value) => String(value || "").trim();

const formatComplaintNameList = (value) =>
  (Array.isArray(value) ? value : [value])
    .map((item) => normalizeComplaintName(item))
    .filter(Boolean)
    .join(", ");

const getCurrentLevelAssigneeName = (complaint = {}) => {
  const currentLevel = normalizeComplaintName(complaint?.currentLevel).toLowerCase();

  if (currentLevel === "department_head") {
    return normalizeComplaintName(complaint?.departmentHeadName) || "-";
  }

  if (currentLevel === "site_head") {
    return normalizeComplaintName(complaint?.siteHeadName) || "-";
  }

  if (currentLevel === "main_admin") {
    return formatComplaintNameList(complaint?.mainAdminNames) || "-";
  }

  if (currentLevel === "completed") {
    return formatComplaintNameList(complaint?.mainAdminNames) || "-";
  }

  return "-";
};

const getNextLevelAssigneeName = (complaint = {}) => {
  const currentLevel = normalizeComplaintName(complaint?.currentLevel).toLowerCase();

  if (currentLevel === "department_head") {
    return normalizeComplaintName(complaint?.siteHeadName) || "-";
  }

  if (currentLevel === "site_head") {
    return formatComplaintNameList(complaint?.mainAdminNames) || "-";
  }

  return "-";
};

export default function ComplaintDetailPanel({
  selectedComplaint,
  detailLoading,
  clockNow,
  onClear,
  actionRemark,
  setActionRemark,
  onAction,
  actionSaving,
  timelineSectionRef,
  timelineHighlighted,
}) {
  const selectedComplaintTimeState = selectedComplaint
    ? getComplaintTimeState(selectedComplaint, clockNow)
    : null;

  return (
    <div className="soft-card complaint-detail-card">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <div className="page-kicker">Complaint Record</div>
          <h5 className="mb-1">Complaint Details</h5>
          <div className="page-subtitle mb-0">
            Review routing, time limit clock, remarks, and the current action point.
          </div>
        </div>
        {selectedComplaint ? (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClear}>
            Clear
          </button>
        ) : null}
      </div>

      {detailLoading ? (
        <div className="text-muted">Loading complaint details...</div>
      ) : !selectedComplaint ? (
        <div className="complaint-empty-state">
          Select a complaint from the report table to review its full history and take action.
        </div>
      ) : (
        <>
          {selectedComplaintTimeState?.isOverdue ? (
            <div className="alert alert-danger d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
              <div>
                This complaint is overdue by{" "}
                <strong>{formatComplaintDuration(selectedComplaintTimeState.overdueMs)}</strong>.
              </div>
              <span className="badge text-bg-danger">Overdue</span>
            </div>
          ) : selectedComplaintTimeState?.isDueSoon ? (
            <div className="alert alert-warning py-2">
              This complaint is due soon. Remaining time:{" "}
              <strong>{formatComplaintDuration(selectedComplaintTimeState.remainingMs)}</strong>
            </div>
          ) : null}

          <div className="row g-3 mb-4">
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold">Complaint ID</label>
              <input className="form-control" value={selectedComplaint.complaintCode || ""} disabled />
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold">Raised By</label>
              <input className="form-control" value={selectedComplaint.employeeLabel || selectedComplaint.employeeName || ""} disabled />
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold">Company</label>
              <input className="form-control" value={selectedComplaint.companyName || "-"} disabled />
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold">Site</label>
              <input className="form-control" value={selectedComplaint.siteDisplayName || ""} disabled />
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold">Department</label>
              <input className="form-control" value={selectedComplaint.departmentName || ""} disabled />
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold">Current Level</label>
              <input className="form-control" value={selectedComplaint.currentLevelLabel || ""} disabled />
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold">Current Level Name</label>
              <input
                className="form-control"
                value={getCurrentLevelAssigneeName(selectedComplaint)}
                disabled
              />
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold">Next Level Name</label>
              <input
                className="form-control"
                value={getNextLevelAssigneeName(selectedComplaint)}
                disabled
              />
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold">Workflow Status</label>
              <input className="form-control" value={selectedComplaint.workflowStatusLabel || ""} disabled />
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold">Overdue Status</label>
              <input className="form-control" value={selectedComplaint.overdueStatusLabel || ""} disabled />
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold">Raised Time</label>
              <input
                className="form-control"
                value={formatComplaintDateTime(selectedComplaintTimeState?.raisedAt)}
                disabled
              />
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold">Deadline Time</label>
              <input
                className="form-control"
                value={formatComplaintDateTime(selectedComplaintTimeState?.deadlineAt)}
                disabled
              />
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold">Time Limit</label>
              <input className="form-control" value={selectedComplaint.slaClockLabel || getTimerSummaryLabel(selectedComplaintTimeState)} disabled />
            </div>
            <div className="col-12 col-md-6 col-xl-3">
              <label className="form-label fw-semibold">Resolved At</label>
              <input
                className="form-control"
                value={selectedComplaint.completedAtLabel || "-"}
                disabled
              />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold">Complaint Subject / Description</label>
              <textarea
                className="form-control"
                rows="5"
                value={selectedComplaint.complaintText || ""}
                disabled
              />
            </div>
            <div className="col-12">
              <label className="form-label fw-semibold d-block">Attachment</label>
              {selectedComplaint.attachment?.url ? (
                <a
                  href={selectedComplaint.attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm btn-outline-primary"
                >
                  {selectedComplaint.attachment.originalName || "Open attachment"}
                </a>
              ) : (
                <div className="text-muted small">No attachment uploaded</div>
              )}
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2 mb-4">
            <span className={`badge ${getStatusBadgeClass(selectedComplaintTimeState)}`}>
              {selectedComplaint.businessStatusLabel || selectedComplaintTimeState?.statusLabel || "In Progress"}
            </span>
            {selectedComplaint.overdueStatusLabel ? (
              <span className="badge bg-light text-dark border">{selectedComplaint.overdueStatusLabel}</span>
            ) : null}
            <span className={`small ${getTimerTextClass(selectedComplaintTimeState)}`}>
              {getTimerSummaryLabel(selectedComplaintTimeState)}
            </span>
          </div>

          <ComplaintProcessTracker complaint={selectedComplaint} clockNow={clockNow} />

          <div
            ref={timelineSectionRef}
            className={`complaint-activity-section ${timelineHighlighted ? "timeline-highlight" : ""}`}
          >
            <div className="complaint-activity-section__header">
              <div>
                <div className="page-kicker">Activity</div>
                <h6 className="mb-1">Remarks & Timeline</h6>
              </div>
              <div className="complaint-activity-section__counts">
                <span>{selectedComplaint.remarks?.length || 0} remarks</span>
                <span>{selectedComplaint.timeline?.length || 0} timeline updates</span>
              </div>
            </div>

            <div className="row g-4">
              <div className="col-12 col-xl-5">
                <div className="complaint-activity-panel complaint-remarks-panel">
                  <div className="complaint-activity-panel__title">
                    <span>Decision Notes</span>
                    <small>Action comments by each level</small>
                  </div>
                  {selectedComplaint.remarks?.length ? (
                    <div className="complaint-remark-list">
                      {selectedComplaint.remarks.map((remark) => (
                        <div key={`${remark.label}-${remark.actedAt || remark.action}`} className="complaint-remark-card">
                          <div className="complaint-remark-card__topline">
                            <div>
                              <div className="complaint-remark-card__label">{remark.label}</div>
                              <div className="complaint-remark-card__meta">
                                {remark.actedByName || "-"} | {remark.actedAtLabel || "-"}
                              </div>
                            </div>
                            <span className={`badge ${getActionBadgeClass(remark.action)}`}>
                              {remark.actionLabel}
                            </span>
                          </div>
                          <div className="complaint-remark-card__body">
                            {remark.remark || "No remark entered."}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="complaint-empty-state">No remarks added yet.</div>
                  )}
                </div>
              </div>

              <div className="col-12 col-xl-7">
                <div className="complaint-activity-panel complaint-timeline-panel">
                  <div className="complaint-activity-panel__title">
                    <span>Progress Timeline</span>
                    <small>Complaint route from creation to current status</small>
                  </div>
                  {selectedComplaint.timeline?.length ? (
                    <div className="complaint-timeline-list">
                      {selectedComplaint.timeline.map((item, index) => (
                        <div key={`${item.level}-${item.action}-${item.actedAt || index}`} className="complaint-timeline-step">
                          <div className="complaint-timeline-step__marker">{index + 1}</div>
                          <div className="complaint-timeline-step__card">
                            <div className="complaint-timeline-step__topline">
                              <div>
                                <div className="complaint-timeline-step__title">
                                  {item.levelLabel} - {item.actionLabel}
                                </div>
                                <div className="complaint-timeline-step__actor">
                                  {item.actedByName || "-"}
                                </div>
                              </div>
                              <div className="complaint-timeline-step__time">{item.actedAtLabel || "-"}</div>
                            </div>
                            <div className="complaint-timeline-step__remark">
                              {item.remark || "No remark recorded."}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="complaint-empty-state">No timeline entries available.</div>
                  )}
                </div>

                {selectedComplaint.canAct ? (
                  <div className="complaint-action-panel">
                    <h6 className="mb-3">Take Action</h6>
                    <div className="mb-3">
                      <label className="form-label fw-semibold">Remark</label>
                      <textarea
                        className="form-control"
                        rows="4"
                        placeholder="Add your remark before moving this complaint ahead"
                        value={actionRemark}
                        onChange={(event) => setActionRemark(event.target.value)}
                      />
                    </div>

                    <div className="d-flex flex-wrap gap-2">
                      {selectedComplaint.availableActions?.includes("submit") ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={actionSaving}
                          onClick={() => onAction("submit")}
                        >
                          {actionSaving ? "Saving..." : "Submit"}
                        </button>
                      ) : null}
                      {selectedComplaint.availableActions?.includes("forward") ? (
                        <button
                          type="button"
                          className="btn btn-outline-primary"
                          disabled={actionSaving}
                          onClick={() => onAction("forward")}
                        >
                          {actionSaving ? "Saving..." : "Forward"}
                        </button>
                      ) : null}
                      {selectedComplaint.availableActions?.includes("complete") ? (
                        <button
                          type="button"
                          className="btn btn-success"
                          disabled={actionSaving}
                          onClick={() => onAction("complete")}
                        >
                          {actionSaving ? "Saving..." : "Mark Completed"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="complaint-action-note">
                    This complaint is visible to you, but no action is pending at your level.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
