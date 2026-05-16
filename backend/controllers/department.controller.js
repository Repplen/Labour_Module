const {
  createDepartmentService,
  createSubDepartmentService,
  deleteDepartmentService,
  deleteSubDepartmentService,
  listDepartmentsService,
  listSubDepartmentsService,
  updateDepartmentService,
  updateSubDepartmentService,
} = require("../services/department.service");

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

  if (err?.skipped) {
    return res.status(err.statusCode || 400).json({
      message: err.message,
      skipped: err.skipped,
    });
  }

  if (err?.statusCode) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  if (err?.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Duplicate department data found",
      errors: [
        {
          field: "name",
          message: "This department name already exists.",
        },
      ],
    });
  }

  return res.status(500).json({ message: fallbackMessage });
};

const listDepartmentsController = async (req, res) => {
  try {
    const rows = await listDepartmentsService(req.access || {});
    return res.json(rows);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load departments");
  }
};

const createDepartmentController = async (req, res) => {
  try {
    const data = await createDepartmentService(req.body, req.validatedDepartment);
    return res.status(201).json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to create department");
  }
};

const updateDepartmentController = async (req, res) => {
  try {
    const data = await updateDepartmentService(
      req.params.id,
      req.body,
      req.access || {},
      req.validatedDepartment
    );
    return res.json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update department");
  }
};

const deleteDepartmentController = async (req, res) => {
  try {
    const data = await deleteDepartmentService(req.params.id, req.access || {});
    return res.json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to delete department");
  }
};

const listSubDepartmentsController = async (req, res) => {
  try {
    const data = await listSubDepartmentsService(
      req.params.id,
      req.query.parentId || "",
      req.access || {}
    );
    return res.json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load sub departments");
  }
};

const createSubDepartmentController = async (req, res) => {
  try {
    const data = await createSubDepartmentService(
      req.params.id,
      req.body,
      req.access || {},
      req.validatedSubDepartment
    );
    return res.status(201).json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to create sub department");
  }
};

const updateSubDepartmentController = async (req, res) => {
  try {
    const data = await updateSubDepartmentService(
      req.params.id,
      req.params.subId,
      req.body,
      req.access || {},
      req.validatedSubDepartment
    );
    return res.json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update sub department");
  }
};

const deleteSubDepartmentController = async (req, res) => {
  try {
    const data = await deleteSubDepartmentService(
      req.params.id,
      req.params.subId,
      req.access || {}
    );
    return res.json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to delete sub department");
  }
};

module.exports = {
  createDepartmentController,
  createSubDepartmentController,
  deleteDepartmentController,
  deleteSubDepartmentController,
  listDepartmentsController,
  listSubDepartmentsController,
  updateDepartmentController,
  updateSubDepartmentController,
};
