import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { usePermissions } from "../../context/usePermissions";
import { formatDepartmentList } from "../../utils/departmentDisplay";
import { formatSiteLabel } from "../../utils/siteDisplay";
import {
  formatChecklistTaskStatus,
  formatDate,
  formatPriorityLabel,
  getChecklistTaskStatusBadgeClass,
  getPriorityBadgeClass,
  getPriorityRowClass,
} from "../../utils/checklistDisplay";

const getDepartmentLabel = (task) =>
  formatDepartmentList(task?.assignedEmployee?.department || task?.department) ||
  task?.assignedEmployee?.departmentDisplay ||
  task?.departmentDisplay ||
  "-";

const getSiteLabel = (task) =>
  formatSiteLabel(task?.checklist?.employeeAssignedSite || task?.employeeAssignedSite) || "-";

const statusOptions = [
  { value: "", label: "All statuses" },
  { value: "waiting_dependency", label: "Waiting for Dependency" },
  { value: "open", label: "Assigned" },
  { value: "submitted", label: "Under Approval" },
  { value: "nil_for_approval", label: "Nil For Approval" },
  { value: "approved", label: "Approved / Completed" },
  { value: "nil_approved", label: "Nil Approved" },
  { value: "rejected", label: "Rejected" },
];

const getLoadErrorMessage = (err) => {
  const responseMessage = String(err.response?.data?.message || "").trim();

  if (responseMessage.toLowerCase() === "validation failed") {
    return "Tasks API route is not active yet. Restart the backend server, then refresh this page to load generated tasks and delete options.";
  }

  return responseMessage || "Failed to load generated checklist tasks";
};

const isGeneratedTaskRouteUnavailable = (err) => {
  const status = Number(err.response?.status || 0);
  const responseMessage = String(err.response?.data?.message || "")
    .trim()
    .toLowerCase();

  return (
    status === 404 ||
    responseMessage === "validation failed" ||
    responseMessage.includes("route not found")
  );
};

