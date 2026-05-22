const {
  createNatureOfWorkService,
  deleteNatureOfWorkService,
  getNatureOfWorkService,
  listActiveNatureOfWorkService,
  listNatureOfWorkService,
  listNatureOfWorkTreeService,
  updateNatureOfWorkService,
  updateNatureOfWorkStatusService,
} = require("../services/natureOfWork.service");
const { getAuditUserId } = require("../helpers/natureOfWork.helper");

const sendErrorResponse = (res, err, fallbackMessage) =>
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || fallbackMessage,
    errors: err.errors || [],
  });

const listNatureOfWorkController = async (req, res) => {
  try {
    return res.json(await listNatureOfWorkService(req.query));
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load nature of work");
  }
};

const listNatureOfWorkTreeController = async (req, res) => {
  try {
    return res.json(await listNatureOfWorkTreeService(req.query));
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load nature of work tree");
  }
};

const listActiveNatureOfWorkController = async (_req, res) => {
  try {
    return res.json(await listActiveNatureOfWorkService());
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load active nature of work");
  }
};

const getNatureOfWorkController = async (req, res) => {
  try {
    const row = await getNatureOfWorkService(req.params.id);
    if (!row) return res.status(404).json({ message: "Work not found." });
    return res.json(row);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load nature of work");
  }
};

const createNatureOfWorkController = async (req, res) => {
  try {
    const row = await createNatureOfWorkService({
      payload: req.validatedNatureOfWork,
      userId: getAuditUserId(req),
    });
    return res.status(201).json(row);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to create nature of work");
  }
};

const createChildNatureOfWorkController = async (req, res) => {
  try {
    const row = await createNatureOfWorkService({
      payload: req.validatedNatureOfWork,
      parentId: req.params.id,
      userId: getAuditUserId(req),
    });
    return res.status(201).json(row);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to create child work");
  }
};

const updateNatureOfWorkController = async (req, res) => {
  try {
    return res.json(
      await updateNatureOfWorkService({
        id: req.params.id,
        payload: req.validatedNatureOfWork,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update nature of work");
  }
};

const deleteNatureOfWorkController = async (req, res) => {
  try {
    const cascadeChildren = String(req.query.cascadeChildren || "").trim().toLowerCase() === "true";
    return res.json(
      await deleteNatureOfWorkService({
        id: req.params.id,
        cascadeChildren,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to delete nature of work");
  }
};

const updateNatureOfWorkStatusController = async (req, res) => {
  try {
    return res.json(
      await updateNatureOfWorkStatusService({
        id: req.params.id,
        ...req.validatedNatureOfWorkStatus,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update nature of work status");
  }
};

module.exports = {
  createChildNatureOfWorkController,
  createNatureOfWorkController,
  deleteNatureOfWorkController,
  getNatureOfWorkController,
  listActiveNatureOfWorkController,
  listNatureOfWorkController,
  listNatureOfWorkTreeController,
  updateNatureOfWorkController,
  updateNatureOfWorkStatusController,
};
