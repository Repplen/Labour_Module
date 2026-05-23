const Material = require("../models/Material");
const Uom = require("../models/Uom");
const {
  VALID_MATERIAL_CODE_REGEX,
  VALID_MATERIAL_TEXT_REGEX,
  calculateMaterialRates,
  createMaterialError,
  escapeRegExp,
  normalizeMaterialCode,
  normalizeOptionalObjectId,
  normalizeText,
} = require("../helpers/material.helper");

const activeFilter = { isDeleted: { $ne: true } };

const populateMaterialQuery = (query) =>
  query.populate("uomId", "uomName shortCode symbol formulaType");

const validateRequiredText = ({ value, field, requiredMessage }) => {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) throw createMaterialError(requiredMessage, 400, field);
  if (!VALID_MATERIAL_TEXT_REGEX.test(normalizedValue)) {
    throw createMaterialError(`${requiredMessage.replace(" is required.", "")} must contain valid text.`, 400, field);
  }
  return normalizedValue;
};

const validateMaterialCode = (value) => {
  const materialCode = normalizeMaterialCode(value);
  if (!materialCode) throw createMaterialError("Material code is required.", 400, "materialCode");
  if (!VALID_MATERIAL_CODE_REGEX.test(materialCode)) {
    throw createMaterialError("Material code must contain valid text.", 400, "materialCode");
  }
  return materialCode;
};

const toNumberOrNull = (value, { positive = false, field, message }) => {
  if (value === "" || value === null || typeof value === "undefined") return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || (positive ? numericValue < 0 : numericValue < 0)) {
    throw createMaterialError(message, 400, field);
  }
  return numericValue;
};

const validateNumericFields = (payload) => {
  const standardRate = toNumberOrNull(payload.standardRate, {
    positive: true,
    field: "standardRate",
    message: "Standard rate must be a positive number.",
  });
  const gstPercent = toNumberOrNull(payload.gstPercent, {
    field: "gstPercent",
    message: "GST percentage must be between 0 and 100.",
  });

  if (gstPercent !== null && (gstPercent < 0 || gstPercent > 100)) {
    throw createMaterialError("GST percentage must be between 0 and 100.", 400, "gstPercent");
  }

  return {
    standardRate,
    gstPercent,
    ...calculateMaterialRates({ standardRate, gstPercent }),
    minimumStock: toNumberOrNull(payload.minimumStock, {
      field: "minimumStock",
      message: "Minimum stock must be zero or positive.",
    }),
    openingStock: toNumberOrNull(payload.openingStock, {
      field: "openingStock",
      message: "Opening stock must be zero or positive.",
    }),
  };
};

const withSafeRateFields = (material = {}) => {
  const row = typeof material.toObject === "function" ? material.toObject() : { ...material };
  const calculatedRates = calculateMaterialRates({
    standardRate: row.standardRate,
    gstPercent: row.gstPercent,
  });

  return {
    ...row,
    gstAmount: row.gstAmount ?? calculatedRates.gstAmount,
    grossRate: row.grossRate ?? calculatedRates.grossRate,
    netRate: row.netRate ?? calculatedRates.netRate,
  };
};

const getUomSnapshot = async (uomId) => {
  const normalizedUomId = normalizeOptionalObjectId(uomId);
  if (!normalizedUomId) throw createMaterialError("UOM is required.", 400, "uomId");

  const uom = await Uom.findOne({ _id: normalizedUomId, isActive: true, ...activeFilter }).lean();
  if (!uom) throw createMaterialError("UOM is required.", 400, "uomId");

  return {
    uomId: uom._id,
    uomName: uom.uomName,
    uomSymbol: uom.symbol || "",
  };
};

const validateDuplicateMaterialCode = async ({ materialCode, excludeId = null }) => {
  const filter = {
    materialCode: { $regex: new RegExp(`^${escapeRegExp(materialCode)}$`, "i") },
    ...activeFilter,
  };
  if (excludeId) filter._id = { $ne: excludeId };

  if (await Material.exists(filter)) {
    throw createMaterialError("This material code already exists.", 409, "materialCode");
  }
};

const validateDuplicateMaterialIdentity = async ({ materialName, category, uomId, excludeId = null }) => {
  const filter = {
    materialName: { $regex: new RegExp(`^\\s*${escapeRegExp(materialName)}\\s*$`, "i") },
    category: { $regex: new RegExp(`^\\s*${escapeRegExp(category)}\\s*$`, "i") },
    uomId,
    ...activeFilter,
  };
  if (excludeId) filter._id = { $ne: excludeId };

  if (await Material.exists(filter)) {
    throw createMaterialError(
      "This material already exists for the selected category and UOM.",
      409,
      "materialName"
    );
  }
};

