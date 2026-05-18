const {
  createDesignationService,
  deleteDesignationService,
  listDesignationsService,
  updateDesignationService,
} = require("../services/designation.service");
const {
  duplicateDesignationNameError,
  isDuplicateKeyError,
} = require("../helpers/designation.helper");

const sendDuplicateDesignationResponse = (res) =>
  res.status(409).json({
    success: false,
    message: "Duplicate designation data found",
    errors: [duplicateDesignationNameError],
  });

const listDesignationsController = async (_req, res) => {
  try {
    const rows = await listDesignationsService();
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: "Failed to load designations" });
  }
};

const createDesignationController = async (req, res) => {
  try {
    const data = await createDesignationService(req.body);

    if (data?.duplicate) return sendDuplicateDesignationResponse(res);

    return res.status(201).json(data);
  } catch (err) {
    if (isDuplicateKeyError(err)) return sendDuplicateDesignationResponse(res);
    return res.status(500).json({ message: "Failed to create designation" });
  }
};

const updateDesignationController = async (req, res) => {
  try {
    const updated = await updateDesignationService(req.params.id, req.body);

    if (updated?.duplicate) return sendDuplicateDesignationResponse(res);
    if (!updated) return res.status(404).json({ message: "Designation not found" });

    return res.json(updated);
  } catch (err) {
    if (isDuplicateKeyError(err)) return sendDuplicateDesignationResponse(res);
    return res.status(500).json({ message: "Failed to update designation" });
  }
};

const deleteDesignationController = async (req, res) => {
  try {
    const result = await deleteDesignationService(req.params.id);

    if (result?.notFound) {
      return res.status(404).json({ message: "Designation not found" });
    }

    if (result?.inUse) {
      return res.status(400).json({
        message: "Cannot delete designation while it is assigned to one or more employees.",
      });
    }

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: "Failed to delete designation" });
  }
};

module.exports = {
  createDesignationController,
  deleteDesignationController,
  listDesignationsController,
  updateDesignationController,
};
