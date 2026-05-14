const {
  getEnabledModuleMap,
  getModuleSettings,
  updateModuleSettingStatus,
} = require("../services/moduleSettings.service");

const getChangedBy = (user = {}) =>
  [user.principalType || "user", user.id || user._id || ""].filter(Boolean).join(":");

exports.getModuleSettings = async (_req, res) => {
  try {
    const rows = await getModuleSettings();
    return res.json({ rows });
  } catch (err) {
    console.error("GET MODULE SETTINGS ERROR:", err);
    return res.status(500).json({ message: "Failed to load module settings" });
  }
};

exports.getEnabledModuleSettings = async (_req, res) => {
  try {
    const flags = await getEnabledModuleMap({ allowCache: false });
    return res.json(flags);
  } catch (err) {
    console.error("GET ENABLED MODULE SETTINGS ERROR:", err);
    return res.status(500).json({ message: "Failed to load enabled module settings" });
  }
};

exports.updateModuleSetting = async (req, res) => {
  try {
    const updatedSetting = await updateModuleSettingStatus({
      moduleKey: req.params.moduleKey,
      isEnabled: req.body?.isEnabled,
      changedBy: getChangedBy(req.user),
      remarks: req.body?.remarks || "",
    });

    return res.json({
      success: true,
      message: "Module status updated successfully",
      row: updatedSetting,
    });
  } catch (err) {
    console.error("UPDATE MODULE SETTING ERROR:", err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || "Failed to update module status",
    });
  }
};
