const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const upload = require("../middleware/upload");
const {
  completePersonalTask,
  createPersonalTask,
  getShareableEmployees,
  getMyPersonalTaskNotifications,
  getMyPersonalTasks,
  getPersonalTaskById,
  markPersonalTaskNotificationRead,
  sharePersonalTask,
} = require("../controllers/personalTask.controller");

router.get("/", auth, requirePermission("own_task", "view"), getMyPersonalTasks);
router.get("/notifications", auth, requirePermission("own_task", "view"), getMyPersonalTaskNotifications);
router.get("/shareable-employees", auth, requirePermission("own_task", "view"), getShareableEmployees);
router.get("/:id", auth, requirePermission("own_task", "view"), getPersonalTaskById);
router.post("/", auth, requirePermission("own_task", "add"), upload.single("attachment"), createPersonalTask);
router.post("/:id/share", auth, requirePermission("own_task", "transfer"), sharePersonalTask);
router.post("/:id/read", auth, requirePermission("own_task", "view"), markPersonalTaskNotificationRead);
router.patch("/:id/complete", auth, requirePermission("own_task", "edit"), completePersonalTask);

module.exports = router;
