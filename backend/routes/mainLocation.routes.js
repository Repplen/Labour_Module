const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const {
  createChildMainLocationController,
  createMainLocationController,
  deleteMainLocationController,
  getMainLocationController,
  getMainLocationTreeBySiteController,
  listMainLocationTreeController,
  listMainLocationsController,
  updateMainLocationController,
  updateMainLocationStatusController,
} = require("../controllers/mainLocation.controller");
const {
  validateCreateMainLocationRequestMiddleware,
  validateStatusMainLocationRequestMiddleware,
  validateUpdateMainLocationRequestMiddleware,
} = require("../validators/mainLocation.validator");

router.get("/", auth, requirePermission("main_location", "view"), listMainLocationsController);

router.get(
  "/tree",
  auth,
  requirePermission("main_location", "view"),
  listMainLocationTreeController
);

router.get(
  "/by-site/:siteId",
  auth,
  requirePermission("main_location", "view"),
  getMainLocationTreeBySiteController
);

router.get("/:id", auth, requirePermission("main_location", "view"), getMainLocationController);

router.post(
  "/",
  auth,
  requirePermission("main_location", "add"),
  validateCreateMainLocationRequestMiddleware,
  createMainLocationController
);

router.post(
  "/:id/children",
  auth,
  requirePermission("main_location", "add"),
  validateCreateMainLocationRequestMiddleware,
  createChildMainLocationController
);

router.put(
  "/:id",
  auth,
  requirePermission("main_location", "edit"),
  validateUpdateMainLocationRequestMiddleware,
  updateMainLocationController
);

router.delete(
  "/:id",
  auth,
  requirePermission("main_location", "delete"),
  deleteMainLocationController
);

router.patch(
  "/:id/status",
  auth,
  requirePermission("main_location", "status_update"),
  validateStatusMainLocationRequestMiddleware,
  updateMainLocationStatusController
);

module.exports = router;
