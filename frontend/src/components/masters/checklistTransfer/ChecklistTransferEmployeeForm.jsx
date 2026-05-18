import {
  getEmployeeLabel,
  isActiveEmployee,
} from "../../../hooks/checklistTransfer/useChecklistTransferMaster";

export default function ChecklistTransferEmployeeForm({
  form,
  fromEmployeeDepartmentLabel,
  fromEmployeeSiteLabel,
  hasInvalidTemporaryDateRange,
  isTemporaryTransfer,
  onEmployeeChange,
  pageLoading,
  selectedFromEmployee,
  selectedToEmployee,
  sortedEmployees,
  submitting,
  toEmployeeOptions,
}) {
  return (
    <div className="soft-card mb-4">
      <div className="row g-3">
        <div className="col-lg-6">
          <label className="form-label fw-semibold">From Employee Name</label>
          <select
            className="form-select"
            name="fromEmployeeId"
            value={form.fromEmployeeId}
            onChange={onEmployeeChange}
            disabled={pageLoading}
          >
            <option value="">Select From Employee</option>
            {sortedEmployees.map((employee) => (
              <option key={employee._id} value={employee._id}>
                {`${getEmployeeLabel(employee)}${
                  isActiveEmployee(employee) ? "" : " (Inactive)"
                }`}
              </option>
            ))}
          </select>
        </div>

        <div className="col-lg-6">
          <label className="form-label fw-semibold">To Employee Name</label>
          <select
            className="form-select"
            name="toEmployeeId"
            value={form.toEmployeeId}
            onChange={onEmployeeChange}
            disabled={pageLoading || !form.fromEmployeeId}
          >
            <option value="">Select To Employee</option>
            {toEmployeeOptions.map((employee) => (
              <option key={employee._id} value={employee._id}>
                {getEmployeeLabel(employee)}
              </option>
            ))}
          </select>
          <div className="form-text">
            {form.fromEmployeeId
              ? "Only active employees from the same assigned Site and Department are shown."
              : "Select a From Employee first to filter To Employee options."}
          </div>
        </div>

        {isTemporaryTransfer ? (
          <>
            <div className="col-lg-6">
              <label className="form-label fw-semibold">From Date</label>
              <input
                type="date"
                className="form-control"
                name="fromDate"
                value={form.fromDate}
                onChange={onEmployeeChange}
                disabled={submitting}
              />
            </div>

            <div className="col-lg-6">
              <label className="form-label fw-semibold">To Date</label>
              <input
                type="date"
                className="form-control"
                name="toDate"
                value={form.toDate}
                onChange={onEmployeeChange}
                disabled={submitting}
              />
            </div>
          </>
        ) : null}
      </div>

      <div className="list-summary mt-3">
        <span className="summary-chip">
          From: {selectedFromEmployee ? getEmployeeLabel(selectedFromEmployee) : "Not selected"}
        </span>
        <span className="summary-chip summary-chip--neutral">
          To: {selectedToEmployee ? getEmployeeLabel(selectedToEmployee) : "Not selected"}
        </span>
        <span className="summary-chip summary-chip--neutral">
          Site: {fromEmployeeSiteLabel}
        </span>
        <span className="summary-chip summary-chip--neutral">
          Department: {fromEmployeeDepartmentLabel}
        </span>
        <span className="summary-chip summary-chip--neutral">
          {toEmployeeOptions.length} eligible To Employees
        </span>
        {isTemporaryTransfer ? (
          <span className="summary-chip summary-chip--neutral">
            Window: {form.fromDate || "-"} to {form.toDate || "-"}
          </span>
        ) : null}
      </div>

      {form.fromEmployeeId && !toEmployeeOptions.length ? (
        <div className="alert alert-warning mt-3 mb-0">
          No active employees were found in the same assigned Site and Department for the
          selected From Employee.
        </div>
      ) : null}

      {isTemporaryTransfer && hasInvalidTemporaryDateRange ? (
        <div className="alert alert-danger mt-3 mb-0">
          From Date must be less than or equal to To Date.
        </div>
      ) : null}
    </div>
  );
}
