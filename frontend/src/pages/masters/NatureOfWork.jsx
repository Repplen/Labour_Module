import { useMemo, useState } from "react";
import NatureOfWorkConfirmModal from "../../features/natureOfWork/components/NatureOfWorkConfirmModal";
import NatureOfWorkFilters from "../../features/natureOfWork/components/NatureOfWorkFilters";
import NatureOfWorkFormModal from "../../features/natureOfWork/components/NatureOfWorkFormModal";
import NatureOfWorkHeader from "../../features/natureOfWork/components/NatureOfWorkHeader";
import NatureOfWorkTable from "../../features/natureOfWork/components/NatureOfWorkTable";
import NatureOfWorkTree from "../../features/natureOfWork/components/NatureOfWorkTree";
import NatureOfWorkViewModal from "../../features/natureOfWork/components/NatureOfWorkViewModal";
import { usePermissions } from "../../context/usePermissions";
import { nodeHasChildren } from "../../features/natureOfWork/helpers/natureOfWork.helpers";
import { useNatureOfWork } from "../../features/natureOfWork/hooks/useNatureOfWork";
import { useNatureOfWorkFilters } from "../../features/natureOfWork/hooks/useNatureOfWorkFilters";
import { useNatureOfWorkForm } from "../../features/natureOfWork/hooks/useNatureOfWorkForm";
import { useNatureOfWorkTree } from "../../features/natureOfWork/hooks/useNatureOfWorkTree";
import "../../features/natureOfWork/natureOfWork.css";

export default function NatureOfWork() {
  const { can } = usePermissions();
  const { clearFilters, filters, queryParams, updateFilter } = useNatureOfWorkFilters();
  const { changeStatus, error, loading, removeWork, saveWork, saving, uoms, works } =
    useNatureOfWork(queryParams);
  const { collapsedIds, tree, toggleNode } = useNatureOfWorkTree(works);
  const form = useNatureOfWorkForm(uoms);
  const [viewMode, setViewMode] = useState("tree");
  const [viewWork, setViewWork] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const permissions = {
    canAdd: can("nature_of_work", "add"),
    canEdit: can("nature_of_work", "edit"),
    canDelete: can("nature_of_work", "delete"),
    canStatusUpdate: can("nature_of_work", "status_update"),
    canExport: can("nature_of_work", "export"),
  };

  const summary = useMemo(
    () => ({
      totalCount: works.length,
      activeCount: works.filter((work) => work.isActive).length,
      inactiveCount: works.filter((work) => !work.isActive).length,
      outturnCount: works.filter((work) => work.isWorkOutturnRequired).length,
    }),
    [works]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = form.validate();
    if (Object.keys(result.errors).length) return;

    const response = await saveWork({
      mode: form.formState.mode,
      values: result.values,
      editingWork: form.formState.editingWork,
    });

    if (response.success) {
      form.closeForm();
      return;
    }

    const fieldErrors = {};
    response.errors?.forEach((item) => {
      fieldErrors[item.field || "workName"] = item.message;
    });
    form.setErrors(fieldErrors);
  };

  const requestDelete = (work) => {
    const hasChildren = nodeHasChildren(work);
    setConfirmState({
      type: "delete",
      work,
      title: "Delete Nature of Work",
      message: hasChildren
        ? "This work has child levels. Do you want to delete all child levels also?"
        : `Delete "${work.workName}"?`,
      confirmLabel: hasChildren ? "Delete All" : "Delete",
      variant: "btn-danger",
      cascadeChildren: hasChildren,
    });
  };

  const requestStatus = (work) => {
    const nextStatus = !work.isActive;
    const hasChildren = nodeHasChildren(work);
    setConfirmState({
      type: "status",
      work,
      title: nextStatus ? "Activate Nature of Work" : "Deactivate Nature of Work",
      message:
        hasChildren && !nextStatus
          ? "This work has child levels. Do you want to make all child levels inactive also?"
          : `${nextStatus ? "Activate" : "Deactivate"} "${work.workName}"?`,
      confirmLabel: nextStatus ? "Activate" : "Deactivate",
      variant: nextStatus ? "btn-success" : "btn-warning",
      isActive: nextStatus,
      cascadeChildren: hasChildren && !nextStatus,
    });
  };

  const confirmAction = async () => {
    if (!confirmState?.work?._id) return;
    const response =
      confirmState.type === "delete"
        ? await removeWork(confirmState.work._id, { cascadeChildren: confirmState.cascadeChildren })
        : await changeStatus(confirmState.work._id, {
            isActive: confirmState.isActive,
            cascadeChildren: confirmState.cascadeChildren,
          });

    if (response.success) setConfirmState(null);
  };

  const exportCsv = () => {
    const headers = ["S.No", "Work Name", "Parent Work", "Level", "Full Path", "Work Outturn", "UOM", "Total Quantity", "Status"];
    const rows = works.map((work, index) => [
      index + 1,
      work.workName,
      work.parentWorkId?.workName || "",
      work.level,
      work.path,
      work.isWorkOutturnRequired ? "Yes" : "No",
      work.uomName ? `${work.uomName} ${work.uomSymbol || ""}` : "",
      work.totalQuantity || work.totalQuantity === 0 ? work.totalQuantity : "",
      work.isActive ? "Active" : "Inactive",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "nature-of-work.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="container-fluid px-3 px-lg-4 mt-4 mb-5 nature-work-page">
      <NatureOfWorkHeader {...summary} canAdd={permissions.canAdd} onAdd={form.openCreate} />

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <NatureOfWorkFilters
        clearFilters={clearFilters}
        filters={filters}
        uoms={uoms}
        updateFilter={updateFilter}
      />

      <div className="list-toolbar mb-3">
        <div className="btn-group" role="group" aria-label="View mode">
          <button type="button" className={`btn btn-sm ${viewMode === "tree" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setViewMode("tree")}>Tree</button>
          <button type="button" className={`btn btn-sm ${viewMode === "table" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setViewMode("table")}>Table</button>
        </div>
        {permissions.canExport ? <button type="button" className="btn btn-sm btn-outline-secondary" onClick={exportCsv}>Export</button> : null}
      </div>

      {viewMode === "tree" ? (
        <NatureOfWorkTree
          collapsedIds={collapsedIds}
          loading={loading}
          permissions={permissions}
          tree={tree}
          onAddChild={form.openChild}
          onDelete={requestDelete}
          onEdit={form.openEdit}
          onStatus={requestStatus}
          onToggle={toggleNode}
          onView={setViewWork}
        />
      ) : (
        <NatureOfWorkTable
          permissions={permissions}
          works={works}
          onAddChild={form.openChild}
          onDelete={requestDelete}
          onEdit={form.openEdit}
          onStatus={requestStatus}
          onView={setViewWork}
        />
      )}

      <NatureOfWorkFormModal
        errors={form.errors}
        formState={form.formState}
        preview={form.preview}
        saving={saving}
        selectedUom={form.selectedUom}
        uoms={uoms}
        onClose={form.closeForm}
        onSubmit={handleSubmit}
        onUpdateField={form.updateField}
      />
      <NatureOfWorkViewModal work={viewWork} onClose={() => setViewWork(null)} />
      <NatureOfWorkConfirmModal
        confirmState={confirmState}
        saving={saving}
        onCancel={() => setConfirmState(null)}
        onConfirm={confirmAction}
      />
    </div>
  );
}
