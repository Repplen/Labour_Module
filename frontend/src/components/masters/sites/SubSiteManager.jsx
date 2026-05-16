import SearchableCheckboxSelector from "../../SearchableCheckboxSelector";

export default function SubSiteManager({
  selectedSiteId,
  selectedSiteName,
  subPath,
  subSites,
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
  clearSubSiteContext,
  saveSubSite,
  resetSubSiteForm,
  editSubSite,
  deleteSubSite,
  openNextSubLevel,
  jumpToSubLevel,
}) {
  if (!selectedSiteId) return null;

  return (
    <div className="soft-card mb-4">
      <h5 className="mb-3">
        Sub Site Master {currentSubLevel} - {selectedSiteName}
      </h5>

      <div className="mb-3 d-flex flex-wrap align-items-center gap-2">
        <span className="fw-semibold">Path:</span>
        <button className="btn btn-sm btn-outline-secondary" onClick={() => jumpToSubLevel(-1)}>
          Sub Site Master 1
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
                ? `Enter Sub Site Master ${currentSubLevel} name`
                : `Enter multiple names with comma or new line for Sub Site Master ${currentSubLevel}`
            }
            value={subName}
            onChange={(e) => setSubName(e.target.value)}
            aria-invalid={subNameError ? "true" : "false"}
            aria-describedby={subNameError ? "sub-site-name-error" : undefined}
            rows={2}
          />
          {subNameError ? (
            <div className="invalid-feedback d-block mb-2" id="sub-site-name-error">
              {subNameError}
            </div>
          ) : null}

          <SearchableCheckboxSelector
            label="Sub Site Heads"
            helperText="Pick one or more sub site heads from the employee master."
            options={employeeSelectionOptions}
            selectedValues={subHeadEmployeeIds}
            onChange={setSubHeadEmployeeIds}
            searchPlaceholder="Search sub site heads"
            emptyMessage="No employees are available to map as sub site heads yet."
          />

          {legacySubHeadNames.length > 0 && (
            <div className="alert alert-warning py-2 mt-2 mb-0 d-flex justify-content-between align-items-center gap-2">
              <span>Legacy sub site heads preserved: {legacySubHeadNames.join(", ")}</span>
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
            onClick={saveSubSite}
            disabled={subLoading || Boolean(subNameError)}
          >
            {subLoading ? "Saving..." : subEditingId ? "Update" : "Add"}
          </button>
          {subEditingId && (
            <button className="btn btn-secondary" onClick={resetSubSiteForm}>
              Cancel
            </button>
          )}
          <button className="btn btn-outline-secondary" onClick={clearSubSiteContext}>
            Close
          </button>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-bordered mb-0">
          <thead>
            <tr>
              <th>#</th>
              <th>Sub Site Master {currentSubLevel}</th>
              <th>Sub Site Heads</th>
              <th width="250">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subSites.length === 0 && (
              <tr>
                <td colSpan="4" className="text-center">
                  No sub sites found
                </td>
              </tr>
            )}

            {subSites.map((sub, index) => (
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
                    <button className="btn btn-sm btn-warning" onClick={() => editSubSite(sub)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => deleteSubSite(sub._id)}
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
