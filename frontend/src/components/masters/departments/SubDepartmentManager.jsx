import SearchableCheckboxSelector from "../../SearchableCheckboxSelector";

export default function SubDepartmentManager({
  subManagerRef,
  selectedDepartmentId,
  selectedDepartmentName,
  subPath,
  subDepartments,
  subName,
  setSubName,
  subNameError,
  subHeadEmployeeIds,
  setSubHeadEmployeeIds,
  legacySubHeadNames,
  setLegacySubHeadNames,
  subEditingId,
  subLoading,
  currentSubLevel,
  employeeSelectionOptions,
  clearSubDepartmentContext,
  saveSubDepartment,
  resetSubDepartmentForm,
  editSubDepartment,
  deleteSubDepartment,
  openNextSubLevel,
  jumpToSubLevel,
}) {
  if (!selectedDepartmentId) return null;

  return (
    <div ref={subManagerRef} className="soft-card mb-4">
      <h5 className="mb-3">
        Sub Department Master {currentSubLevel} - {selectedDepartmentName}
      </h5>

      <div className="mb-3 d-flex flex-wrap align-items-center gap-2">
        <span className="fw-semibold">Path:</span>
        <button className="btn btn-sm btn-outline-secondary" onClick={() => jumpToSubLevel(-1)}>
          Sub Department Master 1
        </button>
        {subPath.map((item, index) => (
          <button
            key={item._id}
            className="btn btn-sm btn-outline-secondary"
            onClick={() => jumpToSubLevel(index)}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="d-flex flex-column flex-lg-row align-items-start gap-2 mb-3">
        <div className="flex-grow-1">
          <textarea
            className={`form-control${subNameError ? " is-invalid" : " mb-2"}`}
            placeholder={
              subEditingId
                ? `Enter Sub Department Master ${currentSubLevel} name`
                : `Enter multiple names with comma or new line for Sub Department Master ${currentSubLevel}`
            }
            value={subName}
            onChange={(e) => setSubName(e.target.value)}
            aria-invalid={subNameError ? "true" : "false"}
            aria-describedby={subNameError ? "sub-department-name-error" : undefined}
            rows={2}
          />
          {subNameError ? (
            <div className="invalid-feedback d-block mb-2" id="sub-department-name-error">
              {subNameError}
            </div>
          ) : null}

          <SearchableCheckboxSelector
            label="Sub Department Heads"
            helperText="Pick one or more sub department heads from the employee master."
            options={employeeSelectionOptions}
            selectedValues={subHeadEmployeeIds}
            onChange={setSubHeadEmployeeIds}
            searchPlaceholder="Search sub department heads"
            emptyMessage="No employees are available to map as sub department heads yet."
          />

          {legacySubHeadNames.length > 0 && (
            <div className="alert alert-warning py-2 mt-2 mb-0 d-flex justify-content-between align-items-center gap-2">
              <span>
                Legacy sub department heads preserved: {legacySubHeadNames.join(", ")}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-warning"
                onClick={() => setLegacySubHeadNames([])}
              >
                Clear Legacy
              </button>
            </div>
          )}
        </div>

        <div className="d-flex flex-wrap gap-2">
          <button
            className="btn btn-success"
            onClick={saveSubDepartment}
            disabled={subLoading || Boolean(subNameError)}
          >
            {subLoading ? "Saving..." : subEditingId ? "Update" : "Add"}
          </button>
          {subEditingId && (
            <button className="btn btn-secondary" onClick={resetSubDepartmentForm}>
              Cancel
            </button>
          )}
          <button className="btn btn-outline-secondary" onClick={clearSubDepartmentContext}>
            Close
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-bordered mb-0">
          <thead>
            <tr>
              <th>#</th>
              <th>Sub Department Master {currentSubLevel}</th>
              <th>Sub Department Heads</th>
              <th width="250">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subDepartments.length === 0 && (
              <tr>
                <td colSpan="4" className="text-center">
                  No sub departments found
                </td>
              </tr>
            )}

            {subDepartments.map((sub, index) => (
              <tr key={sub._id}>
                <td>{index + 1}</td>
                <td>{sub.name}</td>
                <td>{sub.headNames?.length ? sub.headNames.join(", ") : "-"}</td>
                <td>
                  <div className="d-flex flex-wrap gap-2">
                    {currentSubLevel < 4 && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => openNextSubLevel(sub)}
                      >
                        Next Level
                      </button>
                    )}
                    <button
                      className="btn btn-sm btn-warning"
                      onClick={() => editSubDepartment(sub)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => deleteSubDepartment(sub._id, sub.name)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
