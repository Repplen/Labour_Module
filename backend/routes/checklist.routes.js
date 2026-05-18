const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requireAnyPermission, requirePermission } = require("../middleware/permissions");
const upload = require("../middleware/checklistUpload");
const excelUpload = require("../middleware/excelUpload");
const { validateRequest } = require("../middleware/validateRequest");
const {
  checklistBulkDeleteSchema,
  checklistCreateSchema,
  checklistDecisionSchema,
  checklistTaskReportQuerySchema,
  checklistUpdateSchema,
  idParamSchema,
} = require("../validators/checklist.validator");
const {
  approveChecklistAdminRequest,
  bulkDeleteChecklists,
  createChecklist,
  createPermanentChecklistTransfer,
  createTemporaryChecklistTransfer,
  decideChecklistTask,
  deleteChecklist,
  deleteGeneratedChecklistTask,
  exportChecklistsExcel,
  getChecklistAdminRequestById,
  getChecklistAdminRequests,
  getApprovalTasks,
  getChecklistById,
  getChecklistRequestNotifications,
  getChecklistSetupData,
  getChecklistTransferChecklists,
  getChecklistTransferHistory,
  getChecklistTaskById,
  getChecklists,
  getGeneratedChecklistTasks,
  getMyChecklistTasks,
  getNextChecklistNumber,
  importChecklistsExcel,
  markAllChecklistRequestNotificationsRead,
  markChecklistRequestNotificationRead,
  rejectChecklistAdminRequest,
  runSchedulerManually,
  submitChecklistTask,
  toggleChecklistStatus,
  updateChecklist,
} = require("../controllers/checklist.controller");
const {
  exportChecklistTaskReportExcel,
  exportChecklistTaskReportPdf,
  getChecklistTaskReport,
  getChecklistTaskReportOptions,
} = require("../controllers/checklistReport.controller");

