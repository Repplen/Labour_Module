import { useMemo, useState } from "react";
import MainLocationConfirmModal from "../../features/mainLocation/components/MainLocationConfirmModal";
import MainLocationFilters from "../../features/mainLocation/components/MainLocationFilters";
import MainLocationFormModal from "../../features/mainLocation/components/MainLocationFormModal";
import MainLocationHeader from "../../features/mainLocation/components/MainLocationHeader";
import MainLocationTable from "../../features/mainLocation/components/MainLocationTable";
import MainLocationTree from "../../features/mainLocation/components/MainLocationTree";
import MainLocationViewModal from "../../features/mainLocation/components/MainLocationViewModal";
import { useMainLocationFilters } from "../../features/mainLocation/hooks/useMainLocationFilters";
import { useMainLocationForm } from "../../features/mainLocation/hooks/useMainLocationForm";
import { useMainLocationTree } from "../../features/mainLocation/hooks/useMainLocationTree";
import { useMainLocations } from "../../features/mainLocation/hooks/useMainLocations";
import { usePermissions } from "../../context/usePermissions";
import { nodeHasChildren } from "../../features/mainLocation/helpers/mainLocation.helpers";
import "../../features/mainLocation/mainLocation.css";

export default function MainLocation() {
  const { can } = usePermissions();
  const { clearFilters, filters, queryParams, updateFilter } = useMainLocationFilters();
  const {
    error,
    loading,
    locations,
    saveLocation,
    saving,
    sites,
    removeLocation,
    changeStatus,
  } = useMainLocations(queryParams);
  const { collapsedIds, tree, toggleNode } = useMainLocationTree(locations);
  const form = useMainLocationForm();
  const [viewMode, setViewMode] = useState("tree");
  const [viewLocation, setViewLocation] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const permissions = {
    canAdd: can("main_location", "add"),
    canEdit: can("main_location", "edit"),
    canDelete: can("main_location", "delete"),
    canStatusUpdate: can("main_location", "status_update"),
    canExport: can("main_location", "export"),
  };

  const summary = useMemo(
    () => ({
      totalCount: locations.length,
      activeCount: locations.filter((location) => location.isActive).length,
      inactiveCount: locations.filter((location) => !location.isActive).length,
    }),
    [locations]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = form.validate();
    if (Object.keys(result.errors).length) return;

    const response = await saveLocation({
      mode: form.formState.mode,
      values: result.values,
      editingLocation: form.formState.editingLocation,
    });

    if (response.success) {
      form.closeForm();
      return;
    }

    const fieldErrors = {};
    response.errors?.forEach((item) => {
      fieldErrors[item.field || "locationName"] = item.message;
    });
    form.setErrors(fieldErrors);
  };

  const requestDelete = (location) => {
    const hasChildren = nodeHasChildren(location);
    setConfirmState({
      type: "delete",
      location,
      title: "Delete Location",
      message: hasChildren
        ? "This location has child locations. Do you want to delete all child locations also?"
        : `Delete "${location.locationName}"?`,
      confirmLabel: hasChildren ? "Delete All" : "Delete",
      variant: "btn-danger",
      cascadeChildren: hasChildren,
    });
  };

  const requestStatus = (location) => {
    const nextStatus = !location.isActive;
    const hasChildren = nodeHasChildren(location);
    setConfirmState({
      type: "status",
      location,
      title: nextStatus ? "Activate Location" : "Deactivate Location",
      message:
        hasChildren && !nextStatus
          ? "This location has child locations. Do you want to make child locations inactive also?"
          : `${nextStatus ? "Activate" : "Deactivate"} "${location.locationName}"?`,
      confirmLabel: nextStatus ? "Activate" : "Deactivate",
      variant: nextStatus ? "btn-success" : "btn-warning",
      isActive: nextStatus,
      cascadeChildren: hasChildren && !nextStatus,
    });
  };

  const confirmAction = async () => {
    if (!confirmState?.location?._id) return;

    const response =
      confirmState.type === "delete"
        ? await removeLocation(confirmState.location._id, {
            cascadeChildren: confirmState.cascadeChildren,
          })
        : await changeStatus(confirmState.location._id, {
            isActive: confirmState.isActive,
            cascadeChildren: confirmState.cascadeChildren,
          });

    if (response.success) {
      setConfirmState(null);
    }
  };

  const exportCsv = () => {
    const headers = [
      "Site Name",
      "Location Name",
      "Parent Location",
      "Level",
      "Full Path",
      "Has Children",
      "Status",
    ];
    const rows = locations.map((location) => [
      [location.siteId?.companyName, location.siteId?.name].filter(Boolean).join(" - "),
      location.locationName,
      location.parentLocationId?.locationName || "",
      location.level,
      location.path,
      nodeHasChildren(location) ? "Yes" : "No",
      location.isActive ? "Active" : "Inactive",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "main-locations.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="container-fluid px-3 px-lg-4 mt-4 mb-5 main-location-page">
      <MainLocationHeader
        {...summary}
        canAdd={permissions.canAdd}
        onAdd={() => form.openCreate(filters.siteId)}
      />

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <MainLocationFilters
        filters={filters}
        sites={sites}
        updateFilter={updateFilter}
        clearFilters={clearFilters}
      />

      <div className="list-toolbar mb-3">
        <div className="btn-group" role="group" aria-label="View mode">
          <button
            type="button"
            className={`btn btn-sm ${viewMode === "tree" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setViewMode("tree")}
          >
            Tree
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === "table" ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setViewMode("table")}
          >
            Table
          </button>
        </div>
        {permissions.canExport ? (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={exportCsv}>
            Export
          </button>
        ) : null}
      </div>

      {viewMode === "tree" ? (
        <MainLocationTree
          collapsedIds={collapsedIds}
          loading={loading}
          permissions={permissions}
          tree={tree}
          onAddChild={form.openChild}
          onDelete={requestDelete}
          onEdit={form.openEdit}
          onStatus={requestStatus}
          onToggle={toggleNode}
          onView={setViewLocation}
        />
      ) : (
        <MainLocationTable
          locations={locations}
          permissions={permissions}
          onAddChild={form.openChild}
          onDelete={requestDelete}
          onEdit={form.openEdit}
          onStatus={requestStatus}
          onView={setViewLocation}
        />
      )}

      <MainLocationFormModal
        errors={form.errors}
        formState={form.formState}
        onClose={form.closeForm}
        onSubmit={handleSubmit}
        onUpdateField={form.updateField}
        saving={saving}
        sites={sites}
      />
      <MainLocationViewModal location={viewLocation} onClose={() => setViewLocation(null)} />
      <MainLocationConfirmModal
        confirmState={confirmState}
        onCancel={() => setConfirmState(null)}
        onConfirm={confirmAction}
        saving={saving}
      />
    </div>
  );
}
