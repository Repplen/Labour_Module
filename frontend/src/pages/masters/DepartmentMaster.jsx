import ConfirmDialog from "../../components/ConfirmDialog";
import Toast from "../../components/Toast";
import DepartmentForm from "../../components/masters/departments/DepartmentForm";
import DepartmentHeader from "../../components/masters/departments/DepartmentHeader";
import DepartmentTable from "../../components/masters/departments/DepartmentTable";
import SubDepartmentManager from "../../components/masters/departments/SubDepartmentManager";
import { useDepartmentMaster } from "../../hooks/departments/useDepartmentMaster";

export default function DepartmentMaster() {
  const {
    toastState,
    confirmDialog,
    departmentForm,
    departmentsTable,
    summary,
    subDepartmentManager,
  } = useDepartmentMaster();

  return (
    <div className="container mt-4 mb-5">
      <ConfirmDialog
        open={Boolean(confirmDialog.deleteTarget)}
        variant="danger"
        title={
          confirmDialog.deleteTarget?.type === "department"
            ? "Delete Department"
            : "Delete Sub Department"
        }
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

      <DepartmentHeader
        departmentCount={summary.departmentCount}
        selectedHeadCount={summary.selectedHeadCount}
      />
      <DepartmentForm {...departmentForm} />
      <DepartmentTable {...departmentsTable} />
      <SubDepartmentManager {...subDepartmentManager} />
    </div>
  );
}