router.get("/", auth, requirePermission("checklist_master", "view"), getChecklists);
router.get(
  "/setup-data",
  auth,
  requirePermission("checklist_master", "view"),
  getChecklistSetupData
);
router.get(
  "/next-number",
  auth,
  requirePermission("checklist_master", "add"),
  getNextChecklistNumber
);
router.get(
  "/export/excel",
  auth,
  requirePermission("checklist_master", "export"),
  exportChecklistsExcel
);
router.get(
  "/admin-requests/notifications",
  auth,
  requirePermission("checklist_master", "view"),
  getChecklistRequestNotifications
);
router.post(
  "/admin-requests/notifications/read-all",
  auth,
  requirePermission("checklist_master", "view"),
  markAllChecklistRequestNotificationsRead
);
router.post(
  "/admin-requests/notifications/:id/read",
  auth,
  requirePermission("checklist_master", "view"),
  validateRequest({ params: idParamSchema }),
  markChecklistRequestNotificationRead
);
router.get(
  "/admin-requests",
  auth,
  requireAnyPermission([
    { moduleKey: "checklist_master", actionKey: "approve" },
    { moduleKey: "checklist_master", actionKey: "reject" },
  ]),
  getChecklistAdminRequests
);
router.get(
  "/admin-requests/:id",
  auth,
  requireAnyPermission([
    { moduleKey: "checklist_master", actionKey: "approve" },
    { moduleKey: "checklist_master", actionKey: "reject" },
  ]),
  validateRequest({ params: idParamSchema }),
  getChecklistAdminRequestById
);
router.post(
  "/admin-requests/:id/approve",
  auth,
  requirePermission("checklist_master", "approve"),
  validateRequest({ params: idParamSchema }),
  approveChecklistAdminRequest
);
router.post(
  "/admin-requests/:id/reject",
  auth,
  requirePermission("checklist_master", "reject"),
  validateRequest({ params: idParamSchema }),
  rejectChecklistAdminRequest
);
router.get(
  "/transfers/checklists",
  auth,
  requirePermission("checklist_transfer", "view"),
  getChecklistTransferChecklists
);
router.get(
  "/transfers/history",
  auth,
  requirePermission("checklist_transfer", "view"),
  getChecklistTransferHistory
);
router.get(
  "/tasks/report/export/excel",
  auth,
  requireAnyPermission([
    { moduleKey: "reports", actionKey: "view" },
    { moduleKey: "reports", actionKey: "report_view" },
  ]),
  requirePermission("reports", "export"),
  validateRequest({ query: checklistTaskReportQuerySchema }),
  exportChecklistTaskReportExcel
);
router.get(
  "/tasks/report/export/pdf",
  auth,
  requireAnyPermission([
    { moduleKey: "reports", actionKey: "view" },
    { moduleKey: "reports", actionKey: "report_view" },
  ]),
  requirePermission("reports", "export"),
  validateRequest({ query: checklistTaskReportQuerySchema }),
  exportChecklistTaskReportPdf
);
router.get(
  "/tasks/report/options",
  auth,
  requireAnyPermission([
    { moduleKey: "reports", actionKey: "view" },
    { moduleKey: "reports", actionKey: "report_view" },
  ]),
  getChecklistTaskReportOptions
);
router.get(
  "/tasks/report",
  auth,
  requireAnyPermission([
    { moduleKey: "reports", actionKey: "view" },
    { moduleKey: "reports", actionKey: "report_view" },
  ]),
  validateRequest({ query: checklistTaskReportQuerySchema }),
  getChecklistTaskReport
);
router.get(
  "/tasks",
  auth,
  requirePermission("checklist_master", "view"),
  getGeneratedChecklistTasks
);
router.get(
  "/tasks/my",
  auth,
  requirePermission("assigned_checklists", "view"),
  getMyChecklistTasks
);
router.get(
  "/tasks/approvals",
  auth,
  requirePermission("approval_inbox", "view"),
  getApprovalTasks
);
router.get(
  "/tasks/:id",
  auth,
  requireAnyPermission([
    { moduleKey: "assigned_checklists", actionKey: "view" },
    { moduleKey: "approval_inbox", actionKey: "view" },
    { moduleKey: "reports", actionKey: "view" },
    { moduleKey: "reports", actionKey: "report_view" },
    { moduleKey: "checklist_master", actionKey: "view" },
  ]),
  validateRequest({ params: idParamSchema }),
  getChecklistTaskById
);
router.post(
  "/tasks/:id/submit",
  auth,
  requirePermission("assigned_checklists", "edit"),
  upload.array("attachments", 10),
  validateRequest({ params: idParamSchema }),
  submitChecklistTask
);
router.post(
  "/tasks/:id/decision",
  auth,
  requirePermission("approval_inbox", "approve"),
  validateRequest({ params: idParamSchema, body: checklistDecisionSchema }),
  decideChecklistTask
);
router.post(
  "/transfers/permanent",
  auth,
  requirePermission("checklist_transfer", "transfer"),
  createPermanentChecklistTransfer
);
router.post(
  "/transfers/temporary",
  auth,
  requirePermission("checklist_transfer", "transfer"),
  createTemporaryChecklistTransfer
);
router.post(
  "/import/excel",
  auth,
  requirePermission("checklist_master", "add"),
  excelUpload.single("file"),
  importChecklistsExcel
);
router.post(
  "/bulk-delete",
  auth,
  requirePermission("checklist_master", "delete"),
  validateRequest({ body: checklistBulkDeleteSchema }),
  bulkDeleteChecklists
);
router.post(
  "/scheduler/run",
  auth,
  requirePermission("checklist_master", "status_update"),
  runSchedulerManually
);
router.post(
  "/",
  auth,
  requirePermission("checklist_master", "add"),
  validateRequest({ body: checklistCreateSchema }),
  createChecklist
);
router.get(
  "/:id",
  auth,
  requirePermission("checklist_master", "view"),
  validateRequest({ params: idParamSchema }),
  getChecklistById
);
router.put(
  "/:id",
  auth,
  requirePermission("checklist_master", "edit"),
  validateRequest({ params: idParamSchema, body: checklistUpdateSchema }),
  updateChecklist
);
router.patch(
  "/:id/status",
  auth,
  requirePermission("checklist_master", "status_update"),
  validateRequest({ params: idParamSchema }),
  toggleChecklistStatus
);
router.delete(
  "/tasks/:id",
  auth,
  requirePermission("checklist_master", "delete"),
  validateRequest({ params: idParamSchema }),
  deleteGeneratedChecklistTask
);
router.delete(
  "/:id",
  auth,
  requirePermission("checklist_master", "delete"),
  validateRequest({ params: idParamSchema }),
  deleteChecklist
);

module.exports = router;
