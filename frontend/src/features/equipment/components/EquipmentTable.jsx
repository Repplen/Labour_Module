import { formatMoney, getEquipmentRates } from "../helpers/equipment.helpers";
import EquipmentStatusBadge from "./EquipmentStatusBadge";

export default function EquipmentTable({ equipment, onDelete, onEdit, onStatus, onView, permissions }) {
  return (
    <div className="table-shell mb-4">
      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead>
            <tr>
              <th>S.No</th>
              <th>Equipment Code</th>
              <th>Equipment Name</th>
              <th>Category</th>
              <th>Type</th>
              <th>UOM</th>
              <th>Brand / Make</th>
              <th>Model Number</th>
              <th>Serial Number</th>
              <th>Registration Number</th>
              <th>Capacity / Size</th>
              <th>Fuel Type</th>
              <th>Standard Rate</th>
              <th>GST %</th>
              <th>GST Amount</th>
              <th>Gross Rate</th>
              <th>Net Rate</th>
              <th>Opening Quantity</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {equipment.map((item, index) => {
              const rates = getEquipmentRates(item);
              return (
                <tr key={item._id}>
                  <td>{index + 1}</td>
                  <td className="fw-semibold">{item.equipmentCode}</td>
                  <td>{item.equipmentName}</td>
                  <td>{item.category}</td>
                  <td>{item.equipmentType || "-"}</td>
                  <td>{item.uomName} {item.uomSymbol ? `(${item.uomSymbol})` : ""}</td>
                  <td>{item.brand || "-"}</td>
                  <td>{item.modelNumber || "-"}</td>
                  <td>{item.serialNumber || "-"}</td>
                  <td>{item.registrationNumber || "-"}</td>
                  <td>{item.capacitySize || "-"}</td>
                  <td>{item.fuelType || "-"}</td>
                  <td>{formatMoney(item.standardRate)}</td>
                  <td>{item.gstPercent ?? "-"}</td>
                  <td>{formatMoney(rates.gstAmount)}</td>
                  <td>{formatMoney(rates.grossRate)}</td>
                  <td>{formatMoney(rates.netRate)}</td>
                  <td>{item.openingQuantity ?? "-"}</td>
                  <td><EquipmentStatusBadge isActive={item.isActive} /></td>
                  <td>
                    <div className="d-flex flex-wrap gap-1">
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onView(item)}>View</button>
                      {permissions.canEdit ? <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onEdit(item)}>Edit</button> : null}
                      {permissions.canStatusUpdate ? (
                        <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => onStatus(item)}>
                          {item.isActive ? "Inactive" : "Active"}
                        </button>
                      ) : null}
                      {permissions.canDelete ? <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDelete(item)}>Delete</button> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!equipment.length ? (
              <tr>
                <td colSpan="20" className="text-center text-muted py-4">
                  No equipment found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
