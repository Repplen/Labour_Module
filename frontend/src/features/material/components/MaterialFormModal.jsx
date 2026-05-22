import {
  GST_OPTIONS,
  MATERIAL_CATEGORIES,
  MATERIAL_TYPES,
  getUomLabel,
} from "../helpers/material.helpers";

const FieldError = ({ message }) => (message ? <div className="invalid-feedback">{message}</div> : null);

export default function MaterialFormModal({
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

  return (
    <div className="material-modal-backdrop" role="dialog" aria-modal="true">
      <div className="material-modal">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h5 className="mb-1">{isEdit ? "Edit Material" : "Create Material"}</h5>
            <div className="small text-muted">Use UOM Master values as the source for units.</div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Material Code</label>
              <input className={`form-control ${errors.materialCode ? "is-invalid" : ""}`} value={formState.materialCode} onChange={(event) => onUpdateField("materialCode", event.target.value)} placeholder="MAT-001" autoFocus />
              <FieldError message={errors.materialCode} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Material Name</label>
              <input className={`form-control ${errors.materialName ? "is-invalid" : ""}`} value={formState.materialName} onChange={(event) => onUpdateField("materialName", event.target.value)} placeholder="Cement" />
              <FieldError message={errors.materialName} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Material Category</label>
              <select className={`form-select ${errors.category ? "is-invalid" : ""}`} value={formState.category} onChange={(event) => onUpdateField("category", event.target.value)}>
                <option value="">Select category</option>
                {MATERIAL_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <FieldError message={errors.category} />
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
              <label className="form-label">Material Type</label>
              <select className="form-select" value={formState.materialType} onChange={(event) => onUpdateField("materialType", event.target.value)}>
                <option value="">Select type</option>
                {MATERIAL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Brand / Make</label>
              <input className="form-control" value={formState.brand} onChange={(event) => onUpdateField("brand", event.target.value)} placeholder="Ultratech" />
            </div>
            <div className="col-md-6">
              <label className="form-label">Specification / Grade</label>
              <input className="form-control" value={formState.specification} onChange={(event) => onUpdateField("specification", event.target.value)} placeholder="OPC 53 Grade" />
            </div>
            <div className="col-md-3">
              <label className="form-label">Standard Rate</label>
              <input className={`form-control ${errors.standardRate ? "is-invalid" : ""}`} min="0" step="0.01" type="number" value={formState.standardRate} onChange={(event) => onUpdateField("standardRate", event.target.value)} />
              <FieldError message={errors.standardRate} />
            </div>
            <div className="col-md-3">
              <label className="form-label">GST %</label>
              <input className={`form-control ${errors.gstPercent ? "is-invalid" : ""}`} list="material-gst-options" min="0" max="100" step="0.01" type="number" value={formState.gstPercent} onChange={(event) => onUpdateField("gstPercent", event.target.value)} />
              <datalist id="material-gst-options">
                {GST_OPTIONS.filter(Boolean).map((value) => <option key={value} value={value} />)}
              </datalist>
              <FieldError message={errors.gstPercent} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Minimum Stock Level</label>
              <input className={`form-control ${errors.minimumStock ? "is-invalid" : ""}`} min="0" step="0.001" type="number" value={formState.minimumStock} onChange={(event) => onUpdateField("minimumStock", event.target.value)} />
              <FieldError message={errors.minimumStock} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Opening Stock</label>
              <input className={`form-control ${errors.openingStock ? "is-invalid" : ""}`} min="0" step="0.001" type="number" value={formState.openingStock} onChange={(event) => onUpdateField("openingStock", event.target.value)} />
              <FieldError message={errors.openingStock} />
            </div>
            <div className="col-12">
              <label className="form-label">Description</label>
              <textarea className="form-control" rows="2" value={formState.description} onChange={(event) => onUpdateField("description", event.target.value)} />
            </div>
          </div>

          <div className="form-check form-switch my-3">
            <input className="form-check-input" id="materialActive" type="checkbox" checked={formState.isActive} onChange={(event) => onUpdateField("isActive", event.target.checked)} />
            <label className="form-check-label" htmlFor="materialActive">Active</label>
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
