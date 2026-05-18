import ConfirmDialog from "../../components/ConfirmDialog";
import Toast from "../../components/Toast";
import CompanyForm from "../../components/masters/companies/CompanyForm";
import CompanyHeader from "../../components/masters/companies/CompanyHeader";
import CompanyTable from "../../components/masters/companies/CompanyTable";
import { useCompanyMaster } from "../../hooks/companies/useCompanyMaster";

export default function CompanyMaster() {
  const {
    confirmDialog,
    toastState,
    header,
    form,
    table,
  } = useCompanyMaster();

  return (
    <div className="container mt-4 mb-5">
      <ConfirmDialog
        open={Boolean(confirmDialog.deleteTarget)}
        variant="danger"
        title="Delete Company"
        message={
          <>
            Are you sure you want to delete{" "}
            <strong>{confirmDialog.deleteTarget?.name}</strong>? This action cannot be undone.
          </>
        }
        confirmLabel="Yes, Delete"
        onConfirm={confirmDialog.confirmDelete}
        onCancel={() => confirmDialog.setDeleteTarget(null)}
        loading={confirmDialog.deleteLoading}
      />

      <Toast toast={toastState.toast} onClose={toastState.closeToast} />

      <CompanyHeader {...header} />
      <CompanyForm {...form} />
      <CompanyTable {...table} />
    </div>
  );
}
