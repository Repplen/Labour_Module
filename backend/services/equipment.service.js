const Equipment = require("../models/Equipment");
const Uom = require("../models/Uom");
const {
  VALID_EQUIPMENT_CODE_REGEX,
  VALID_EQUIPMENT_TEXT_REGEX,
  calculateEquipmentRates,
  createEquipmentError,
  escapeRegExp,
  normalizeEquipmentCode,
  normalizeOptionalObjectId,
  normalizeText,
} = require("../helpers/equipment.helper");

const activeFilter = { isDeleted: { $ne: true } };

const populateEquipmentQuery = (query) =>
  query.populate("uomId", "uomName shortCode symbol formulaType");

const validateRequiredText = ({ value, field, requiredMessage }) => {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) throw createEquipmentError(requiredMessage, 400, field);
  if (!VALID_EQUIPMENT_TEXT_REGEX.test(normalizedValue)) {
    throw createEquipmentError(`${requiredMessage.replace(" is required.", "")} must contain valid text.`, 400, field);
  }
  return normalizedValue;
};

const validateEquipmentCode = (value) => {
  const equipmentCode = normalizeEquipmentCode(value);
  if (!equipmentCode) throw createEquipmentError("Equipment code is required.", 400, "equipmentCode");
  if (!VALID_EQUIPMENT_CODE_REGEX.test(equipmentCode)) {
    throw createEquipmentError("Equipment code must contain valid text.", 400, "equipmentCode");
  }
  return equipmentCode;
};

const toNumberOrNull = (value, { field, message }) => {
  if (value === "" || value === null || typeof value === "undefined") return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw createEquipmentError(message, 400, field);
  }
  return numericValue;
};

const validateNumericFields = (payload) => {
  const standardRate = toNumberOrNull(payload.standardRate, {
    field: "standardRate",
    message: "Rate must be a positive number.",
  });
  const gstPercent = toNumberOrNull(payload.gstPercent, {
    field: "gstPercent",
    message: "GST must be between 0 and 100.",
  });

  if (gstPercent !== null && (gstPercent < 0 || gstPercent > 100)) {
    throw createEquipmentError("GST must be between 0 and 100.", 400, "gstPercent");
  }

  return {
    standardRate,
    gstPercent,
    ...calculateEquipmentRates({ standardRate, gstPercent }),
    minimumAvailability: toNumberOrNull(payload.minimumAvailability, {
      field: "minimumAvailability",
      message: "Minimum availability must be zero or positive.",
    }),
    openingQuantity: toNumberOrNull(payload.openingQuantity, {
      field: "openingQuantity",
      message: "Opening quantity must be zero or positive.",
    }),
  };
};

