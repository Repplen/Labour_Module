import { useMemo, useState } from "react";
import { usePermissions } from "../../context/usePermissions";
import EquipmentConfirmModal from "../../features/equipment/components/EquipmentConfirmModal";
import EquipmentFilters from "../../features/equipment/components/EquipmentFilters";
import EquipmentFormModal from "../../features/equipment/components/EquipmentFormModal";
import EquipmentHeader from "../../features/equipment/components/EquipmentHeader";
import EquipmentTable from "../../features/equipment/components/EquipmentTable";
import EquipmentViewModal from "../../features/equipment/components/EquipmentViewModal";
import { useEquipmentFilters } from "../../features/equipment/hooks/useEquipmentFilters";
import { useEquipmentForm } from "../../features/equipment/hooks/useEquipmentForm";
import { useEquipment } from "../../features/equipment/hooks/useEquipment";
import { getEquipmentRates } from "../../features/equipment/helpers/equipment.helpers";
import "../../features/equipment/equipment.css";

export default function EquipmentMaster() {
  const { can } = usePermissions();
  const { clearFilters, filters, queryParams, updateFilter } = useEquipmentFilters();
  const {
    changeStatus,
    equipment,
    error,
    loading,
    removeEquipment,
    saveEquipment,
    saving,
    uoms,
  } = useEquipment(queryParams);
  const form = useEquipmentForm();
  const [viewEquipment, setViewEquipment] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const permissions = {
    canAdd: can("equipment_master", "add"),
    canEdit: can("equipment_master", "edit"),
    canDelete: can("equipment_master", "delete"),
    canStatusUpdate: can("equipment_master", "status_update"),
    canExport: can("equipment_master", "export"),
  };

  const summary = useMemo(
    () => ({
      totalCount: equipment.length,
      activeCount: equipment.filter((item) => item.isActive).length,
      inactiveCount: equipment.filter((item) => !item.isActive).length,
    }),
    [equipment]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = form.validate();
    if (Object.keys(result.errors).length) return;

    const response = await saveEquipment({
      mode: form.formState.mode,
      values: result.values,
      editingEquipment: form.formState.editingEquipment,
    });

    if (response.success) {
      form.closeForm();
      return;
    }

    const fieldErrors = {};
    response.errors?.forEach((item) => {
      fieldErrors[item.field || "equipmentName"] = item.message;
    });
    form.setErrors(fieldErrors);
  };

  const requestDelete = (item) => {
    setConfirmState({
      type: "delete",
      equipment: item,
      title: "Delete Equipment",
      message: `Delete "${item.equipmentName}"?`,
      confirmLabel: "Delete",
      variant: "btn-danger",
    });
  };

  const requestStatus = (item) => {
    const nextStatus = !item.isActive;
    setConfirmState({
      type: "status",
      equipment: item,
      title: nextStatus ? "Activate Equipment" : "Deactivate Equipment",
      message: `${nextStatus ? "Activate" : "Deactivate"} "${item.equipmentName}"?`,
      confirmLabel: nextStatus ? "Activate" : "Deactivate",
      variant: nextStatus ? "btn-success" : "btn-warning",
      isActive: nextStatus,
    });
  };

  const confirmAction = async () => {
    if (!confirmState?.equipment?._id) return;
    const response =
      confirmState.type === "delete"
        ? await removeEquipment(confirmState.equipment._id)
        : await changeStatus(confirmState.equipment._id, { isActive: confirmState.isActive });

    if (response.success) setConfirmState(null);
  };

  const exportCsv = () => {
    const headers = [
      "S.No",
      "Equipment Code",
      "Equipment Name",
      "Category",
      "Type",
      "UOM",
      "Brand / Make",
      "Model Number",
      "Serial Number",
      "Registration Number",
      "Capacity / Size",
      "Fuel Type",
      "Standard Rate",
      "GST %",
      "GST Amount",
      "Gross Rate",
      "Net Rate",
      "Minimum Availability",
      "Opening Quantity",
      "Status",
    ];
    const rows = equipment.map((item, index) => {
      const rates = getEquipmentRates(item);
      return [
        index + 1,
        item.equipmentCode,
        item.equipmentName,
        item.category,
        item.equipmentType,
        item.uomName ? `${item.uomName} ${item.uomSymbol || ""}` : "",
        item.brand,
        item.modelNumber,
        item.serialNumber,
        item.registrationNumber,
        item.capacitySize,
        item.fuelType,
        item.standardRate ?? "",
        item.gstPercent ?? "",
        rates.gstAmount ?? "",
        rates.grossRate ?? "",
        rates.netRate ?? "",
        item.minimumAvailability ?? "",
        item.openingQuantity ?? "",
        item.isActive ? "Active" : "Inactive",
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "equipment.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="container-fluid px-3 px-lg-4 mt-4 mb-5 equipment-page">
      <EquipmentHeader {...summary} canAdd={permissions.canAdd} onAdd={form.openCreate} />

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <EquipmentFilters
        clearFilters={clearFilters}
        filters={filters}
        uoms={uoms}
        updateFilter={updateFilter}
      />

      <div className="list-toolbar mb-3">
        <div className="small text-muted">
          {loading ? "Loading equipment..." : `${equipment.length} equipment records`}
        </div>
        {permissions.canExport ? (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={exportCsv}>
            Export
          </button>
        ) : null}
      </div>

      <EquipmentTable
        equipment={equipment}
        permissions={permissions}
        onDelete={requestDelete}
        onEdit={form.openEdit}
        onStatus={requestStatus}
        onView={setViewEquipment}
      />

      <EquipmentFormModal
        errors={form.errors}
        formState={form.formState}
        saving={saving}
        uoms={uoms}
        onClose={form.closeForm}
        onSubmit={handleSubmit}
        onUpdateField={form.updateField}
      />
      <EquipmentViewModal equipment={viewEquipment} onClose={() => setViewEquipment(null)} />
      <EquipmentConfirmModal
        confirmState={confirmState}
        saving={saving}
        onCancel={() => setConfirmState(null)}
        onConfirm={confirmAction}
      />
    </div>
  );
}
