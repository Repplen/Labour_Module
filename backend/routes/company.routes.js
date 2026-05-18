const router = require("express").Router();
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const {
  createCompanyController,
  deleteCompanyController,
  listCompaniesController,
  updateCompanyController,
} = require("../controllers/company.controller");
const { validateCompanyRequestMiddleware } = require("../validators/company.validator");

router.get(
  "/",
  auth,
  requirePermission("company_master", "view"),
  listCompaniesController
);

router.post(
  "/",
  auth,
  requirePermission("company_master", "add"),
  validateCompanyRequestMiddleware,
  createCompanyController
);

router.put(
  "/:id",
  auth,
  requirePermission("company_master", "edit"),
  validateCompanyRequestMiddleware,
  updateCompanyController
);

router.delete(
  "/:id",
  auth,
  requirePermission("company_master", "delete"),
  deleteCompanyController
);

module.exports = router;
