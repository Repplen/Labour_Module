const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { moduleEnabled } = require("../middleware/moduleEnabled");
const pollUpload = require("../middleware/pollUpload");
const { requireAnyPermission, requirePermission } = require("../middleware/permissions");
const { validateRequest } = require("../middleware/validateRequest");
const {
  idParamSchema,
  pollAssignmentIdParamSchema,
  pollCreateSchema,
  pollSubmitSchema,
  pollUpdateSchema,
} = require("../validators/poll.validator");
const {
  createPoll,
  deletePoll,
  getMyAssignedPolls,
  getMyPollByAssignment,
  getMyPollNotifications,
  getPollById,
  getPollReport,
  getPollSetupOptions,
  getPolls,
  markPollNotificationRead,
  previewPollAssignees,
  submitPollResponse,
  togglePollStatus,
  updatePoll,
} = require("../controllers/poll.controller");

router.use(moduleEnabled("polling"));

router.get(
  "/options",
  auth,
  requireAnyPermission([
    { moduleKey: "poll_master", actionKey: "view" },
    { moduleKey: "poll_master", actionKey: "add" },
    { moduleKey: "poll_master", actionKey: "edit" },
  ]),
  getPollSetupOptions
);
router.post(
  "/assignee-preview",
  auth,
  requireAnyPermission([
    { moduleKey: "poll_master", actionKey: "add" },
    { moduleKey: "poll_master", actionKey: "edit" },
  ]),
  previewPollAssignees
);
router.get(
  "/reports/:id",
  auth,
  requirePermission("poll_master", "report_view"),
  validateRequest({ params: idParamSchema }),
  getPollReport
);
router.get(
  "/my/notifications",
  auth,
  requirePermission("assigned_polls", "view"),
  getMyPollNotifications
);
router.post(
  "/my/notifications/:id/read",
  auth,
  requirePermission("assigned_polls", "view"),
  validateRequest({ params: idParamSchema }),
  markPollNotificationRead
);
router.get("/my", auth, requirePermission("assigned_polls", "view"), getMyAssignedPolls);
router.get(
  "/my/:assignmentId",
  auth,
  requirePermission("assigned_polls", "view"),
  validateRequest({ params: pollAssignmentIdParamSchema }),
  getMyPollByAssignment
);
router.post(
  "/my/:assignmentId/submit",
  auth,
  requirePermission("assigned_polls", "edit"),
  pollUpload.array("attachments", 10),
  validateRequest({ params: pollAssignmentIdParamSchema, body: pollSubmitSchema }),
  submitPollResponse
);
router.get("/", auth, requirePermission("poll_master", "view"), getPolls);
router.post(
  "/",
  auth,
  requirePermission("poll_master", "add"),
  validateRequest({ body: pollCreateSchema }),
  createPoll
);
router.get(
  "/:id",
  auth,
  requireAnyPermission([
    { moduleKey: "poll_master", actionKey: "view" },
    { moduleKey: "poll_master", actionKey: "edit" },
  ]),
  validateRequest({ params: idParamSchema }),
  getPollById
);
router.put(
  "/:id",
  auth,
  requirePermission("poll_master", "edit"),
  validateRequest({ params: idParamSchema, body: pollUpdateSchema }),
  updatePoll
);
router.patch(
  "/:id/status",
  auth,
  requirePermission("poll_master", "status_update"),
  validateRequest({ params: idParamSchema }),
  togglePollStatus
);
router.delete(
  "/:id",
  auth,
  requirePermission("poll_master", "delete"),
  validateRequest({ params: idParamSchema }),
  deletePoll
);

module.exports = router;
