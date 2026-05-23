import {
  GST_OPTIONS,
  LABOUR_CATEGORIES,
  WORKER_TYPES,
  calculateLabourPieceRates,
  getNatureLabel,
  getRateTypesForWorkerType,
  getUomLabel,
} from "../helpers/labourPieceWorker.helpers";
import LabourPieceWorkerRateSummary from "./LabourPieceWorkerRateSummary";

const FieldError = ({ message }) => (message ? <div className="invalid-feedback">{message}</div> : null);

const getId = (value) => value?._id || value || "";

export default function LabourPieceWorkerFormModal({
  errors,
  formState,
  natureOfWorks,
  onClose,
  onSubmit,
  onUpdateField,
  saving,
  uoms,
}) {
  if (!formState.isOpen) return null;

  const isEdit = formState.mode === "edit";
  const isPieceWorker = formState.workerType === "Piece Worker";
  const rateTypes = getRateTypesForWorkerType(formState.workerType);
  const topLevelNature = natureOfWorks.filter((work) => Number(work.level || 1) === 1);
  const selectedNature = natureOfWorks.find((work) => work._id === formState.natureOfWorkId);
  const subNatureOptions = selectedNature
    ? natureOfWorks.filter((work) => work.path?.startsWith(`${selectedNature.path} /`))
    : natureOfWorks.filter((work) => Number(work.level || 1) > 1);
  const ratePreview = calculateLabourPieceRates({
    standardRate: formState.standardRate,
    gstApplicable: formState.gstApplicable,
    gstPercent: formState.gstPercent,
  });

  return (
    <div className="labour-piece-worker-modal-backdrop" role="dialog" aria-modal="true">
      <div className="labour-piece-worker-modal">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <h5 className="mb-1">{isEdit ? "Edit Labour / Piece Worker" : "Create Labour / Piece Worker"}</h5>
            <div className="small text-muted">Use Nature of Work and UOM Master values as dropdown sources.</div>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Worker Code</label>
              <input className={`form-control ${errors.workerCode ? "is-invalid" : ""}`} value={formState.workerCode} onChange={(event) => onUpdateField("workerCode", event.target.value)} placeholder="LAB-001" autoFocus />
              <FieldError message={errors.workerCode} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Worker / Work Category Name</label>
              <input className={`form-control ${errors.workerName ? "is-invalid" : ""}`} value={formState.workerName} onChange={(event) => onUpdateField("workerName", event.target.value)} placeholder="Mason" />
              <FieldError message={errors.workerName} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Worker Type</label>
              <select className={`form-select ${errors.workerType ? "is-invalid" : ""}`} value={formState.workerType} onChange={(event) => onUpdateField("workerType", event.target.value)}>
                {WORKER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <FieldError message={errors.workerType} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Labour Category</label>
              <select className={`form-select ${errors.labourCategory ? "is-invalid" : ""}`} value={formState.labourCategory} onChange={(event) => onUpdateField("labourCategory", event.target.value)}>
                <option value="">Select category</option>
                {LABOUR_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <FieldError message={errors.labourCategory} />
            </div>
            {isPieceWorker ? (
              <>
                <div className="col-md-4">
                  <label className="form-label">Nature of Work</label>
                  <select className="form-select" value={formState.natureOfWorkId} onChange={(event) => onUpdateField("natureOfWorkId", event.target.value)}>
                    <option value="">Select nature</option>
                    {topLevelNature.map((work) => <option key={work._id} value={work._id}>{getNatureLabel(work)}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Sub Nature of Work</label>
                  <select className="form-select" value={formState.subNatureOfWorkId} onChange={(event) => onUpdateField("subNatureOfWorkId", event.target.value)} disabled={!subNatureOptions.length}>
                    <option value="">Select sub nature</option>
                    {subNatureOptions.map((work) => <option key={work._id} value={work._id}>{getNatureLabel(work)}</option>)}
                  </select>
                </div>
              </>
            ) : null}
            <div className="col-md-4">
              <label className="form-label">UOM{isPieceWorker ? "" : " (Optional)"}</label>
              <select className={`form-select ${errors.uomId ? "is-invalid" : ""}`} value={getId(formState.uomId)} onChange={(event) => onUpdateField("uomId", event.target.value)}>
                <option value="">Select UOM</option>
                {uoms.map((uom) => <option key={uom._id} value={uom._id}>{getUomLabel(uom)}</option>)}
              </select>
              <FieldError message={errors.uomId} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Rate Type</label>
              <select className={`form-select ${errors.rateType ? "is-invalid" : ""}`} value={formState.rateType} onChange={(event) => onUpdateField("rateType", event.target.value)}>
                <option value="">Select rate type</option>
                {rateTypes.map((rateType) => <option key={rateType} value={rateType}>{rateType}</option>)}
              </select>
              <FieldError message={errors.rateType} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Standard Rate</label>
              <input className={`form-control ${errors.standardRate ? "is-invalid" : ""}`} min="0" step="0.01" type="number" value={formState.standardRate} onChange={(event) => onUpdateField("standardRate", event.target.value)} />
              <FieldError message={errors.standardRate} />
            </div>
            {!isPieceWorker ? (
              <div className="col-md-4">
                <label className="form-label">Overtime Rate</label>
                <input className={`form-control ${errors.overtimeRate ? "is-invalid" : ""}`} min="0" step="0.01" type="number" value={formState.overtimeRate} onChange={(event) => onUpdateField("overtimeRate", event.target.value)} />
                <FieldError message={errors.overtimeRate} />
              </div>
            ) : (
              <div className="col-md-4">
                <label className="form-label">Piece Rate</label>
                <input className={`form-control ${errors.pieceRate ? "is-invalid" : ""}`} min="0" step="0.01" type="number" value={formState.pieceRate} onChange={(event) => onUpdateField("pieceRate", event.target.value)} />
                <FieldError message={errors.pieceRate} />
              </div>
            )}
            <div className="col-md-4">
              <label className="form-label d-block">GST Applicable</label>
              <div className="d-flex gap-3">
                <label className="form-check">
                  <input className="form-check-input" type="radio" name="gstApplicable" checked={formState.gstApplicable === true} onChange={() => onUpdateField("gstApplicable", true)} />
                  <span className="form-check-label">Yes</span>
                </label>
                <label className="form-check">
                  <input className="form-check-input" type="radio" name="gstApplicable" checked={formState.gstApplicable !== true} onChange={() => onUpdateField("gstApplicable", false)} />
                  <span className="form-check-label">No</span>
                </label>
              </div>
            </div>
            {formState.gstApplicable ? (
              <div className="col-md-3">
                <label className="form-label">GST %</label>
                <input className={`form-control ${errors.gstPercent ? "is-invalid" : ""}`} list="labour-piece-worker-gst-options" min="0" max="100" step="0.01" type="number" value={formState.gstPercent} onChange={(event) => onUpdateField("gstPercent", event.target.value)} />
                <datalist id="labour-piece-worker-gst-options">
                  {GST_OPTIONS.filter(Boolean).map((value) => <option key={value} value={value} />)}
                </datalist>
                <FieldError message={errors.gstPercent} />
              </div>
            ) : null}
            <LabourPieceWorkerRateSummary rates={ratePreview} />
            <div className="col-12">
              <label className="form-label">Description</label>
              <textarea className="form-control" rows="2" value={formState.description} onChange={(event) => onUpdateField("description", event.target.value)} />
            </div>
          </div>

          <div className="form-check form-switch my-3">
            <input className="form-check-input" id="labourPieceWorkerActive" type="checkbox" checked={formState.isActive} onChange={(event) => onUpdateField("isActive", event.target.checked)} />
            <label className="form-check-label" htmlFor="labourPieceWorkerActive">Active</label>
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
