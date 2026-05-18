import SearchableCheckboxSelector from "../../SearchableCheckboxSelector";

export default function DepartmentForm({
  formRef,
  name,
  setName,
  nameError,
  hasNameError,
  loading,
  editingId,
  headEmployeeIds,
  setHeadEmployeeIds,
  legacyHeadNames,
  setLegacyHeadNames,
  departmentLeadEmployeeIds,
  setDepartmentLeadEmployeeIds,
  legacyDepartmentLeadNames,
  setLegacyDepartmentLeadNames,
  employeeSelectionOptions,
  saveDepartment,
  resetDepartmentForm,
  clearServerNameError,
}) {
  return (
    <div ref={formRef} className="soft-card mb-4">
      <input
        className={`form-control${nameError ? " is-invalid" : " mb-2"}`}
        placeholder="Department Name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          clearServerNameError();
        }}
        aria-invalid={nameError ? "true" : "false"}
        aria-describedby={nameError ? "department-name-duplicate-error" : undefined}
      />
      {nameError ? (
        <div className="invalid-feedback d-block mb-2" id="department-name-duplicate-error">
          {nameError}
        </div>
      ) : null}

      <SearchableCheckboxSelector
        label="Department Heads"
        helperText="Pick one or more department heads from the employee master."
        options={employeeSelectionOptions}
        selectedValues={headEmployeeIds}
        onChange={setHeadEmployeeIds}
        searchPlaceholder="Search department heads"
        emptyMessage="No employees are available to map as department heads yet."
      />

      <div className="mt-3">
        <SearchableCheckboxSelector
          label="Department Leads"
          helperText="Pick one or more department leads from the employee master."
          options={employeeSelectionOptions}
          selectedValues={departmentLeadEmployeeIds}
          onChange={setDepartmentLeadEmployeeIds}
          searchPlaceholder="Search department leads"
          emptyMessage="No employees are available to map as department leads yet."
        />
      </div>

      {legacyHeadNames.length > 0 && (
        <div className="alert alert-warning py-2 mb-2 d-flex justify-content-between align-items-center gap-2">
          <span>Legacy department heads preserved: {legacyHeadNames.join(", ")}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-warning"
            onClick={() => setLegacyHeadNames([])}
          >
            Clear Legacy
          </button>
        </div>
      )}

      {legacyDepartmentLeadNames.length > 0 && (
        <div className="alert alert-warning py-2 mb-2 d-flex justify-content-between align-items-center gap-2">
          <span>
            Legacy department leads preserved: {legacyDepartmentLeadNames.join(", ")}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-outline-warning"
            onClick={() => setLegacyDepartmentLeadNames([])}
          >
            Clear Legacy
          </button>
        </div>
      )}

      <div className="d-flex gap-2">
        <button
          className="btn btn-success"
          onClick={saveDepartment}
          disabled={loading || hasNameError}
        >
          {loading ? "Saving..." : editingId ? "Update Department" : "Save Department"}
        </button>
        {editingId && (
          <button className="btn btn-secondary" onClick={resetDepartmentForm}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
