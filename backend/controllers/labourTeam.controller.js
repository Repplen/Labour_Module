const {
  createLabourTeamService,
  deleteLabourTeamService,
  getLabourTeamService,
  listActiveLabourTeamsService,
  listLabourTeamsService,
  updateLabourTeamService,
  updateLabourTeamStatusService,
} = require("../services/labourTeam.service");
const { getAuditUserId } = require("../helpers/teamMaster.helper");

const sendErrorResponse = (res, err, fallbackMessage) =>
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || fallbackMessage,
    errors: err.errors || [],
  });

const listLabourTeamsController = async (req, res) => {
  try {
    return res.json(await listLabourTeamsService(req.query));
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load labour teams");
  }
};

const listActiveLabourTeamsController = async (req, res) => {
  try {
    return res.json(await listActiveLabourTeamsService(req.query));
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load active labour teams");
  }
};

const getLabourTeamController = async (req, res) => {
  try {
    const team = await getLabourTeamService(req.params.id);
    if (!team) return res.status(404).json({ message: "Labour team not found." });
    return res.json(team);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load labour team");
  }
};

const createLabourTeamController = async (req, res) => {
  try {
    return res.status(201).json(
      await createLabourTeamService({
        payload: req.validatedLabourTeam,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to create labour team");
  }
};

const updateLabourTeamController = async (req, res) => {
  try {
    return res.json(
      await updateLabourTeamService({
        id: req.params.id,
        payload: req.validatedLabourTeam,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update labour team");
  }
};

const deleteLabourTeamController = async (req, res) => {
  try {
    return res.json(
      await deleteLabourTeamService({
        id: req.params.id,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to delete labour team");
  }
};

const updateLabourTeamStatusController = async (req, res) => {
  try {
    return res.json(
      await updateLabourTeamStatusService({
        id: req.params.id,
        ...req.validatedLabourTeamStatus,
        userId: getAuditUserId(req),
      })
    );
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update labour team status");
  }
};

module.exports = {
  createLabourTeamController,
  deleteLabourTeamController,
  getLabourTeamController,
  listActiveLabourTeamsController,
  listLabourTeamsController,
  updateLabourTeamController,
  updateLabourTeamStatusController,
};
