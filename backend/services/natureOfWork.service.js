const NatureOfWork = require("../models/NatureOfWork");
const Uom = require("../models/Uom");
const { getFormulaFieldsByUom } = require("../helpers/uom.helper");
const {
  VALID_WORK_NAME_REGEX,
  buildTree,
  buildWorkPath,
  calculateAndDescribeOutturn,
  createNatureOfWorkError,
  escapeRegExp,
  normalizeOptionalObjectId,
  normalizeWorkName,
} = require("../helpers/natureOfWork.helper");

const activeFilter = { isDeleted: { $ne: true } };

const getWorkById = async (id) => {
  const work = await NatureOfWork.findOne({ _id: id, ...activeFilter });
  if (!work) throw createNatureOfWorkError("Work not found.", 404);
  return work;
};

const populateWorkQuery = (query) =>
  query.populate("parentWorkId", "workName path level").populate("uomId", "uomName symbol shortCode formulaType");

const validateWorkName = (value) => {
  const workName = normalizeWorkName(value);
  if (!workName) throw createNatureOfWorkError("Work name is required.", 400, "workName");
  if (!VALID_WORK_NAME_REGEX.test(workName)) {
    throw createNatureOfWorkError("Work name must contain valid text.", 400, "workName");
  }
  return workName;
};

