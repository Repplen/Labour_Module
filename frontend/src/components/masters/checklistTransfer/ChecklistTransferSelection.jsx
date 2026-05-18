import SearchableCheckboxSelector from "../../SearchableCheckboxSelector";

export default function ChecklistTransferSelection({
  allChecklistIds,
  allChecklistsSelected,
  checklistLoading,
  checklistOptions,
  form,
  onClearSelectedChecklists,
  onSelectAllChecklists,
  selectedChecklistIds,
  setSelectedChecklistIds,
  submitting,
}) {
  return (
    <div className="soft-card mb-4">
      <div className="list-toolbar mb-3">
        <div>
          <h5 className="mb-1">Selected Employee Checklist Masters</h5>
          <div className="form-help">
            Only checklist masters currently assigned to the selected From
            Employee are shown here.
          </div>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={onSelectAllChecklists}
            disabled={!allChecklistIds.length || allChecklistsSelected || checklistLoading}
          >
            Select All Checklists
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={onClearSelectedChecklists}
            disabled={!selectedChecklistIds.length || checklistLoading}
          >
            Clear Selection
          </button>
        </div>
      </div>

      {!form.fromEmployeeId ? (
        <div className="alert alert-secondary mb-0">
          Choose a From Employee to load the currently assigned checklist masters.
        </div>
      ) : checklistLoading ? (
        <div className="alert alert-info mb-0">Loading employee checklist masters...</div>
      ) : !checklistOptions.length ? (
        <div className="alert alert-warning mb-0">
          No checklist masters are currently assigned to the selected From Employee.
        </div>
      ) : (
        <>
          <SearchableCheckboxSelector
            label="Checklist Selection"
            helperText="Pick individual checklist masters or use Select All Checklists to transfer everything assigned to the selected employee."
            options={checklistOptions}
            selectedValues={selectedChecklistIds}
            onChange={setSelectedChecklistIds}
            searchPlaceholder="Search checklist number or name"
            emptyMessage="No checklist masters are available for transfer."
            noResultsMessage="No checklist masters match the current search."
            disabled={submitting}
          />

          <div className="list-summary mt-3">
            <span className="summary-chip">{checklistOptions.length} available</span>
            <span className="summary-chip summary-chip--neutral">
              {selectedChecklistIds.length} ready to transfer
            </span>
          </div>
        </>
      )}
    </div>
  );
}
