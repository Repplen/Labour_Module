const {
  createEquipmentService,
  deleteEquipmentService,
  getEquipmentService,
  listActiveEquipmentService,
  listEquipmentService,
  updateEquipmentService,
  updateEquipmentStatusService,
} = require("../services/equipment.service");
const { getAuditUserId } = require("../helpers/equipment.helper");

const sendErrorResponse = (res, err, fallbackMessage) =>
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || fallbackMessage,
    errors: err.errors || [],
  });

const listEquipmentController = async (req, res) => {
  try {
    return res.json(await listEquipmentService(req.query));
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load equipment");
  }
};

const listActiveEquipmentController = async (req, res) => {
  try {
    return res.json(await listActiveEquipmentService(req.query));
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load active equipment");
  }
};

const getEquipmentController = async (req, res) => {
  try {
    const row = await getEquipmentService(req.params.id);
    if (!row) return res.status(404).json({ message: "Equipment not found." });
    return res.json(row);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load equipment");
  }
};

const createEquipmentController = async (req, res) => {
  try {
    const row = await createEquipmentService({
      payload: req.validatedEquipment,
      userId: getAuditUserId(req),
    });
    return res.status(201).json(row);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to create equipment");
  }
};

const updateEquipmentController = async (req, res) => {
  try {
    return res.json(
      await updateEquipmentService({
        id: req.params.id,
        payload: req.validatedEquipment,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update equipment");
  }
};

const deleteEquipmentController = async (req, res) => {
  try {
    return res.json(
      await deleteEquipmentService({
        id: req.params.id,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to delete equipment");
  }
};

const updateEquipmentStatusController = async (req, res) => {
  try {
    return res.json(
      await updateEquipmentStatusService({
        id: req.params.id,
        ...req.validatedEquipmentStatus,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update equipment status");
  }
};

module.exports = {
  createEquipmentController,
  deleteEquipmentController,
  getEquipmentController,
  listActiveEquipmentController,
  listEquipmentController,
  updateEquipmentController,
  updateEquipmentStatusController,
};
