const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const {
  createEquipmentController,
  deleteEquipmentController,
  getEquipmentController,
  listActiveEquipmentController,
  listEquipmentController,
  updateEquipmentController,
  updateEquipmentStatusController,
} = require("../controllers/equipment.controller");
const {
  validateCreateEquipmentRequestMiddleware,
  validateStatusEquipmentRequestMiddleware,
  validateUpdateEquipmentRequestMiddleware,
} = require("../validators/equipment.validator");

router.get("/", auth, requirePermission("equipment_master", "view"), listEquipmentController);
router.get("/active", auth, requirePermission("equipment_master", "view"), listActiveEquipmentController);
router.get("/:id", auth, requirePermission("equipment_master", "view"), getEquipmentController);
router.post("/", auth, requirePermission("equipment_master", "add"), validateCreateEquipmentRequestMiddleware, createEquipmentController);
router.put("/:id", auth, requirePermission("equipment_master", "edit"), validateUpdateEquipmentRequestMiddleware, updateEquipmentController);
router.delete("/:id", auth, requirePermission("equipment_master", "delete"), deleteEquipmentController);
router.patch("/:id/status", auth, requirePermission("equipment_master", "status_update"), validateStatusEquipmentRequestMiddleware, updateEquipmentStatusController);

module.exports = router;
