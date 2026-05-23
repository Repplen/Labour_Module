import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_TYPES,
  FUEL_TYPES,
  getUomLabel,
} from "../helpers/equipment.helpers";

export default function EquipmentFilters({ clearFilters, filters, uoms, updateFilter }) {
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
          <label className="form-label">Category</label>
          <select className="form-select" value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}>
            <option value="">All</option>
            {EQUIPMENT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
        <div className="col-md-4 col-lg-2">
          <label className="form-label">Type</label>
          <select className="form-select" value={filters.equipmentType} onChange={(event) => updateFilter("equipmentType", event.target.value)}>
            <option value="">All</option>
            {EQUIPMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div className="col-md-4 col-lg-2">
          <label className="form-label">UOM</label>
          <select className="form-select" value={filters.uomId} onChange={(event) => updateFilter("uomId", event.target.value)}>
            <option value="">All UOMs</option>
            {uoms.map((uom) => <option key={uom._id} value={uom._id}>{getUomLabel(uom)}</option>)}
          </select>
        </div>
        <div className="col-md-4 col-lg-1">
          <label className="form-label">Fuel</label>
          <select className="form-select" value={filters.fuelType} onChange={(event) => updateFilter("fuelType", event.target.value)}>
            <option value="">All</option>
            {FUEL_TYPES.map((fuelType) => <option key={fuelType} value={fuelType}>{fuelType}</option>)}
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
        <div className="col-md-4 col-lg-2">
          <label className="form-label">Brand</label>
          <input className="form-control" value={filters.brand} onChange={(event) => updateFilter("brand", event.target.value)} placeholder="Brand" />
        </div>
        <div className="col-md-4 col-lg-2 d-flex align-items-end">
          <button type="button" className="btn btn-outline-secondary w-100" onClick={clearFilters}>Clear</button>
        </div>
      </div>
    </div>
  );
}
