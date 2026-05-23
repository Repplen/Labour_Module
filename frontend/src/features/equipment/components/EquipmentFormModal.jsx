import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_TYPES,
  FUEL_TYPES,
  GST_OPTIONS,
  calculateEquipmentRates,
  getUomLabel,
} from "../helpers/equipment.helpers";
import EquipmentRateSummary from "./EquipmentRateSummary";

const FieldError = ({ message }) => (message ? <div className="invalid-feedback">{message}</div> : null);

export default function EquipmentFormModal({
  errors,
  formState,
  onClose,
  onSubmit,
  onUpdateField,
  saving,
  uoms,
}) {
  if (!formState.isOpen) return null;

  const isEdit = formState.mode === "edit";
  const ratePreview = calculateEquipmentRates({
    standardRate: formState.standardRate,
    gstPercent: formState.gstPercent,
  });

  return (
    <div className="equipment-modal-backdrop" role="dialog" aria-modal="true">
      <div className="equipment-modal">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h5 className="mb-1">{isEdit ? "Edit Equipment" : "Create Equipment"}</h5>
            <div className="small text-muted">Use UOM Master values as the source for equipment units.</div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Equipment Code</label>
              <input className={`form-control ${errors.equipmentCode ? "is-invalid" : ""}`} value={formState.equipmentCode} onChange={(event) => onUpdateField("equipmentCode", event.target.value)} placeholder="EQP-001" autoFocus />
              <FieldError message={errors.equipmentCode} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Equipment Name</label>
              <input className={`form-control ${errors.equipmentName ? "is-invalid" : ""}`} value={formState.equipmentName} onChange={(event) => onUpdateField("equipmentName", event.target.value)} placeholder="JCB" />
              <FieldError message={errors.equipmentName} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Equipment Category</label>
              <select className={`form-select ${errors.category ? "is-invalid" : ""}`} value={formState.category} onChange={(event) => onUpdateField("category", event.target.value)}>
                <option value="">Select category</option>
                {EQUIPMENT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <FieldError message={errors.category} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Equipment Type</label>
              <select className="form-select" value={formState.equipmentType} onChange={(event) => onUpdateField("equipmentType", event.target.value)}>
                <option value="">Select type</option>
                {EQUIPMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">UOM</label>
              <select className={`form-select ${errors.uomId ? "is-invalid" : ""}`} value={formState.uomId} onChange={(event) => onUpdateField("uomId", event.target.value)}>
                <option value="">Select UOM</option>
                {uoms.map((uom) => <option key={uom._id} value={uom._id}>{getUomLabel(uom)}</option>)}
              </select>
              <FieldError message={errors.uomId} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Brand / Make</label>
              <input className="form-control" value={formState.brand} onChange={(event) => onUpdateField("brand", event.target.value)} placeholder="JCB" />
            </div>
            <div className="col-md-4">
              <label className="form-label">Model Number</label>
              <input className="form-control" value={formState.modelNumber} onChange={(event) => onUpdateField("modelNumber", event.target.value)} placeholder="3DX" />
            </div>
            <div className="col-md-4">
              <label className="form-label">Serial Number</label>
              <input className="form-control" value={formState.serialNumber} onChange={(event) => onUpdateField("serialNumber", event.target.value)} placeholder="Serial number" />
            </div>
            <div className="col-md-4">
              <label className="form-label">Registration Number</label>
              <input className="form-control" value={formState.registrationNumber} onChange={(event) => onUpdateField("registrationNumber", event.target.value)} placeholder="TN 01 AB 1234" />
            </div>
            <div className="col-md-4">
              <label className="form-label">Capacity / Size</label>
              <input className="form-control" value={formState.capacitySize} onChange={(event) => onUpdateField("capacitySize", event.target.value)} placeholder="5 Ton" />
            </div>
            <div className="col-md-4">
              <label className="form-label">Fuel Type</label>
              <select className="form-select" value={formState.fuelType} onChange={(event) => onUpdateField("fuelType", event.target.value)}>
                <option value="">Select fuel</option>
                {FUEL_TYPES.map((fuelType) => <option key={fuelType} value={fuelType}>{fuelType}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Standard Rate</label>
              <input className={`form-control ${errors.standardRate ? "is-invalid" : ""}`} min="0" step="0.01" type="number" value={formState.standardRate} onChange={(event) => onUpdateField("standardRate", event.target.value)} />
              <FieldError message={errors.standardRate} />
            </div>
            <div className="col-md-3">
              <label className="form-label">GST %</label>
              <input className={`form-control ${errors.gstPercent ? "is-invalid" : ""}`} list="equipment-gst-options" min="0" max="100" step="0.01" type="number" value={formState.gstPercent} onChange={(event) => onUpdateField("gstPercent", event.target.value)} />
              <datalist id="equipment-gst-options">
                {GST_OPTIONS.filter(Boolean).map((value) => <option key={value} value={value} />)}
              </datalist>
              <FieldError message={errors.gstPercent} />
            </div>
            <EquipmentRateSummary rates={ratePreview} />
            <div className="col-md-3">
              <label className="form-label">Minimum Availability / Stock</label>
              <input className={`form-control ${errors.minimumAvailability ? "is-invalid" : ""}`} min="0" step="0.001" type="number" value={formState.minimumAvailability} onChange={(event) => onUpdateField("minimumAvailability", event.target.value)} />
              <FieldError message={errors.minimumAvailability} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Opening Quantity</label>
              <input className={`form-control ${errors.openingQuantity ? "is-invalid" : ""}`} min="0" step="0.001" type="number" value={formState.openingQuantity} onChange={(event) => onUpdateField("openingQuantity", event.target.value)} />
              <FieldError message={errors.openingQuantity} />
            </div>
            <div className="col-12">
              <label className="form-label">Description</label>
              <textarea className="form-control" rows="2" value={formState.description} onChange={(event) => onUpdateField("description", event.target.value)} />
            </div>
          </div>

          <div className="form-check form-switch my-3">
            <input className="form-check-input" id="equipmentActive" type="checkbox" checked={formState.isActive} onChange={(event) => onUpdateField("isActive", event.target.checked)} />
            <label className="form-check-label" htmlFor="equipmentActive">Active</label>
          </div>

          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
