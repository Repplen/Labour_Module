import { useMemo, useState } from "react";
import { usePermissions } from "../../context/usePermissions";
import LabourPieceWorkerConfirmModal from "../../features/labourPieceWorker/components/LabourPieceWorkerConfirmModal";
import LabourPieceWorkerFilters from "../../features/labourPieceWorker/components/LabourPieceWorkerFilters";
import LabourPieceWorkerFormModal from "../../features/labourPieceWorker/components/LabourPieceWorkerFormModal";
import LabourPieceWorkerHeader from "../../features/labourPieceWorker/components/LabourPieceWorkerHeader";
import LabourPieceWorkerTable from "../../features/labourPieceWorker/components/LabourPieceWorkerTable";
import LabourPieceWorkerViewModal from "../../features/labourPieceWorker/components/LabourPieceWorkerViewModal";
import { getLabourPieceRates } from "../../features/labourPieceWorker/helpers/labourPieceWorker.helpers";
import { useLabourPieceWorkerFilters } from "../../features/labourPieceWorker/hooks/useLabourPieceWorkerFilters";
import { useLabourPieceWorkerForm } from "../../features/labourPieceWorker/hooks/useLabourPieceWorkerForm";
import { useLabourPieceWorkers } from "../../features/labourPieceWorker/hooks/useLabourPieceWorkers";
import "../../features/labourPieceWorker/labourPieceWorker.css";

export default function LabourPieceWorkerMaster() {
  const { can } = usePermissions();
  const { clearFilters, filters, queryParams, updateFilter } = useLabourPieceWorkerFilters();
  const {
    changeStatus,
    error,
    loading,
    natureOfWorks,
    removeWorker,
    saveWorker,
    saving,
    uoms,
    workers,
  } = useLabourPieceWorkers(queryParams);
  const form = useLabourPieceWorkerForm();
  const [viewWorker, setViewWorker] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const permissions = {
    canAdd: can("labour_piece_worker_master", "add"),
    canEdit: can("labour_piece_worker_master", "edit"),
    canDelete: can("labour_piece_worker_master", "delete"),
    canStatusUpdate: can("labour_piece_worker_master", "status_update"),
    canExport: can("labour_piece_worker_master", "export"),
  };

  const summary = useMemo(
    () => ({
      totalCount: workers.length,
      activeCount: workers.filter((worker) => worker.isActive).length,
      inactiveCount: workers.filter((worker) => !worker.isActive).length,
    }),
    [workers]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = form.validate();
    if (Object.keys(result.errors).length) return;

    const response = await saveWorker({
      mode: form.formState.mode,
      values: result.values,
      editingWorker: form.formState.editingWorker,
    });

    if (response.success) {
      form.closeForm();
      return;
    }

    const fieldErrors = {};
    response.errors?.forEach((item) => {
      fieldErrors[item.field || "workerName"] = item.message;
    });
    form.setErrors(fieldErrors);
  };

  const requestDelete = (worker) => {
    setConfirmState({
      type: "delete",
      worker,
      title: "Delete Labour / Piece Worker",
      message: `Delete "${worker.workerName}"?`,
      confirmLabel: "Delete",
      variant: "btn-danger",
    });
  };

  const requestStatus = (worker) => {
    const nextStatus = !worker.isActive;
    setConfirmState({
      type: "status",
      worker,
      title: nextStatus ? "Activate Labour / Piece Worker" : "Deactivate Labour / Piece Worker",
      message: `${nextStatus ? "Activate" : "Deactivate"} "${worker.workerName}"?`,
      confirmLabel: nextStatus ? "Activate" : "Deactivate",
      variant: nextStatus ? "btn-success" : "btn-warning",
      isActive: nextStatus,
    });
  };

  const confirmAction = async () => {
    if (!confirmState?.worker?._id) return;
    const response =
      confirmState.type === "delete"
        ? await removeWorker(confirmState.worker._id)
        : await changeStatus(confirmState.worker._id, { isActive: confirmState.isActive });

    if (response.success) setConfirmState(null);
  };

  const exportCsv = () => {
    const headers = [
      "S.No",
      "Worker Code",
      "Worker Name",
      "Worker Type",
      "Labour Category",
      "Nature of Work",
      "Sub Nature of Work",
      "UOM",
      "Rate Type",
      "Standard Rate",
      "Overtime Rate",
      "Piece Rate",
      "GST Applicable",
      "GST %",
      "GST Amount",
      "Gross Rate",
      "Net Rate",
      "Status",
    ];
    const rows = workers.map((worker, index) => {
      const rates = getLabourPieceRates(worker);
      return [
        index + 1,
        worker.workerCode,
        worker.workerName,
        worker.workerType,
        worker.labourCategory,
        worker.natureOfWorkName,
        worker.subNatureOfWorkPath,
        worker.uomName ? `${worker.uomName} ${worker.uomSymbol || ""}` : "",
        worker.rateType,
        worker.standardRate ?? "",
        worker.overtimeRate ?? "",
        worker.pieceRate ?? "",
        worker.gstApplicable ? "Yes" : "No",
        worker.gstPercent ?? "",
        rates.gstAmount ?? "",
        rates.grossRate ?? "",
        rates.netRate ?? "",
        worker.isActive ? "Active" : "Inactive",
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "labour-piece-workers.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="container-fluid px-3 px-lg-4 mt-4 mb-5 labour-piece-worker-page">
      <LabourPieceWorkerHeader {...summary} canAdd={permissions.canAdd} onAdd={form.openCreate} />

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <LabourPieceWorkerFilters
        clearFilters={clearFilters}
        filters={filters}
        natureOfWorks={natureOfWorks}
        uoms={uoms}
        updateFilter={updateFilter}
      />

      <div className="list-toolbar mb-3">
        <div className="small text-muted">
          {loading ? "Loading labour/piece workers..." : `${workers.length} labour/piece worker records`}
        </div>
        {permissions.canExport ? (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={exportCsv}>
            Export
          </button>
        ) : null}
      </div>

      <LabourPieceWorkerTable
        permissions={permissions}
        workers={workers}
        onDelete={requestDelete}
        onEdit={form.openEdit}
        onStatus={requestStatus}
        onView={setViewWorker}
      />

      <LabourPieceWorkerFormModal
        errors={form.errors}
        formState={form.formState}
        natureOfWorks={natureOfWorks}
        saving={saving}
        uoms={uoms}
        onClose={form.closeForm}
        onSubmit={handleSubmit}
        onUpdateField={form.updateField}
      />
      <LabourPieceWorkerViewModal worker={viewWorker} onClose={() => setViewWorker(null)} />
      <LabourPieceWorkerConfirmModal
        confirmState={confirmState}
        saving={saving}
        onCancel={() => setConfirmState(null)}
        onConfirm={confirmAction}
      />
    </div>
  );
}