const withSafeRateFields = (equipment = {}) => {
  const row = typeof equipment.toObject === "function" ? equipment.toObject() : { ...equipment };
  const calculatedRates = calculateEquipmentRates({
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
  if (!normalizedUomId) throw createEquipmentError("UOM is required.", 400, "uomId");

  const uom = await Uom.findOne({ _id: normalizedUomId, isActive: true, ...activeFilter }).lean();
  if (!uom) throw createEquipmentError("UOM is required.", 400, "uomId");

  return {
    uomId: uom._id,
    uomName: uom.uomName,
    uomSymbol: uom.symbol || "",
  };
};

const validateDuplicateEquipmentCode = async ({ equipmentCode, excludeId = null }) => {
  const filter = {
    equipmentCode: { $regex: new RegExp(`^${escapeRegExp(equipmentCode)}$`, "i") },
    ...activeFilter,
  };
  if (excludeId) filter._id = { $ne: excludeId };

  if (await Equipment.exists(filter)) {
    throw createEquipmentError("This equipment code already exists.", 409, "equipmentCode");
  }
};

const validateDuplicateEquipmentIdentity = async ({ equipmentName, category, uomId, excludeId = null }) => {
  const filter = {
    equipmentName: { $regex: new RegExp(`^\\s*${escapeRegExp(equipmentName)}\\s*$`, "i") },
    category: { $regex: new RegExp(`^\\s*${escapeRegExp(category)}\\s*$`, "i") },
    uomId,
    ...activeFilter,
  };
  if (excludeId) filter._id = { $ne: excludeId };

  if (await Equipment.exists(filter)) {
    throw createEquipmentError(
      "This equipment already exists for the selected category and UOM.",
      409,
      "equipmentName"
    );
  }
};

const validateOptionalUniqueText = async ({ value, field, message, excludeId = null }) => {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return;

  const filter = {
    [field]: { $regex: new RegExp(`^\\s*${escapeRegExp(normalizedValue)}\\s*$`, "i") },
    ...activeFilter,
  };
  if (excludeId) filter._id = { $ne: excludeId };

  if (await Equipment.exists(filter)) {
    throw createEquipmentError(message, 409, field);
  }
};

const buildEquipmentFilter = (query = {}) => {
  const filter = { ...activeFilter };
  const search = normalizeText(query.search);
  const category = normalizeText(query.category);
  const equipmentType = normalizeText(query.equipmentType);
  const brand = normalizeText(query.brand);
  const fuelType = normalizeText(query.fuelType);
  const status = String(query.status || "").trim().toLowerCase();
  const uomId = normalizeOptionalObjectId(query.uomId);

  if (category) filter.category = category;
  if (equipmentType) filter.equipmentType = equipmentType;
  if (brand) filter.brand = { $regex: new RegExp(escapeRegExp(brand), "i") };
  if (fuelType) filter.fuelType = fuelType;
  if (uomId) filter.uomId = uomId;
  if (status === "active") filter.isActive = true;
  if (status === "inactive") filter.isActive = false;
  if (search) {
    filter.$or = [
      { equipmentCode: { $regex: new RegExp(escapeRegExp(search), "i") } },
      { equipmentName: { $regex: new RegExp(escapeRegExp(search), "i") } },
    ];
  }

  return filter;
};

const listEquipmentService = async (query = {}) => {
  const rows = await populateEquipmentQuery(
    Equipment.find(buildEquipmentFilter(query)).sort({ equipmentName: 1, equipmentCode: 1 })
  ).lean();
  return rows.map(withSafeRateFields);
};

const listActiveEquipmentService = async (query = {}) => {
  const rows = await populateEquipmentQuery(
    Equipment.find({ ...buildEquipmentFilter(query), isActive: true }).sort({ equipmentName: 1 })
  ).lean();
  return rows.map(withSafeRateFields);
};

const getEquipmentService = async (id) => {
  const row = await populateEquipmentQuery(Equipment.findOne({ _id: id, ...activeFilter })).lean();
  return row ? withSafeRateFields(row) : null;
};

const getEquipmentById = async (id) => {
  const equipment = await Equipment.findOne({ _id: id, ...activeFilter });
  if (!equipment) throw createEquipmentError("Equipment not found.", 404);
  return equipment;
};

const buildEquipmentPayload = async (payload) => {
  const equipmentCode = validateEquipmentCode(payload.equipmentCode);
  const equipmentName = validateRequiredText({
    value: payload.equipmentName,
    field: "equipmentName",
    requiredMessage: "Equipment name is required.",
  });
  const category = validateRequiredText({
    value: payload.category,
    field: "category",
    requiredMessage: "Equipment category is required.",
  });
  const uomSnapshot = await getUomSnapshot(payload.uomId);

  return {
    equipmentCode,
    equipmentName,
    category,
    equipmentType: normalizeText(payload.equipmentType),
    ...uomSnapshot,
    brand: normalizeText(payload.brand),
    modelNumber: normalizeText(payload.modelNumber),
    serialNumber: normalizeText(payload.serialNumber),
    registrationNumber: normalizeText(payload.registrationNumber),
    capacitySize: normalizeText(payload.capacitySize),
    fuelType: normalizeText(payload.fuelType),
    description: normalizeText(payload.description),
    ...validateNumericFields(payload),
    isActive: payload.isActive !== false,
  };
};

const validateDuplicateEquipment = async ({ equipmentPayload, excludeId = null }) => {
  await validateDuplicateEquipmentCode({
    equipmentCode: equipmentPayload.equipmentCode,
    excludeId,
  });
  await validateDuplicateEquipmentIdentity({
    equipmentName: equipmentPayload.equipmentName,
    category: equipmentPayload.category,
    uomId: equipmentPayload.uomId,
    excludeId,
  });
  await validateOptionalUniqueText({
    value: equipmentPayload.serialNumber,
    field: "serialNumber",
    message: "This serial number already exists.",
    excludeId,
  });
  await validateOptionalUniqueText({
    value: equipmentPayload.registrationNumber,
    field: "registrationNumber",
    message: "This registration number already exists.",
    excludeId,
  });
};

const createEquipmentService = async ({ payload, userId = "" }) => {
  const equipmentPayload = await buildEquipmentPayload(payload);
  await validateDuplicateEquipment({ equipmentPayload });

  const equipment = await Equipment.create({
    ...equipmentPayload,
    createdBy: userId,
    updatedBy: userId,
  });

  return withSafeRateFields(await populateEquipmentQuery(Equipment.findById(equipment._id)).lean());
};

const updateEquipmentService = async ({ id, payload, userId = "" }) => {
  const equipment = await getEquipmentById(id);
  const equipmentPayload = await buildEquipmentPayload(payload);

  await validateDuplicateEquipment({
    equipmentPayload,
    excludeId: equipment._id,
  });

  Object.assign(equipment, equipmentPayload, { updatedBy: userId });
  await equipment.save();
  return withSafeRateFields(await populateEquipmentQuery(Equipment.findById(equipment._id)).lean());
};

const hasBlockingUsage = async () => false;

const deleteEquipmentService = async ({ id, userId = "" }) => {
  const equipment = await getEquipmentById(id);
  if (await hasBlockingUsage(equipment)) {
    throw createEquipmentError(
      "This equipment is already used and cannot be deleted. Please deactivate it instead.",
      409
    );
  }

  equipment.isDeleted = true;
  equipment.isActive = false;
  equipment.deletedAt = new Date();
  equipment.deletedBy = userId;
  equipment.updatedBy = userId;
  await equipment.save();
  return { success: true, deletedCount: 1 };
};

const updateEquipmentStatusService = async ({ id, isActive, userId = "" }) => {
  const equipment = await getEquipmentById(id);
  equipment.isActive = Boolean(isActive);
  equipment.updatedBy = userId;
  await equipment.save();
  return withSafeRateFields(await populateEquipmentQuery(Equipment.findById(equipment._id)).lean());
};

module.exports = {
  buildEquipmentFilter,
  createEquipmentService,
  deleteEquipmentService,
  getEquipmentService,
  listActiveEquipmentService,
  listEquipmentService,
  updateEquipmentService,
  updateEquipmentStatusService,
  validateDuplicateEquipment,
};
