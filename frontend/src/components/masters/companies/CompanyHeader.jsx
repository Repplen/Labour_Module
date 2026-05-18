export default function CompanyHeader({ companyCount, selectedDirectorCount }) {
  return (
    <div className="page-intro-card mb-4">
      <div className="list-toolbar">
        <div>
          <div className="page-kicker">Masters</div>
          <h3 className="mb-1">Company Master</h3>
          <p className="page-subtitle mb-0">
            Maintain company names and director mappings with searchable selections.
          </p>
        </div>
        <div className="list-summary">
          <span className="summary-chip">{companyCount} companies</span>
          <span className="summary-chip summary-chip--neutral">
            {selectedDirectorCount} directors selected
          </span>
        </div>
      </div>
    </div>
  );
}
