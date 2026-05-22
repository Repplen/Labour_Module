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
  { moduleKey: "material_master", actionKey: "view" },
  { moduleKey: "material_master", actionKey: "add" },
  { moduleKey: "material_master", actionKey: "edit" },
]);

router.get("/", auth, canReadUom, listUomsController);
router.get("/active", auth, canReadUom, listUomsController);
router.get("/defaults", auth, canReadUom, listDefaultUomsController);
router.post("/seed-defaults", auth, requirePermission("uom", "add"), seedDefaultUomsController);
router.post("/", auth, requirePermission("uom", "add"), validateCreateUomRequestMiddleware, createUomController);
router.patch("/:id/status", auth, requirePermission("uom", "status_update"), validateStatusUomRequestMiddleware, updateUomStatusController);

module.exports = router;
