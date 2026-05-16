export default function DepartmentHeader({ departmentCount, selectedHeadCount }) {
  return (
    <div className="page-intro-card mb-4">
      <div className="list-toolbar">
        <div>
          <div className="page-kicker">Masters</div>
          <h3 className="mb-1">Department Master</h3>
          <p className="page-subtitle mb-0">
            Maintain departments, department heads, leads, and nested sub-department levels.
          </p>
        </div>

        <div className="list-summary">
          <span className="summary-chip">{departmentCount} departments</span>
          <span className="summary-chip summary-chip--neutral">
            {selectedHeadCount} heads selected
          </span>
        </div>
      </div>
    </div>
  );
}
