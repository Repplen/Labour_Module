const {
  createLabourPieceWorkerService,
  deleteLabourPieceWorkerService,
  getLabourPieceWorkerService,
  listActiveLabourPieceWorkersService,
  listLabourPieceWorkersService,
  updateLabourPieceWorkerService,
  updateLabourPieceWorkerStatusService,
} = require("../services/labourPieceWorker.service");
const { getAuditUserId } = require("../helpers/labourPieceWorker.helper");

const sendErrorResponse = (res, err, fallbackMessage) =>
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || fallbackMessage,
    errors: err.errors || [],
  });

const listLabourPieceWorkersController = async (req, res) => {
  try {
    return res.json(await listLabourPieceWorkersService(req.query));
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load labour/piece workers");
  }
};

const listActiveLabourPieceWorkersController = async (req, res) => {
  try {
    return res.json(await listActiveLabourPieceWorkersService(req.query));
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load active labour/piece workers");
  }
};

const getLabourPieceWorkerController = async (req, res) => {
  try {
    const row = await getLabourPieceWorkerService(req.params.id);
    if (!row) return res.status(404).json({ message: "Labour/piece worker not found." });
    return res.json(row);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load labour/piece worker");
  }
};

const createLabourPieceWorkerController = async (req, res) => {
  try {
    const row = await createLabourPieceWorkerService({
      payload: req.validatedLabourPieceWorker,
      userId: getAuditUserId(req),
    });
    return res.status(201).json(row);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to create labour/piece worker");
  }
};

const updateLabourPieceWorkerController = async (req, res) => {
  try {
    return res.json(
      await updateLabourPieceWorkerService({
        id: req.params.id,
        payload: req.validatedLabourPieceWorker,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update labour/piece worker");
  }
};

const deleteLabourPieceWorkerController = async (req, res) => {
  try {
    return res.json(
      await deleteLabourPieceWorkerService({
        id: req.params.id,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to delete labour/piece worker");
  }
};

const updateLabourPieceWorkerStatusController = async (req, res) => {
  try {
    return res.json(
      await updateLabourPieceWorkerStatusService({
        id: req.params.id,
        ...req.validatedLabourPieceWorkerStatus,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update labour/piece worker status");
  }
};

module.exports = {
  createLabourPieceWorkerController,
  deleteLabourPieceWorkerController,
  getLabourPieceWorkerController,
  listActiveLabourPieceWorkersController,
  listLabourPieceWorkersController,
  updateLabourPieceWorkerController,
  updateLabourPieceWorkerStatusController,
};
