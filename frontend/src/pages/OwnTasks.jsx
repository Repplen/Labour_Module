import { useRef } from "react";
import { Navigate } from "react-router-dom";
import ConfirmDialog from "../components/ConfirmDialog";
import Toast from "../components/Toast";
import OwnTaskCreateForm from "../components/personalTasks/OwnTaskCreateForm";
import OwnTaskDetailPanel from "../components/personalTasks/OwnTaskDetailPanel";
import OwnTaskEditModal from "../components/personalTasks/OwnTaskEditModal";
import OwnTaskFilterBar from "../components/personalTasks/OwnTaskFilterBar";
import OwnTaskTable from "../components/personalTasks/OwnTaskTable";
import OwnTasksHeader from "../components/personalTasks/OwnTasksHeader";
import TaskShareModal from "../components/personalTasks/TaskShareModal";
import { useOwnTasks } from "../hooks/personalTasks/useOwnTasks";

export default function OwnTasks() {
  const detailPanelRef = useRef(null);
  const {
    access,
    confirmComplete,
    confirmDelete,
    detail,
    editModal,
    filters,
    form,
    header,
    shareModal,
    table,
    toast,
  } = useOwnTasks();

  if (!access.isEmployee) {
    return <Navigate to="/access-denied" replace />;
  }

  const handleViewTask = (taskId) => {
    table.onViewTask(taskId);
    detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="container-fluid mt-4 mb-5 own-tasks-page">
      <OwnTasksHeader {...header} />

      <div className="row g-4 mb-4">
        <div className="col-12 col-xl-5">
          <OwnTaskCreateForm {...form} />
        </div>

        <div className="col-12 col-xl-7" ref={detailPanelRef}>
          <OwnTaskDetailPanel {...detail} />
        </div>
      </div>

      <OwnTaskFilterBar {...filters} />
      <OwnTaskTable {...table} onViewTask={handleViewTask} />
      <TaskShareModal {...shareModal} />
      <OwnTaskEditModal {...editModal} />
      <ConfirmDialog
        {...confirmComplete}
        variant="warning"
        icon={<i className="bi bi-patch-check" />}
        title="Mark as Complete?"
        message="This will mark the task as completed. This action cannot be undone."
        confirmLabel="Yes, Complete"
        cancelLabel="Cancel"
      />
      <ConfirmDialog
        {...confirmDelete}
        variant="danger"
        icon={<i className="bi bi-trash" />}
        title="Delete Task?"
        message="This will permanently delete the task. This action cannot be undone."
        confirmLabel="Yes, Delete"
        cancelLabel="Cancel"
      />
      <Toast {...toast} />
    </div>
  );
}
