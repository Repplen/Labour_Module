import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import { usePermissions } from "../../context/usePermissions";

const statusLabels = {
  pending_admin_approval: "Pending Admin Approval",
  approved: "Approved",
  rejected: "Rejected",
};

const statusBadgeClass = {
  pending_admin_approval: "bg-warning text-dark",
  approved: "bg-success",
  rejected: "bg-danger",
};

const moduleLabels = {
  checklist_master: "Checklist Master",
  checklist_transfer: "Checklist Transfer",
};

const formatDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const renderMultilineValue = (value) => {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return "-";

  return normalizedValue.split("\n").map((line, index) => (
    <div key={`${line}-${index}`}>{line}</div>
  ));
};

function SnapshotSection({ title, fields, changedFieldKeys }) {
  if (!Array.isArray(fields) || !fields.length) return null;

  return (
    <div className="card shadow-sm border-0 mb-3">
      <div className="card-body">
        <h6 className="mb-3">{title}</h6>
        <div className="table-responsive">
          <table className="table table-bordered align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th style={{ width: "220px" }}>Field</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr
                  key={field.key}
                  className={changedFieldKeys.has(field.key) ? "table-warning" : ""}
                >
                  <td className="fw-semibold">{field.label}</td>
                  <td>{renderMultilineValue(field.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ChecklistAdminApprovals() {
  const { can, user } = usePermissions();
  const isMainAdminReviewer =
    Boolean(user?.isDefaultAdmin) ||
    String(user?.roleKey || "").toLowerCase() === "main_admin";
  const canApproveRequests = isMainAdminReviewer && can("checklist_master", "approve");
  const canRejectRequests = isMainAdminReviewer && can("checklist_master", "reject");
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("pending_admin_approval");
  const [moduleKey, setModuleKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [pageError, setPageError] = useState("");
  const [modalError, setModalError] = useState("");
  const [reviewRemarks, setReviewRemarks] = useState("");

  useEffect(() => {
    const loadRows = async () => {
      setLoading(true);
      setPageError("");

      try {
        const response = await api.get("/checklists/admin-requests", {
          params: {
            search: search || undefined,
            status: status || undefined,
            moduleKey: moduleKey || undefined,
          },
        });

        setRows(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Checklist admin approvals load failed:", err);
        setRows([]);
        setPageError(
          err.response?.data?.message || "Failed to load checklist approval requests."
        );
      } finally {
        setLoading(false);
      }
    };

    void loadRows();
  }, [moduleKey, reloadToken, search, status]);

  const openRequest = async (requestId) => {
    setDetailLoading(true);
    setModalError("");

    try {
      const response = await api.get(`/checklists/admin-requests/${requestId}`);
      setSelectedRequest(response.data || null);
      setReviewRemarks(String(response.data?.remarks || ""));
    } catch (err) {
      console.error("Checklist admin approval detail load failed:", err);
      setSelectedRequest(null);
      const message =
        err.response?.data?.message || "Failed to load checklist approval details.";
      setModalError(message);
      setPageError(message);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeRequest = () => {
    setSelectedRequest(null);
    setModalError("");
    setReviewRemarks("");
  };

  const handleDecision = async (decision) => {
    if (!selectedRequest?._id || actionLoading) return;

    setActionLoading(true);
    setModalError("");

    try {
      await api.post(`/checklists/admin-requests/${selectedRequest._id}/${decision}`, {
        remarks: reviewRemarks,
      });

      closeRequest();
      setReloadToken((currentValue) => currentValue + 1);
    } catch (err) {
      console.error(`Checklist admin approval ${decision} failed:`, err);
      setModalError(
        err.response?.data?.message ||
          `Failed to ${decision === "approve" ? "approve" : "reject"} request.`
      );
    } finally {
      setActionLoading(false);
    }
  };

  const pendingCount = useMemo(
    () =>
      rows.filter((row) => String(row.status || "").trim().toLowerCase() === "pending_admin_approval")
        .length,
    [rows]
  );
  const approvedCount = useMemo(
    () => rows.filter((row) => String(row.status || "").trim().toLowerCase() === "approved").length,
    [rows]
  );
  const rejectedCount = useMemo(
    () => rows.filter((row) => String(row.status || "").trim().toLowerCase() === "rejected").length,
    [rows]
  );

  const changedFieldKeys = useMemo(
    () =>
      new Set(
        (selectedRequest?.comparisonRows || [])
          .filter((row) => row?.changed)
          .map((row) => String(row.key || "").trim())
          .filter(Boolean)
      ),
    [selectedRequest]
  );

  return (
    <div className="container-fluid mt-4 mb-5" data-testid="checklist-approval-page">
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Checklists</div>
            <h3 className="mb-1">Admin Approval Inbox</h3>
            <div className="page-subtitle">
              Review checklist master and checklist transfer requests before they go live.
            </div>
          </div>

          <div className="list-summary">
            <span className="summary-chip">{rows.length} requests</span>
            <span className="summary-chip summary-chip--neutral">{pendingCount} pending</span>
            <span className="summary-chip summary-chip--neutral">{approvedCount} approved</span>
            <span className="summary-chip summary-chip--neutral">{rejectedCount} rejected</span>
          </div>
        </div>
      </div>

      {pageError ? (
        <div className="alert alert-danger" role="alert">
          {pageError}
        </div>
      ) : null}

      <div className="filter-card mb-4">
        <div className="list-toolbar">
          <div>
            <h6 className="mb-1">Filters</h6>
            <div className="form-help">
              Search by checklist, requester, or request summary and narrow by module or status.
            </div>
          </div>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => {
              setSearch("");
              setStatus("pending_admin_approval");
              setModuleKey("");
            }}
            disabled={!search && status === "pending_admin_approval" && !moduleKey}
          >
            Clear Filters
          </button>
        </div>

        <div className="row g-2 mt-1">
          <div className="col-lg-5">
            <input
              className="form-control"
              placeholder="Search checklist number, name, or requester"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="col-lg-3">
            <select
              className="form-select"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="pending_admin_approval">Pending Admin Approval</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="col-lg-4">
            <select
              className="form-select"
              value={moduleKey}
              onChange={(event) => setModuleKey(event.target.value)}
            >
              <option value="">All modules</option>
              <option value="checklist_master">Checklist Master</option>
              <option value="checklist_transfer">Checklist Transfer</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-shell">
        <div className="table-responsive">
          <table
            className="table table-bordered table-striped align-middle"
            data-testid="approval-table"
          >
            <thead className="table-dark">
              <tr>
                <th>#</th>
                <th>Requested At</th>
                <th>Module</th>
                <th>Action</th>
                <th>Entry</th>
                <th>Requested By</th>
                <th>Changed Fields</th>
                <th>Status</th>
                <th>Reviewed</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" className="text-center">
                    Loading admin approval requests...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center">
                    No checklist approval requests found.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row._id}>
                    <td>{index + 1}</td>
                    <td>{formatDateTime(row.createdAt)}</td>
                    <td>{moduleLabels[row.moduleKey] || row.moduleName || "-"}</td>
                    <td>{row.actionLabel || row.actionType || "-"}</td>
                    <td>
                      <div className="fw-semibold">{row.entryLabel || row.entryId || "-"}</div>
                      {row.requestSummary ? (
                        <div className="small text-muted">{row.requestSummary}</div>
                      ) : null}
                    </td>
                    <td>
                      <div>{row.requestedByName || "-"}</div>
                      <div className="small text-muted">{row.requestedByEmail || "-"}</div>
                    </td>
                    <td>{row.changedFieldCount || 0}</td>
                    <td>
                      <span
                        className={`badge ${
                          statusBadgeClass[row.status] || "bg-secondary"
                        }`}
                      >
                        {statusLabels[row.status] || row.status || "-"}
                      </span>
                    </td>
                    <td>
                      <div>{formatDateTime(row.reviewedAt)}</div>
                      {row.reviewedByName ? (
                        <div className="small text-muted">{row.reviewedByName}</div>
                      ) : null}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => void openRequest(row._id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailLoading ? (
        <div className="modal fade show d-block app-modal-overlay" tabIndex="-1">
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-body py-5 text-center">Loading approval details...</div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedRequest ? (
        <div className="modal fade show d-block app-modal-overlay" tabIndex="-1">
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title mb-1">Approval Request Details</h5>
                  <div className="small text-muted">
                    {selectedRequest.entryLabel || selectedRequest.requestSummary || "-"}
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={closeRequest} />
              </div>

              <div className="modal-body">
                <div className="list-summary mb-3">
                  <span className="summary-chip">
                    {moduleLabels[selectedRequest.moduleKey] ||
                      selectedRequest.moduleName ||
                      "-"}
                  </span>
                  <span className="summary-chip summary-chip--neutral">
                    {selectedRequest.actionLabel || selectedRequest.actionType || "-"}
                  </span>
                  <span
                    className={`summary-chip ${
                      selectedRequest.status === "approved"
                        ? "bg-success text-white"
                        : selectedRequest.status === "rejected"
                        ? "bg-danger text-white"
                        : ""
                    }`}
                  >
                    {statusLabels[selectedRequest.status] || selectedRequest.status || "-"}
                  </span>
                  <span className="summary-chip summary-chip--neutral">
                    Requested {formatDateTime(selectedRequest.createdAt)}
                  </span>
                  <span className="summary-chip summary-chip--neutral">
                    By {selectedRequest.requestedByName || "-"}
                  </span>
                </div>

                {modalError ? (
                  <div className="alert alert-danger" role="alert">
                    {modalError}
                  </div>
                ) : null}

                <div className="card shadow-sm border-0 mb-4">
                  <div className="card-body">
                    <h6 className="mb-3">Old vs New Comparison</h6>
                    <div className="table-responsive">
                      <table className="table table-bordered align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: "220px" }}>Field</th>
                            <th>Old Data</th>
                            <th>New Data</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedRequest.comparisonRows || []).length ? (
                            selectedRequest.comparisonRows.map((row) => (
                              <tr key={row.key} className={row.changed ? "table-warning" : ""}>
                                <td className="fw-semibold">{row.label}</td>
                                <td>{renderMultilineValue(row.oldValue)}</td>
                                <td>{renderMultilineValue(row.newValue)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="3" className="text-center">
                                No comparison data available.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="row g-3">
                  <div className="col-lg-6">
                    <h6 className="mb-3">Old Data</h6>
                    {(selectedRequest.oldDisplay?.sections || []).length ? (
                      selectedRequest.oldDisplay.sections.map((section) => (
                        <SnapshotSection
                          key={`old-${section.title}`}
                          title={section.title}
                          fields={section.fields || []}
                          changedFieldKeys={changedFieldKeys}
                        />
                      ))
                    ) : (
                      <div className="alert alert-secondary">No previous live data.</div>
                    )}
                  </div>

                  <div className="col-lg-6">
                    <h6 className="mb-3">New Data</h6>
                    {(selectedRequest.newDisplay?.sections || []).length ? (
                      selectedRequest.newDisplay.sections.map((section) => (
                        <SnapshotSection
                          key={`new-${section.title}`}
                          title={section.title}
                          fields={section.fields || []}
                          changedFieldKeys={changedFieldKeys}
                        />
                      ))
                    ) : (
                      <div className="alert alert-secondary">No requested data available.</div>
                    )}
                  </div>
                </div>

                <div className="card shadow-sm border-0 mt-4">
                  <div className="card-body">
                    <label className="form-label fw-semibold">Remarks</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      value={reviewRemarks}
                      onChange={(event) => setReviewRemarks(event.target.value)}
                      placeholder="Optional admin remarks"
                      disabled={
                        actionLoading ||
                        String(selectedRequest.status || "").trim().toLowerCase() !==
                          "pending_admin_approval"
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={closeRequest}>
                  Close
                </button>
                {String(selectedRequest.status || "").trim().toLowerCase() ===
                "pending_admin_approval" ? (
                  <>
                    {canRejectRequests ? (
                      <button
                        type="button"
                        className="btn btn-outline-danger"
                        data-testid="reject-button"
                        onClick={() => void handleDecision("reject")}
                        disabled={actionLoading}
                      >
                        {actionLoading ? "Saving..." : "Reject"}
                      </button>
                    ) : null}
                    {canApproveRequests ? (
                      <button
                        type="button"
                        className="btn btn-success"
                        data-testid="approve-button"
                        onClick={() => void handleDecision("approve")}
                        disabled={actionLoading}
                      >
                        {actionLoading ? "Saving..." : "Approve"}
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

