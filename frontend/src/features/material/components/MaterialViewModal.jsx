import { formatMoney } from "../helpers/material.helpers";

export default function MaterialViewModal({ material, onClose }) {
  if (!material) return null;

  return (
    <div className="material-modal-backdrop" role="dialog" aria-modal="true">
      <div className="material-modal material-modal--sm">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <h5 className="mb-0">{material.materialName}</h5>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
        </div>
        <dl className="row mb-0">
          <dt className="col-5">Code</dt><dd className="col-7">{material.materialCode}</dd>
          <dt className="col-5">Category</dt><dd className="col-7">{material.category}</dd>
          <dt className="col-5">UOM</dt><dd className="col-7">{material.uomName} {material.uomSymbol ? `(${material.uomSymbol})` : ""}</dd>
          <dt className="col-5">Type</dt><dd className="col-7">{material.materialType || "-"}</dd>
          <dt className="col-5">Brand / Make</dt><dd className="col-7">{material.brand || "-"}</dd>
          <dt className="col-5">Specification</dt><dd className="col-7">{material.specification || "-"}</dd>
          <dt className="col-5">Rate</dt><dd className="col-7">{formatMoney(material.standardRate)}</dd>
          <dt className="col-5">GST %</dt><dd className="col-7">{material.gstPercent ?? "-"}</dd>
          <dt className="col-5">Minimum Stock</dt><dd className="col-7">{material.minimumStock ?? "-"}</dd>
          <dt className="col-5">Opening Stock</dt><dd className="col-7">{material.openingStock ?? "-"}</dd>
          <dt className="col-5">Description</dt><dd className="col-7">{material.description || "-"}</dd>
          <dt className="col-5">Status</dt><dd className="col-7">{material.isActive ? "Active" : "Inactive"}</dd>
        </dl>
      </div>
    </div>
  );
}
