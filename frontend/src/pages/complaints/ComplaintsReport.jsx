import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  exportComplaintReport,
  getComplaintDetail,
  getComplaintReport,
  updateComplaint,
} from "../../api/complaintApi";
import ComplaintDetailPanel from "../../components/complaints/ComplaintDetailPanel";
import ComplaintProcessTracker from "../../components/complaints/ComplaintProcessTracker";
import {
  buildComplaintQueryParams,
  buildComplaintRequestParams,
  defaultComplaintFilters,
  getComplaintDownloadFileName,
  getComplaintSortIndicator,
  parseComplaintFiltersFromSearchParams,
  toggleComplaintSort,
} from "../../utils/complaintReporting";
import { getComplaintProcessState } from "../../utils/complaintLifecycle";
import "../../styles/complaintsWorkspace.css";

const emptyReportData = {
  summary: {
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    overdue: 0,
    pendingDepartmentHead: 0,
    pendingSiteHead: 0,
    pendingMainAdmin: 0,
    actionRequired: 0,
  },
  rows: [],
  filterOptions: {
    companies: [],
    sites: [],
    departments: [],
    employees: [],
    complaintStatuses: [],
    complaintLevels: [],
  },
};

const buildPrintFilterSummary = (filters = {}) => {
  const parts = [];

  if (filters.fromDate || filters.toDate) {
    parts.push(`Date: ${filters.fromDate || "Any"} to ${filters.toDate || "Any"}`);
  }
  if (filters.company) parts.push(`Company: ${filters.company}`);
  if (filters.site) parts.push(`Site: ${filters.site}`);
  if (filters.department) parts.push(`Department: ${filters.department}`);
  if (filters.complaintStatus) parts.push(`Status: ${filters.complaintStatus}`);
  if (filters.level) parts.push(`Level: ${filters.level}`);
  if (filters.employeeName) parts.push(`Employee: ${filters.employeeName}`);
  if (filters.search) parts.push(`Search: ${filters.search}`);

  return parts.length ? parts.join(" | ") : "All visible complaints";
};

