import { formatMoney, getLabourPieceRates } from "../helpers/labourPieceWorker.helpers";
import LabourPieceWorkerStatusBadge from "./LabourPieceWorkerStatusBadge";

export default function LabourPieceWorkerTable({ onDelete, onEdit, onStatus, onView, permissions, workers }) {
  return (
    <div className="table-shell mb-4">
      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead>
            <tr>
              <th>S.No</th>
              <th>Worker Code</th>
              <th>Worker / Work Name</th>
              <th>Worker Type</th>
              <th>Labour Category</th>
              <th>Nature of Work</th>
              <th>UOM</th>
              <th>Rate Type</th>
              <th>Standard Rate</th>
              <th>GST %</th>
              <th>GST Amount</th>
              <th>Gross Rate</th>
              <th>Net Rate</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker, index) => {
              const rates = getLabourPieceRates(worker);
              const natureLabel = worker.subNatureOfWorkPath || worker.natureOfWorkName || "-";
              return (
                <tr key={worker._id}>
                  <td>{index + 1}</td>
                  <td className="fw-semibold">{worker.workerCode}</td>
                  <td>{worker.workerName}</td>
                  <td>{worker.workerType}</td>
                  <td>{worker.labourCategory}</td>
                  <td>{natureLabel}</td>
                  <td>{worker.uomName ? `${worker.uomName} ${worker.uomSymbol ? `(${worker.uomSymbol})` : ""}` : "-"}</td>
                  <td>{worker.rateType}</td>
                  <td>{formatMoney(worker.standardRate)}</td>
                  <td>{worker.gstApplicable ? worker.gstPercent ?? "-" : "No GST"}</td>
                  <td>{formatMoney(rates.gstAmount)}</td>
                  <td>{formatMoney(rates.grossRate)}</td>
                  <td>{formatMoney(rates.netRate)}</td>
                  <td><LabourPieceWorkerStatusBadge isActive={worker.isActive} /></td>
                  <td>
                    <div className="d-flex flex-wrap gap-1">
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onView(worker)}>View</button>
                      {permissions.canEdit ? <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onEdit(worker)}>Edit</button> : null}
                      {permissions.canStatusUpdate ? (
                        <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => onStatus(worker)}>
                          {worker.isActive ? "Inactive" : "Active"}
                        </button>
                      ) : null}
                      {permissions.canDelete ? <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDelete(worker)}>Delete</button> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!workers.length ? (
              <tr>
                <td colSpan="15" className="text-center text-muted py-4">
                  No labour or piece workers found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
