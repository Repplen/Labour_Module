export default function MaterialHeader({ activeCount, canAdd, inactiveCount, onAdd, totalCount }) {
  return (
    <div className="page-intro-card mb-3">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
        <div>
          <div className="page-kicker">Masters</div>
          <h3 className="mb-2">Material Master</h3>
          <p className="page-subtitle mb-0">
            Manage construction and project materials with UOM, rate, tax, and stock details.
          </p>
        </div>
        {canAdd ? (
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            + Create Material
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
      </div>
    </div>
  );
}
