import { getSiteLabel } from "../helpers/mainLocation.helpers";

export default function MainLocationFilters({ filters, sites, updateFilter, clearFilters }) {
  return (
    <div className="filter-card mb-3">
      <div className="row g-3">
        <div className="col-md-4 col-lg-3">
          <label className="form-label">Site</label>
          <select
            className="form-select"
            value={filters.siteId}
            onChange={(event) => updateFilter("siteId", event.target.value)}
          >
            <option value="">All Sites</option>
            {sites.map((site) => (
              <option key={site._id} value={site._id}>
                {getSiteLabel(site)}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4 col-lg-3">
          <label className="form-label">Location Name</label>
          <input
            className="form-control"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder="Search name"
          />
        </div>
        <div className="col-md-4 col-lg-3">
          <label className="form-label">Full Path</label>
          <input
            className="form-control"
            value={filters.path}
            onChange={(event) => updateFilter("path", event.target.value)}
            placeholder="Building / Floor"
          />
        </div>
        <div className="col-md-4 col-lg-2">
          <label className="form-label">Status</label>
          <select
            className="form-select"
            value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="col-md-4 col-lg-1">
          <label className="form-label">Level</label>
          <input
            className="form-control"
            type="number"
            min="0"
            value={filters.level}
            onChange={(event) => updateFilter("level", event.target.value)}
          />
        </div>
        <div className="col-md-4 col-lg-3">
          <label className="form-label">Has Children</label>
          <select
            className="form-select"
            value={filters.hasChildren}
            onChange={(event) => updateFilter("hasChildren", event.target.value)}
          >
            <option value="">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div className="col-md-4 col-lg-2 d-flex align-items-end">
          <button type="button" className="btn btn-outline-secondary w-100" onClick={clearFilters}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