const validateDuplicateUnderParent = async ({ parentWorkId = null, workName, excludeId = null }) => {
  const filter = {
    parentWorkId: parentWorkId || null,
    workName: { $regex: new RegExp(`^\\s*${escapeRegExp(workName)}\\s*$`, "i") },
    ...activeFilter,
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const duplicate = await NatureOfWork.exists(filter);
  if (duplicate) {
    throw createNatureOfWorkError(
      "This work name already exists under the selected parent.",
      409,
      "workName"
    );
  }
};

const getUomSnapshot = async (payload) => {
  if (!payload.isWorkOutturnRequired) {
    return {
      uomId: null,
      uomName: "",
      uomSymbol: "",
      formulaType: null,
      customUomName: "",
      length: null,
      breadth: null,
      height: null,
      quantity: null,
      totalQuantity: null,
      outturnDescription: "",
    };
  }

  if (!payload.uomId) throw createNatureOfWorkError("UOM is required.", 400, "uomId");

  const uom = await Uom.findOne({ _id: payload.uomId, isActive: true, ...activeFilter }).lean();
  if (!uom) throw createNatureOfWorkError("UOM is required.", 400, "uomId");

  const measurements = {
    length: payload.length ?? null,
    breadth: payload.breadth ?? null,
    height: payload.height ?? null,
    quantity: payload.quantity ?? null,
    customUomName: normalizeWorkName(payload.customUomName) || "",
  };
  const formulaType = uom.formulaType;
  const requiredMeasurementFields = getFormulaFieldsByUom(formulaType).filter(
    (field) => !["customUomName", "outturnDescription"].includes(field)
  );
  const hasCompleteMeasurements =
    requiredMeasurementFields.length > 0 &&
    requiredMeasurementFields.every(
      (field) =>
        measurements[field] !== "" &&
        measurements[field] !== null &&
        typeof measurements[field] !== "undefined"
    );
  const calculated = hasCompleteMeasurements
    ? calculateAndDescribeOutturn({
        formulaType,
        uomSymbol: uom.symbol,
        ...measurements,
      })
    : { totalQuantity: null, outturnDescription: "" };

  return {
    uomId: uom._id,
    uomName: uom.uomName,
    uomSymbol: uom.symbol,
    formulaType,
    ...measurements,
    ...calculated,
  };
};

const buildListFilter = (query = {}) => {
  const filter = { ...activeFilter };
  const parentWorkId = normalizeOptionalObjectId(query.parentWorkId);
  const status = String(query.status || "").trim().toLowerCase();
  const outturn = String(query.workOutturn || query.isWorkOutturnRequired || "").trim().toLowerCase();
  const level = String(query.level || "").trim();
  const search = normalizeWorkName(query.search);
  const path = normalizeWorkName(query.path);
  const uomId = normalizeOptionalObjectId(query.uomId);

  if (parentWorkId) filter.parentWorkId = parentWorkId;
  if (status === "active") filter.isActive = true;
  if (status === "inactive") filter.isActive = false;
  if (outturn === "yes" || outturn === "true") filter.isWorkOutturnRequired = true;
  if (outturn === "no" || outturn === "false") filter.isWorkOutturnRequired = false;
  if (level !== "" && Number.isInteger(Number(level))) filter.level = Number(level);
  if (uomId) filter.uomId = uomId;
  if (search) filter.workName = { $regex: new RegExp(escapeRegExp(search), "i") };
  if (path) filter.path = { $regex: new RegExp(escapeRegExp(path), "i") };

  return filter;
};

const listNatureOfWorkService = async (query = {}) =>
  populateWorkQuery(NatureOfWork.find(buildListFilter(query)).sort({ path: 1, level: 1 })).lean();

const listNatureOfWorkTreeService = async (query = {}) => buildTree(await listNatureOfWorkService(query));

const listActiveNatureOfWorkService = async () =>
  populateWorkQuery(NatureOfWork.find({ ...activeFilter, isActive: true }).sort({ path: 1 })).lean();

const getNatureOfWorkService = async (id) =>
  populateWorkQuery(NatureOfWork.findOne({ _id: id, ...activeFilter })).lean();

const refreshHasChildren = async (workId) => {
  if (!workId) return;
  const hasChildren = Boolean(await NatureOfWork.exists({ parentWorkId: workId, ...activeFilter }));
  await NatureOfWork.updateOne({ _id: workId }, { $set: { hasChildren } });
};

const createNatureOfWorkService = async ({ payload, parentId = "", userId = "" }) => {
  const workName = validateWorkName(payload.workName);
  let parentWorkId = parentId || payload.parentWorkId || null;
  let parent = null;
  let level = 1;
  let path = workName;

  if (parentWorkId) {
    parent = await getWorkById(parentWorkId);
    parentWorkId = parent._id;
    level = Number(parent.level || 1) + 1;
    path = buildWorkPath(parent.path, workName);
  } else {
    parentWorkId = null;
  }

  await validateDuplicateUnderParent({ parentWorkId, workName });
  const outturn = await getUomSnapshot(payload);

  const work = await NatureOfWork.create({
    workName,
    parentWorkId,
    level,
    path,
    isWorkOutturnRequired: Boolean(payload.isWorkOutturnRequired),
    isActive: payload.isActive !== false,
    ...outturn,
    createdBy: userId,
    updatedBy: userId,
  });

  if (parent) {
    parent.hasChildren = true;
    parent.updatedBy = userId;
    await parent.save();
  }

  return populateWorkQuery(NatureOfWork.findById(work._id)).lean();
};

const updateDescendantPaths = async ({ work, oldPath, userId }) => {
  const descendants = await NatureOfWork.find({
    path: { $regex: new RegExp(`^${escapeRegExp(oldPath)} /`) },
    ...activeFilter,
  });

  await Promise.all(
    descendants.map((descendant) => {
      descendant.path = `${work.path}${descendant.path.slice(oldPath.length)}`;
      descendant.updatedBy = userId;
      return descendant.save();
    })
  );
};

const updateNatureOfWorkService = async ({ id, payload, userId = "" }) => {
  const work = await getWorkById(id);
  const workName = validateWorkName(payload.workName);

  await validateDuplicateUnderParent({
    parentWorkId: work.parentWorkId || null,
    workName,
    excludeId: work._id,
  });

  const oldPath = work.path;
  const parent = work.parentWorkId
    ? await NatureOfWork.findOne({ _id: work.parentWorkId, ...activeFilter })
    : null;
  const outturn = await getUomSnapshot(payload);

  work.workName = workName;
  work.path = buildWorkPath(parent?.path || "", workName);
  work.isWorkOutturnRequired = Boolean(payload.isWorkOutturnRequired);
  work.isActive = payload.isActive !== false;
  Object.assign(work, outturn);
  work.updatedBy = userId;
  await work.save();
  await updateDescendantPaths({ work, oldPath, userId });

  return populateWorkQuery(NatureOfWork.findById(work._id)).lean();
};

const hasBlockingUsage = async () => false;

const getChildWorkIds = async (root) =>
  NatureOfWork.find({
    path: { $regex: new RegExp(`^${escapeRegExp(root.path)} /`) },
    ...activeFilter,
  }).distinct("_id");

const deleteNatureOfWorkService = async ({ id, cascadeChildren = false, userId = "" }) => {
  const work = await getWorkById(id);

  if (await hasBlockingUsage(work)) {
    throw createNatureOfWorkError(
      "This work is already used and cannot be deleted. Please deactivate it instead.",
      409
    );
  }

  const childCount = await NatureOfWork.countDocuments({ parentWorkId: id, ...activeFilter });
  if (childCount > 0 && !cascadeChildren) {
    throw createNatureOfWorkError(
      "This work has child levels. Do you want to delete all child levels also?",
      409,
      "cascadeChildren"
    );
  }

  const descendantIds = await getChildWorkIds(work);
  const ids = [work._id, ...descendantIds];
  await NatureOfWork.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        isDeleted: true,
        isActive: false,
        deletedAt: new Date(),
        deletedBy: userId,
        updatedBy: userId,
      },
    }
  );

  await refreshHasChildren(work.parentWorkId);
  return { success: true, deletedCount: ids.length };
};

const updateNatureOfWorkStatusService = async ({ id, isActive, cascadeChildren = false, userId = "" }) => {
  const work = await getWorkById(id);
  const childCount = await NatureOfWork.countDocuments({ parentWorkId: id, ...activeFilter });

  if (childCount > 0 && isActive === false && !cascadeChildren) {
    throw createNatureOfWorkError(
      "This work has child levels. Do you want to make all child levels inactive also?",
      409,
      "cascadeChildren"
    );
  }

  work.isActive = Boolean(isActive);
  work.updatedBy = userId;
  await work.save();

  if (cascadeChildren) {
    const descendantIds = await getChildWorkIds(work);
    await NatureOfWork.updateMany(
      { _id: { $in: descendantIds } },
      { $set: { isActive: Boolean(isActive), updatedBy: userId } }
    );
  }

  return populateWorkQuery(NatureOfWork.findById(work._id)).lean();
};

module.exports = {
  createNatureOfWorkService,
  deleteNatureOfWorkService,
  getNatureOfWorkService,
  listActiveNatureOfWorkService,
  listNatureOfWorkService,
  listNatureOfWorkTreeService,
  updateNatureOfWorkService,
  updateNatureOfWorkStatusService,
};
