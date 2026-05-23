const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requireAnyPermission, requirePermission } = require("../middleware/permissions");
const {
  createUomController,
  listDefaultUomsController,
  listUomsController,
  seedDefaultUomsController,
  updateUomStatusController,
} = require("../controllers/uom.controller");
const {
  validateCreateUomRequestMiddleware,
  validateStatusUomRequestMiddleware,
} = require("../validators/uom.validator");

const canReadUom = requireAnyPermission([
  { moduleKey: "uom", actionKey: "view" },
  { moduleKey: "nature_of_work", actionKey: "view" },
  { moduleKey: "nature_of_work", actionKey: "add" },
  { moduleKey: "nature_of_work", actionKey: "edit" },
  { moduleKey: "equipment_master", actionKey: "view" },
  { moduleKey: "equipment_master", actionKey: "add" },
  { moduleKey: "equipment_master", actionKey: "edit" },
  { moduleKey: "employee_master", actionKey: "view" },
  { moduleKey: "employee_master", actionKey: "add" },
  { moduleKey: "employee_master", actionKey: "edit" },
  { moduleKey: "labour_piece_worker_master", actionKey: "view" },
  { moduleKey: "labour_piece_worker_master", actionKey: "add" },
  { moduleKey: "labour_piece_worker_master", actionKey: "edit" },
  { moduleKey: "piece_worker_team_master", actionKey: "view" },
  { moduleKey: "piece_worker_team_master", actionKey: "add" },
  { moduleKey: "piece_worker_team_master", actionKey: "edit" },
]);

router.get("/", auth, canReadUom, listUomsController);
router.get("/active", auth, canReadUom, listUomsController);
router.get("/defaults", auth, canReadUom, listDefaultUomsController);
router.post("/seed-defaults", auth, requirePermission("uom", "add"), seedDefaultUomsController);
router.post("/", auth, requirePermission("uom", "add"), validateCreateUomRequestMiddleware, createUomController);
router.patch("/:id/status", auth, requirePermission("uom", "status_update"), validateStatusUomRequestMiddleware, updateUomStatusController);

module.exports = router;
