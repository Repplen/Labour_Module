import { formatMoney, getLabourPieceRates } from "../helpers/labourPieceWorker.helpers";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

export default function LabourPieceWorkerViewModal({ onClose, worker }) {
  if (!worker) return null;
  const rates = getLabourPieceRates(worker);

  return (
    <div className="labour-piece-worker-modal-backdrop" role="dialog" aria-modal="true">
      <div className="labour-piece-worker-modal labour-piece-worker-modal--sm">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <h5 className="mb-0">{worker.workerName}</h5>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
        </div>
        <dl className="row mb-0">
          <dt className="col-5">Worker Code</dt><dd className="col-7">{worker.workerCode}</dd>
          <dt className="col-5">Worker / Work Name</dt><dd className="col-7">{worker.workerName}</dd>
          <dt className="col-5">Worker Type</dt><dd className="col-7">{worker.workerType}</dd>
          <dt className="col-5">Labour Category</dt><dd className="col-7">{worker.labourCategory}</dd>
          <dt className="col-5">Nature of Work</dt><dd className="col-7">{worker.natureOfWorkName || "-"}</dd>
          <dt className="col-5">Sub Nature of Work</dt><dd className="col-7">{worker.subNatureOfWorkPath || "-"}</dd>
          <dt className="col-5">UOM</dt><dd className="col-7">{worker.uomName ? `${worker.uomName} ${worker.uomSymbol ? `(${worker.uomSymbol})` : ""}` : "-"}</dd>
          <dt className="col-5">Rate Type</dt><dd className="col-7">{worker.rateType}</dd>
          <dt className="col-5">Standard Rate</dt><dd className="col-7">{formatMoney(worker.standardRate)}</dd>
          <dt className="col-5">Overtime Rate</dt><dd className="col-7">{formatMoney(worker.overtimeRate)}</dd>
          <dt className="col-5">Piece Rate</dt><dd className="col-7">{formatMoney(worker.pieceRate)}</dd>
          <dt className="col-5">GST Applicable</dt><dd className="col-7">{worker.gstApplicable ? "Yes" : "No"}</dd>
          <dt className="col-5">GST %</dt><dd className="col-7">{worker.gstApplicable ? worker.gstPercent ?? "-" : "-"}</dd>
          <dt className="col-5">GST Amount</dt><dd className="col-7">{formatMoney(rates.gstAmount)}</dd>
          <dt className="col-5">Gross Rate</dt><dd className="col-7">{formatMoney(rates.grossRate)}</dd>
          <dt className="col-5">Net Rate</dt><dd className="col-7">{formatMoney(rates.netRate)}</dd>
          <dt className="col-5">Description</dt><dd className="col-7">{worker.description || "-"}</dd>
          <dt className="col-5">Status</dt><dd className="col-7">{worker.isActive ? "Active" : "Inactive"}</dd>
          <dt className="col-5">Created Date</dt><dd className="col-7">{formatDateTime(worker.createdAt)}</dd>
          <dt className="col-5">Updated Date</dt><dd className="col-7">{formatDateTime(worker.updatedAt)}</dd>
        </dl>
      </div>
    </div>
  );
}
