import { formatMoney, getMaterialRates } from "../helpers/material.helpers";
import MaterialStatusBadge from "./MaterialStatusBadge";

export default function MaterialTable({ materials, onDelete, onEdit, onStatus, onView, permissions }) {
  return (
    <div className="table-shell mb-4">
      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead>
            <tr>
              <th>S.No</th>
              <th>Material Code</th>
              <th>Material Name</th>
              <th>Category</th>
              <th>UOM</th>
              <th>Type</th>
              <th>Brand / Make</th>
              <th>Specification / Grade</th>
              <th>Standard Rate</th>
              <th>GST %</th>
              <th>GST Amount</th>
              <th>Gross Rate</th>
              <th>Net Rate</th>
              <th>Minimum Stock</th>
              <th>Opening Stock</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((material, index) => {
              const rates = getMaterialRates(material);
              return (
                <tr key={material._id}>
                  <td>{index + 1}</td>
                  <td className="fw-semibold">{material.materialCode}</td>
                  <td>{material.materialName}</td>
                  <td>{material.category}</td>
                  <td>{material.uomName} {material.uomSymbol ? `(${material.uomSymbol})` : ""}</td>
                  <td>{material.materialType || "-"}</td>
                  <td>{material.brand || "-"}</td>
                  <td>{material.specification || "-"}</td>
                  <td>{formatMoney(material.standardRate)}</td>
                  <td>{material.gstPercent ?? "-"}</td>
                  <td>{formatMoney(rates.gstAmount)}</td>
                  <td>{formatMoney(rates.grossRate)}</td>
                  <td>{formatMoney(rates.netRate)}</td>
                  <td>{material.minimumStock ?? "-"}</td>
                  <td>{material.openingStock ?? "-"}</td>
                  <td><MaterialStatusBadge isActive={material.isActive} /></td>
                  <td>
                    <div className="d-flex flex-wrap gap-1">
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onView(material)}>View</button>
                      {permissions.canEdit ? <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onEdit(material)}>Edit</button> : null}
                      {permissions.canStatusUpdate ? (
                        <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => onStatus(material)}>
                          {material.isActive ? "Inactive" : "Active"}
                        </button>
                      ) : null}
                      {permissions.canDelete ? <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDelete(material)}>Delete</button> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!materials.length ? (
              <tr>
                <td colSpan="17" className="text-center text-muted py-4">
                  No materials found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
