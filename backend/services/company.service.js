const Company = require("../models/Company");
const Employee = require("../models/Employee");
const Site = require("../models/Site");
const { buildCompanyScopeFilter } = require("./accessScope.service");
const {
  createDuplicateCompanyError,
  createError,
  escapeRegExp,
  formatEmployeeDirectorLabel,
  parseEmployeeIds,
  parseNameList,
} = require("../helpers/company.helper");

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

const resolveDirectorNames = async ({ directorEmployeeIds, fallbackDirectorNames }) => {
  const employeeIds = parseEmployeeIds(directorEmployeeIds);
  const fallbackNames = parseNameList(fallbackDirectorNames);

  if (!employeeIds.length) {
    return fallbackNames;
  }

  const employees = await Employee.find(
    { _id: { $in: employeeIds }, isActive: { $ne: false } },
    "employeeCode employeeName"
  );

  if (employees.length !== employeeIds.length) {
    throw createError("One or more selected company directors are invalid", 400);
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

  return directorNames;
};

const listCompaniesService = async (access) =>
  Company.find({
    ...(await buildCompanyScopeFilter(access || {})),
    isActive: { $ne: false },
  }).sort({ name: 1 });

const buildCompanyPayload = async (body, validatedCompany) => {
  const { name } = validatedCompany || {};
  if (!name) throw createError("Company name is required.", 400);

  const directorNames = await resolveDirectorNames({
    directorEmployeeIds: body.directorEmployeeIds,
    fallbackDirectorNames: body.directorNames,
  });

  return { name, directorNames };
};

const createCompanyService = async (body, validatedCompany) => {
  const data = await buildCompanyPayload(body, validatedCompany);

  const duplicateCompany = await findDuplicateCompany(data.name);
  if (duplicateCompany) {
    throw createDuplicateCompanyError();
  }

  const softDeleted = await Company.findOne({
    name: { $regex: new RegExp(`^\\s*${escapeRegExp(data.name)}\\s*$`, "i") },
    isActive: false,
  });

  if (softDeleted) {
    softDeleted.name = data.name;
    softDeleted.directorNames = data.directorNames;
    softDeleted.isActive = true;
    return softDeleted.save();
  }

  return Company.create(data);
};

const updateCompanyService = async (companyId, body, validatedCompany) => {
  const data = await buildCompanyPayload(body, validatedCompany);

  const existing = await Company.findOne({
    _id: companyId,
    isActive: { $ne: false },
  });
  if (!existing) throw createError("Company not found", 404);

  const duplicateCompany = await findDuplicateCompany(data.name, companyId);
  if (duplicateCompany) {
    throw createDuplicateCompanyError();
  }

  const previousName = existing.name;
  existing.name = data.name;
  existing.directorNames = data.directorNames;
  await existing.save();

  if (previousName !== data.name) {
    await Site.updateMany(
      { companyName: previousName },
      { $set: { companyName: data.name } }
    );
  }

  return existing;
};

const deleteCompanyService = async (companyId) => {
  const existing = await Company.findOne({
    _id: companyId,
    isActive: { $ne: false },
  });
  if (!existing) throw createError("Company not found", 404);

  const inUse = await Site.exists({
    companyName: existing.name,
    isActive: { $ne: false },
  });

  if (inUse) {
    throw createError("Cannot delete company while it is used in Site Master", 400);
  }

  existing.isActive = false;
  await existing.save();

  return { success: true, isActive: false };
};

module.exports = {
  createCompanyService,
  deleteCompanyService,
  findDuplicateCompany,
  listCompaniesService,
  resolveDirectorNames,
  updateCompanyService,
};
