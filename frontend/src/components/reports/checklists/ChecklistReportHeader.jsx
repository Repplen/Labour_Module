export default function ChecklistReportHeader({
  canExportReports,
  exportingFormat,
  onExport,
  search,
  onSearchChange,
}) {
  return (
    <div className="checklist-report__header mb-3">
      <div className="checklist-report__intro">
        <h3 className="mb-1">Checklist Task Report</h3>
        <div className="text-muted">
          Track generated tasks, submission status, and approval movement across employees.
        </div>
      </div>

      <div className="checklist-report__toolbar">
        {canExportReports ? (
          <div className="checklist-report__toolbar-actions">
            <button
              type="button"
              className="btn btn-outline-success"
              onClick={() => onExport("excel")}
              disabled={exportingFormat === "excel"}
            >
              {exportingFormat === "excel" ? "Downloading Excel..." : "Download Excel"}
            </button>
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={() => onExport("pdf")}
              disabled={exportingFormat === "pdf"}
            >
              {exportingFormat === "pdf" ? "Downloading PDF..." : "Download PDF"}
            </button>
          </div>
        ) : null}

        <div className="checklist-report__search">
          <input
            className="form-control checklist-report__search-input"
            placeholder="Search task number or checklist name"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
