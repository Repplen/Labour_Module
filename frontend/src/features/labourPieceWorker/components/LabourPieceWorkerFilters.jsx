import {
  LABOUR_CATEGORIES,
  RATE_TYPES,
  WORKER_TYPES,
  getNatureLabel,
  getUomLabel,
} from "../helpers/labourPieceWorker.helpers";

export default function LabourPieceWorkerFilters({
  clearFilters,
  filters,
  natureOfWorks,
  uoms,
  updateFilter,
}) {
  return (
    <div className="filter-card mb-3">
      <div className="row g-3">
        <div className="col-md-4 col-lg-3">
          <label className="form-label">Search</label>
          <input
            className="form-control"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Code or name"
          />
        </div>
        <div className="col-md-4 col-lg-2">
          <label className="form-label">Worker Type</label>
          <select className="form-select" value={filters.workerType} onChange={(event) => updateFilter("workerType", event.target.value)}>
            <option value="">All</option>
            {WORKER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div className="col-md-4 col-lg-2">
          <label className="form-label">Labour Category</label>
          <select className="form-select" value={filters.labourCategory} onChange={(event) => updateFilter("labourCategory", event.target.value)}>
            <option value="">All</option>
            {LABOUR_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
        <div className="col-md-4 col-lg-2">
          <label className="form-label">Nature of Work</label>
          <select className="form-select" value={filters.natureOfWorkId} onChange={(event) => updateFilter("natureOfWorkId", event.target.value)}>
            <option value="">All</option>
            {natureOfWorks.map((work) => <option key={work._id} value={work._id}>{getNatureLabel(work)}</option>)}
          </select>
        </div>
        <div className="col-md-4 col-lg-2">
          <label className="form-label">UOM</label>
          <select className="form-select" value={filters.uomId} onChange={(event) => updateFilter("uomId", event.target.value)}>
            <option value="">All UOMs</option>
            {uoms.map((uom) => <option key={uom._id} value={uom._id}>{getUomLabel(uom)}</option>)}
          </select>
        </div>
        <div className="col-md-4 col-lg-2">
          <label className="form-label">Rate Type</label>
          <select className="form-select" value={filters.rateType} onChange={(event) => updateFilter("rateType", event.target.value)}>
            <option value="">All</option>
            {RATE_TYPES.map((rateType) => <option key={rateType} value={rateType}>{rateType}</option>)}
          </select>
        </div>
        <div className="col-md-4 col-lg-1">
          <label className="form-label">Status</label>
          <select className="form-select" value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="col-md-4 col-lg-2 d-flex align-items-end">
          <button type="button" className="btn btn-outline-secondary w-100" onClick={clearFilters}>Clear</button>
        </div>
      </div>
    </div>
  );
}
