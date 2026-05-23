const LabourPieceWorker = require("../models/LabourPieceWorker");
const NatureOfWork = require("../models/NatureOfWork");
const Uom = require("../models/Uom");
const {
  LABOUR_RATE_TYPES,
  PIECE_RATE_TYPES,
  VALID_WORKER_CODE_REGEX,
  VALID_WORKER_TEXT_REGEX,
  WORKER_TYPES,
  calculateLabourPieceRates,
  createLabourPieceWorkerError,
  escapeRegExp,
  normalizeOptionalObjectId,
  normalizeText,
  normalizeWorkerCode,
  toBoolean,
} = require("../helpers/labourPieceWorker.helper");

const activeFilter = { isDeleted: { $ne: true } };

const populateWorkerQuery = (query) =>
  query
    .populate("natureOfWorkId", "workName path level")
    .populate("subNatureOfWorkId", "workName path level")
    .populate("uomId", "uomName shortCode symbol formulaType");

const validateRequiredText = ({ value, field, requiredMessage }) => {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) throw createLabourPieceWorkerError(requiredMessage, 400, field);
  if (!VALID_WORKER_TEXT_REGEX.test(normalizedValue)) {
    throw createLabourPieceWorkerError(`${requiredMessage.replace(" is required.", "")} must contain valid text.`, 400, field);
  }
  return normalizedValue;
};

const validateWorkerCode = (value) => {
  const workerCode = normalizeWorkerCode(value);
  if (!workerCode) throw createLabourPieceWorkerError("Worker code is required.", 400, "workerCode");
  if (!VALID_WORKER_CODE_REGEX.test(workerCode)) {
    throw createLabourPieceWorkerError("Worker code must contain valid text.", 400, "workerCode");
  }
  return workerCode;
};

const toRequiredNonNegativeNumber = (value, { field, message }) => {
  if (value === "" || value === null || typeof value === "undefined") {
    throw createLabourPieceWorkerError(message, 400, field);
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw createLabourPieceWorkerError(message, 400, field);
  }
  return numericValue;
};

const toOptionalNonNegativeNumber = (value, { field, message }) => {
  if (value === "" || value === null || typeof value === "undefined") return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw createLabourPieceWorkerError(message, 400, field);
  }
  return numericValue;
};

const validateWorkerType = (value) => {
  const workerType = validateRequiredText({
    value,
    field: "workerType",
    requiredMessage: "Worker type is required.",
  });
  if (!WORKER_TYPES.includes(workerType)) {
    throw createLabourPieceWorkerError("Worker type is required.", 400, "workerType");
  }
  return workerType;
};

const validateRateType = ({ value, workerType }) => {
  const rateType = validateRequiredText({
    value,
    field: "rateType",
    requiredMessage: "Rate type is required.",
  });
  const allowedTypes = workerType === "Piece Worker" ? PIECE_RATE_TYPES : LABOUR_RATE_TYPES;
  if (!allowedTypes.includes(rateType)) {
    throw createLabourPieceWorkerError("Rate type is required.", 400, "rateType");
  }
  return rateType;
};

const validateNumericFields = (payload) => {
  const gstApplicable = toBoolean(payload.gstApplicable);
  const standardRate = toRequiredNonNegativeNumber(payload.standardRate, {
    field: "standardRate",
    message: "Standard rate must be a positive number.",
  });
  const overtimeRate = toOptionalNonNegativeNumber(payload.overtimeRate, {
    field: "overtimeRate",
    message: "Overtime rate must be zero or positive.",
  });
  const pieceRate = toOptionalNonNegativeNumber(payload.pieceRate, {
    field: "pieceRate",
    message: "Piece rate must be zero or positive.",
  });

  let gstPercent = null;
  if (gstApplicable) {
    gstPercent = toRequiredNonNegativeNumber(payload.gstPercent, {
      field: "gstPercent",
      message: "GST percentage must be between 0 and 100.",
    });
    if (gstPercent < 0 || gstPercent > 100) {
      throw createLabourPieceWorkerError("GST percentage must be between 0 and 100.", 400, "gstPercent");
    }
  }

  return {
    standardRate,
    overtimeRate,
    pieceRate,
    gstApplicable,
    gstPercent,
    ...calculateLabourPieceRates({ standardRate, gstApplicable, gstPercent }),
  };
};

const withSafeRateFields = (worker = {}) => {
  const row = typeof worker.toObject === "function" ? worker.toObject() : { ...worker };
  const calculatedRates = calculateLabourPieceRates({
    standardRate: row.standardRate,
    gstApplicable: row.gstApplicable,
    gstPercent: row.gstPercent,
  });

  return {
    ...row,
    gstAmount: row.gstAmount ?? calculatedRates.gstAmount,
    grossRate: row.grossRate ?? calculatedRates.grossRate,
    netRate: row.netRate ?? calculatedRates.netRate,
  };
};

