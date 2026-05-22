import { useMemo, useState } from "react";
import { usePermissions } from "../../context/usePermissions";
import MaterialConfirmModal from "../../features/material/components/MaterialConfirmModal";
import MaterialFilters from "../../features/material/components/MaterialFilters";
import MaterialFormModal from "../../features/material/components/MaterialFormModal";
import MaterialHeader from "../../features/material/components/MaterialHeader";
import MaterialTable from "../../features/material/components/MaterialTable";
import MaterialViewModal from "../../features/material/components/MaterialViewModal";
import { useMaterialFilters } from "../../features/material/hooks/useMaterialFilters";
import { useMaterialForm } from "../../features/material/hooks/useMaterialForm";
import { useMaterials } from "../../features/material/hooks/useMaterials";
import "../../features/material/material.css";

export default function MaterialMaster() {
  const { can } = usePermissions();
  const { clearFilters, filters, queryParams, updateFilter } = useMaterialFilters();
  const {
    changeStatus,
    error,
    loading,
    materials,
    removeMaterial,
    saveMaterial,
    saving,
    uoms,
  } = useMaterials(queryParams);
  const form = useMaterialForm();
  const [viewMaterial, setViewMaterial] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const permissions = {
    canAdd: can("material_master", "add"),
    canEdit: can("material_master", "edit"),
    canDelete: can("material_master", "delete"),
    canStatusUpdate: can("material_master", "status_update"),
    canExport: can("material_master", "export"),
  };

  const summary = useMemo(
    () => ({
      totalCount: materials.length,
      activeCount: materials.filter((material) => material.isActive).length,
      inactiveCount: materials.filter((material) => !material.isActive).length,
    }),
    [materials]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = form.validate();
    if (Object.keys(result.errors).length) return;

    const response = await saveMaterial({
      mode: form.formState.mode,
      values: result.values,
      editingMaterial: form.formState.editingMaterial,
    });

    if (response.success) {
      form.closeForm();
      return;
    }

    const fieldErrors = {};
    response.errors?.forEach((item) => {
      fieldErrors[item.field || "materialName"] = item.message;
    });
    form.setErrors(fieldErrors);
  };

  const requestDelete = (material) => {
    setConfirmState({
      type: "delete",
      material,
      title: "Delete Material",
      message: `Delete "${material.materialName}"?`,
      confirmLabel: "Delete",
      variant: "btn-danger",
    });
  };

  const requestStatus = (material) => {
    const nextStatus = !material.isActive;
    setConfirmState({
      type: "status",
      material,
      title: nextStatus ? "Activate Material" : "Deactivate Material",
      message: `${nextStatus ? "Activate" : "Deactivate"} "${material.materialName}"?`,
      confirmLabel: nextStatus ? "Activate" : "Deactivate",
      variant: nextStatus ? "btn-success" : "btn-warning",
      isActive: nextStatus,
    });
  };

  const confirmAction = async () => {
    if (!confirmState?.material?._id) return;
    const response =
      confirmState.type === "delete"
        ? await removeMaterial(confirmState.material._id)
        : await changeStatus(confirmState.material._id, { isActive: confirmState.isActive });

    if (response.success) setConfirmState(null);
  };

  const exportCsv = () => {
    const headers = [
      "S.No",
      "Material Code",
      "Material Name",
      "Category",
      "UOM",
      "Type",
      "Brand / Make",
      "Specification / Grade",
      "Standard Rate",
      "GST %",
      "Minimum Stock",
      "Opening Stock",
      "Status",
    ];
    const rows = materials.map((material, index) => [
      index + 1,
      material.materialCode,
      material.materialName,
      material.category,
      material.uomName ? `${material.uomName} ${material.uomSymbol || ""}` : "",
      material.materialType,
      material.brand,
      material.specification,
      material.standardRate ?? "",
      material.gstPercent ?? "",
      material.minimumStock ?? "",
      material.openingStock ?? "",
      material.isActive ? "Active" : "Inactive",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "materials.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="container-fluid px-3 px-lg-4 mt-4 mb-5 material-page">
      <MaterialHeader {...summary} canAdd={permissions.canAdd} onAdd={form.openCreate} />

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <MaterialFilters
        clearFilters={clearFilters}
        filters={filters}
        uoms={uoms}
        updateFilter={updateFilter}
      />

      <div className="list-toolbar mb-3">
        <div className="small text-muted">
          {loading ? "Loading materials..." : `${materials.length} material records`}
        </div>
        {permissions.canExport ? (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={exportCsv}>
            Export
          </button>
        ) : null}
      </div>

      <MaterialTable
        materials={materials}
        permissions={permissions}
        onDelete={requestDelete}
        onEdit={form.openEdit}
        onStatus={requestStatus}
        onView={setViewMaterial}
      />

      <MaterialFormModal
        errors={form.errors}
        formState={form.formState}
        saving={saving}
        uoms={uoms}
        onClose={form.closeForm}
        onSubmit={handleSubmit}
        onUpdateField={form.updateField}
      />
      <MaterialViewModal material={viewMaterial} onClose={() => setViewMaterial(null)} />
      <MaterialConfirmModal
        confirmState={confirmState}
        saving={saving}
        onCancel={() => setConfirmState(null)}
        onConfirm={confirmAction}
      />
    </div>
  );
}