export default function ChecklistTasksAdmin() {
  const { can, canAny } = usePermissions();
  const canDeleteTasks = can("checklist_master", "delete");
  const canViewTaskReport = canAny([
    { moduleKey: "reports", actionKey: "view" },
    { moduleKey: "reports", actionKey: "report_view" },
  ]);
  const canViewApprovalInbox = can("approval_inbox", "view");

  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState("");
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [deleteApiActive, setDeleteApiActive] = useState(true);

  useEffect(() => {
    const loadRows = async () => {
      setLoading(true);

      try {
        setErrorMessage("");
        setDeleteApiActive(true);
        const response = await api.get("/generated-checklist-tasks", {
          params: {
            search: search || undefined,
            status: status || undefined,
          },
        });

        setRows(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Generated checklist task load failed:", err);

        if (canViewTaskReport && isGeneratedTaskRouteUnavailable(err)) {
          try {
            const reportResponse = await api.get("/checklists/tasks/report", {
              params: {
                search: search || undefined,
                status: status || undefined,
              },
            });

            setRows(Array.isArray(reportResponse.data) ? reportResponse.data : []);
            setDeleteApiActive(false);
            setErrorMessage(
              "Generated task delete API is not active yet. Showing generated tasks from report data; deploy the latest backend to enable delete."
            );
          } catch (fallbackErr) {
            console.error("Generated checklist task report fallback failed:", fallbackErr);
            setErrorMessage(getLoadErrorMessage(fallbackErr));
            setRows([]);
          }
        } else {
          setErrorMessage(getLoadErrorMessage(err));
          setRows([]);
        }
      } finally {
        setLoading(false);
      }
    };

    void loadRows();
  }, [canViewTaskReport, search, status]);

  useEffect(() => {
    setSelectedTaskIds((currentValue) =>
      currentValue.filter((selectedId) =>
        rows.some((row) => String(row._id) === String(selectedId))
      )
    );
  }, [rows]);

  const removeRowsFromState = (taskIds) => {
    const normalizedTaskIds = taskIds.map((taskId) => String(taskId));

    setRows((currentValue) =>
      currentValue.filter((row) => !normalizedTaskIds.includes(String(row._id)))
    );
    setSelectedTaskIds((currentValue) =>
      currentValue.filter((taskId) => !normalizedTaskIds.includes(String(taskId)))
    );
  };

  const toggleTaskSelection = (taskId) => {
    const normalizedTaskId = String(taskId);

    setSelectedTaskIds((currentValue) =>
      currentValue.includes(normalizedTaskId)
        ? currentValue.filter((selectedId) => selectedId !== normalizedTaskId)
        : [...currentValue, normalizedTaskId]
    );
  };

  const toggleAllTaskSelections = () => {
    const visibleTaskIds = rows.map((row) => String(row._id));

    if (
      visibleTaskIds.length &&
      visibleTaskIds.every((taskId) => selectedTaskIds.includes(taskId))
    ) {
      setSelectedTaskIds([]);
      return;
    }

    setSelectedTaskIds(visibleTaskIds);
  };

  const deleteTask = async (taskId) => {
    if (
      !window.confirm(
        "This will permanently remove only the selected employee assigned task. Checklist Master will not be deleted."
      )
    ) {
      return;
    }

    setDeletingTaskId(taskId);

    try {
      await api.delete(`/generated-checklist-tasks/${taskId}`);
      removeRowsFromState([taskId]);
      alert("Selected employee assigned task deleted permanently.");
    } catch (err) {
      console.error("Generated checklist task delete failed:", err);
      alert(err.response?.data?.message || "Failed to delete selected checklist task");
    } finally {
      setDeletingTaskId("");
    }
  };

  const deleteSelectedTasks = async () => {
    if (!selectedTaskIds.length) {
      return;
    }

    if (
      !window.confirm(
        "This will permanently remove only the selected employee assigned tasks. Checklist Master will not be deleted."
      )
    ) {
      return;
    }

    setBulkDeleteLoading(true);

    try {
      const response = await api.post("/generated-checklist-tasks/bulk-delete", {
        taskIds: selectedTaskIds,
      });
      const deletedCount = Number(response.data?.deletedCount || selectedTaskIds.length);

      removeRowsFromState(selectedTaskIds);
      alert(
        `${deletedCount} employee assigned task${
          deletedCount === 1 ? "" : "s"
        } deleted permanently.`
      );
    } catch (err) {
      console.error("Generated checklist task bulk delete failed:", err);
      alert(err.response?.data?.message || "Failed to delete selected checklist tasks");
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
  };

  const openCount = rows.filter((row) => String(row.status || "").trim().toLowerCase() === "open")
    .length;
  const approvalCount = rows.filter((row) =>
    ["submitted", "nil_for_approval"].includes(String(row.status || "").trim().toLowerCase())
  ).length;
  const completedCount = rows.filter((row) =>
    ["approved", "nil_approved"].includes(String(row.status || "").trim().toLowerCase())
  ).length;
  const allRowsSelected =
    rows.length > 0 && rows.every((row) => selectedTaskIds.includes(String(row._id)));
  const hasFilters = Boolean(search.trim() || status);
  const canBulkDeleteTasks = canDeleteTasks && deleteApiActive;
  const tableColumnCount = canDeleteTasks ? 14 : 13;

  return (
    <div className="container-fluid mt-4 mb-5">
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Checklist Admin</div>
            <h3 className="mb-1">Tasks</h3>
            <div className="page-subtitle">
              Manage already generated employee-assigned checklist task instances without
              affecting Checklist Master records.
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2">
            {canDeleteTasks ? (
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={deleteSelectedTasks}
                disabled={!canBulkDeleteTasks || !selectedTaskIds.length || bulkDeleteLoading}
                title={
                  deleteApiActive
                    ? "Delete selected generated tasks"
                    : "Deploy the latest backend to enable generated task deletion"
                }
              >
                {bulkDeleteLoading
                  ? "Deleting..."
                  : `Delete Selected${selectedTaskIds.length ? ` (${selectedTaskIds.length})` : ""}`}
              </button>
            ) : null}
            {canViewApprovalInbox ? (
              <Link to="/checklists/approvals" className="btn btn-outline-primary">
                Approval Inbox
              </Link>
            ) : null}
            <Link to="/checklists" className="btn btn-outline-secondary">
              Checklist Master
            </Link>
          </div>
        </div>

        <div className="list-summary mt-3">
          <span className="summary-chip">{rows.length} generated tasks</span>
          <span className="summary-chip summary-chip--neutral">{openCount} assigned</span>
          <span className="summary-chip summary-chip--neutral">{approvalCount} under approval</span>
          <span className="summary-chip summary-chip--neutral">{completedCount} completed</span>
          {selectedTaskIds.length ? (
            <span className="summary-chip">{selectedTaskIds.length} selected</span>
          ) : null}
        </div>
      </div>

      <div className="filter-card mb-4">
        <div className="list-toolbar">
          <div>
            <h6 className="mb-1">Filters</h6>
            <div className="form-help">
              Search generated tasks by task ID, checklist number, or checklist name.
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={clearFilters}
            disabled={!hasFilters}
          >
            Clear Filters
          </button>
        </div>

        <div className="row g-2 mt-1">
          <div className="col-md-8">
            <input
              className="form-control"
              placeholder="Search task ID, checklist number, or checklist name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="col-md-4">
            <select
              className="form-select"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="table-shell">
        <div className="table-responsive">
          <table className="table table-bordered table-striped align-middle">
            <thead className="table-dark">
              <tr>
                {canDeleteTasks ? (
                  <th className="text-center" style={{ width: "56px" }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={allRowsSelected}
                      onChange={toggleAllTaskSelections}
                      disabled={!rows.length || !deleteApiActive || bulkDeleteLoading}
                      aria-label="Select all generated checklist tasks"
                    />
                  </th>
                ) : null}
                <th>#</th>
                <th>Task ID</th>
                <th>Checklist Number</th>
                <th>Checklist Name</th>
                <th>Employee Name</th>
                <th>Site</th>
                <th>Department</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Created From Checklist Master</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {errorMessage ? (
                <tr>
                  <td colSpan={tableColumnCount} className="text-center text-danger">
                    {errorMessage}
                  </td>
                </tr>
              ) : null}

              {loading ? (
                <tr>
                  <td colSpan={tableColumnCount} className="text-center">
                    Loading generated checklist tasks...
                  </td>
                </tr>
              ) : null}

              {!loading && !errorMessage && rows.length === 0 ? (
                <tr>
                  <td colSpan={tableColumnCount} className="text-center">
                    No generated checklist tasks found
                  </td>
                </tr>
              ) : null}

              {!loading
                ? rows.map((row, index) => (
                    <tr key={row._id} className={getPriorityRowClass(row)}>
                      {canDeleteTasks ? (
                        <td className="text-center">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={selectedTaskIds.includes(String(row._id))}
                            onChange={() => toggleTaskSelection(row._id)}
                            disabled={!deleteApiActive || bulkDeleteLoading}
                            aria-label={`Select generated task ${row.taskNumber || row._id}`}
                          />
                        </td>
                      ) : null}
                      <td>{index + 1}</td>
                      <td>
                        <div className="fw-semibold">{row.taskNumber || row._id}</div>
                        {row.taskNumber ? (
                          <div className="small text-muted">{row._id}</div>
                        ) : null}
                      </td>
                      <td>{row.checklistNumber || "-"}</td>
                      <td className="fw-semibold">{row.checklistName || "-"}</td>
                      <td>{row.assignedEmployee?.employeeName || "-"}</td>
                      <td>{getSiteLabel(row)}</td>
                      <td>{getDepartmentLabel(row)}</td>
                      <td>{formatDate(row.occurrenceDate)}</td>
                      <td>{formatDate(row.endDateTime)}</td>
                      <td>
                        <span className={`badge ${getChecklistTaskStatusBadgeClass(row.status)}`}>
                          {formatChecklistTaskStatus(row.status)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${getPriorityBadgeClass(row)}`}>
                          {formatPriorityLabel(row)}
                        </span>
                      </td>
                      <td>
                        {row.checklist?._id ? (
                          <Link
                            to={`/checklists/${row.checklist._id}`}
                            className="btn btn-sm btn-outline-secondary"
                          >
                            View Master
                          </Link>
                        ) : (
                          <span className="badge text-bg-light border text-dark">
                            Master Protected
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-2 justify-content-center">
                          <Link to={`/checklists/tasks/${row._id}`} className="btn btn-sm btn-info">
                            View
                          </Link>
                          {canDeleteTasks ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => deleteTask(row._id)}
                              disabled={!deleteApiActive || deletingTaskId === row._id}
                              title={
                                deleteApiActive
                                  ? "Delete generated task"
                                  : "Deploy the latest backend to enable generated task deletion"
                              }
                            >
                              {!deleteApiActive
                                ? "Delete unavailable"
                                : deletingTaskId === row._id
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
