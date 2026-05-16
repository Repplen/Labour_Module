const {
  createSiteService,
  createSubSiteService,
  deleteSiteService,
  deleteSubSiteService,
  listSitesService,
  listSubSitesService,
  updateSiteService,
  updateSubSiteService,
} = require("../services/site.service");

const sendDuplicateSiteResponse = (res) =>
  res.status(409).json({
    success: false,
    message: "Duplicate site data found",
    errors: [
      {
        field: "name",
        message: "This site name already exists.",
      },
    ],
  });

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
    return sendDuplicateSiteResponse(res);
  }

  return res.status(500).json({ message: fallbackMessage });
};

const listSitesController = async (req, res) => {
  try {
    const rows = await listSitesService(req.access || {});
    return res.json(rows);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load sites");
  }
};

const createSiteController = async (req, res) => {
  try {
    const data = await createSiteService(req.body, req.validatedSite);
    return res.status(201).json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to create site");
  }
};

const updateSiteController = async (req, res) => {
  try {
    const data = await updateSiteService(
      req.params.id,
      req.body,
      req.access || {},
      req.validatedSite
    );
    return res.json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update site");
  }
};

const deleteSiteController = async (req, res) => {
  try {
    const data = await deleteSiteService(req.params.id, req.access || {});
    return res.json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to delete site");
  }
};

const listSubSitesController = async (req, res) => {
  try {
    const data = await listSubSitesService(
      req.params.id,
      req.query.parentId || "",
      req.access || {}
    );
    return res.json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to load sub sites");
  }
};

const createSubSiteController = async (req, res) => {
  try {
    const data = await createSubSiteService(
      req.params.id,
      req.body,
      req.access || {},
      req.validatedSubSite
    );
    return res.status(201).json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to create sub site");
  }
};

const updateSubSiteController = async (req, res) => {
  try {
    const data = await updateSubSiteService(
      req.params.id,
      req.params.subId,
      req.body,
      req.access || {},
      req.validatedSubSite
    );
    return res.json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to update sub site");
  }
};

const deleteSubSiteController = async (req, res) => {
  try {
    const data = await deleteSubSiteService(
      req.params.id,
      req.params.subId,
      req.access || {}
    );
    return res.json(data);
  } catch (err) {
    return sendErrorResponse(res, err, "Failed to delete sub site");
  }
};

module.exports = {
  createSiteController,
  createSubSiteController,
  deleteSiteController,
  deleteSubSiteController,
  listSitesController,
  listSubSitesController,
  updateSiteController,
  updateSubSiteController,
};
