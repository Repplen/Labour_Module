import {
  GENERAL_ATTACHMENT_ACCEPT,
  GENERAL_ATTACHMENT_OPTIONS,
  validateFile,
} from "../../utils/fileValidation";

export default function ComplaintQuickSubmitCard({
  currentEmployee,
  user,
  departmentOptions,
  form,
  setForm,
  fileInputRef,
  onSubmit,
  saving,
}) {
  const handleAttachmentChange = (event) => {
    const file = event.target.files?.[0] || null;
    const validationMessage = validateFile(file, GENERAL_ATTACHMENT_OPTIONS);

    if (validationMessage) {
      alert(validationMessage);
      event.target.value = "";
      setForm((current) => ({ ...current, attachment: null }));
      return;
    }

    setForm((current) => ({
      ...current,
      attachment: file,
    }));
  };

  return (
    <div className="soft-card complaint-submit-card" data-testid="complaint-form">
      <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
        <div>
          <div className="page-kicker">Quick Raise</div>
          <h5 className="mb-1">Submit Complaint</h5>
          <div className="page-subtitle mb-0">
            Employee and site information are pulled from your logged-in profile.
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-md-6 col-xl-3">
          <label className="form-label fw-semibold">Employee Name</label>
          <input
            className="form-control"
            value={currentEmployee?.employeeName || user?.name || ""}
            disabled
          />
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <label className="form-label fw-semibold">Site</label>
          <input
            className="form-control"
            value={currentEmployee?.siteDisplayName || "No mapped site"}
            disabled
          />
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <label className="form-label fw-semibold">Department</label>
          <select
            className="form-select"
            value={form.departmentId}
            onChange={(event) =>
              setForm((current) => ({ ...current, departmentId: event.target.value }))
            }
          >
            <option value="">Select Department</option>
            {departmentOptions.map((department) => (
              <option key={department.value} value={department.value}>
                {department.label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <label className="form-label fw-semibold">Attachment</label>
          <input
            ref={fileInputRef}
            type="file"
            className="form-control"
            accept={GENERAL_ATTACHMENT_ACCEPT}
            onChange={handleAttachmentChange}
          />
        </div>
        <div className="col-12">
          <label className="form-label fw-semibold">Complaint Subject / Description</label>
          <textarea
            className="form-control"
            rows="5"
            placeholder="Describe the complaint clearly so the department, site head, and main admin can act quickly."
            value={form.complaintText}
            onChange={(event) =>
              setForm((current) => ({ ...current, complaintText: event.target.value }))
            }
          />
        </div>
      </div>

      <div className="mt-3">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={saving}
          data-testid="complaint-submit"
        >
          {saving ? "Submitting..." : "Submit Complaint"}
        </button>
      </div>
    </div>
  );
}
