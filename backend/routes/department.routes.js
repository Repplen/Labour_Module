const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const {
  createDepartmentController,
  createSubDepartmentController,
  deleteDepartmentController,
  deleteSubDepartmentController,
  listDepartmentsController,
  listSubDepartmentsController,
  updateDepartmentController,
  updateSubDepartmentController,
} = require("../controllers/department.controller");
const {
  validateCreateSubDepartmentRequestMiddleware,
  validateDepartmentRequestMiddleware,
  validateUpdateSubDepartmentRequestMiddleware,
} = require("../validators/department.validator");

router.get(
  "/",
  auth,
  requirePermission("department_master", "view"),
  listDepartmentsController
);

router.post(
  "/",
  auth,
  requirePermission("department_master", "add"),
  validateDepartmentRequestMiddleware,
  createDepartmentController
);

router.put(
  "/:id",
  auth,
  requirePermission("department_master", "edit"),
  validateDepartmentRequestMiddleware,
  updateDepartmentController
);

router.delete(
  "/:id",
  auth,
  requirePermission("department_master", "delete"),
  deleteDepartmentController
);

router.get(
  "/:id/sub-departments",
  auth,
  requirePermission("sub_department_master", "view"),
  listSubDepartmentsController
);

router.post(
  "/:id/sub-departments",
  auth,
  requirePermission("sub_department_master", "add"),
  validateCreateSubDepartmentRequestMiddleware,
  createSubDepartmentController
);

router.put(
  "/:id/sub-departments/:subId",
  auth,
  requirePermission("sub_department_master", "edit"),
  validateUpdateSubDepartmentRequestMiddleware,
  updateSubDepartmentController
);

router.delete(
  "/:id/sub-departments/:subId",
  auth,
  requirePermission("sub_department_master", "delete"),
  deleteSubDepartmentController
);

module.exports = router;
