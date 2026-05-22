export default function NatureOfWorkHeader({ activeCount, canAdd, inactiveCount, onAdd, outturnCount, totalCount }) {
  return (
    <div className="page-intro-card mb-3">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
        <div>
          <div className="page-kicker">Masters</div>
          <h3 className="mb-2">Nature of Work</h3>
          <p className="page-subtitle mb-0">
            Manage multi-level work categories with UOM-based work outturn calculations.
          </p>
        </div>
        {canAdd ? (
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            + Add Nature of Work
          </button>
        ) : null}
      </div>
      <div className="page-stats-row mt-3">
        <div className="page-stat-card page-stat-card--primary">
          <div className="page-stat-card__label">Total</div>
          <div className="page-stat-card__value">{totalCount}</div>
        </div>
        <div className="page-stat-card page-stat-card--success">
          <div className="page-stat-card__label">Active</div>
          <div className="page-stat-card__value">{activeCount}</div>
        </div>
        <div className="page-stat-card page-stat-card--neutral">
          <div className="page-stat-card__label">Inactive</div>
          <div className="page-stat-card__value">{inactiveCount}</div>
        </div>
        <div className="page-stat-card">
          <div className="page-stat-card__label">Outturn</div>
          <div className="page-stat-card__value">{outturnCount}</div>
        </div>
      </div>
    </div>
  );
}
