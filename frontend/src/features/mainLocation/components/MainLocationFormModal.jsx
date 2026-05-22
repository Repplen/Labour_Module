import { getSiteLabel } from "../helpers/mainLocation.helpers";

export default function MainLocationFormModal({
  errors,
  formState,
  onClose,
  onSubmit,
  onUpdateField,
  saving,
  sites,
}) {
  if (!formState.isOpen) return null;

  const isChild = Boolean(formState.parentLocationId);
  const isEdit = formState.mode === "edit";
  const title = isEdit ? "Edit Location" : isChild ? "Add Child Location" : "Add Main Location";

  return (
    <div className="main-location-modal-backdrop" role="dialog" aria-modal="true">
      <div className="main-location-modal">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h5 className="mb-1">{title}</h5>
            {isChild ? (
              <div className="small text-muted">
                Parent: {formState.parentLocation?.path || formState.parentLocation?.locationName}
              </div>
            ) : null}
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="mb-3">
            <label className="form-label">Site Name</label>
            <select
              className={`form-select ${errors.siteId ? "is-invalid" : ""}`}
              value={formState.siteId}
              disabled={isChild || isEdit}
              onChange={(event) => onUpdateField("siteId", event.target.value)}
            >
              <option value="">Select site</option>
              {sites.map((site) => (
                <option key={site._id} value={site._id}>
                  {getSiteLabel(site)}
                </option>
              ))}
            </select>
            {errors.siteId ? <div className="invalid-feedback">{errors.siteId}</div> : null}
          </div>

          <div className="mb-3">
            <label className="form-label">Location Name</label>
            <input
              className={`form-control ${errors.locationName ? "is-invalid" : ""}`}
              value={formState.locationName}
              onChange={(event) => onUpdateField("locationName", event.target.value)}
              placeholder="Building A"
              autoFocus
            />
            {errors.locationName ? (
              <div className="invalid-feedback">{errors.locationName}</div>
            ) : null}
          </div>

          {isChild ? (
            <div className="mb-3">
              <label className="form-label">Parent Location</label>
              <input
                className="form-control"
                value={formState.parentLocation?.path || ""}
                readOnly
              />
            </div>
          ) : null}

          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
