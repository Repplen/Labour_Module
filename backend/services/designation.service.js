const Designation = require("../models/Designation");
const Employee = require("../models/Employee");
const { normalizeMasterName } = require("../utils/masterNameValidation");
const { buildDesignationNameRegex } = require("../helpers/designation.helper");

const findDuplicateDesignation = (name, currentDesignationId = null) => {
  const filter = {
    name: { $regex: buildDesignationNameRegex(name) },
    isActive: { $ne: false },
  };

  if (currentDesignationId) filter._id = { $ne: currentDesignationId };
  return Designation.exists(filter);
};

const listDesignationsService = () =>
  Designation.find({ isActive: { $ne: false } }).sort({ name: 1 });

const createDesignationService = async (body) => {
  const name = normalizeMasterName(body.name);
  const duplicate = await findDuplicateDesignation(name);

  if (duplicate) {
    return {
      duplicate: true,
    };
  }

  const softDeleted = await Designation.findOne({
    name: { $regex: buildDesignationNameRegex(name) },
    isActive: false,
  });

  if (softDeleted) {
    softDeleted.name = name;
    softDeleted.isActive = true;
    return softDeleted.save();
  }

  return Designation.create({ name });
};

const updateDesignationService = async (designationId, body) => {
  const name = normalizeMasterName(body.name);
  const duplicate = await findDuplicateDesignation(name, designationId);

  if (duplicate) {
    return {
      duplicate: true,
    };
  }

  return Designation.findOneAndUpdate(
    { _id: designationId, isActive: { $ne: false } },
    { name },
    { new: true, runValidators: true }
  );
};

const deleteDesignationService = async (designationId) => {
  const designation = await Designation.findOne({
    _id: designationId,
    isActive: { $ne: false },
  });

  if (!designation) {
    return {
      notFound: true,
    };
  }

  const inUse = await Employee.exists({
    designation: designation._id,
    isActive: { $ne: false },
  });

  if (inUse) {
    return {
      inUse: true,
    };
  }

  designation.isActive = false;
  await designation.save();

  return {
    success: true,
    isActive: false,
  };
};

module.exports = {
  createDesignationService,
  deleteDesignationService,
  findDuplicateDesignation,
  listDesignationsService,
  updateDesignationService,
};
