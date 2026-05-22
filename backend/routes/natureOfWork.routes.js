const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
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

router.get("/", auth, requirePermission("nature_of_work", "view"), listNatureOfWorkController);
router.get("/tree", auth, requirePermission("nature_of_work", "view"), listNatureOfWorkTreeController);
router.get("/active", auth, requirePermission("nature_of_work", "view"), listActiveNatureOfWorkController);
router.get("/:id", auth, requirePermission("nature_of_work", "view"), getNatureOfWorkController);
router.post("/", auth, requirePermission("nature_of_work", "add"), validateCreateNatureOfWorkRequestMiddleware, createNatureOfWorkController);
router.post("/:id/children", auth, requirePermission("nature_of_work", "add"), validateCreateNatureOfWorkRequestMiddleware, createChildNatureOfWorkController);
router.put("/:id", auth, requirePermission("nature_of_work", "edit"), validateUpdateNatureOfWorkRequestMiddleware, updateNatureOfWorkController);
router.delete("/:id", auth, requirePermission("nature_of_work", "delete"), deleteNatureOfWorkController);
router.patch("/:id/status", auth, requirePermission("nature_of_work", "status_update"), validateStatusNatureOfWorkRequestMiddleware, updateNatureOfWorkStatusController);

module.exports = router;
