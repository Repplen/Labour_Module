import { formatDate, formatDateTime } from "../../../utils/checklistDisplay";
import { getEmployeeLabel } from "../../../hooks/checklistTransfer/useChecklistTransferMaster";

const getHistoryEmployeeLabel = (historyRow, side) => {
  const employee =
    side === "from" ? historyRow?.fromEmployee : historyRow?.toEmployee;
  const code =
    side === "from"
      ? String(historyRow?.fromEmployeeCode || "").trim()
      : String(historyRow?.toEmployeeCode || "").trim();
  const name =
    side === "from"
      ? String(historyRow?.fromEmployeeName || "").trim()
      : String(historyRow?.toEmployeeName || "").trim();

  if (employee?.employeeCode || employee?.employeeName) {
    return getEmployeeLabel(employee);
  }

  if (code && name) return `${code} - ${name}`;
  return code || name || "-";
};

const getTransferredByLabel = (historyRow) => {
  const userName = String(historyRow?.transferredBy?.name || "").trim();
  const email =
    String(historyRow?.transferredBy?.email || "").trim() ||
    String(historyRow?.transferredByEmail || "").trim();

  if (userName && email) return `${userName} (${email})`;
  return userName || email || "-";
};

const getTransferTypeLabel = (transferType) =>
  String(transferType || "").trim().toLowerCase() === "temporary"
    ? "Temporary"
    : "Permanent";

const getHistoryTransferStatusLabel = (historyRow) => {
  if (String(historyRow?.transferType || "").trim().toLowerCase() !== "temporary") {
    return "Completed";
  }

  const normalizedStatus = String(historyRow?.transferStatus || "").trim().toLowerCase();
  if (normalizedStatus === "active") return "Active";
  if (normalizedStatus === "pending") return "Pending";
  return "Completed";
};

const getHistoryTransferDateRangeLabel = (historyRow) => {
  if (String(historyRow?.transferType || "").trim().toLowerCase() !== "temporary") {
    return "-";
  }

  const fromDateLabel = formatDate(historyRow?.transferStartDate);
  const toDateLabel = formatDate(historyRow?.transferEndDate);

  if (fromDateLabel === "-" && toDateLabel === "-") return "-";
  return `${fromDateLabel} to ${toDateLabel}`;
};

const getChecklistNamesLabel = (historyRow) => {
  if (Array.isArray(historyRow.checklistNames) && historyRow.checklistNames.length) {
    return historyRow.checklistNames.join(", ");
  }

  if (Array.isArray(historyRow.checklists)) {
    return historyRow.checklists
      .map((checklist) => checklist?.checklistName || checklist?.checklistNumber)
      .filter(Boolean)
      .join(", ");
  }

  return "-";
};

export default function ChecklistTransferHistoryTable({
  historyLoading,
  historyRows,
  pageLoading,
}) {
  return (
    <div className="table-shell">
      <div className="p-3 border-bottom">
        <div className="list-toolbar">
          <div>
            <h5 className="mb-1">Transfer History</h5>
            <div className="form-help">
              Recent permanent and temporary transfers are stored here for audit and tracking.
            </div>
          </div>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-bordered align-middle">
          <thead className="table-light">
            <tr>
              <th style={{ minWidth: "160px" }}>Transfer Date</th>
              <th style={{ minWidth: "120px" }}>Transfer Type</th>
              <th style={{ minWidth: "180px" }}>Effective Dates</th>
              <th style={{ minWidth: "120px" }}>Status</th>
              <th style={{ minWidth: "180px" }}>From Employee</th>
              <th style={{ minWidth: "180px" }}>To Employee</th>
              <th>Transferred Checklist Names</th>
              <th style={{ minWidth: "220px" }}>Transferred By</th>
            </tr>
          </thead>
          <tbody>
            {pageLoading || historyLoading ? (
              <tr>
                <td colSpan="8" className="text-center">
                  Loading transfer history...
                </td>
              </tr>
            ) : historyRows.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center">
                  No checklist transfers have been recorded yet.
                </td>
              </tr>
            ) : (
              historyRows.map((historyRow) => (
                <tr key={historyRow._id}>
                  <td>{formatDateTime(historyRow.transferredAt || historyRow.createdAt)}</td>
                  <td>{getTransferTypeLabel(historyRow.transferType)}</td>
                  <td>{getHistoryTransferDateRangeLabel(historyRow)}</td>
                  <td>{getHistoryTransferStatusLabel(historyRow)}</td>
                  <td>{getHistoryEmployeeLabel(historyRow, "from")}</td>
                  <td>{getHistoryEmployeeLabel(historyRow, "to")}</td>
                  <td className="text-break">{getChecklistNamesLabel(historyRow)}</td>
                  <td>{getTransferredByLabel(historyRow)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
