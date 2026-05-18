import SearchableCheckboxSelector from "../../SearchableCheckboxSelector";

export default function CompanyForm({
  formRef,
  name,
  setName,
  displayError,
  employeeOptions,
  directorEmployeeIds,
  setDirectorEmployeeIds,
  legacyDirectorNames,
  setLegacyDirectorNames,
  editingId,
  loading,
  saveCompany,
  resetForm,
  hasBlockingNameError,
}) {
  return (
    <div className="soft-card mb-4" ref={formRef}>
      <div className="row g-3">
        <div className="col-lg-4">
          <label className="form-label fw-semibold">Company Name</label>
          <input
            className={`form-control${displayError ? " is-invalid" : ""}`}
            placeholder="Company Name"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={displayError ? "true" : "false"}
            aria-describedby={displayError ? "company-name-error" : undefined}
          />
          {displayError && (
            <div className="invalid-feedback d-block" id="company-name-error">
              {displayError}
            </div>
          )}
        </div>

        <div className="col-lg-8">
          <SearchableCheckboxSelector
            label="Company Directors"
            helperText="Pick one or more directors from the employee master."
            options={employeeOptions}
            selectedValues={directorEmployeeIds}
            onChange={setDirectorEmployeeIds}
            searchPlaceholder="Search directors"
            emptyMessage="No employees are available to map as directors yet."
          />
        </div>
      </div>

      {legacyDirectorNames.length > 0 && (
        <div className="alert alert-warning py-2 mt-3 mb-0 d-flex justify-content-between align-items-center gap-2">
          <span>Legacy company directors preserved: {legacyDirectorNames.join(", ")}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-warning"
            onClick={() => setLegacyDirectorNames([])}
          >
            Clear Legacy
          </button>
        </div>
      )}

      <div className="d-flex gap-2 mt-3">
        <button
          className="btn btn-success"
          onClick={saveCompany}
          disabled={loading || Boolean(hasBlockingNameError)}
        >
          {loading ? "Saving..." : editingId ? "Update Company" : "Save Company"}
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
