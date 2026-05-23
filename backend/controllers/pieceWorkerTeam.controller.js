const {
  createPieceWorkerTeamService,
  deletePieceWorkerTeamService,
  getPieceWorkerTeamService,
  listActivePieceWorkerTeamsService,
  listPieceWorkerTeamsService,
  updatePieceWorkerTeamService,
  updatePieceWorkerTeamStatusService,
} = require("../services/pieceWorkerTeam.service");
const { getAuditUserId } = require("../helpers/teamMaster.helper");

const sendErrorResponse = (res, err, fallbackMessage) =>
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || fallbackMessage,
    errors: err.errors || [],
  });

const listPieceWorkerTeamsController = async (req, res) => {
  try {
    return res.json(await listPieceWorkerTeamsService(req.query));
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load piece worker teams");
  }
};

const listActivePieceWorkerTeamsController = async (req, res) => {
  try {
    return res.json(await listActivePieceWorkerTeamsService(req.query));
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load active piece worker teams");
  }
};

const getPieceWorkerTeamController = async (req, res) => {
  try {
    const team = await getPieceWorkerTeamService(req.params.id);
    if (!team) return res.status(404).json({ message: "Piece worker team not found." });
    return res.json(team);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load piece worker team");
  }
};

const createPieceWorkerTeamController = async (req, res) => {
  try {
    return res.status(201).json(
      await createPieceWorkerTeamService({
        payload: req.validatedPieceWorkerTeam,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to create piece worker team");
  }
};

const updatePieceWorkerTeamController = async (req, res) => {
  try {
    return res.json(
      await updatePieceWorkerTeamService({
        id: req.params.id,
        payload: req.validatedPieceWorkerTeam,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update piece worker team");
  }
};

const deletePieceWorkerTeamController = async (req, res) => {
  try {
    return res.json(
      await deletePieceWorkerTeamService({
        id: req.params.id,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to delete piece worker team");
  }
};

const updatePieceWorkerTeamStatusController = async (req, res) => {
  try {
    return res.json(
      await updatePieceWorkerTeamStatusService({
        id: req.params.id,
        ...req.validatedPieceWorkerTeamStatus,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update piece worker team status");
  }
};

module.exports = {
  createPieceWorkerTeamController,
  deletePieceWorkerTeamController,
  getPieceWorkerTeamController,
  listActivePieceWorkerTeamsController,
  listPieceWorkerTeamsController,
  updatePieceWorkerTeamController,
  updatePieceWorkerTeamStatusController,
};
