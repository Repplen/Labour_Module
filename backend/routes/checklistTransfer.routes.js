const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const {
  createPermanentChecklistTransfer,
  createTemporaryChecklistTransfer,
  getChecklistTransferChecklists,
  getChecklistTransferHistory,
} = require("../controllers/checklistTransfer.controller");

router.get(
  "/checklists",
  auth,
  requirePermission("checklist_transfer", "view"),
  getChecklistTransferChecklists
);

router.get(
  "/history",
  auth,
  requirePermission("checklist_transfer", "view"),
  getChecklistTransferHistory
);

router.post(
  "/permanent",
  auth,
  requirePermission("checklist_transfer", "transfer"),
  createPermanentChecklistTransfer
);

router.post(
  "/temporary",
  auth,
  requirePermission("checklist_transfer", "transfer"),
  createTemporaryChecklistTransfer
);

module.exports = router;
