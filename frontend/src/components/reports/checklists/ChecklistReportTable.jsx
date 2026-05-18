import { Link } from "react-router-dom";
import Pagination from "../../Pagination";
import { usePagination } from "../../../hooks/usePagination";
import {
  formatApprovalWorkflowLabel,
  formatChecklistScoreLabel,
  formatCurrentApproverLabel,
  formatDateTime,
  formatEmployeeLabel,
  formatPriorityLabel,
  formatScheduleLabel,
  formatTaskFinalMarkLabel,
  formatTaskTimeStatusLabel,
  getApprovalWorkflowEmployees,
  getChecklistTaskStatusBadgeClass,
  getPriorityBadgeClass,
  getPriorityRowClass,
  getTaskTimeStatusBadgeClass,
} from "../../../utils/checklistDisplay";
import {
  formatReportChecklistTaskStatus,
  getDepartmentLabel,
} from "../../../utils/checklistReportFilters";

export default function ChecklistReportTable({ rows, loading }) {
  const pagination = usePagination(rows, { initialPageSize: 25 });
  const { paginatedData } = pagination;
  return (
    <>
    <div className="table-responsive">
      <table className="table table-bordered table-striped align-middle">
        <thead className="table-dark">
          <tr>
            <th>#</th>
            <th>Task Number</th>
            <th>Checklist</th>
            <th>Employee</th>
            <th>Department</th>
            <th>Priority</th>
            <th>Schedule</th>
            <th>Start</th>
            <th>End</th>
            <th>Submitted At</th>
            <th>Scoring</th>
            <th>Time Status</th>
            <th>Final Mark</th>
            <th>Current Approver</th>
            <th>Approval Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan="16" className="text-center">
                Loading checklist task report...
              </td>
            </tr>
          )}

          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan="16" className="text-center">
                No checklist task records found
              </td>
            </tr>
          )}

          {!loading &&
            paginatedData.map((row, index) => {
              const currentApproverLabel = formatCurrentApproverLabel(row);
              const approvalWorkflowLabel = formatApprovalWorkflowLabel(row);
              const workflowCount = getApprovalWorkflowEmployees(row).length;
              const approverPrimaryLabel =
                currentApproverLabel && currentApproverLabel !== "-"
                  ? currentApproverLabel
                  : approvalWorkflowLabel;
              const showWorkflowLabel =
                workflowCount > 1 &&
                approvalWorkflowLabel &&
                approvalWorkflowLabel !== "-";

              return (
                <tr key={row._id} className={getPriorityRowClass(row)}>
                  <td>{index + 1}</td>
                  <td>{row.taskNumber}</td>
                  <td>
                    <div className="fw-semibold">{row.checklistName}</div>
                    <div className="small text-muted">{row.checklistNumber}</div>
                  </td>
                  <td>{formatEmployeeLabel(row.assignedEmployee)}</td>
                  <td>{getDepartmentLabel(row)}</td>
                  <td>
                    <span className={`badge ${getPriorityBadgeClass(row)}`}>
                      {formatPriorityLabel(row)}
                    </span>
                  </td>
                  <td>{formatScheduleLabel(row)}</td>
                  <td>{formatDateTime(row.occurrenceDate)}</td>
                  <td>{formatDateTime(row.endDateTime)}</td>
                  <td>{formatDateTime(row.submittedAt)}</td>
                  <td>{formatChecklistScoreLabel(row)}</td>
                  <td>
                    <span className={`badge ${getTaskTimeStatusBadgeClass(row)}`}>
                      {formatTaskTimeStatusLabel(row)}
                    </span>
                  </td>
                  <td>{formatTaskFinalMarkLabel(row)}</td>
                  <td>
                    <div>{approverPrimaryLabel || "-"}</div>
                    {showWorkflowLabel && (
                      <div className="small text-muted">Workflow: {approvalWorkflowLabel}</div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${getChecklistTaskStatusBadgeClass(row.status)}`}>
                      {formatReportChecklistTaskStatus(row.status)}
                    </span>
                  </td>
                  <td>
                    <Link className="btn btn-sm btn-info" to={`/checklists/tasks/${row._id}`}>
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
    <Pagination {...pagination} />
    </>
  );
}
