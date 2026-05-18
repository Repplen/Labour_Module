import ChecklistReportFilters from "../../components/reports/checklists/ChecklistReportFilters";
import ChecklistReportHeader from "../../components/reports/checklists/ChecklistReportHeader";
import ChecklistReportTable from "../../components/reports/checklists/ChecklistReportTable";
import { usePermissions } from "../../context/usePermissions";
import { useChecklistReport } from "../../hooks/reports/useChecklistReport";

export default function ChecklistReport() {
  const { can, canAny, scope } = usePermissions();
  const canReadReports = canAny([
    { moduleKey: "reports", actionKey: "view" },
    { moduleKey: "reports", actionKey: "report_view" },
  ]);
  const canExportReports = canReadReports && can("reports", "export");
  const report = useChecklistReport(scope);

  return (
    <div className="container-fluid mt-4 mb-5 checklist-report">
      <ChecklistReportHeader
        canExportReports={canExportReports}
        exportingFormat={report.exportingFormat}
        onExport={report.handleExport}
        search={report.search}
        onSearchChange={report.setSearch}
      />
      <ChecklistReportFilters
        filters={report.filters}
        setFilters={report.setFilters}
        onApply={report.applyFilters}
        onReset={report.clearFilters}
        options={report.filterOptions}
      />
      <ChecklistReportTable rows={report.rows} loading={report.loading} />
    </div>
  );
}
