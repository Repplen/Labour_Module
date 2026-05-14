const router = require("express").Router();
const controller = require("../controllers/attendance.controller");
const { auth } = require("../middleware/auth");
const { moduleEnabled } = require("../middleware/moduleEnabled");
const { requireAnyPermission, requirePermission } = require("../middleware/permissions");
const { validateRequest } = require("../middleware/validateRequest");
const {
  attendanceRecordCreateSchema,
  attendanceRecordUpdateSchema,
  attendanceSelfActionSchema,
  attendanceSettingsSchema,
  idParamSchema,
  regularizationCreateSchema,
  regularizationDecisionSchema,
} = require("../validators/attendance.validator");

router.use(moduleEnabled("attendance"));

router.get(
  "/options",
  auth,
  requireAnyPermission([
    { moduleKey: "employee_attendance", actionKey: "view" },
    { moduleKey: "attendance_reports", actionKey: "report_view" },
    { moduleKey: "attendance_regularization", actionKey: "view" },
  ]),
  controller.getAttendanceOptions
);

router.get(
  "/dashboard",
  auth,
  requirePermission("employee_attendance", "view"),
  controller.getAttendanceDashboard
);

router.get(
  "/records",
  auth,
  requirePermission("employee_attendance", "view"),
  controller.getAttendanceRecords
);

router.post(
  "/records",
  auth,
  requirePermission("employee_attendance", "add"),
  validateRequest({ body: attendanceRecordCreateSchema }),
  controller.createOrUpdateAttendanceRecord
);

router.put(
  "/records/:id",
  auth,
  requirePermission("employee_attendance", "edit"),
  validateRequest({ params: idParamSchema, body: attendanceRecordUpdateSchema }),
  controller.updateAttendanceRecord
);

router.get(
  "/self",
  auth,
  requirePermission("employee_attendance", "view"),
  controller.getSelfAttendance
);

router.post(
  "/self/check-in",
  auth,
  requirePermission("employee_attendance", "add"),
  validateRequest({ body: attendanceSelfActionSchema }),
  controller.selfCheckIn
);

router.post(
  "/self/check-out",
  auth,
  requirePermission("employee_attendance", "edit"),
  validateRequest({ body: attendanceSelfActionSchema }),
  controller.selfCheckOut
);

router.get(
  "/settings",
  auth,
  requirePermission("attendance_settings", "view"),
  controller.getAttendanceSettings
);

router.put(
  "/settings",
  auth,
  requirePermission("attendance_settings", "edit"),
  validateRequest({ body: attendanceSettingsSchema }),
  controller.updateAttendanceSettings
);

router.get(
  "/reports/monthly/export/excel",
  auth,
  requirePermission("attendance_reports", "export"),
  controller.exportMonthlyAttendanceReportExcel
);

router.get(
  "/reports/monthly",
  auth,
  requirePermission("attendance_reports", "report_view"),
  controller.getMonthlyAttendanceReport
);

router.get(
  "/regularization",
  auth,
  requirePermission("attendance_regularization", "view"),
  controller.getRegularizationRequests
);

router.post(
  "/regularization",
  auth,
  requirePermission("attendance_regularization", "add"),
  validateRequest({ body: regularizationCreateSchema }),
  controller.createRegularizationRequest
);

router.patch(
  "/regularization/:id/approve",
  auth,
  requirePermission("attendance_regularization", "approve"),
  validateRequest({ params: idParamSchema, body: regularizationDecisionSchema }),
  controller.approveRegularizationRequest
);

router.patch(
  "/regularization/:id/reject",
  auth,
  requirePermission("attendance_regularization", "reject"),
  validateRequest({ params: idParamSchema, body: regularizationDecisionSchema }),
  controller.rejectRegularizationRequest
);

module.exports = router;