const getNatureSnapshot = async ({ natureOfWorkId, subNatureOfWorkId }) => {
  const normalizedNatureId = normalizeOptionalObjectId(natureOfWorkId);
  const normalizedSubNatureId = normalizeOptionalObjectId(subNatureOfWorkId);
  const snapshot = {
    natureOfWorkId: null,
    natureOfWorkName: "",
    subNatureOfWorkId: null,
    subNatureOfWorkPath: "",
  };

  if (normalizedNatureId) {
    const nature = await NatureOfWork.findOne({ _id: normalizedNatureId, isActive: true, ...activeFilter }).lean();
    if (!nature) throw createLabourPieceWorkerError("Nature of work not found.", 400, "natureOfWorkId");
    snapshot.natureOfWorkId = nature._id;
    snapshot.natureOfWorkName = nature.workName;
  }

  if (normalizedSubNatureId) {
    const subNature = await NatureOfWork.findOne({ _id: normalizedSubNatureId, isActive: true, ...activeFilter }).lean();
    if (!subNature) throw createLabourPieceWorkerError("Sub nature of work not found.", 400, "subNatureOfWorkId");
    snapshot.subNatureOfWorkId = subNature._id;
    snapshot.subNatureOfWorkPath = subNature.path || subNature.workName || "";
  }

  return snapshot;
};

const getUomSnapshot = async ({ uomId, workerType }) => {
  const normalizedUomId = normalizeOptionalObjectId(uomId);
  if (!normalizedUomId) {
    if (workerType === "Piece Worker") {
      throw createLabourPieceWorkerError("UOM is required for piece worker.", 400, "uomId");
    }
    return {
      uomId: null,
      uomName: "",
      uomSymbol: "",
    };
  }

  const uom = await Uom.findOne({ _id: normalizedUomId, isActive: true, ...activeFilter }).lean();
  if (!uom) throw createLabourPieceWorkerError("UOM is required for piece worker.", 400, "uomId");

  return {
    uomId: uom._id,
    uomName: uom.uomName,
    uomSymbol: uom.symbol || "",
  };
};

const validateDuplicateWorkerCode = async ({ workerCode, excludeId = null }) => {
  const filter = {
    workerCode: { $regex: new RegExp(`^${escapeRegExp(workerCode)}$`, "i") },
    ...activeFilter,
  };
  if (excludeId) filter._id = { $ne: excludeId };

  if (await LabourPieceWorker.exists(filter)) {
    throw createLabourPieceWorkerError("This worker code already exists.", 409, "workerCode");
  }
};

const validateDuplicateWorkerIdentity = async ({ workerPayload, excludeId = null }) => {
  const filter = {
    workerName: { $regex: new RegExp(`^\\s*${escapeRegExp(workerPayload.workerName)}\\s*$`, "i") },
    workerType: workerPayload.workerType,
    natureOfWorkId: workerPayload.natureOfWorkId || null,
    uomId: workerPayload.uomId || null,
    ...activeFilter,
  };
  if (excludeId) filter._id = { $ne: excludeId };

  if (await LabourPieceWorker.exists(filter)) {
    throw createLabourPieceWorkerError("This worker/work already exists.", 409, "workerName");
  }
};

const buildWorkerFilters = (query = {}) => {
  const filter = { ...activeFilter };
  const search = normalizeText(query.search);
  const workerType = normalizeText(query.workerType);
  const labourCategory = normalizeText(query.labourCategory);
  const rateType = normalizeText(query.rateType);
  const status = String(query.status || "").trim().toLowerCase();
  const natureOfWorkId = normalizeOptionalObjectId(query.natureOfWorkId);
  const uomId = normalizeOptionalObjectId(query.uomId);

  if (workerType) filter.workerType = workerType;
  if (labourCategory) filter.labourCategory = labourCategory;
  if (rateType) filter.rateType = rateType;
  if (natureOfWorkId) filter.natureOfWorkId = natureOfWorkId;
  if (uomId) filter.uomId = uomId;
  if (status === "active") filter.isActive = true;
  if (status === "inactive") filter.isActive = false;
  if (search) {
    filter.$or = [
      { workerCode: { $regex: new RegExp(escapeRegExp(search), "i") } },
      { workerName: { $regex: new RegExp(escapeRegExp(search), "i") } },
    ];
  }

  return filter;
};

