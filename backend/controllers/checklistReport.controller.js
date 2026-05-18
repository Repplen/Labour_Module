const {
  buildChecklistTaskReportPdfBuffer,
  buildChecklistTaskReportWorkbook,
  loadChecklistTaskReportOptions,
  loadChecklistTaskReportRows,
} = require("../services/checklistReport.service");
const { hasModulePermission } = require("../services/permissionResolver.service");
const { normalizeText } = require("../helpers/checklistReport.helper");

const canReadChecklistTaskReport = (user) =>
  hasModulePermission(user?.permissions, "reports", "view") ||
  hasModulePermission(user?.permissions, "reports", "report_view");

const canExportChecklistTaskReport = (user) =>
  canReadChecklistTaskReport(user) &&
  hasModulePermission(user?.permissions, "reports", "export");

exports.getChecklistTaskReportOptions = async (req, res) => {
  try {
    if (!canReadChecklistTaskReport(req.user)) {
      return res.status(403).json({ message: "Report view permission is required" });
    }

    const { employees, departments, sites } = await loadChecklistTaskReportOptions(
      req.access || {}
    );

    return res.json({
      employees,
      departments,
      sites,
      currentPrincipalEmployeeId:
        req.user?.principalType === "employee" ? normalizeText(req.user?.id) : "",
      scopeStrategy: normalizeText(req.access?.scope?.strategy).toLowerCase(),
    });
  } catch (err) {
    console.error("GET CHECKLIST TASK REPORT OPTIONS ERROR:", err);
    return res.status(500).json({ message: "Failed to load checklist task report filters" });
  }
};

exports.getChecklistTaskReport = async (req, res) => {
  try {
    if (!canReadChecklistTaskReport(req.user)) {
      return res.status(403).json({ message: "Report view permission is required" });
    }

    const reportResult = await loadChecklistTaskReportRows(req.query, req.access || {});

    if (reportResult?.error) {
      return res
        .status(reportResult.status || 400)
        .json({ message: reportResult.error });
    }

    return res.json(reportResult.tasks || []);
  } catch (err) {
    console.error("GET CHECKLIST TASK REPORT ERROR:", err);
    return res.status(500).json({ message: "Failed to load checklist task report" });
  }
};

exports.exportChecklistTaskReportExcel = async (req, res) => {
  try {
    if (!canExportChecklistTaskReport(req.user)) {
      return res.status(403).json({ message: "Report export permission is required" });
    }

    const reportResult = await loadChecklistTaskReportRows(req.query, req.access || {});

    if (reportResult?.error) {
      return res
        .status(reportResult.status || 400)
        .json({ message: reportResult.error });
    }

    const workbook = buildChecklistTaskReportWorkbook(reportResult.tasks || []);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="checklist-task-report.xlsx"'
    );

    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    console.error("EXPORT CHECKLIST TASK REPORT EXCEL ERROR:", err);
    return res
      .status(500)
      .json({ message: "Failed to export checklist task report in Excel format" });
  }
};

exports.exportChecklistTaskReportPdf = async (req, res) => {
  try {
    if (!canExportChecklistTaskReport(req.user)) {
      return res.status(403).json({ message: "Report export permission is required" });
    }

    const reportResult = await loadChecklistTaskReportRows(req.query, req.access || {});

    if (reportResult?.error) {
      return res
        .status(reportResult.status || 400)
        .json({ message: reportResult.error });
    }

    const pdfBuffer = buildChecklistTaskReportPdfBuffer(
      reportResult.tasks || [],
      req.query
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="checklist-task-report.pdf"'
    );

    return res.send(pdfBuffer);
  } catch (err) {
    console.error("EXPORT CHECKLIST TASK REPORT PDF ERROR:", err);
    return res
      .status(500)
      .json({ message: "Failed to export checklist task report in PDF format" });
  }
};
