import { formatMoney, getEquipmentRates } from "../helpers/equipment.helpers";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

export default function EquipmentViewModal({ equipment, onClose }) {
  if (!equipment) return null;
  const rates = getEquipmentRates(equipment);

  return (
    <div className="equipment-modal-backdrop" role="dialog" aria-modal="true">
      <div className="equipment-modal equipment-modal--sm">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <h5 className="mb-0">{equipment.equipmentName}</h5>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
        </div>
        <dl className="row mb-0">
          <dt className="col-5">Code</dt><dd className="col-7">{equipment.equipmentCode}</dd>
          <dt className="col-5">Category</dt><dd className="col-7">{equipment.category}</dd>
          <dt className="col-5">Type</dt><dd className="col-7">{equipment.equipmentType || "-"}</dd>
          <dt className="col-5">UOM</dt><dd className="col-7">{equipment.uomName} {equipment.uomSymbol ? `(${equipment.uomSymbol})` : ""}</dd>
          <dt className="col-5">Brand / Make</dt><dd className="col-7">{equipment.brand || "-"}</dd>
          <dt className="col-5">Model Number</dt><dd className="col-7">{equipment.modelNumber || "-"}</dd>
          <dt className="col-5">Serial Number</dt><dd className="col-7">{equipment.serialNumber || "-"}</dd>
          <dt className="col-5">Registration Number</dt><dd className="col-7">{equipment.registrationNumber || "-"}</dd>
          <dt className="col-5">Capacity / Size</dt><dd className="col-7">{equipment.capacitySize || "-"}</dd>
          <dt className="col-5">Fuel Type</dt><dd className="col-7">{equipment.fuelType || "-"}</dd>
          <dt className="col-5">Standard Rate</dt><dd className="col-7">{formatMoney(equipment.standardRate)}</dd>
          <dt className="col-5">GST %</dt><dd className="col-7">{equipment.gstPercent ?? "-"}</dd>
          <dt className="col-5">GST Amount</dt><dd className="col-7">{formatMoney(rates.gstAmount)}</dd>
          <dt className="col-5">Gross Rate</dt><dd className="col-7">{formatMoney(rates.grossRate)}</dd>
          <dt className="col-5">Net Rate</dt><dd className="col-7">{formatMoney(rates.netRate)}</dd>
          <dt className="col-5">Minimum Availability</dt><dd className="col-7">{equipment.minimumAvailability ?? "-"}</dd>
          <dt className="col-5">Opening Quantity</dt><dd className="col-7">{equipment.openingQuantity ?? "-"}</dd>
          <dt className="col-5">Description</dt><dd className="col-7">{equipment.description || "-"}</dd>
          <dt className="col-5">Status</dt><dd className="col-7">{equipment.isActive ? "Active" : "Inactive"}</dd>
          <dt className="col-5">Created Date</dt><dd className="col-7">{formatDateTime(equipment.createdAt)}</dd>
          <dt className="col-5">Updated Date</dt><dd className="col-7">{formatDateTime(equipment.updatedAt)}</dd>
        </dl>
      </div>
    </div>
  );
}
