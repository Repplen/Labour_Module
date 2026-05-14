const { isModuleEnabled } = require("../services/moduleSettings.service");

const DISABLED_MODULE_RESPONSE = {
  success: false,
  message: "This module is currently disabled.",
};

const moduleEnabled = (moduleKey) => async (_req, res, next) => {
  try {
    if (await isModuleEnabled(moduleKey)) {
      return next();
    }

    return res.status(403).json(DISABLED_MODULE_RESPONSE);
  } catch (err) {
    return next(err);
  }
};

const moduleAnyEnabled = (moduleKeys = []) => async (_req, res, next) => {
  try {
    const checks = await Promise.all(moduleKeys.map((moduleKey) => isModuleEnabled(moduleKey)));

    if (checks.some(Boolean)) {
      return next();
    }

    return res.status(403).json(DISABLED_MODULE_RESPONSE);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  moduleAnyEnabled,
  moduleEnabled,
};
