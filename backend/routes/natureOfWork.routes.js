const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requireAnyPermission, requirePermission } = require("../middleware/permissions");
const {
  createChildNatureOfWorkController,
  createNatureOfWorkController,
  deleteNatureOfWorkController,
  getNatureOfWorkController,
  listActiveNatureOfWorkController,
  listNatureOfWorkController,
  listNatureOfWorkTreeController,
  updateNatureOfWorkController,
  updateNatureOfWorkStatusController,
} = require("../controllers/natureOfWork.controller");
const {
  validateCreateNatureOfWorkRequestMiddleware,
  validateStatusNatureOfWorkRequestMiddleware,
  validateUpdateNatureOfWorkRequestMiddleware,
} = require("../validators/natureOfWork.validator");

const canReadNatureOfWorkOptions = requireAnyPermission([
  { moduleKey: "nature_of_work", actionKey: "view" },
  { moduleKey: "employee_master", actionKey: "view" },
  { moduleKey: "employee_master", actionKey: "add" },
  { moduleKey: "employee_master", actionKey: "edit" },
  { moduleKey: "labour_piece_worker_master", actionKey: "view" },
  { moduleKey: "labour_piece_worker_master", actionKey: "add" },
  { moduleKey: "labour_piece_worker_master", actionKey: "edit" },
  { moduleKey: "labour_team_master", actionKey: "view" },
  { moduleKey: "labour_team_master", actionKey: "add" },
  { moduleKey: "labour_team_master", actionKey: "edit" },
  { moduleKey: "piece_worker_team_master", actionKey: "view" },
  { moduleKey: "piece_worker_team_master", actionKey: "add" },
  { moduleKey: "piece_worker_team_master", actionKey: "edit" },
]);

router.get("/", auth, requirePermission("nature_of_work", "view"), listNatureOfWorkController);
router.get("/tree", auth, requirePermission("nature_of_work", "view"), listNatureOfWorkTreeController);
router.get("/active", auth, canReadNatureOfWorkOptions, listActiveNatureOfWorkController);
router.get("/:id", auth, requirePermission("nature_of_work", "view"), getNatureOfWorkController);
router.post("/", auth, requirePermission("nature_of_work", "add"), validateCreateNatureOfWorkRequestMiddleware, createNatureOfWorkController);
router.post("/:id/children", auth, requirePermission("nature_of_work", "add"), validateCreateNatureOfWorkRequestMiddleware, createChildNatureOfWorkController);
router.put("/:id", auth, requirePermission("nature_of_work", "edit"), validateUpdateNatureOfWorkRequestMiddleware, updateNatureOfWorkController);
router.delete("/:id", auth, requirePermission("nature_of_work", "delete"), deleteNatureOfWorkController);
router.patch("/:id/status", auth, requirePermission("nature_of_work", "status_update"), validateStatusNatureOfWorkRequestMiddleware, updateNatureOfWorkStatusController);

module.exports = router;
