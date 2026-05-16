const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const {
  createSiteController,
  createSubSiteController,
  deleteSiteController,
  deleteSubSiteController,
  listSitesController,
  listSubSitesController,
  updateSiteController,
  updateSubSiteController,
} = require("../controllers/site.controller");
const {
  validateCreateSiteRequestMiddleware,
  validateCreateSubSiteRequestMiddleware,
  validateUpdateSiteRequestMiddleware,
  validateUpdateSubSiteRequestMiddleware,
} = require("../validators/site.validator");

router.get(
  "/",
  auth,
  requirePermission("site_master", "view"),
  listSitesController
);

router.post(
  "/",
  auth,
  requirePermission("site_master", "add"),
  validateCreateSiteRequestMiddleware,
  createSiteController
);

router.put(
  "/:id",
  auth,
  requirePermission("site_master", "edit"),
  validateUpdateSiteRequestMiddleware,
  updateSiteController
);

router.get(
  "/:id/sub-sites",
  auth,
  requirePermission("site_master", "view"),
  listSubSitesController
);

router.post(
  "/:id/sub-sites",
  auth,
  requirePermission("site_master", "add"),
  validateCreateSubSiteRequestMiddleware,
  createSubSiteController
);

router.put(
  "/:id/sub-sites/:subId",
  auth,
  requirePermission("site_master", "edit"),
  validateUpdateSubSiteRequestMiddleware,
  updateSubSiteController
);

router.delete(
  "/:id/sub-sites/:subId",
  auth,
  requirePermission("site_master", "delete"),
  deleteSubSiteController
);

router.delete(
  "/:id",
  auth,
  requirePermission("site_master", "delete"),
  deleteSiteController
);

module.exports = router;
