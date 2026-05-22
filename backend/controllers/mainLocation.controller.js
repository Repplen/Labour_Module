const {
  createMainLocationService,
  deleteMainLocationService,
  getMainLocationService,
  getMainLocationTreeBySiteService,
  listMainLocationTreeService,
  listMainLocationsService,
  updateMainLocationService,
  updateMainLocationStatusService,
} = require("../services/mainLocation.service");
const { getAuditUserId } = require("../helpers/mainLocation.helper");

const sendErrorResponse = (res, err, fallbackMessage) =>
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || fallbackMessage,
    errors: err.errors || [],
  });

const listMainLocationsController = async (req, res) => {
  try {
    const data = await listMainLocationsService(req.query);
    return res.json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load main locations");
  }
};

const listMainLocationTreeController = async (req, res) => {
  try {
    const data = await listMainLocationTreeService(req.query);
    return res.json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load main location tree");
  }
};

const getMainLocationTreeBySiteController = async (req, res) => {
  try {
    const data = await getMainLocationTreeBySiteService(req.params.siteId, req.query);
    return res.json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load site locations");
  }
};

const getMainLocationController = async (req, res) => {
  try {
    const data = await getMainLocationService(req.params.id);
    if (!data) return res.status(404).json({ message: "Location not found." });
    return res.json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load main location");
  }
};

const createMainLocationController = async (req, res) => {
  try {
    const data = await createMainLocationService({
      payload: req.validatedMainLocation,
      userId: getAuditUserId(req),
    });
    return res.status(201).json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to create main location");
  }
};

const createChildMainLocationController = async (req, res) => {
  try {
    const data = await createMainLocationService({
      payload: req.validatedMainLocation,
      parentId: req.params.id,
      userId: getAuditUserId(req),
    });
    return res.status(201).json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to create child location");
  }
};

const updateMainLocationController = async (req, res) => {
  try {
    const data = await updateMainLocationService({
      id: req.params.id,
      payload: req.validatedMainLocation,
      userId: getAuditUserId(req),
    });
    return res.json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update main location");
  }
};

const deleteMainLocationController = async (req, res) => {
  try {
    const cascadeChildren =
      String(req.query.cascadeChildren || "").trim().toLowerCase() === "true";
    const data = await deleteMainLocationService({
      id: req.params.id,
      cascadeChildren,
      userId: getAuditUserId(req),
    });
    return res.json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to delete main location");
  }
};

const updateMainLocationStatusController = async (req, res) => {
  try {
    const data = await updateMainLocationStatusService({
      id: req.params.id,
      ...req.validatedMainLocationStatus,
      userId: getAuditUserId(req),
    });
    return res.json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update main location status");
  }
};

module.exports = {
  createChildMainLocationController,
  createMainLocationController,
  deleteMainLocationController,
  getMainLocationController,
  getMainLocationTreeBySiteController,
  listMainLocationTreeController,
  listMainLocationsController,
  updateMainLocationController,
  updateMainLocationStatusController,
};
