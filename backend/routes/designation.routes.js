const router = require("express").Router();
const Designation = require("../models/Designation");
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const {
  normalizeMasterName,
  sendMasterNameValidationError,
  validateMasterName,
} = require("../utils/masterNameValidation");

const normalizeName = normalizeMasterName;
const duplicateDesignationMessage = "Duplicate designation data found";
const duplicateDesignationNameError = {
  field: "name",
  message: "This designation name already exists.",
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sendDuplicateDesignationResponse = (res) =>
  res.status(409).json({
    success: false,
    message: duplicateDesignationMessage,
    errors: [duplicateDesignationNameError],
  });

const findDuplicateDesignation = (name, currentDesignationId = null) => {
  const filter = {
    name: { $regex: new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`, "i") },
  };

  if (currentDesignationId) {
    filter._id = { $ne: currentDesignationId };
  }

  return Designation.exists(filter);
};

router.get("/", auth, requirePermission("designation_master", "view"), async (req, res) => {
  try {
    const rows = await Designation.find({ isActive: { $ne: false } }).sort({ name: 1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load designations" });
  }
});

router.post("/", auth, requirePermission("designation_master", "add"), async (req, res) => {
  try {
    const { name, error: nameError } = validateMasterName(req.body.name, "Designation");
    if (nameError) return sendMasterNameValidationError(res, "name", nameError);

    const duplicateDesignation = await findDuplicateDesignation(name);
    if (duplicateDesignation) return sendDuplicateDesignationResponse(res);

    const data = await Designation.create({ name });
    res.status(201).json(data);
  } catch (err) {
    if (err?.code === 11000) {
      return sendDuplicateDesignationResponse(res);
    }
    res.status(500).json({ message: "Failed to create designation" });
  }
});

router.put("/:id", auth, requirePermission("designation_master", "edit"), async (req, res) => {
  try {
    const { name, error: nameError } = validateMasterName(req.body.name, "Designation");
    if (nameError) return sendMasterNameValidationError(res, "name", nameError);

    const duplicateDesignation = await findDuplicateDesignation(name, req.params.id);
    if (duplicateDesignation) return sendDuplicateDesignationResponse(res);

    const updated = await Designation.findOneAndUpdate(
      { _id: req.params.id, isActive: { $ne: false } },
      { name },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: "Designation not found" });
    res.json(updated);
  } catch (err) {
    if (err?.code === 11000) {
      return sendDuplicateDesignationResponse(res);
    }
    res.status(500).json({ message: "Failed to update designation" });
  }
});

router.delete("/:id", auth, requirePermission("designation_master", "delete"), async (req, res) => {
  try {
    const designation = await Designation.findOne({
      _id: req.params.id,
      isActive: { $ne: false },
    });
    if (!designation) return res.status(404).json({ message: "Designation not found" });

    designation.isActive = false;
    await designation.save();
    res.json({ success: true, isActive: false });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete designation" });
  }
});

module.exports = router;
