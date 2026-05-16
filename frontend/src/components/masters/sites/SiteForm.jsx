import SearchableCheckboxSelector from "../../SearchableCheckboxSelector";

export default function SiteForm({
  companyName,
  setCompanyName,
  companyNameError,
  companyOptions,
  name,
  setName,
  nameError,
  loading,
  editingId,
  headEmployeeIds,
  setHeadEmployeeIds,
  legacyHeadNames,
  setLegacyHeadNames,
  siteLeadEmployeeIds,
  setSiteLeadEmployeeIds,
  legacySiteLeadNames,
  setLegacySiteLeadNames,
  employeeSelectionOptions,
  saveSite,
  resetForm,
  clearServerNameError,
}) {
  return (
    <div className="soft-card mb-4">
      <select
        className={`form-select${companyNameError ? " is-invalid" : " mb-2"}`}
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        aria-invalid={companyNameError ? "true" : "false"}
        aria-describedby={companyNameError ? "site-company-error" : undefined}
      >
        <option value="">Select Company</option>
        {companyOptions.map((company) => (
          <option key={company._id} value={company.name}>
            {company.name}
          </option>
        ))}
      </select>
      {companyNameError ? (
        <div className="invalid-feedback d-block mb-2" id="site-company-error">
          {companyNameError}
        </div>
      ) : null}

      {companyOptions.length === 0 && (
        <div className="alert alert-warning py-2 mb-2">
          Create company names in Company Master first.
        </div>
      )}

      <input
        className={`form-control${nameError ? " is-invalid" : " mb-2"}`}
        placeholder="Site Name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          clearServerNameError();
        }}
        aria-invalid={nameError ? "true" : "false"}
        aria-describedby={nameError ? "site-name-duplicate-error" : undefined}
      />
      {nameError ? (
        <div className="invalid-feedback d-block mb-2" id="site-name-duplicate-error">
          {nameError}
        </div>
      ) : null}

      <SearchableCheckboxSelector
        label="Site Heads"
        helperText="Pick one or more site heads from the employee master."
        options={employeeSelectionOptions}
        selectedValues={headEmployeeIds}
        onChange={setHeadEmployeeIds}
        searchPlaceholder="Search site heads"
        emptyMessage="No employees are available to map as site heads yet."
      />

      <div className="mt-3">
        <SearchableCheckboxSelector
          label="Site Leads"
          helperText="Pick one or more site leads from the employee master."
          options={employeeSelectionOptions}
          selectedValues={siteLeadEmployeeIds}
          onChange={setSiteLeadEmployeeIds}
          searchPlaceholder="Search site leads"
          emptyMessage="No employees are available to map as site leads yet."
        />
      </div>

      {legacyHeadNames.length > 0 && (
        <div className="alert alert-warning py-2 mb-2 d-flex justify-content-between align-items-center gap-2">
          <span>Legacy site heads preserved: {legacyHeadNames.join(", ")}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-warning"
            onClick={() => setLegacyHeadNames([])}
          >
            Clear Legacy
          </button>
        </div>
      )}

      {legacySiteLeadNames.length > 0 && (
        <div className="alert alert-warning py-2 mb-2 d-flex justify-content-between align-items-center gap-2">
          <span>Legacy site leads preserved: {legacySiteLeadNames.join(", ")}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-warning"
            onClick={() => setLegacySiteLeadNames([])}
          >
            Clear Legacy
          </button>
        </div>
      )}

      <div className="d-flex flex-wrap gap-2">
        <button
          className="btn btn-success"
          onClick={saveSite}
          disabled={loading}
        >
          {loading ? "Saving..." : editingId ? "Update" : "Save"}
        </button>
        {editingId && (
          <button className="btn btn-secondary" onClick={resetForm}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
