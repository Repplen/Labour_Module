export default function DesignationHeader({ designationCount }) {
  return (
    <div className="page-intro-card mb-4">
      <div className="list-toolbar">
        <div>
          <div className="page-kicker">Masters</div>
          <h3 className="mb-1">Designation Master</h3>
          <p className="page-subtitle mb-0">
            Maintain designation names used across employee and workflow setup.
          </p>
        </div>
        <div className="list-summary">
          <span className="summary-chip">{designationCount} designations</span>
        </div>
      </div>
    </div>
  );
}