export default function ComplaintsReport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const appliedFilters = useMemo(
    () => parseComplaintFiltersFromSearchParams(searchParams),
    [searchParams]
  );
  const selectedComplaintId = String(searchParams.get("complaintId") || "").trim();

  const [filters, setFilters] = useState(appliedFilters);
  const [reportData, setReportData] = useState(emptyReportData);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [actionRemark, setActionRemark] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionSaving, setActionSaving] = useState(false);
  const [exportingFormat, setExportingFormat] = useState("");
  const [loadError, setLoadError] = useState("");
  const [clockNow, setClockNow] = useState(() => new Date());
  const [expandedProcessId, setExpandedProcessId] = useState("");
  const [timelineHighlighted, setTimelineHighlighted] = useState(false);
  const timelineRef = useRef(null);
  const scrollTimerRef = useRef(null);
  const highlightTimerRef = useRef(null);
  const pendingTimelineScrollRef = useRef(false);

  useEffect(() => {
    setFilters(appliedFilters);
  }, [appliedFilters]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setClockNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(scrollTimerRef.current);
      window.clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const loadReport = useCallback(async (nextFilters) => {
    setLoading(true);
    setLoadError("");

    try {
      const response = await getComplaintReport(buildComplaintRequestParams(nextFilters));

      setReportData({
        ...emptyReportData,
        ...(response.data || {}),
      });
    } catch (error) {
      console.error("Complaint report load failed:", error);
      setReportData(emptyReportData);
      setLoadError(error.response?.data?.message || "Complaint report could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadComplaintDetail = async (complaintId) => {
    if (!complaintId) {
      setSelectedComplaint(null);
      setActionRemark("");
      return;
    }

    setDetailLoading(true);

    try {
      const response = await getComplaintDetail(complaintId);
      setSelectedComplaint(response.data || null);
      setActionRemark("");
    } catch (error) {
      console.error("Complaint detail load failed:", error);
      setSelectedComplaint(null);
      alert(error.response?.data?.message || "Failed to load complaint details");
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadReport(appliedFilters);
  }, [appliedFilters, loadReport]);

  useEffect(() => {
    if (!selectedComplaintId) {
      setSelectedComplaint(null);
      setActionRemark("");
      pendingTimelineScrollRef.current = false;
      return;
    }

    void loadComplaintDetail(selectedComplaintId);
  }, [selectedComplaintId]);

  const scrollToTimeline = useCallback(() => {
    setTimelineHighlighted(false);
    window.clearTimeout(scrollTimerRef.current);
    window.clearTimeout(highlightTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => {
      timelineRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setTimelineHighlighted(true);
      highlightTimerRef.current = window.setTimeout(() => {
        setTimelineHighlighted(false);
      }, 1500);
    }, 100);
  }, []);

  useEffect(() => {
    if (!pendingTimelineScrollRef.current || detailLoading || !selectedComplaint) return;

    pendingTimelineScrollRef.current = false;
    scrollToTimeline();
  }, [detailLoading, scrollToTimeline, selectedComplaint]);

  const applyFilters = () => {
    if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
      alert("From date cannot be greater than to date");
      return;
    }

    setSearchParams(buildComplaintQueryParams(filters));
  };

  const resetFilters = () => {
    setFilters(defaultComplaintFilters);
    setSearchParams(new URLSearchParams());
  };

  const selectComplaint = (complaintId) => {
    const nextParams = buildComplaintQueryParams(appliedFilters);
    nextParams.set("complaintId", complaintId);
    setSearchParams(nextParams);
    pendingTimelineScrollRef.current = true;

    if (complaintId === selectedComplaintId && timelineRef.current) {
      pendingTimelineScrollRef.current = false;
      scrollToTimeline();
    }
  };

  const clearSelectedComplaint = () => {
    const nextParams = buildComplaintQueryParams(appliedFilters);
    setSearchParams(nextParams);
  };

  const toggleProcessRow = (complaintId) => {
    setExpandedProcessId((currentId) => (currentId === complaintId ? "" : complaintId));
  };

  const handleSort = (field) => {
    const nextFilters = toggleComplaintSort(appliedFilters, field);
    const nextParams = buildComplaintQueryParams(nextFilters);

    if (selectedComplaintId) {
      nextParams.set("complaintId", selectedComplaintId);
    }

    setSearchParams(nextParams);
  };

  const handleAction = async (action) => {
    if (!selectedComplaintId) return;

    setActionSaving(true);

    try {
      const response = await updateComplaint(selectedComplaintId, {
        action,
        remark: actionRemark,
      });

      alert(response.data?.message || "Complaint updated successfully");
      await loadReport(appliedFilters);
      await loadComplaintDetail(selectedComplaintId);
    } catch (error) {
      console.error("Complaint action failed:", error);
      alert(error.response?.data?.message || "Failed to update complaint");
    } finally {
      setActionSaving(false);
    }
  };

  const handleExport = async (format) => {
    setExportingFormat(format);

    try {
      const response = await exportComplaintReport(
        format,
        buildComplaintRequestParams(appliedFilters)
      );

      const fallbackFileName =
        format === "excel" ? "complaint-report.xlsx" : "complaint-report.pdf";
      const blob = new Blob([response.data], {
        type: response.headers?.["content-type"] || undefined,
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = downloadUrl;
      anchor.download = getComplaintDownloadFileName(response.headers, fallbackFileName);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error(`Complaint report ${format} export failed:`, error);
      alert(
        format === "excel"
          ? "Failed to download complaint report in Excel format"
          : "Failed to download complaint report in PDF format"
      );
    } finally {
      setExportingFormat("");
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1280,height=900");

    if (!printWindow) {
      alert("Allow pop-ups in your browser to print the complaint report.");
      return;
    }

    const rowsHtml = (reportData.rows || [])
      .map(
        (row, index) => `
          <tr class="${row.isOverdue ? "is-overdue" : ""}">
            <td>${index + 1}</td>
            <td>${row.complaintCode || "-"}</td>
            <td>${row.employeeLabel || row.employeeName || "-"}</td>
            <td>${row.companyName || "-"}</td>
            <td>${row.siteDisplayName || "-"}</td>
            <td>${row.departmentName || "-"}</td>
            <td>${row.complaintText || "-"}</td>
            <td>${row.raisedAtLabel || "-"}</td>
            <td>${row.currentLevelLabel || "-"}</td>
            <td>${row.businessStatusLabel || "-"}</td>
            <td>${row.overdueStatusLabel || "-"}</td>
            <td>${row.completedAtLabel || "-"}</td>
          </tr>
        `
      )
      .join("");

    printWindow.document.write(`<!doctype html>
<html>
  <head>
    <title>Complaint Report</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
      h1 { margin: 0 0 8px; }
      .meta { color: #475569; margin-bottom: 16px; font-size: 14px; }
      .summary { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
      .summary-item { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 12px; min-width: 140px; }
      .summary-item strong { display: block; font-size: 20px; margin-top: 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; text-align: left; }
      th { background: #e2e8f0; }
      .is-overdue td { background: #fef2f2; }
    </style>
  </head>
  <body>
    <h1>Complaint Report</h1>
    <div class="meta">Filters: ${buildPrintFilterSummary(appliedFilters)}</div>
    <div class="summary">
      <div class="summary-item">Total<strong>${reportData.summary.total || 0}</strong></div>
      <div class="summary-item">Open<strong>${reportData.summary.open || 0}</strong></div>
      <div class="summary-item">In Progress<strong>${reportData.summary.inProgress || 0}</strong></div>
      <div class="summary-item">Resolved<strong>${reportData.summary.resolved || 0}</strong></div>
      <div class="summary-item">Overdue<strong>${reportData.summary.overdue || 0}</strong></div>
    </div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Complaint ID</th>
          <th>Raised By</th>
          <th>Company</th>
          <th>Site</th>
          <th>Department</th>
          <th>Complaint</th>
          <th>Raised At</th>
          <th>Current Level</th>
          <th>Status</th>
          <th>Overdue Status</th>
          <th>Resolved At</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="12">No complaint rows found.</td></tr>'}
      </tbody>
    </table>
  </body>
</html>`);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const filterOptions = reportData.filterOptions || emptyReportData.filterOptions;

  return (
    <div className="container-fluid mt-4 mb-5 complaints-workspace complaints-report">
      <div className="page-intro-card complaint-hero-card mb-4">
        <div className="list-toolbar align-items-start">
          <div>
            <div className="page-kicker">Complaints</div>
            <h3 className="mb-1">Complaint Report</h3>
            <p className="page-subtitle mb-0">
              Search, filter, sort, export, print, and action complaint records in one place.
            </p>
          </div>

          <div className="d-flex flex-wrap gap-2 complaint-hero-actions">
            <Link className="btn btn-light complaint-hero-actions__primary" to="/complaints">
              Back to Dashboard
            </Link>
            <button
              type="button"
              className="btn btn-outline-light"
              onClick={() => handleExport("excel")}
              disabled={exportingFormat === "excel"}
            >
              {exportingFormat === "excel" ? "Downloading Excel..." : "Export Excel"}
            </button>
            <button
              type="button"
              className="btn btn-outline-light"
              onClick={() => handleExport("pdf")}
              disabled={exportingFormat === "pdf"}
            >
              {exportingFormat === "pdf" ? "Downloading PDF..." : "Export PDF"}
            </button>
            <button type="button" className="btn btn-outline-light" onClick={handlePrint}>
              Print
            </button>
          </div>
        </div>

        <div className="complaint-summary-strip mt-4">
          <div className="complaint-summary-pill">
            <span>Total</span>
            <strong>{reportData.summary.total || 0}</strong>
          </div>
          <div className="complaint-summary-pill">
            <span>Open</span>
            <strong>{reportData.summary.open || 0}</strong>
          </div>
          <div className="complaint-summary-pill">
            <span>In Progress</span>
            <strong>{reportData.summary.inProgress || 0}</strong>
          </div>
          <div className="complaint-summary-pill">
            <span>Resolved</span>
            <strong>{reportData.summary.resolved || 0}</strong>
          </div>
          <div className="complaint-summary-pill">
            <span>Overdue</span>
            <strong>{reportData.summary.overdue || 0}</strong>
          </div>
        </div>
      </div>

      <div className="soft-card complaint-filter-card mb-4">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
          <div>
            <div className="page-kicker">Filters</div>
            <h5 className="mb-1">Complaint Report Filters</h5>
            <div className="page-subtitle mb-0">
              Use search and filters to isolate the exact complaint set you want to review.
            </div>
          </div>

          <div className="d-flex gap-2">
            <button type="button" className="btn btn-primary" onClick={applyFilters}>
              Apply Filters
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={resetFilters}>
              Reset
            </button>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-md-6 col-xl-3">
            <label className="form-label fw-semibold">Search</label>
            <input
              className="form-control"
              placeholder="Complaint ID, employee, site, remark..."
              value={filters.search}
              onChange={(event) =>
                setFilters((current) => ({ ...current, search: event.target.value }))
              }
            />
          </div>
          <div className="col-12 col-md-6 col-xl-2">
            <label className="form-label fw-semibold">From Date</label>
            <input
              type="date"
              className="form-control"
              value={filters.fromDate}
              onChange={(event) =>
                setFilters((current) => ({ ...current, fromDate: event.target.value }))
              }
            />
          </div>
          <div className="col-12 col-md-6 col-xl-2">
            <label className="form-label fw-semibold">To Date</label>
            <input
              type="date"
              className="form-control"
              value={filters.toDate}
              onChange={(event) =>
                setFilters((current) => ({ ...current, toDate: event.target.value }))
              }
            />
          </div>
          <div className="col-12 col-md-6 col-xl-2">
            <ComplaintFilterSelect
              label="Company"
              value={filters.company}
              options={filterOptions.companies}
              onChange={(value) => setFilters((current) => ({ ...current, company: value }))}
              emptyLabel="All Companies"
            />
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <ComplaintFilterSelect
              label="Site"
              value={filters.site}
              options={filterOptions.sites}
              onChange={(value) => setFilters((current) => ({ ...current, site: value }))}
              emptyLabel="All Sites"
            />
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <ComplaintFilterSelect
              label="Department"
              value={filters.department}
              options={filterOptions.departments}
              onChange={(value) => setFilters((current) => ({ ...current, department: value }))}
              emptyLabel="All Departments"
            />
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <ComplaintFilterSelect
              label="Complaint Status"
              value={filters.complaintStatus}
              options={filterOptions.complaintStatuses}
              onChange={(value) =>
                setFilters((current) => ({ ...current, complaintStatus: value }))
              }
              emptyLabel="All Statuses"
            />
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <ComplaintFilterSelect
              label="Complaint Level"
              value={filters.level}
              options={filterOptions.complaintLevels}
              onChange={(value) => setFilters((current) => ({ ...current, level: value }))}
              emptyLabel="All Levels"
            />
          </div>
          <div className="col-12 col-md-6 col-xl-3">
            <label className="form-label fw-semibold">Employee Name</label>
            <input
              className="form-control"
              placeholder="Filter by employee name"
              value={filters.employeeName}
              onChange={(event) =>
                setFilters((current) => ({ ...current, employeeName: event.target.value }))
              }
            />
          </div>
        </div>

        {loadError ? <div className="alert alert-warning mt-3 mb-0">{loadError}</div> : null}
      </div>

      <div className="table-shell mb-4 complaint-table-shell">
        <div className="table-responsive">
          <table className="table align-middle complaint-report-table">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <SortableHeader
                  label="Complaint ID"
                  field="complaintCode"
                  filters={appliedFilters}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Raised By"
                  field="employeeName"
                  filters={appliedFilters}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Company"
                  field="companyName"
                  filters={appliedFilters}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Site"
                  field="siteDisplayName"
                  filters={appliedFilters}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Department"
                  field="departmentName"
                  filters={appliedFilters}
                  onSort={handleSort}
                />
                <th>Complaint Subject / Description</th>
                <SortableHeader
                  label="Raised Date & Time"
                  field="raisedAt"
                  filters={appliedFilters}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Current Level"
                  field="currentLevel"
                  filters={appliedFilters}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Status"
                  field="businessStatus"
                  filters={appliedFilters}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Overdue Status"
                  field="overdueStatus"
                  filters={appliedFilters}
                  onSort={handleSort}
                />
                <SortableHeader
                  label="Final Resolution Date"
                  field="completedAt"
                  filters={appliedFilters}
                  onSort={handleSort}
                />
                <th>Department Head Remark</th>
                <th>Site Head Remark</th>
                <th>Main Admin Remark</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="17" className="text-center py-4">
                    Loading complaint report...
                  </td>
                </tr>
              ) : reportData.rows.length === 0 ? (
                <tr>
                  <td colSpan="17" className="text-center py-4 text-muted">
                    No complaint records found for the selected filters.
                  </td>
                </tr>
              ) : (
                reportData.rows.map((row, index) => {
                  const processState = getComplaintProcessState(row, clockNow);
                  const rowIsOverdue = row.isOverdue || processState.isOverdue;
                  const processExpanded = expandedProcessId === row._id;

                  return (
                    <Fragment key={row._id}>
                      <tr
                        className={`${rowIsOverdue ? "table-danger" : ""} ${
                          row._id === selectedComplaintId ? "complaint-report-table__row--active" : ""
                        }`}
                      >
                        <td>{index + 1}</td>
                        <td className="fw-semibold">{row.complaintCode}</td>
                        <td>
                          <div className="fw-semibold">{row.employeeLabel || row.employeeName}</div>
                        </td>
                        <td>{row.companyName || "-"}</td>
                        <td>{row.siteDisplayName || "-"}</td>
                        <td>{row.departmentName || "-"}</td>
                        <td className="complaint-report-table__description">{row.complaintText || "-"}</td>
                        <td>{row.raisedAtLabel || "-"}</td>
                        <td>{row.currentLevelLabel || "-"}</td>
                        <td>
                          <div className="fw-semibold">{row.businessStatusLabel || "-"}</div>
                          <div className="small text-muted">{row.workflowStatusLabel || "-"}</div>
                        </td>
                        <td>
                          <div className={rowIsOverdue ? "text-danger fw-semibold" : ""}>
                            {row.overdueStatusLabel || (processState.isOverdue ? "Overdue After 22 Hours" : "-")}
                          </div>
                          <div className={`small ${rowIsOverdue ? "text-danger" : "text-muted"}`}>
                            {row.slaClockLabel || processState.helperLabel || "-"}
                          </div>
                        </td>
                        <td>{row.completedAtLabel || "-"}</td>
                        <td>{row.departmentHeadRemark || "-"}</td>
                        <td>{row.siteHeadRemark || "-"}</td>
                        <td>{row.mainAdminRemark || "-"}</td>
                        <td>
                          <div className="complaint-action-stack">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => selectComplaint(row._id)}
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary complaint-process-toggle"
                              onClick={() => toggleProcessRow(row._id)}
                              aria-expanded={processExpanded}
                              aria-label={`${processExpanded ? "Hide" : "Show"} complaint process`}
                              title={`${processExpanded ? "Hide" : "Show"} process`}
                            >
                              <span className="complaint-process-toggle__eye" aria-hidden="true">
                                <span />
                              </span>
                              <span>{processExpanded ? "Hide" : "Process"}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {processExpanded ? (
                        <tr className="complaint-process-row">
                          <td colSpan="17">
                            <ComplaintProcessTracker complaint={row} clockNow={clockNow} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ComplaintDetailPanel
        selectedComplaint={selectedComplaint}
        detailLoading={detailLoading}
        clockNow={clockNow}
        onClear={clearSelectedComplaint}
        actionRemark={actionRemark}
        setActionRemark={setActionRemark}
        onAction={handleAction}
        actionSaving={actionSaving}
        timelineSectionRef={timelineRef}
        timelineHighlighted={timelineHighlighted}
      />
    </div>
  );
}

function ComplaintFilterSelect({ label, value, options, onChange, emptyLabel }) {
  return (
    <>
      <label className="form-label fw-semibold">{label}</label>
      <select className="form-select" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{emptyLabel}</option>
        {(options || []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
}

function SortableHeader({ label, field, filters, onSort }) {
  return (
    <th>
      <button
        type="button"
        className="complaint-sort-button"
        onClick={() => onSort(field)}
      >
        <span>{label}</span>
        <span>{getComplaintSortIndicator(filters, field)}</span>
      </button>
    </th>
  );
}
