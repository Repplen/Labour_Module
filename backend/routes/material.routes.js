const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const {
  createMaterialController,
  deleteMaterialController,
  getMaterialController,
  listActiveMaterialsController,
  listMaterialsController,
  updateMaterialController,
  updateMaterialStatusController,
} = require("../controllers/material.controller");
const {
  validateCreateMaterialRequestMiddleware,
  validateStatusMaterialRequestMiddleware,
  validateUpdateMaterialRequestMiddleware,
} = require("../validators/material.validator");

router.get("/", auth, requirePermission("material_master", "view"), listMaterialsController);
router.get("/active", auth, requirePermission("material_master", "view"), listActiveMaterialsController);
router.get("/:id", auth, requirePermission("material_master", "view"), getMaterialController);
router.post("/", auth, requirePermission("material_master", "add"), validateCreateMaterialRequestMiddleware, createMaterialController);
router.put("/:id", auth, requirePermission("material_master", "edit"), validateUpdateMaterialRequestMiddleware, updateMaterialController);
router.delete("/:id", auth, requirePermission("material_master", "delete"), deleteMaterialController);
router.patch("/:id/status", auth, requirePermission("material_master", "status_update"), validateStatusMaterialRequestMiddleware, updateMaterialStatusController);

module.exports = router;
