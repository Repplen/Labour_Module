export default function DesignationForm({
  displayError,
  editingId,
  formRef,
  liveNameError,
  loading,
  name,
  resetForm,
  saveDesignation,
  setName,
}) {
  return (
    <div className="soft-card mb-4" ref={formRef}>
      <div className="row g-3">
        <div className="col-lg-4">
          <label className="form-label fw-semibold">Designation Name</label>
          <input
            className={`form-control${displayError ? " is-invalid" : ""}`}
            placeholder="e.g. Software Engineer"
            value={name}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={displayError ? "true" : "false"}
            aria-describedby={displayError ? "designation-name-error" : undefined}
          />
          {displayError && (
            <div className="invalid-feedback d-block" id="designation-name-error">
              {displayError}
            </div>
          )}
        </div>
      </div>

      <div className="d-flex gap-2 mt-3">
        <button
          className="btn btn-success"
          onClick={saveDesignation}
          disabled={loading || Boolean(liveNameError)}
        >
          {loading ? "Saving..." : editingId ? "Update Designation" : "Save Designation"}
        </button>
        {editingId && (
          <button className="btn btn-outline-secondary" onClick={resetForm}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
