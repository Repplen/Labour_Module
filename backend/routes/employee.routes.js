const express = require("express");
const controller = require("../controllers/employee.controller");
const upload = require("../middleware/upload");
const { auth } = require("../middleware/auth");
const { moduleAnyEnabled, moduleEnabled } = require("../middleware/moduleEnabled");
const { requireAnyPermission, requirePermission } = require("../middleware/permissions");
const { validateRequest } = require("../middleware/validateRequest");
const {
  employeeBulkDeleteSchema,
  employeeCreateSchema,
  employeeUpdateSchema,
  idParamSchema,
} = require("../validators/employee.validator");

const router = express.Router();

router.get(
  "/",
  moduleEnabled("employee_master"),
  auth,
  requirePermission("employee_master", "view"),
  controller.getEmployees
);
router.get(
  "/export/excel",
  moduleEnabled("employee_master"),
  auth,
  requirePermission("employee_master", "export"),
  controller.exportEmployeesExcel
);
router.get("/qr/:qrToken", controller.getEmployeeByQrToken);
router.post(
  "/:id/qr",
  moduleEnabled("employee_master"),
  auth,
  requirePermission("employee_master", "view"),
  validateRequest({ params: idParamSchema }),
  controller.getOrCreateEmployeeQr
);
router.patch(
  "/:id/qr/access",
  moduleEnabled("employee_master"),
  auth,
  requirePermission("employee_master", "edit"),
  validateRequest({ params: idParamSchema }),
  controller.updateEmployeeQrAccess
);
router.get(
  "/:id",
  moduleAnyEnabled(["employee_master", "own_profile"]),
  auth,
  requireAnyPermission([
    { moduleKey: "employee_master", actionKey: "view" },
    { moduleKey: "own_profile", actionKey: "view" },
  ]),
  validateRequest({ params: idParamSchema }),
  controller.getEmployeeById
);
router.post(
  "/",
  moduleEnabled("employee_master"),
  auth,
  requirePermission("employee_master", "add"),
  upload.single("photo"),
  validateRequest({ body: employeeCreateSchema }),
  controller.createEmployee
);
router.put(
  "/:id",
  moduleAnyEnabled(["employee_master", "own_profile"]),
  auth,
  requirePermission("employee_master", "edit"),
  upload.single("photo"),
  validateRequest({ params: idParamSchema, body: employeeUpdateSchema }),
  controller.updateEmployee
);
router.post(
  "/bulk-delete",
  moduleEnabled("employee_master"),
  auth,
  requirePermission("employee_master", "delete"),
  validateRequest({ body: employeeBulkDeleteSchema }),
  controller.bulkDeleteEmployees
);
router.delete(
  "/:id",
  moduleEnabled("employee_master"),
  auth,
  requirePermission("employee_master", "delete"),
  validateRequest({ params: idParamSchema }),
  controller.deleteEmployee
);
router.patch(
  "/:id/status",
  moduleEnabled("employee_master"),
  auth,
  requirePermission("employee_master", "status_update"),
  validateRequest({ params: idParamSchema }),
  controller.toggleEmployeeStatus
);

module.exports = router;
