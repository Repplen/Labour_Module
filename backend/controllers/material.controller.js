const {
  createMaterialService,
  deleteMaterialService,
  getMaterialService,
  listActiveMaterialsService,
  listMaterialsService,
  updateMaterialService,
  updateMaterialStatusService,
} = require("../services/material.service");
const { getAuditUserId } = require("../helpers/material.helper");

const sendErrorResponse = (res, err, fallbackMessage) =>
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || fallbackMessage,
    errors: err.errors || [],
  });

const listMaterialsController = async (req, res) => {
  try {
    return res.json(await listMaterialsService(req.query));
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load materials");
  }
};

const listActiveMaterialsController = async (req, res) => {
  try {
    return res.json(await listActiveMaterialsService(req.query));
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load active materials");
  }
};

const getMaterialController = async (req, res) => {
  try {
    const row = await getMaterialService(req.params.id);
    if (!row) return res.status(404).json({ message: "Material not found." });
    return res.json(row);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load material");
  }
};

const createMaterialController = async (req, res) => {
  try {
    const row = await createMaterialService({
      payload: req.validatedMaterial,
      userId: getAuditUserId(req),
    });
    return res.status(201).json(row);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to create material");
  }
};

const updateMaterialController = async (req, res) => {
  try {
    return res.json(
      await updateMaterialService({
        id: req.params.id,
        payload: req.validatedMaterial,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update material");
  }
};

const deleteMaterialController = async (req, res) => {
  try {
    return res.json(
      await deleteMaterialService({
        id: req.params.id,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to delete material");
  }
};

const updateMaterialStatusController = async (req, res) => {
  try {
    return res.json(
      await updateMaterialStatusService({
        id: req.params.id,
        ...req.validatedMaterialStatus,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update material status");
  }
};

module.exports = {
  createMaterialController,
  deleteMaterialController,
  getMaterialController,
  listActiveMaterialsController,
  listMaterialsController,
  updateMaterialController,
  updateMaterialStatusController,
};
