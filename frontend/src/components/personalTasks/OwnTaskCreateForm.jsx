import { CapInput, CapTextarea } from "../CapInput";
import FilterDropdown from "../FilterDropdown";
import { IMAGE_FILE_ACCEPT } from "../../utils/fileValidation";
import {
  monthlyReminderOptions,
  weeklyReminderOptions,
} from "../../utils/personalTaskForm";

const REMINDER_TYPE_OPTIONS = [
  { value: "one_time", label: "One-time" },
  { value: "daily", label: "Recurring Daily" },
  { value: "weekly", label: "Recurring Weekly" },
  { value: "monthly", label: "Recurring Monthly" },
];

export default function OwnTaskCreateForm({
  attachmentInputRef,
  attachmentPreview,
  form,
  handleAttachmentChange,
  handleCreateTask,
  handleFieldChange,
  resetCreateForm,
  saving,
}) {
  const showWeeklySelector = form.reminderType === "weekly";
  const showMonthlySelector = form.reminderType === "monthly";

  return (
    <div className="soft-card h-100">
      <div className="d-flex justify-content-between align-items-start gap-3 pb-3 mb-3 border-bottom">
        <div>
          <h5 className="mb-1">Create Own Task</h5>
          <div className="form-help">
            Add a task for yourself first, then use Sharing Employee to assign it when needed.
          </div>
        </div>
        <span className="summary-chip" style={{ whiteSpace: "nowrap" }}>Shareable</span>
      </div>

      <form className="d-flex flex-column gap-3" onSubmit={handleCreateTask}>
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
            rows="4"
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
            onChange={(value) => handleFieldChange({ target: { name: "reminderType", value } })}
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
          <label className="form-label">Attach Image</label>
          <input
            ref={attachmentInputRef}
            className="form-control"
            type="file"
            name="attachment"
            accept={IMAGE_FILE_ACCEPT}
            onChange={handleAttachmentChange}
          />
          <div className="form-help mt-1">
            Optional. Attach one image related to this task or reminder.
          </div>

          {attachmentPreview ? (
            <div className="upload-preview mt-3">
              <img
                src={attachmentPreview}
                alt="Own task attachment preview"
                className="upload-preview__image"
              />
              <div className="form-help">Attachment preview ready for this task.</div>
            </div>
          ) : null}
        </div>

        <div className="d-flex flex-wrap gap-2 pt-1 mt-1 border-top">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Creating..." : "Create Own Task"}
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={resetCreateForm}
            disabled={saving}
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
