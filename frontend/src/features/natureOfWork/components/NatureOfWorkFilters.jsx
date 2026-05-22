import { getUomLabel } from "../helpers/natureOfWork.helpers";

export default function NatureOfWorkFilters({ clearFilters, filters, uoms, updateFilter }) {
  return (
    <div className="filter-card mb-3">
      <div className="row g-3">
        <div className="col-md-4 col-lg-3">
          <label className="form-label">Work Name</label>
          <input className="form-control" value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search name" />
        </div>
        <div className="col-md-4 col-lg-3">
          <label className="form-label">Full Path</label>
          <input className="form-control" value={filters.path} onChange={(event) => updateFilter("path", event.target.value)} placeholder="Brick Work / Red Bricks" />
        </div>
        <div className="col-md-4 col-lg-2">
          <label className="form-label">Status</label>
          <select className="form-select" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="col-md-4 col-lg-2">
          <label className="form-label">Work Outturn</label>
          <select className="form-select" value={filters.workOutturn} onChange={(event) => updateFilter("workOutturn", event.target.value)}>
            <option value="">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div className="col-md-4 col-lg-1">
          <label className="form-label">Level</label>
          <input className="form-control" min="1" type="number" value={filters.level} onChange={(event) => updateFilter("level", event.target.value)} />
        </div>
        <div className="col-md-4 col-lg-3">
          <label className="form-label">UOM</label>
          <select className="form-select" value={filters.uomId} onChange={(event) => updateFilter("uomId", event.target.value)}>
            <option value="">All UOMs</option>
            {uoms.map((uom) => (
              <option key={uom._id} value={uom._id}>{getUomLabel(uom)}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4 col-lg-2 d-flex align-items-end">
          <button type="button" className="btn btn-outline-secondary w-100" onClick={clearFilters}>Clear</button>
        </div>
      </div>
    </div>
  );
}
