export default function NatureOfWorkViewModal({ onClose, work }) {
  if (!work) return null;

  return (
    <div className="nature-work-modal-backdrop" role="dialog" aria-modal="true">
      <div className="nature-work-modal nature-work-modal--sm">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <h5 className="mb-0">{work.workName}</h5>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
        </div>
        <dl className="row mb-0">
          <dt className="col-5">Full Path</dt><dd className="col-7">{work.path}</dd>
          <dt className="col-5">Level</dt><dd className="col-7">{work.level}</dd>
          <dt className="col-5">Parent</dt><dd className="col-7">{work.parentWorkId?.workName || "-"}</dd>
          <dt className="col-5">Work Outturn</dt><dd className="col-7">{work.isWorkOutturnRequired ? "Yes" : "No"}</dd>
          <dt className="col-5">UOM</dt><dd className="col-7">{work.uomName || "-"}</dd>
          <dt className="col-5">Formula</dt><dd className="col-7">{work.formulaType || "-"}</dd>
          <dt className="col-5">Total</dt><dd className="col-7">{work.totalQuantity || work.totalQuantity === 0 ? `${work.totalQuantity} ${work.uomSymbol || ""}` : "-"}</dd>
          <dt className="col-5">Preview</dt><dd className="col-7">{work.outturnDescription || "-"}</dd>
          <dt className="col-5">Status</dt><dd className="col-7">{work.isActive ? "Active" : "Inactive"}</dd>
        </dl>
      </div>
    </div>
  );
}
