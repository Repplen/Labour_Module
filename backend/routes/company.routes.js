const router = require("express").Router();
const Company = require("../models/Company");
const Site = require("../models/Site");
const Employee = require("../models/Employee");
const { auth } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permissions");
const { buildCompanyScopeFilter } = require("../services/accessScope.service");
const {
  normalizeMasterName,
  sendMasterNameValidationError,
  validateCompanyName,
} = require("../utils/masterNameValidation");

const normalizeName = normalizeMasterName;
const duplicateCompanyMessage = "Duplicate company data found";
const duplicateCompanyNameError = {
  field: "name",
  message: "This company name already exists.",
};

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const sendDuplicateCompanyResponse = (res) =>
  res.status(409).json({
    success: false,
    message: duplicateCompanyMessage,
    errors: [duplicateCompanyNameError],
  });

const findDuplicateCompany = (name, currentCompanyId = null) => {
  const filter = {
    name: { $regex: new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`, "i") },
    isActive: { $ne: false },
  };

  if (currentCompanyId) {
    filter._id = { $ne: currentCompanyId };
  }

  return Company.exists(filter);
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

const formatEmployeeDirectorLabel = (employee) => {
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

const resolveDirectorNames = async ({ directorEmployeeIds, fallbackDirectorNames }) => {
  const employeeIds = parseEmployeeIds(directorEmployeeIds);
  const fallbackNames = parseNameList(fallbackDirectorNames);

  if (!employeeIds.length) {
    return { directorNames: fallbackNames };
  }

  const employees = await Employee.find(
    { _id: { $in: employeeIds }, isActive: { $ne: false } },
    "employeeCode employeeName"
  );

  if (employees.length !== employeeIds.length) {
    return { error: "One or more selected company directors are invalid" };
  }

  const byId = new Map(employees.map((employee) => [String(employee._id), employee]));
  const employeeDirectorNames = employeeIds
    .map((id) => formatEmployeeDirectorLabel(byId.get(String(id))))
    .filter(Boolean);
  const directorNames = [...employeeDirectorNames];
  const seen = new Set(directorNames.map((item) => item.toLowerCase()));

  fallbackNames.forEach((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    directorNames.push(item);
  });

  return { directorNames };
};

router.get("/", auth, requirePermission("company_master", "view"), async (req, res) => {
  try {
    const rows = await Company.find({
      ...(await buildCompanyScopeFilter(req.access || {})),
      isActive: { $ne: false },
    }).sort({ name: 1 });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Failed to load companies" });
  }
});

router.post("/", auth, requirePermission("company_master", "add"), async (req, res) => {
  try {
    const { name, error: nameError } = validateCompanyName(req.body.name);
    const { directorNames, error: directorError } = await resolveDirectorNames({
      directorEmployeeIds: req.body.directorEmployeeIds,
      fallbackDirectorNames: req.body.directorNames,
    });
    if (nameError) return sendMasterNameValidationError(res, "name", nameError);
    if (directorError) return res.status(400).json({ message: directorError });

    const duplicateCompany = await findDuplicateCompany(name);
    if (duplicateCompany) return sendDuplicateCompanyResponse(res);

    // Reactivate a soft-deleted company with the same name instead of inserting
    // a new document (avoids unique-index conflict if the index has no partial filter).
    const softDeleted = await Company.findOne({
      name: { $regex: new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`, "i") },
      isActive: false,
    });

    let data;
    if (softDeleted) {
      softDeleted.name = name;
      softDeleted.directorNames = directorNames;
      softDeleted.isActive = true;
      data = await softDeleted.save();
    } else {
      data = await Company.create({ name, directorNames });
    }
    res.status(201).json(data);
  } catch (err) {
    if (err?.code === 11000) {
      return sendDuplicateCompanyResponse(res);
    }
    res.status(500).json({ message: "Failed to create company" });
  }
});

router.put("/:id", auth, requirePermission("company_master", "edit"), async (req, res) => {
  try {
    const { name, error: nameError } = validateCompanyName(req.body.name);
    const { directorNames, error: directorError } = await resolveDirectorNames({
      directorEmployeeIds: req.body.directorEmployeeIds,
      fallbackDirectorNames: req.body.directorNames,
    });
    if (nameError) return sendMasterNameValidationError(res, "name", nameError);
    if (directorError) return res.status(400).json({ message: directorError });

    const existing = await Company.findOne({
      _id: req.params.id,
      isActive: { $ne: false },
    });
    if (!existing) return res.status(404).json({ message: "Company not found" });

    const duplicateCompany = await findDuplicateCompany(name, req.params.id);
    if (duplicateCompany) return sendDuplicateCompanyResponse(res);

    const previousName = existing.name;
    existing.name = name;
    existing.directorNames = directorNames;
    await existing.save();

    if (previousName !== name) {
      await Site.updateMany({ companyName: previousName }, { $set: { companyName: name } });
    }

    res.json(existing);
  } catch (err) {
    if (err?.code === 11000) {
      return sendDuplicateCompanyResponse(res);
    }
    res.status(500).json({ message: "Failed to update company" });
  }
});

router.delete("/:id", auth, requirePermission("company_master", "delete"), async (req, res) => {
  try {
    const existing = await Company.findOne({
      _id: req.params.id,
      isActive: { $ne: false },
    });
    if (!existing) return res.status(404).json({ message: "Company not found" });

    const inUse = await Site.exists({ companyName: existing.name, isActive: { $ne: false } });
    if (inUse) {
      return res.status(400).json({
        message: "Cannot delete company while it is used in Site Master",
      });
    }

    existing.isActive = false;
    await existing.save();
    res.json({ success: true, isActive: false });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete company" });
  }
});

module.exports = router;
