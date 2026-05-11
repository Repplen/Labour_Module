const router = require("express").Router();
const controller = require("../controllers/dashboard.controller");
const { auth } = require("../middleware/auth");
const { requireAnyPermission, requirePermission } = require("../middleware/permissions");

const requireDashboardAnalyticsAccess = requireAnyPermission([
  { moduleKey: "dashboard_analytics", actionKey: "view" },
  { moduleKey: "dashboard_analytics", actionKey: "report_view" },
]);

if (typeof controller.getWelcomeSummary === "function") {
  router.get("/welcome-summary", auth, controller.getWelcomeSummary);
}

if (typeof controller.getEmployeeMarkDrilldown === "function") {
  router.get(
    "/employee-marks/drilldown",
    auth,
    requireDashboardAnalyticsAccess,
    controller.getEmployeeMarkDrilldown
  );
}

if (typeof controller.getCompanySiteEmployeeMarkDrilldown === "function") {
  router.get(
    "/company-site-marks/drilldown",
    auth,
    requireDashboardAnalyticsAccess,
    controller.getCompanySiteEmployeeMarkDrilldown
  );
}

if (typeof controller.getDashboardHierarchicalMarkSummary === "function") {
  router.get(
    "/hierarchical-marks/summary",
    auth,
    requireDashboardAnalyticsAccess,
    controller.getDashboardHierarchicalMarkSummary
  );
}

router.get("/", auth, requirePermission("dashboard", "view"), controller.getDashboardStats);

module.exports = router;
