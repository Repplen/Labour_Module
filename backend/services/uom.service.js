const Uom = require("../models/Uom");
const {
  DEFAULT_UOMS,
  createUomError,
  normalizeCode,
  normalizeText,
} = require("../helpers/uom.helper");

const activeFilter = { isDeleted: { $ne: true } };
const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let defaultSeedChecked = false;

const buildUomFilter = (query = {}) => {
  const filter = { ...activeFilter };
  const status = String(query.status || "active").trim().toLowerCase();
  const category = normalizeText(query.category);
  const search = normalizeText(query.search);

  if (status === "active") filter.isActive = true;
  if (status === "inactive") filter.isActive = false;
  if (status === "all") delete filter.isActive;
  if (category) filter.category = category;
  if (search) {
    filter.$or = [
      { uomName: { $regex: new RegExp(escapeRegExp(search), "i") } },
      { shortCode: { $regex: new RegExp(escapeRegExp(search), "i") } },
      { symbol: { $regex: new RegExp(escapeRegExp(search), "i") } },
    ];
  }

  return filter;
};

const ensureDefaultUomsSeeded = async () => {
  if (defaultSeedChecked) return;

  const hasAnyUom = Boolean(await Uom.exists({ isDeleted: { $ne: true } }));
  if (!hasAnyUom) {
    await seedDefaultUomsService();
  }

  defaultSeedChecked = true;
};

const listUomsService = async (query = {}) => {
  await ensureDefaultUomsSeeded();
  return Uom.find(buildUomFilter(query)).sort({ category: 1, uomName: 1 }).lean();
};

const listDefaultUomsService = async () => {
  await ensureDefaultUomsSeeded();
  return Uom.find({ ...activeFilter, isDefault: true }).sort({ category: 1, uomName: 1 }).lean();
};

const seedDefaultUomsService = async () => {
  const results = [];

  for (const item of DEFAULT_UOMS) {
    const shortCode = normalizeCode(item.shortCode);
    const uomName = normalizeText(item.uomName);
    const existing = await Uom.findOne({
      isDeleted: { $ne: true },
      $or: [{ shortCode }, { uomName: { $regex: new RegExp(`^${escapeRegExp(uomName)}$`, "i") } }],
    });

    if (existing) {
      const setOnMissing = {};
      ["symbol", "category", "formulaType"].forEach((field) => {
        if (!existing[field] && item[field]) setOnMissing[field] = item[field];
      });
      if (existing.isDefault !== true) setOnMissing.isDefault = true;
      if (Object.keys(setOnMissing).length) {
        await Uom.updateOne({ _id: existing._id }, { $set: setOnMissing });
      }
      results.push({ action: "updated", shortCode, uomName });
      continue;
    }

    await Uom.create({ ...item, shortCode, uomName });
    results.push({ action: "created", shortCode, uomName });
  }

  defaultSeedChecked = true;
  return results;
};

const createUomService = async ({ payload, userId = "" }) => {
  const uomName = normalizeText(payload.uomName);
  const shortCode = normalizeCode(payload.shortCode);

  if (!uomName) throw createUomError("UOM name is required.", 400, "uomName");
  if (!shortCode) throw createUomError("Short code is required.", 400, "shortCode");

  const duplicate = await Uom.exists({
    isDeleted: { $ne: true },
    $or: [{ shortCode }, { uomName: { $regex: new RegExp(`^${escapeRegExp(uomName)}$`, "i") } }],
  });
  if (duplicate) throw createUomError("This UOM already exists.", 409, "uomName");

  return Uom.create({
    uomName,
    shortCode,
    symbol: normalizeText(payload.symbol),
    category: normalizeText(payload.category) || "Other",
    formulaType: payload.formulaType,
    isDefault: false,
    isActive: payload.isActive !== false,
    createdBy: userId,
    updatedBy: userId,
  });
};

const updateUomStatusService = async ({ id, isActive, userId = "" }) => {
  const uom = await Uom.findOne({ _id: id, ...activeFilter });
  if (!uom) throw createUomError("UOM not found.", 404);

  uom.isActive = Boolean(isActive);
  uom.updatedBy = userId;
  await uom.save();
  return uom.toObject();
};

module.exports = {
  createUomService,
  listDefaultUomsService,
  listUomsService,
  seedDefaultUomsService,
  updateUomStatusService,
};
