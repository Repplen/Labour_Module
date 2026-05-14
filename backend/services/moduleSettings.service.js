const mongoose = require("mongoose");
const ModuleSetting = require("../models/ModuleSetting");
const ModuleSettingHistory = require("../models/ModuleSettingHistory");
const {
  MODULE_SETTINGS_CATALOG,
  STATIC_MODULE_FLAGS,
  isModuleEnabled: isStaticModuleEnabled,
  normalizeModuleKey,
} = require("../config/modules");

const CACHE_TTL_MS = 15 * 1000;

let enabledMapCache = null;
let enabledMapCacheExpiresAt = 0;

const isDatabaseReady = () => mongoose.connection.readyState === 1;

const getCatalogItem = (moduleKey) =>
  MODULE_SETTINGS_CATALOG.find((item) => item.moduleKey === normalizeModuleKey(moduleKey)) || null;

const buildDefaultSetting = (catalogItem) => ({
  moduleKey: catalogItem.moduleKey,
  moduleName: catalogItem.moduleName,
  parentGroup: catalogItem.parentGroup || "General",
  isEnabled:
    catalogItem.isSystemRequired === true
      ? true
      : STATIC_MODULE_FLAGS[catalogItem.moduleKey] !== false,
  isSystemRequired: catalogItem.isSystemRequired === true,
  description: catalogItem.description || "",
  sortOrder: Number(catalogItem.sortOrder || 0),
});

const buildFallbackEnabledMap = () =>
  MODULE_SETTINGS_CATALOG.reduce((result, catalogItem) => {
    const setting = buildDefaultSetting(catalogItem);
    result[setting.moduleKey] = setting.isEnabled;
    return result;
  }, { ...STATIC_MODULE_FLAGS });

const invalidateModuleSettingsCache = () => {
  enabledMapCache = null;
  enabledMapCacheExpiresAt = 0;
};

const syncModuleSettingsSeed = async () => {
  if (!isDatabaseReady()) {
    return;
  }

  await Promise.all(
    MODULE_SETTINGS_CATALOG.map((catalogItem) => {
      const defaultSetting = buildDefaultSetting(catalogItem);

      return ModuleSetting.updateOne(
        { moduleKey: defaultSetting.moduleKey },
        {
          $set: {
            moduleName: defaultSetting.moduleName,
            parentGroup: defaultSetting.parentGroup,
            isSystemRequired: defaultSetting.isSystemRequired,
            description: defaultSetting.description,
            sortOrder: defaultSetting.sortOrder,
          },
          $setOnInsert: {
            isEnabled: defaultSetting.isEnabled,
          },
        },
        { upsert: true }
      );
    })
  );

  invalidateModuleSettingsCache();
};

const getModuleSettings = async () => {
  if (!isDatabaseReady()) {
    return MODULE_SETTINGS_CATALOG.map(buildDefaultSetting);
  }

  await syncModuleSettingsSeed();

  return ModuleSetting.find({}).sort({ sortOrder: 1, moduleName: 1 }).lean();
};

const getEnabledModuleMap = async ({ allowCache = true } = {}) => {
  const now = Date.now();

  if (allowCache && enabledMapCache && enabledMapCacheExpiresAt > now) {
    return enabledMapCache;
  }

  if (!isDatabaseReady()) {
    return buildFallbackEnabledMap();
  }

  try {
    await syncModuleSettingsSeed();
    const rows = await ModuleSetting.find({}, "moduleKey isEnabled isSystemRequired").lean();
    const nextMap = rows.reduce((result, row) => {
      const moduleKey = normalizeModuleKey(row.moduleKey);
      result[moduleKey] = row.isSystemRequired === true ? true : row.isEnabled !== false;
      return result;
    }, buildFallbackEnabledMap());

    enabledMapCache = nextMap;
    enabledMapCacheExpiresAt = now + CACHE_TTL_MS;

    return nextMap;
  } catch (err) {
    console.error("MODULE SETTINGS ENABLED MAP ERROR:", err);
    return buildFallbackEnabledMap();
  }
};

const isModuleEnabled = async (moduleKey) => {
  const enabledMap = await getEnabledModuleMap();
  return isStaticModuleEnabled(moduleKey, enabledMap);
};

const updateModuleSettingStatus = async ({
  moduleKey,
  isEnabled,
  changedBy = "",
  remarks = "",
}) => {
  const normalizedModuleKey = normalizeModuleKey(moduleKey);
  const catalogItem = getCatalogItem(normalizedModuleKey);

  if (!catalogItem) {
    const error = new Error("Module setting was not found");
    error.statusCode = 404;
    throw error;
  }

  if (!isDatabaseReady()) {
    const error = new Error("Database connection is not ready");
    error.statusCode = 503;
    throw error;
  }

  if (typeof isEnabled !== "boolean") {
    const error = new Error("isEnabled must be true or false");
    error.statusCode = 400;
    throw error;
  }

  await syncModuleSettingsSeed();

  const currentSetting =
    (await ModuleSetting.findOne({ moduleKey: normalizedModuleKey })) ||
    (await ModuleSetting.create(buildDefaultSetting(catalogItem)));

  if (currentSetting.isSystemRequired && isEnabled === false) {
    const error = new Error("This module is required and cannot be disabled.");
    error.statusCode = 400;
    throw error;
  }

  const oldStatus = currentSetting.isEnabled !== false;
  const nextStatus = Boolean(isEnabled);

  currentSetting.isEnabled = currentSetting.isSystemRequired ? true : nextStatus;
  currentSetting.updatedBy = changedBy;
  await currentSetting.save();

  if (oldStatus !== currentSetting.isEnabled) {
    await ModuleSettingHistory.create({
      moduleKey: normalizedModuleKey,
      oldStatus,
      newStatus: currentSetting.isEnabled,
      changedBy,
      remarks,
      changedAt: new Date(),
    });
  }

  invalidateModuleSettingsCache();

  return currentSetting.toObject();
};

module.exports = {
  getEnabledModuleMap,
  getModuleSettings,
  invalidateModuleSettingsCache,
  isModuleEnabled,
  syncModuleSettingsSeed,
  updateModuleSettingStatus,
};
