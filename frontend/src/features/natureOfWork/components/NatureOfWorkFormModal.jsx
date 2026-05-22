import WorkOutturnFields from "./WorkOutturnFields";

export default function NatureOfWorkFormModal({
  errors,
  formState,
  onClose,
  onSubmit,
  onUpdateField,
  preview,
  saving,
  selectedUom,
  uoms,
}) {
  if (!formState.isOpen) return null;

  const isChild = Boolean(formState.parentWorkId);
  const isEdit = formState.mode === "edit";
  const title = isEdit ? "Edit Nature of Work" : isChild ? "Add Child Work" : "Add Nature of Work";

  return (
    <div className="nature-work-modal-backdrop" role="dialog" aria-modal="true">
      <div className="nature-work-modal">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h5 className="mb-1">{title}</h5>
            {isChild ? <div className="small text-muted">Parent: {formState.parentWork?.path || formState.parentWork?.workName}</div> : null}
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="mb-3">
            <label className="form-label">Work Name</label>
            <input className={`form-control ${errors.workName ? "is-invalid" : ""}`} value={formState.workName} onChange={(event) => onUpdateField("workName", event.target.value)} placeholder="Brick Work" autoFocus />
            {errors.workName ? <div className="invalid-feedback">{errors.workName}</div> : null}
          </div>

          {isChild ? (
            <div className="mb-3">
              <label className="form-label">Parent Work</label>
              <input className="form-control" value={formState.parentWork?.path || ""} readOnly />
            </div>
          ) : null}

          <WorkOutturnFields
            errors={errors}
            formState={formState}
            onUpdateField={onUpdateField}
            preview={preview}
            selectedUom={selectedUom}
            uoms={uoms}
          />

          <div className="form-check form-switch my-3">
            <input className="form-check-input" id="natureWorkActive" type="checkbox" checked={formState.isActive} onChange={(event) => onUpdateField("isActive", event.target.checked)} />
            <label className="form-check-label" htmlFor="natureWorkActive">Active</label>
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
