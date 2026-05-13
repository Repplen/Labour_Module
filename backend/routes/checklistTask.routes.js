const router = require("express").Router();
const { getYourChecklist } = require("../controllers/checklistTask.controller");
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

router.get(
  "/your-checklist",
  auth,
  requirePermission("assigned_checklists", "view"),
  getYourChecklist
);

module.exports = router;
