const MainLocation = require("../models/MainLocation");
const Site = require("../models/Site");
const {
  buildTree,
  createMainLocationError,
  escapeRegExp,
  normalizeLocationName,
  normalizeOptionalObjectId,
} = require("../helpers/mainLocation.helper");

const activeFilter = { isDeleted: { $ne: true } };

const assertSiteExists = async (siteId) => {
  if (!normalizeOptionalObjectId(siteId)) {
    throw createMainLocationError("Site name is required.", 400, "siteId");
  }

  const site = await Site.findOne({ _id: siteId, isActive: { $ne: false } }).lean();
  if (!site) {
    throw createMainLocationError("Site name is required.", 400, "siteId");
  }

  return site;
};

const getLocationById = async (id) => {
  const location = await MainLocation.findOne({ _id: id, ...activeFilter });
  if (!location) {
    throw createMainLocationError("Location not found.", 404);
  }
  return location;
};

const buildDuplicateFilter = ({ siteId, parentLocationId = null, locationName, excludeId = null }) => {
  const filter = {
    siteId,
    parentLocationId: parentLocationId || null,
    locationName: { $regex: new RegExp(`^\\s*${escapeRegExp(locationName)}\\s*$`, "i") },
    ...activeFilter,
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  return filter;
};

const assertNoDuplicateSibling = async ({ siteId, parentLocationId, locationName, excludeId }) => {
  const duplicate = await MainLocation.exists(
    buildDuplicateFilter({ siteId, parentLocationId, locationName, excludeId })
  );

  if (duplicate) {
    throw createMainLocationError(
      "This location already exists under the selected parent.",
      409,
      "locationName"
    );
  }
};

const refreshHasChildren = async (locationId) => {
  if (!locationId) return;

  const hasChildren = Boolean(
    await MainLocation.exists({ parentLocationId: locationId, ...activeFilter })
  );

  await MainLocation.updateOne({ _id: locationId }, { $set: { hasChildren } });
};

const buildListFilter = (query = {}) => {
  const filter = { ...activeFilter };
  const siteId = normalizeOptionalObjectId(query.siteId);
  const parentLocationId = normalizeOptionalObjectId(query.parentLocationId);
  const status = String(query.status || "").trim().toLowerCase();
  const hasChildren = String(query.hasChildren || "").trim().toLowerCase();
  const level = String(query.level || "").trim();
  const search = normalizeLocationName(query.search);
  const path = normalizeLocationName(query.path);

  if (siteId) filter.siteId = siteId;
  if (parentLocationId) filter.parentLocationId = parentLocationId;
  if (status === "active") filter.isActive = true;
  if (status === "inactive") filter.isActive = false;
  if (hasChildren === "yes" || hasChildren === "true") filter.hasChildren = true;
  if (hasChildren === "no" || hasChildren === "false") filter.hasChildren = false;
  if (level !== "" && Number.isInteger(Number(level))) filter.level = Number(level);
  if (search) filter.locationName = { $regex: new RegExp(escapeRegExp(search), "i") };
  if (path) filter.path = { $regex: new RegExp(escapeRegExp(path), "i") };

  return filter;
};

const populateLocationQuery = (query) =>
  query
    .populate("siteId", "name companyName")
    .populate("parentLocationId", "locationName path level");

const listMainLocationsService = async (query = {}) => {
  const rows = await populateLocationQuery(
    MainLocation.find(buildListFilter(query)).sort({ "siteId.name": 1, path: 1, level: 1 })
  ).lean();

  return rows;
};

const getMainLocationService = async (id) =>
  populateLocationQuery(MainLocation.findOne({ _id: id, ...activeFilter })).lean();

const listMainLocationTreeService = async (query = {}) => {
  const rows = await listMainLocationsService(query);
  const grouped = new Map();

  rows.forEach((row) => {
    const siteKey = String(row.siteId?._id || row.siteId || "");
    if (!grouped.has(siteKey)) {
      grouped.set(siteKey, {
        site: row.siteId,
        locations: [],
      });
    }
    grouped.get(siteKey).locations.push(row);
  });

  return Array.from(grouped.values()).map((group) => ({
    site: group.site,
    tree: buildTree(group.locations),
  }));
};

const getMainLocationTreeBySiteService = async (siteId, query = {}) => {
  await assertSiteExists(siteId);
  const rows = await listMainLocationsService({ ...query, siteId });
  return buildTree(rows);
};

const createMainLocationService = async ({ payload, parentId = "", userId = "" }) => {
  const locationName = normalizeLocationName(payload.locationName);

  if (!locationName) {
    throw createMainLocationError("Location name is required.", 400, "locationName");
  }

  let siteId = payload.siteId;
  let parentLocationId = parentId || payload.parentLocationId || null;
  let level = 0;
  let path = locationName;
  let parent = null;

  if (parentLocationId) {
    parent = await getLocationById(parentLocationId);
    siteId = String(parent.siteId);
    parentLocationId = parent._id;
    level = Number(parent.level || 0) + 1;
    path = `${parent.path} / ${locationName}`;
  } else {
    await assertSiteExists(siteId);
    parentLocationId = null;
  }

  await assertSiteExists(siteId);
  await assertNoDuplicateSibling({ siteId, parentLocationId, locationName });

  const location = await MainLocation.create({
    siteId,
    locationName,
    parentLocationId,
    level,
    path,
    createdBy: userId,
    updatedBy: userId,
  });

  if (parent) {
    parent.hasChildren = true;
    parent.updatedBy = userId;
    await parent.save();
  }

  return populateLocationQuery(MainLocation.findById(location._id)).lean();
};

const updateDescendantPaths = async ({ location, oldPath, userId }) => {
  const descendants = await MainLocation.find({
    path: { $regex: new RegExp(`^${escapeRegExp(oldPath)} /`) },
    ...activeFilter,
  });

  await Promise.all(
    descendants.map((descendant) => {
      descendant.path = `${location.path}${descendant.path.slice(oldPath.length)}`;
      descendant.updatedBy = userId;
      return descendant.save();
    })
  );
};

const updateMainLocationService = async ({ id, payload, userId = "" }) => {
  const location = await getLocationById(id);
  const locationName = normalizeLocationName(payload.locationName);

  if (!locationName) {
    throw createMainLocationError("Location name is required.", 400, "locationName");
  }

  await assertNoDuplicateSibling({
    siteId: location.siteId,
    parentLocationId: location.parentLocationId || null,
    locationName,
    excludeId: location._id,
  });

  const oldPath = location.path;
  const parent = location.parentLocationId
    ? await MainLocation.findOne({ _id: location.parentLocationId, ...activeFilter })
    : null;
  const parentPath = parent?.path || "";

  location.locationName = locationName;
  location.path = parentPath ? `${parentPath} / ${locationName}` : locationName;
  location.updatedBy = userId;
  await location.save();
  await updateDescendantPaths({ location, oldPath, userId });

  return populateLocationQuery(MainLocation.findById(location._id)).lean();
};

const hasBlockingUsage = async () => false;

const softDeleteLocationAndChildren = async ({ rootId, userId }) => {
  const root = await getLocationById(rootId);
  const descendantIds = await MainLocation.find({
    path: { $regex: new RegExp(`^${escapeRegExp(root.path)} /`) },
    ...activeFilter,
  }).distinct("_id");
  const ids = [root._id, ...descendantIds];

  await MainLocation.updateMany(
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

  await refreshHasChildren(root.parentLocationId);
  return { success: true, deletedCount: ids.length };
};

const deleteMainLocationService = async ({ id, cascadeChildren = false, userId = "" }) => {
  const location = await getLocationById(id);

  if (await hasBlockingUsage(location)) {
    throw createMainLocationError(
      "This location is already used and cannot be deleted. Please deactivate it instead.",
      409
    );
  }

  const childCount = await MainLocation.countDocuments({
    parentLocationId: id,
    ...activeFilter,
  });

  if (childCount > 0 && !cascadeChildren) {
    throw createMainLocationError(
      "This location has child locations. Do you want to delete all child locations also?",
      409,
      "cascadeChildren"
    );
  }

  return softDeleteLocationAndChildren({ rootId: id, userId });
};

const updateMainLocationStatusService = async ({
  id,
  isActive,
  cascadeChildren = false,
  userId = "",
}) => {
  const location = await getLocationById(id);
  const childCount = await MainLocation.countDocuments({
    parentLocationId: id,
    ...activeFilter,
  });

  if (childCount > 0 && isActive === false && !cascadeChildren) {
    throw createMainLocationError(
      "This location has child locations. Do you want to make child locations inactive also?",
      409,
      "cascadeChildren"
    );
  }

  location.isActive = Boolean(isActive);
  location.updatedBy = userId;
  await location.save();

  if (cascadeChildren) {
    const descendantIds = await MainLocation.find({
      path: { $regex: new RegExp(`^${escapeRegExp(location.path)} /`) },
      ...activeFilter,
    }).distinct("_id");

    await MainLocation.updateMany(
      { _id: { $in: descendantIds } },
      { $set: { isActive: Boolean(isActive), updatedBy: userId } }
    );
  }

  return populateLocationQuery(MainLocation.findById(location._id)).lean();
};

module.exports = {
  createMainLocationService,
  deleteMainLocationService,
  getMainLocationService,
  getMainLocationTreeBySiteService,
  listMainLocationTreeService,
  listMainLocationsService,
  updateMainLocationService,
  updateMainLocationStatusService,
};
