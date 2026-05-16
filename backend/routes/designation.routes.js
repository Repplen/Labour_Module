const router = require("express").Router();
const Designation = require("../models/Designation");
const Employee = require("../models/Employee");
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { validateRequest } = require("../middleware/validateRequest");
const { normalizeMasterName } = require("../utils/masterNameValidation");
const {
  designationBodySchema,
  idParamSchema,
} = require("../validators/designation.validator");

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const duplicateDesignationNameError = {
  field: "name",
  message: "This designation name already exists.",
};

const sendDuplicateDesignationResponse = (res) =>
  res.status(409).json({
    success: false,
    message: "Duplicate designation data found",
    errors: [duplicateDesignationNameError],
  });

const findDuplicateDesignation = (name, currentDesignationId = null) => {
  const filter = {
    name: { $regex: new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`, "i") },
    isActive: { $ne: false },
  };
  if (currentDesignationId) filter._id = { $ne: currentDesignationId };
  return Designation.exists(filter);
};

// ── GET all active designations ───────────────────────────────────────────────
router.get("/", auth, requirePermission("designation_master", "view"), async (req, res) => {
  try {
    const rows = await Designation.find({ isActive: { $ne: false } }).sort({ name: 1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load designations" });
  }
});

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post(
  "/",
  auth,
  requirePermission("designation_master", "add"),
  validateRequest({ body: designationBodySchema }),
  async (req, res) => {
    try {
      // req.body.name is already trimmed + validated by Zod
      const name = normalizeMasterName(req.body.name);

      const duplicate = await findDuplicateDesignation(name);
      if (duplicate) return sendDuplicateDesignationResponse(res);

      // Reactivate a soft-deleted record with the same name — avoids unique-index conflict
      const softDeleted = await Designation.findOne({
        name: { $regex: new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`, "i") },
        isActive: false,
      });

      let data;
      if (softDeleted) {
        softDeleted.name = name;
        softDeleted.isActive = true;
        data = await softDeleted.save();
      } else {
        data = await Designation.create({ name });
      }
      res.status(201).json(data);
    } catch (err) {
      if (err?.code === 11000) return sendDuplicateDesignationResponse(res);
      res.status(500).json({ message: "Failed to create designation" });
    }
  }
);

// ── UPDATE ────────────────────────────────────────────────────────────────────
router.put(
  "/:id",
  auth,
  requirePermission("designation_master", "edit"),
  validateRequest({ body: designationBodySchema, params: idParamSchema }),
  async (req, res) => {
    try {
      const name = normalizeMasterName(req.body.name);

      const duplicate = await findDuplicateDesignation(name, req.params.id);
      if (duplicate) return sendDuplicateDesignationResponse(res);

      const updated = await Designation.findOneAndUpdate(
        { _id: req.params.id, isActive: { $ne: false } },
        { name },
        { new: true, runValidators: true }
      );

      if (!updated) return res.status(404).json({ message: "Designation not found" });
      res.json(updated);
    } catch (err) {
      if (err?.code === 11000) return sendDuplicateDesignationResponse(res);
      res.status(500).json({ message: "Failed to update designation" });
    }
  }
);

// ── DELETE (soft) ─────────────────────────────────────────────────────────────
router.delete(
  "/:id",
  auth,
  requirePermission("designation_master", "delete"),
  validateRequest({ params: idParamSchema }),
  async (req, res) => {
    try {
      const designation = await Designation.findOne({
        _id: req.params.id,
        isActive: { $ne: false },
      });
      if (!designation) return res.status(404).json({ message: "Designation not found" });

      const inUse = await Employee.exists({
        designation: designation._id,
        isActive: { $ne: false },
      });
      if (inUse) {
        return res.status(400).json({
          message: "Cannot delete designation while it is assigned to one or more employees.",
        });
      }

      designation.isActive = false;
      await designation.save();
      res.json({ success: true, isActive: false });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete designation" });
    }
  }
);

module.exports = router;
