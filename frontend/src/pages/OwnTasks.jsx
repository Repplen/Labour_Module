import { Navigate } from "react-router-dom";
import OwnTaskCreateForm from "../components/personalTasks/OwnTaskCreateForm";
import OwnTaskDetailPanel from "../components/personalTasks/OwnTaskDetailPanel";
import OwnTaskFilterBar from "../components/personalTasks/OwnTaskFilterBar";
import OwnTaskTable from "../components/personalTasks/OwnTaskTable";
import OwnTasksHeader from "../components/personalTasks/OwnTasksHeader";
import TaskShareModal from "../components/personalTasks/TaskShareModal";
import { useOwnTasks } from "../hooks/personalTasks/useOwnTasks";

export default function OwnTasks() {
  const {
    access,
    detail,
    filters,
    form,
    header,
    shareModal,
    table,
  } = useOwnTasks();

  if (!access.isEmployee) {
    return <Navigate to="/access-denied" replace />;
  }

  return (
    <div className="container-fluid mt-4 mb-5 own-tasks-page">
      <OwnTasksHeader {...header} />

      <div className="row g-4 mb-4">
        <div className="col-12 col-xl-5">
          <OwnTaskCreateForm {...form} />
        </div>

        <div className="col-12 col-xl-7">
          <OwnTaskDetailPanel {...detail} />
        </div>
      </div>

      <OwnTaskFilterBar {...filters} />
      <OwnTaskTable {...table} />
      <TaskShareModal {...shareModal} />
    </div>
  );
}
