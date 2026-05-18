const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { validateRequest } = require("../middleware/validateRequest");
const {
  createDesignationController,
  deleteDesignationController,
  listDesignationsController,
  updateDesignationController,
} = require("../controllers/designation.controller");
const {
  designationBodySchema,
  idParamSchema,
} = require("../validators/designation.validator");

router.get(
  "/",
  auth,
  requirePermission("designation_master", "view"),
  listDesignationsController
);

router.post(
  "/",
  auth,
  requirePermission("designation_master", "add"),
  validateRequest({ body: designationBodySchema }),
  createDesignationController
);

router.put(
  "/:id",
  auth,
  requirePermission("designation_master", "edit"),
  validateRequest({ body: designationBodySchema, params: idParamSchema }),
  updateDesignationController
);

router.delete(
  "/:id",
  auth,
  requirePermission("designation_master", "delete"),
  validateRequest({ params: idParamSchema }),
  deleteDesignationController
);

module.exports = router;