const listLabourPieceWorkersService = async (query = {}) => {
  const rows = await populateWorkerQuery(
    LabourPieceWorker.find(buildWorkerFilters(query)).sort({ workerType: 1, workerName: 1, workerCode: 1 })
  ).lean();
  return rows.map(withSafeRateFields);
};

const listActiveLabourPieceWorkersService = async (query = {}) => {
  const rows = await populateWorkerQuery(
    LabourPieceWorker.find({ ...buildWorkerFilters(query), isActive: true }).sort({ workerType: 1, workerName: 1 })
  ).lean();
  return rows.map(withSafeRateFields);
};

const getLabourPieceWorkerService = async (id) => {
  const row = await populateWorkerQuery(LabourPieceWorker.findOne({ _id: id, ...activeFilter })).lean();
  return row ? withSafeRateFields(row) : null;
};

const getLabourPieceWorkerById = async (id) => {
  const worker = await LabourPieceWorker.findOne({ _id: id, ...activeFilter });
  if (!worker) throw createLabourPieceWorkerError("Labour/piece worker not found.", 404);
  return worker;
};

const normalizeWorkerPayload = async (payload) => {
  const workerCode = validateWorkerCode(payload.workerCode);
  const workerName = validateRequiredText({
    value: payload.workerName,
    field: "workerName",
    requiredMessage: "Worker name is required.",
  });
  const workerType = validateWorkerType(payload.workerType);
  const labourCategory = validateRequiredText({
    value: payload.labourCategory,
    field: "labourCategory",
    requiredMessage: "Labour category is required.",
  });
  const rateType = validateRateType({ value: payload.rateType, workerType });
  const natureSnapshot = await getNatureSnapshot(payload);
  const uomSnapshot = await getUomSnapshot({ uomId: payload.uomId, workerType });

  return {
    workerCode,
    workerName,
    workerType,
    labourCategory,
    ...natureSnapshot,
    ...uomSnapshot,
    rateType,
    ...validateNumericFields(payload),
    description: normalizeText(payload.description),
    isActive: payload.isActive !== false,
  };
};

const validateDuplicateWorker = async ({ workerPayload, excludeId = null }) => {
  await validateDuplicateWorkerCode({
    workerCode: workerPayload.workerCode,
    excludeId,
  });
  await validateDuplicateWorkerIdentity({
    workerPayload,
    excludeId,
  });
};

const createLabourPieceWorkerService = async ({ payload, userId = "" }) => {
  const workerPayload = await normalizeWorkerPayload(payload);
  await validateDuplicateWorker({ workerPayload });

  const worker = await LabourPieceWorker.create({
    ...workerPayload,
    createdBy: userId,
    updatedBy: userId,
  });

  return withSafeRateFields(await populateWorkerQuery(LabourPieceWorker.findById(worker._id)).lean());
};

const updateLabourPieceWorkerService = async ({ id, payload, userId = "" }) => {
  const worker = await getLabourPieceWorkerById(id);
  const workerPayload = await normalizeWorkerPayload(payload);

  await validateDuplicateWorker({
    workerPayload,
    excludeId: worker._id,
  });

  Object.assign(worker, workerPayload, { updatedBy: userId });
  await worker.save();
  return withSafeRateFields(await populateWorkerQuery(LabourPieceWorker.findById(worker._id)).lean());
};

const hasBlockingUsage = async () => false;

const deleteLabourPieceWorkerService = async ({ id, userId = "" }) => {
  const worker = await getLabourPieceWorkerById(id);
  if (await hasBlockingUsage(worker)) {
    throw createLabourPieceWorkerError(
      "This labour/piece worker is already used and cannot be deleted. Please deactivate it instead.",
      409
    );
  }

  worker.isDeleted = true;
  worker.isActive = false;
  worker.deletedAt = new Date();
  worker.deletedBy = userId;
  worker.updatedBy = userId;
  await worker.save();
  return { success: true, deletedCount: 1 };
};

const updateLabourPieceWorkerStatusService = async ({ id, isActive, userId = "" }) => {
  const worker = await getLabourPieceWorkerById(id);
  worker.isActive = Boolean(isActive);
  worker.updatedBy = userId;
  await worker.save();
  return withSafeRateFields(await populateWorkerQuery(LabourPieceWorker.findById(worker._id)).lean());
};

module.exports = {
  buildWorkerFilters,
  createLabourPieceWorkerService,
  deleteLabourPieceWorkerService,
  getLabourPieceWorkerService,
  listActiveLabourPieceWorkersService,
  listLabourPieceWorkersService,
  normalizeWorkerPayload,
  updateLabourPieceWorkerService,
  updateLabourPieceWorkerStatusService,
  validateDuplicateWorker,
};
