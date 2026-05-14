const router = require("express").Router();
const Department = require("../models/Department");
const Employee = require("../models/Employee");
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { buildDepartmentScopeFilter } = require("../services/accessScope.service");
const {
  normalizeMasterName,
  sendMasterNameValidationError,
  validateMasterName,
} = require("../utils/masterNameValidation");

const MAX_SUB_LEVELS = 4;
const normalizeName = normalizeMasterName;
const duplicateDepartmentMessage = "Duplicate department data found";
const duplicateDepartmentNameError = {
  field: "name",
  message: "This department name already exists.",
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sendDuplicateDepartmentResponse = (res) =>
  res.status(409).json({
    success: false,
    message: duplicateDepartmentMessage,
    errors: [duplicateDepartmentNameError],
  });

const findDuplicateDepartment = (name, currentDepartmentId = null) => {
  const filter = {
    name: { $regex: new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`, "i") },
  };

  if (currentDepartmentId) {
    filter._id = { $ne: currentDepartmentId };
  }

  return Department.exists(filter);
};

const parseNameList = (value) => {
  const raw =
    Array.isArray(value)
      ? value
      : String(value || "")
          .split(/[\n,]+/)
          .map((item) => item.trim());

  const unique = [];
  const seen = new Set();

  raw
    .map((item) => normalizeName(item))
    .filter(Boolean)
    .forEach((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(item);
    });

  return unique;
};

const formatEmployeeHeadLabel = (employee) => {
  const code = normalizeName(employee?.employeeCode);
  const name = normalizeName(employee?.employeeName);
  if (code && name) return `${code} - ${name}`;
  return code || name;
};

const parseEmployeeIds = (value) => {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();

  return raw
    .map((item) => normalizeName(item))
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
};

const resolveHeadNames = async ({
  headEmployeeIds,
  fallbackHeadNames,
  invalidSelectionMessage = "One or more selected department heads are invalid",
}) => {
  const employeeIds = parseEmployeeIds(headEmployeeIds);
  const fallbackNames = parseNameList(fallbackHeadNames);

  if (!employeeIds.length) {
    return { headNames: fallbackNames };
  }

  const employees = await Employee.find(
    { _id: { $in: employeeIds }, isActive: { $ne: false } },
    "employeeCode employeeName"
  );

  if (employees.length !== employeeIds.length) {
    return { error: invalidSelectionMessage };
  }

  const byId = new Map(employees.map((employee) => [String(employee._id), employee]));
  const employeeHeadNames = employeeIds
    .map((id) => formatEmployeeHeadLabel(byId.get(String(id))))
    .filter(Boolean);

  const headNames = [...employeeHeadNames];
  const seen = new Set(headNames.map((item) => item.toLowerCase()));

  fallbackNames.forEach((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    headNames.push(item);
  });

  return { headNames };
};

const hasDuplicateSubDepartment = (rows, name, ignoreId = null) =>
  rows.some(
    (item) =>
      item.name.trim().toLowerCase() === name.trim().toLowerCase() &&
      String(item._id) !== String(ignoreId || "")
  );

const parseSubDepartmentNames = (body = {}) => {
  return {
    names: parseNameList(
      Array.isArray(body.names) || typeof body.names === "string"
        ? body.names
        : [body.name]
    ),
    hasBulkPayload: Array.isArray(body.names) || typeof body.names === "string",
  };
};

const findSubDepartmentNode = (rows = [], subId, level = 1) => {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (String(row._id) === String(subId)) {
      return { node: row, siblings: rows, index: i, level };
    }

    const childMatch = findSubDepartmentNode(row.children || [], subId, level + 1);
    if (childMatch) return childMatch;
  }

  return null;
};

const canAccessScopedDepartment = async (req, departmentId) => {
  const scopeFilter = await buildDepartmentScopeFilter(req.access || {});

  if (!scopeFilter?._id?.$in) {
    return scopeFilter?._id !== null;
  }

  return scopeFilter._id.$in.some((value) => String(value) === String(departmentId));
};

router.get("/", auth, requirePermission("department_master", "view"), async (req, res) => {
  try {
    const rows = await Department.find({
      ...(await buildDepartmentScopeFilter(req.access || {})),
      isActive: { $ne: false },
    }).sort({ name: 1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load departments" });
  }
});

router.post("/", auth, requirePermission("department_master", "add"), async (req, res) => {
  try {
    const { name, error: nameError } = validateMasterName(req.body.name, "Department");
    const { headNames, error: headError } = await resolveHeadNames({
      headEmployeeIds: req.body.headEmployeeIds,
      fallbackHeadNames: req.body.headNames,
    });
    const { headNames: departmentLeadNames, error: departmentLeadError } =
      await resolveHeadNames({
        headEmployeeIds: req.body.departmentLeadEmployeeIds,
        fallbackHeadNames: req.body.departmentLeadNames,
        invalidSelectionMessage: "One or more selected department leads are invalid",
      });
    if (nameError) return sendMasterNameValidationError(res, "name", nameError);
    if (headError) return res.status(400).json({ message: headError });
    if (departmentLeadError) {
      return res.status(400).json({ message: departmentLeadError });
    }

    const duplicateDepartment = await findDuplicateDepartment(name);
    if (duplicateDepartment) return sendDuplicateDepartmentResponse(res);

    const data = await Department.create({ name, headNames, departmentLeadNames });
    res.status(201).json(data);
  } catch (err) {
    if (err?.code === 11000) {
      return sendDuplicateDepartmentResponse(res);
    }
    res.status(500).json({ message: "Failed to create department" });
  }
});

router.put("/:id", auth, requirePermission("department_master", "edit"), async (req, res) => {
  try {
    if (!(await canAccessScopedDepartment(req, req.params.id))) {
      return res.status(404).json({ message: "Department not found" });
    }

    const { name, error: nameError } = validateMasterName(req.body.name, "Department");
    const { headNames, error: headError } = await resolveHeadNames({
      headEmployeeIds: req.body.headEmployeeIds,
      fallbackHeadNames: req.body.headNames,
    });
    const { headNames: departmentLeadNames, error: departmentLeadError } =
      await resolveHeadNames({
        headEmployeeIds: req.body.departmentLeadEmployeeIds,
        fallbackHeadNames: req.body.departmentLeadNames,
        invalidSelectionMessage: "One or more selected department leads are invalid",
      });
    if (nameError) return sendMasterNameValidationError(res, "name", nameError);
    if (headError) return res.status(400).json({ message: headError });
    if (departmentLeadError) {
      return res.status(400).json({ message: departmentLeadError });
    }

    const duplicateDepartment = await findDuplicateDepartment(name, req.params.id);
    if (duplicateDepartment) return sendDuplicateDepartmentResponse(res);

    const updated = await Department.findOneAndUpdate(
      { _id: req.params.id, isActive: { $ne: false } },
      { name, headNames, departmentLeadNames },
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ message: "Department not found" });
    res.json(updated);
  } catch (err) {
    if (err?.code === 11000) {
      return sendDuplicateDepartmentResponse(res);
    }
    res.status(500).json({ message: "Failed to update department" });
  }
});

router.delete("/:id", auth, requirePermission("department_master", "delete"), async (req, res) => {
  try {
    if (!(await canAccessScopedDepartment(req, req.params.id))) {
      return res.status(404).json({ message: "Department not found" });
    }

    const department = await Department.findOne({
      _id: req.params.id,
      isActive: { $ne: false },
    });
    if (!department) return res.status(404).json({ message: "Department not found" });

    department.isActive = false;
    await department.save();
    res.json({ success: true, isActive: false });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete department" });
  }
});

router.get("/:id/sub-departments", auth, requirePermission("sub_department_master", "view"), async (req, res) => {
  try {
    if (!(await canAccessScopedDepartment(req, req.params.id))) {
      return res.status(404).json({ message: "Department not found" });
    }

    const row = await Department.findById(req.params.id, "subDepartments");
    if (!row) return res.status(404).json({ message: "Department not found" });

    const { parentId = "" } = req.query;
    if (!parentId) {
      return res.json(row.subDepartments || []);
    }

    const parent = findSubDepartmentNode(row.subDepartments || [], parentId);
    if (!parent) return res.status(404).json({ message: "Sub department not found" });
    res.json(parent.node.children || []);
  } catch (err) {
    res.status(500).json({ message: "Failed to load sub departments" });
  }
});

router.post("/:id/sub-departments", auth, requirePermission("sub_department_master", "add"), async (req, res) => {
  try {
    if (!(await canAccessScopedDepartment(req, req.params.id))) {
      return res.status(404).json({ message: "Department not found" });
    }

    const { names: rawNames, hasBulkPayload } = parseSubDepartmentNames(req.body);
    if (!rawNames.length) {
      return sendMasterNameValidationError(
        res,
        "name",
        "Sub department name is required."
      );
    }

    const validationResults = rawNames.map((item) =>
      validateMasterName(item, "Sub department")
    );
    const invalidName = validationResults
      .find((result) => result.error);
    const names = validationResults.map((result) => result.name);
    const { headNames, error: headError } = await resolveHeadNames({
      headEmployeeIds: req.body.headEmployeeIds,
      fallbackHeadNames: req.body.headNames,
    });
    if (invalidName) return sendMasterNameValidationError(res, "name", invalidName.error);
    if (headError) return res.status(400).json({ message: headError });

    const row = await Department.findById(req.params.id);
    if (!row) return res.status(404).json({ message: "Department not found" });

    const { parentId = "" } = req.body;
    let targetRows = row.subDepartments || [];
    let parentLevel = 0;

    if (parentId) {
      const parent = findSubDepartmentNode(row.subDepartments || [], parentId);
      if (!parent) return res.status(404).json({ message: "Sub department not found" });
      parentLevel = parent.level;
      targetRows = parent.node.children || [];
    }

    if (parentLevel >= MAX_SUB_LEVELS) {
      return res.status(400).json({
        message: `You can only create up to Sub Department Master ${MAX_SUB_LEVELS}`,
      });
    }

    const skipped = [];
    const created = [];

    names.forEach((item) => {
      if (hasDuplicateSubDepartment(targetRows, item)) {
        skipped.push(item);
        return;
      }
      targetRows.push({ name: item, headNames });
      created.push(targetRows[targetRows.length - 1]);
    });

    if (!created.length) {
      return res.status(409).json({ message: "All sub department names already exist", skipped });
    }

    await row.save();

    if (!hasBulkPayload && created.length === 1 && skipped.length === 0) {
      return res.status(201).json(created[0]);
    }

    res.status(201).json({ created, skipped });
  } catch (err) {
    res.status(500).json({ message: "Failed to create sub department" });
  }
});

router.put("/:id/sub-departments/:subId", auth, requirePermission("sub_department_master", "edit"), async (req, res) => {
  try {
    if (!(await canAccessScopedDepartment(req, req.params.id))) {
      return res.status(404).json({ message: "Department not found" });
    }

    const { name, error: nameError } = validateMasterName(req.body.name, "Sub department");
    const { headNames, error: headError } = await resolveHeadNames({
      headEmployeeIds: req.body.headEmployeeIds,
      fallbackHeadNames: req.body.headNames,
    });
    if (nameError) return sendMasterNameValidationError(res, "name", nameError);
    if (headError) return res.status(400).json({ message: headError });

    const row = await Department.findById(req.params.id);
    if (!row) return res.status(404).json({ message: "Department not found" });

    const sub = findSubDepartmentNode(row.subDepartments || [], req.params.subId);
    if (!sub) return res.status(404).json({ message: "Sub department not found" });

    if (hasDuplicateSubDepartment(sub.siblings || [], name, sub.node._id)) {
      return res.status(409).json({ message: "Sub department already exists in this department" });
    }

    sub.node.name = name;
    sub.node.headNames = headNames;
    await row.save();
    res.json(sub.node);
  } catch (err) {
    res.status(500).json({ message: "Failed to update sub department" });
  }
});

router.delete("/:id/sub-departments/:subId", auth, requirePermission("sub_department_master", "delete"), async (req, res) => {
  try {
    if (!(await canAccessScopedDepartment(req, req.params.id))) {
      return res.status(404).json({ message: "Department not found" });
    }

    const row = await Department.findById(req.params.id);
    if (!row) return res.status(404).json({ message: "Department not found" });

    const sub = findSubDepartmentNode(row.subDepartments || [], req.params.subId);
    if (!sub) return res.status(404).json({ message: "Sub department not found" });

    sub.siblings.splice(sub.index, 1);
    await row.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete sub department" });
  }
});

module.exports = router;
