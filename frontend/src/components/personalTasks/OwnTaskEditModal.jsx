import { CapInput, CapTextarea } from "../CapInput";
import FilterDropdown from "../FilterDropdown";
import { IMAGE_FILE_ACCEPT } from "../../utils/fileValidation";
import { monthlyReminderOptions, weeklyReminderOptions } from "../../utils/personalTaskForm";

const FORM_ID = "own-task-edit-form";

const REMINDER_TYPE_OPTIONS = [
  { value: "one_time", label: "One-time" },
  { value: "daily", label: "Recurring Daily" },
  { value: "weekly", label: "Recurring Weekly" },
  { value: "monthly", label: "Recurring Monthly" },
];

export default function OwnTaskEditModal({
  attachmentInputRef,
  attachmentPreview,
  form,
  handleAttachmentChange,
  handleFieldChange,
  onClose,
  onSubmit,
  open,
  saving,
}) {
  if (!open) return null;

  const showWeeklySelector = form.reminderType === "weekly";
  const showMonthlySelector = form.reminderType === "monthly";

  return (
    <div className="modal fade show d-block app-modal-overlay" tabIndex="-1">
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Edit Task</h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={saving} />
          </div>

          {/* form is inside modal-body so modal-dialog-scrollable works correctly */}
          <div className="modal-body">
            <form id={FORM_ID} onSubmit={onSubmit} className="d-flex flex-column gap-3">
              <div>
                <label className="form-label">Title</label>
                <CapInput
                  className="form-control"
                  name="title"
                  value={form.title}
                  onChange={handleFieldChange}
                  placeholder="Enter reminder title"
                  required
                />
              </div>

              <div>
                <label className="form-label">Description</label>
                <CapTextarea
                  className="form-control"
                  name="description"
                  rows="3"
                  value={form.description}
                  onChange={handleFieldChange}
                  placeholder="Add details for this reminder"
                />
              </div>

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Date</label>
                  <input
                    className="form-control"
                    type="date"
                    name="reminderDate"
                    value={form.reminderDate}
                    onChange={handleFieldChange}
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Time</label>
                  <input
                    className="form-control"
                    type="time"
                    name="reminderTime"
                    value={form.reminderTime}
                    onChange={handleFieldChange}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Reminder Type</label>
                <FilterDropdown
                  options={REMINDER_TYPE_OPTIONS}
                  value={form.reminderType}
                  onChange={(value) =>
                    handleFieldChange({ target: { name: "reminderType", value } })
                  }
                />
              </div>

              {showWeeklySelector ? (
                <div>
                  <label className="form-label">Which Day of Week</label>
                  <select
                    className="form-select"
                    name="weeklyDayOfWeek"
                    value={form.weeklyDayOfWeek}
                    onChange={handleFieldChange}
                    required
                  >
                    <option value="">Select weekday</option>
                    {weeklyReminderOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {showMonthlySelector ? (
                <div>
                  <label className="form-label">Which Day of Month</label>
                  <select
                    className="form-select"
                    name="monthlyDayOfMonth"
                    value={form.monthlyDayOfMonth}
                    onChange={handleFieldChange}
                    required
                  >
                    <option value="">Select day of month</option>
                    {monthlyReminderOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label className="form-label">Replace Attachment</label>
                <input
                  ref={attachmentInputRef}
                  className="form-control"
                  type="file"
                  name="attachment"
                  accept={IMAGE_FILE_ACCEPT}
                  onChange={handleAttachmentChange}
                />
                <div className="form-help mt-1">
                  Upload a new image to replace the existing attachment.
                </div>

                {attachmentPreview ? (
                  <div className="upload-preview mt-3">
                    <img
                      src={attachmentPreview}
                      alt="New attachment preview"
                      className="upload-preview__image"
                    />
                  </div>
                ) : null}
              </div>
            </form>
          </div>

          {/* footer is outside the form; submit button targets the form via form= */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
              disabled={saving}
            >
              <i className="bi bi-x-circle" />
              Cancel
            </button>
            <button
              type="submit"
              form={FORM_ID}
              className="btn btn-primary"
              disabled={saving}
            >
              <i className={`bi ${saving ? "bi-arrow-clockwise" : "bi-floppy-fill"}`} />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
