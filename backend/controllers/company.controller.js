const {
  createCompanyService,
  deleteCompanyService,
  listCompaniesService,
  updateCompanyService,
} = require("../services/company.service");

const sendDuplicateCompanyResponse = (res) =>
  res.status(409).json({
    success: false,
    message: "Duplicate company data found",
    errors: [
      {
        field: "name",
        message: "This company name already exists.",
      },
    ],
  });

const sendErrorResponse = (res, err, fallbackMessage) => {
  if (err?.field && err?.errors) {
    return res.status(err.statusCode || 400).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  if (err?.errors) {
    return res.status(err.statusCode || 400).json({
      success: err.success,
      message: err.message,
      errors: err.errors,
    });
  }

  if (err?.statusCode) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  if (err?.code === 11000) {
    return sendDuplicateCompanyResponse(res);
  }

  return res.status(500).json({ message: fallbackMessage });
};

const listCompaniesController = async (req, res) => {
  try {
    const rows = await listCompaniesService(req.access || {});
    return res.json(rows);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load companies");
  }
};

const createCompanyController = async (req, res) => {
  try {
    const data = await createCompanyService(req.body, req.validatedCompany);
    return res.status(201).json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to create company");
  }
};

const updateCompanyController = async (req, res) => {
  try {
    const data = await updateCompanyService(
      req.params.id,
      req.body,
      req.validatedCompany
    );
    return res.json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update company");
  }
};

const deleteCompanyController = async (req, res) => {
  try {
    const data = await deleteCompanyService(req.params.id);
    return res.json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to delete company");
  }
};

module.exports = {
  createCompanyController,
  deleteCompanyController,
  listCompaniesController,
  updateCompanyController,
};
