const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { moduleEnabled } = require("../middleware/moduleEnabled");
const { requirePermission } = require("../middleware/permissions");
const complaintUpload = require("../middleware/complaintUpload");
const { validateRequest } = require("../middleware/validateRequest");
const {
  complaintActionSchema,
  complaintCreateSchema,
  idParamSchema,
  notificationIdParamSchema,
} = require("../validators/complaint.validator");
const {
  createComplaint,
  exportComplaintsExcel,
  exportComplaintsPdf,
  getComplaintById,
  getComplaintDashboard,
  getComplaintNotifications,
  getComplaintOptions,
  getComplaints,
  markAllComplaintNotificationsRead,
  markComplaintNotificationRead,
  progressComplaint,
} = require("../controllers/complaint.controller");

router.use(moduleEnabled("complaints"));

router.get("/options", auth, requirePermission("complaints", "view"), getComplaintOptions);
router.get("/dashboard", auth, requirePermission("complaints", "view"), getComplaintDashboard);
router.get("/export/excel", auth, requirePermission("complaints", "view"), exportComplaintsExcel);
router.get("/export/pdf", auth, requirePermission("complaints", "view"), exportComplaintsPdf);
router.get(
  "/notifications",
  auth,
  requirePermission("complaints", "view"),
  getComplaintNotifications
);
router.post(
  "/notifications/read-all",
  auth,
  requirePermission("complaints", "view"),
  markAllComplaintNotificationsRead
);
router.post(
  "/notifications/:notificationId/read",
  auth,
  requirePermission("complaints", "view"),
  validateRequest({ params: notificationIdParamSchema }),
  markComplaintNotificationRead
);
router.get("/", auth, requirePermission("complaints", "view"), getComplaints);
router.post(
  "/",
  auth,
  requirePermission("complaints", "add"),
  complaintUpload.single("attachment"),
  validateRequest({ body: complaintCreateSchema }),
  createComplaint
);
router.get(
  "/:id",
  auth,
  requirePermission("complaints", "view"),
  validateRequest({ params: idParamSchema }),
  getComplaintById
);
router.patch(
  "/:id/action",
  auth,
  requirePermission("complaints", "view"),
  validateRequest({ params: idParamSchema, body: complaintActionSchema }),
  progressComplaint
);

module.exports = router;
