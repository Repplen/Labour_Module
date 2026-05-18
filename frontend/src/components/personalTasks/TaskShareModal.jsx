import { formatEmployeeLabel } from "../../utils/personalTaskDisplay";

export default function TaskShareModal({
  task,
  shareSearch,
  setShareSearch,
  employees,
  loading,
  sharing,
  onClose,
  onSelectEmployee,
}) {
  if (!task) return null;

  return (
    <div
      className="modal fade show d-block app-modal-overlay"
      tabIndex="-1"
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable own-tasks-share-modal">
        <div className="modal-content own-tasks-share-modal__content">
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-1">Sharing Employee</h5>
              <div className="small text-muted">
                Select the employee who should receive "{task?.title || "this task"}".
              </div>
            </div>
            <button type="button" className="btn-close" onClick={onClose} disabled={sharing} />
          </div>

          <div className="modal-body d-flex flex-column gap-3 own-tasks-share-modal__body">
            <input
              className="form-control own-tasks-share-modal__search"
              placeholder="Search employee by code, name, or email"
              value={shareSearch}
              onChange={(event) => setShareSearch(event.target.value)}
              disabled={loading || sharing}
            />

            {loading ? (
              <div className="text-muted">Loading employees...</div>
            ) : employees.length ? (
              <div className="d-flex flex-column gap-2">
                {employees.map((employee) => (
                  <button
                    key={employee._id}
                    type="button"
                    className="notification-item own-tasks-share-modal__employee"
                    onClick={() => onSelectEmployee(employee._id)}
                    disabled={sharing}
                  >
                    <div className="fw-semibold text-dark">
                      {formatEmployeeLabel(employee)}
                    </div>
                    <div className="small text-muted text-start">
                      {employee.email || "Employee"}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-muted">No employees found for sharing.</div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={onClose}
              disabled={sharing}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
