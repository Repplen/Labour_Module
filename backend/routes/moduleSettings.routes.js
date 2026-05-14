const express = require("express");
const {
  getEnabledModuleSettings,
  getModuleSettings,
  updateModuleSetting,
} = require("../controllers/moduleSettings.controller");
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");

const router = express.Router();

const requireMainAdmin = (req, res, next) => {
  if (req.user?.roleKey === "main_admin" || req.user?.isDefaultAdmin) {
    return next();
  }

  return res.status(403).json({ message: "Main Admin only access" });
};

router.get("/enabled", getEnabledModuleSettings);
router.get(
  "/",
  auth,
  requireMainAdmin,
  requirePermission("module_settings", "view"),
  getModuleSettings
);
router.patch(
  "/:moduleKey",
  auth,
  requireMainAdmin,
  requirePermission("module_settings", "status_update"),
  updateModuleSetting
);

module.exports = router;
