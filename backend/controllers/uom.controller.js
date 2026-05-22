const {
  createUomService,
  listDefaultUomsService,
  listUomsService,
  seedDefaultUomsService,
  updateUomStatusService,
} = require("../services/uom.service");

const getAuditUserId = (req) =>
  String(req?.user?.id || req?.user?.principalId || req?.user?._id || "").trim();

const sendErrorResponse = (res, err, fallbackMessage) =>
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || fallbackMessage,
    errors: err.errors || [],
  });

const listUomsController = async (req, res) => {
  try {
    const rows = await listUomsService(req.query);
    return res.json(rows);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load UOMs");
  }
};

const listDefaultUomsController = async (_req, res) => {
  try {
    const rows = await listDefaultUomsService();
    return res.json(rows);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load default UOMs");
  }
};

const seedDefaultUomsController = async (_req, res) => {
  try {
    const rows = await seedDefaultUomsService();
    return res.json({ success: true, rows });
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to seed default UOMs");
  }
};

const createUomController = async (req, res) => {
  try {
    const row = await createUomService({
      payload: req.validatedUom,
      userId: getAuditUserId(req),
    });
    return res.status(201).json(row);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to create UOM");
  }
};

const updateUomStatusController = async (req, res) => {
  try {
    const row = await updateUomStatusService({
      id: req.params.id,
      isActive: req.validatedUomStatus.isActive,
      userId: getAuditUserId(req),
    });
    return res.json(row);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update UOM status");
  }
};

module.exports = {
  createUomController,
  listDefaultUomsController,
  listUomsController,
  seedDefaultUomsController,
  updateUomStatusController,
};