const buildMaterialFilter = (query = {}) => {
  const filter = { ...activeFilter };
  const search = normalizeText(query.search);
  const category = normalizeText(query.category);
  const materialType = normalizeText(query.materialType);
  const brand = normalizeText(query.brand);
  const status = String(query.status || "").trim().toLowerCase();
  const uomId = normalizeOptionalObjectId(query.uomId);

  if (category) filter.category = category;
  if (materialType) filter.materialType = materialType;
  if (brand) filter.brand = { $regex: new RegExp(escapeRegExp(brand), "i") };
  if (uomId) filter.uomId = uomId;
  if (status === "active") filter.isActive = true;
  if (status === "inactive") filter.isActive = false;
  if (search) {
    filter.$or = [
      { materialCode: { $regex: new RegExp(escapeRegExp(search), "i") } },
      { materialName: { $regex: new RegExp(escapeRegExp(search), "i") } },
    ];
  }

  return filter;
};

const listMaterialsService = async (query = {}) => {
  const rows = await populateMaterialQuery(
    Material.find(buildMaterialFilter(query)).sort({ materialName: 1, materialCode: 1 })
  ).lean();
  return rows.map(withSafeRateFields);
};

const listActiveMaterialsService = async (query = {}) => {
  const rows = await populateMaterialQuery(
    Material.find({ ...buildMaterialFilter(query), isActive: true }).sort({ materialName: 1 })
  ).lean();
  return rows.map(withSafeRateFields);
};

const getMaterialService = async (id) => {
  const row = await populateMaterialQuery(Material.findOne({ _id: id, ...activeFilter })).lean();
  return row ? withSafeRateFields(row) : null;
};

const getMaterialById = async (id) => {
  const material = await Material.findOne({ _id: id, ...activeFilter });
  if (!material) throw createMaterialError("Material not found.", 404);
  return material;
};

const buildMaterialPayload = async (payload) => {
  const materialCode = validateMaterialCode(payload.materialCode);
  const materialName = validateRequiredText({
    value: payload.materialName,
    field: "materialName",
    requiredMessage: "Material name is required.",
  });
  const category = validateRequiredText({
    value: payload.category,
    field: "category",
    requiredMessage: "Material category is required.",
  });
  const uomSnapshot = await getUomSnapshot(payload.uomId);

  return {
    materialCode,
    materialName,
    category,
    ...uomSnapshot,
    materialType: normalizeText(payload.materialType),
    brand: normalizeText(payload.brand),
    specification: normalizeText(payload.specification),
    description: normalizeText(payload.description),
    ...validateNumericFields(payload),
    isActive: payload.isActive !== false,
  };
};

const createMaterialService = async ({ payload, userId = "" }) => {
  const materialPayload = await buildMaterialPayload(payload);
  await validateDuplicateMaterialCode({ materialCode: materialPayload.materialCode });
  await validateDuplicateMaterialIdentity({
    materialName: materialPayload.materialName,
    category: materialPayload.category,
    uomId: materialPayload.uomId,
  });

  const material = await Material.create({
    ...materialPayload,
    createdBy: userId,
    updatedBy: userId,
  });

  return withSafeRateFields(await populateMaterialQuery(Material.findById(material._id)).lean());
};

const updateMaterialService = async ({ id, payload, userId = "" }) => {
  const material = await getMaterialById(id);
  const materialPayload = await buildMaterialPayload(payload);

  await validateDuplicateMaterialCode({
    materialCode: materialPayload.materialCode,
    excludeId: material._id,
  });
  await validateDuplicateMaterialIdentity({
    materialName: materialPayload.materialName,
    category: materialPayload.category,
    uomId: materialPayload.uomId,
    excludeId: material._id,
  });

  Object.assign(material, materialPayload, { updatedBy: userId });
  await material.save();
  return withSafeRateFields(await populateMaterialQuery(Material.findById(material._id)).lean());
};

const hasBlockingUsage = async () => false;

const deleteMaterialService = async ({ id, userId = "" }) => {
  const material = await getMaterialById(id);
  if (await hasBlockingUsage(material)) {
    throw createMaterialError(
      "This material is already used and cannot be deleted. Please deactivate it instead.",
      409
    );
  }

  material.isDeleted = true;
  material.isActive = false;
  material.deletedAt = new Date();
  material.deletedBy = userId;
  material.updatedBy = userId;
  await material.save();
  return { success: true, deletedCount: 1 };
};

const updateMaterialStatusService = async ({ id, isActive, userId = "" }) => {
  const material = await getMaterialById(id);
  material.isActive = Boolean(isActive);
  material.updatedBy = userId;
  await material.save();
  return withSafeRateFields(await populateMaterialQuery(Material.findById(material._id)).lean());
};

module.exports = {
  createMaterialService,
  deleteMaterialService,
  getMaterialService,
  listActiveMaterialsService,
  listMaterialsService,
  updateMaterialService,
  updateMaterialStatusService,
};
