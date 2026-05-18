import ConfirmDialog from "../../components/ConfirmDialog";
import Toast from "../../components/Toast";
import DesignationForm from "../../components/masters/designations/DesignationForm";
import DesignationHeader from "../../components/masters/designations/DesignationHeader";
import DesignationTable from "../../components/masters/designations/DesignationTable";
import { useDesignationMaster } from "../../hooks/designations/useDesignationMaster";

export default function DesignationMaster() {
  const {
    confirmDialog,
    form,
    header,
    table,
    toastState,
  } = useDesignationMaster();

  return (
    <div className="container mt-4 mb-5">
      <ConfirmDialog
        open={Boolean(confirmDialog.deleteTarget)}
        variant="danger"
        title="Delete Designation"
        message={
          <>
            Are you sure you want to delete{" "}
            <strong>{confirmDialog.deleteTarget?.name}</strong>?{" "}
            This action cannot be undone.
          </>
        }
        confirmLabel="Yes, Delete"
        onConfirm={confirmDialog.confirmDelete}
        onCancel={() => confirmDialog.setDeleteTarget(null)}
        loading={confirmDialog.deleteLoading}
      />

      <Toast toast={toastState.toast} onClose={toastState.closeToast} />

      <DesignationHeader {...header} />
      <DesignationForm {...form} />
      <DesignationTable {...table} />
    </div>
  );
}
