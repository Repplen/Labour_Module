const Department = require("../models/Department");
const Employee = require("../models/Employee");
const { buildDepartmentScopeFilter } = require("./accessScope.service");
const {
  MAX_SUB_LEVELS,
  createDuplicateDepartmentError,
  createError,
  escapeRegExp,
  findSubDepartmentNode,
  formatEmployeeHeadLabel,
  hasDuplicateSubDepartment,
  parseEmployeeIds,
  parseNameList,
} = require("../helpers/department.helper");

const findDuplicateDepartment = (name, currentDepartmentId = null) => {
  const filter = {
    name: { $regex: new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`, "i") },
  };

  if (currentDepartmentId) {
    filter._id = { $ne: currentDepartmentId };
  }

  return Department.exists(filter);
};

const resolveHeadNames = async ({
  headEmployeeIds,
  fallbackHeadNames,
  invalidSelectionMessage = "One or more selected department heads are invalid",
}) => {
  const employeeIds = parseEmployeeIds(headEmployeeIds);
  const fallbackNames = parseNameList(fallbackHeadNames);

  if (!employeeIds.length) {
    return fallbackNames;
  }

  const employees = await Employee.find(
    { _id: { $in: employeeIds }, isActive: { $ne: false } },
    "employeeCode employeeName"
  );

  if (employees.length !== employeeIds.length) {
    throw createError(invalidSelectionMessage, 400);
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

  return headNames;
};

const canAccessScopedDepartment = async (access, departmentId) => {
  const scopeFilter = await buildDepartmentScopeFilter(access || {});

  if (!scopeFilter?._id?.$in) {
    return scopeFilter?._id !== null;
  }

  return scopeFilter._id.$in.some((value) => String(value) === String(departmentId));
};

const assertCanAccessDepartment = async (access, departmentId) => {
  if (!(await canAccessScopedDepartment(access, departmentId))) {
    throw createError("Department not found", 404);
  }
};

const buildDepartmentPayload = async (
  body,
  validatedDepartment,
  currentDepartmentId = null
) => {
  const { name } = validatedDepartment || {};

  if (!name) {
    throw createError("Department name is required.", 400);
  }

  const headNames = await resolveHeadNames({
    headEmployeeIds: body.headEmployeeIds,
    fallbackHeadNames: body.headNames,
  });
  const departmentLeadNames = await resolveHeadNames({
    headEmployeeIds: body.departmentLeadEmployeeIds,
    fallbackHeadNames: body.departmentLeadNames,
    invalidSelectionMessage: "One or more selected department leads are invalid",
  });

  const duplicateDepartment = await findDuplicateDepartment(name, currentDepartmentId);
  if (duplicateDepartment) {
    console.log('--------------------------------------- duplicate department name', name);
    throw createDuplicateDepartmentError();
  }

  return { name, headNames, departmentLeadNames };
};

const listDepartmentsService = async (access) =>
  Department.find({
    ...(await buildDepartmentScopeFilter(access || {})),
    isActive: { $ne: false },
  }).sort({ name: 1 });

const createDepartmentService = async (body, validatedDepartment) => {
  const data = await buildDepartmentPayload(body, validatedDepartment);
  return Department.create(data);
};

const updateDepartmentService = async (
  departmentId,
  body,
  access,
  validatedDepartment
) => {
  await assertCanAccessDepartment(access, departmentId);
  const data = await buildDepartmentPayload(body, validatedDepartment, departmentId);

  const updated = await Department.findOneAndUpdate(
    { _id: departmentId, isActive: { $ne: false } },
    data,
    { new: true, runValidators: true }
  );

  if (!updated) throw createError("Department not found", 404);
  return updated;
};

const deleteDepartmentService = async (departmentId, access) => {
  await assertCanAccessDepartment(access, departmentId);

  const department = await Department.findOne({
    _id: departmentId,
    isActive: { $ne: false },
  });

  if (!department) throw createError("Department not found", 404);

  department.isActive = false;
  await department.save();

  return { success: true, isActive: false };
};

const listSubDepartmentsService = async (departmentId, parentId = "", access) => {
  await assertCanAccessDepartment(access, departmentId);

  const row = await Department.findById(departmentId, "subDepartments");
  if (!row) throw createError("Department not found", 404);

  if (!parentId) {
    return row.subDepartments || [];
  }

  const parent = findSubDepartmentNode(row.subDepartments || [], parentId);
  if (!parent) throw createError("Sub department not found", 404);

  return parent.node.children || [];
};

const createSubDepartmentService = async (
  departmentId,
  body,
  access,
  validatedSubDepartment
) => {
  await assertCanAccessDepartment(access, departmentId);

  const { names, hasBulkPayload } = validatedSubDepartment || {};
  if (!Array.isArray(names) || !names.length) {
    throw createError("Sub department name is required.", 400);
  }

  const headNames = await resolveHeadNames({
    headEmployeeIds: body.headEmployeeIds,
    fallbackHeadNames: body.headNames,
  });

  const row = await Department.findById(departmentId);
  if (!row) throw createError("Department not found", 404);

  const { parentId = "" } = body;
  let targetRows = row.subDepartments || [];
  let parentLevel = 0;

  if (parentId) {
    const parent = findSubDepartmentNode(row.subDepartments || [], parentId);
    if (!parent) throw createError("Sub department not found", 404);
    parentLevel = parent.level;
    targetRows = parent.node.children || [];
  }

  if (parentLevel >= MAX_SUB_LEVELS) {
    throw createError(
      `You can only create up to Sub Department Master ${MAX_SUB_LEVELS}`,
      400
    );
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
    throw createError("All sub department names already exist", 409, { skipped });
  }

  await row.save();

  if (!hasBulkPayload && created.length === 1 && skipped.length === 0) {
    return created[0];
  }

  return { created, skipped };
};

const updateSubDepartmentService = async (
  departmentId,
  subId,
  body,
  access,
  validatedSubDepartment
) => {
  await assertCanAccessDepartment(access, departmentId);

  const { name } = validatedSubDepartment || {};
  if (!name) {
    throw createError("Sub department name is required.", 400);
  }

  const headNames = await resolveHeadNames({
    headEmployeeIds: body.headEmployeeIds,
    fallbackHeadNames: body.headNames,
  });

  const row = await Department.findById(departmentId);
  if (!row) throw createError("Department not found", 404);

  const sub = findSubDepartmentNode(row.subDepartments || [], subId);
  if (!sub) throw createError("Sub department not found", 404);

  if (hasDuplicateSubDepartment(sub.siblings || [], name, sub.node._id)) {
    throw createError("Sub department already exists in this department", 409);
  }

  sub.node.name = name;
  sub.node.headNames = headNames;
  await row.save();

  return sub.node;
};

const deleteSubDepartmentService = async (departmentId, subId, access) => {
  await assertCanAccessDepartment(access, departmentId);

  const row = await Department.findById(departmentId);
  if (!row) throw createError("Department not found", 404);

  const sub = findSubDepartmentNode(row.subDepartments || [], subId);
  if (!sub) throw createError("Sub department not found", 404);

  sub.siblings.splice(sub.index, 1);
  await row.save();

  return { success: true };
};

module.exports = {
  createDepartmentService,
  createSubDepartmentService,
  deleteDepartmentService,
  deleteSubDepartmentService,
  findDuplicateDepartment,
  listDepartmentsService,
  listSubDepartmentsService,
  resolveHeadNames,
  updateDepartmentService,
  updateSubDepartmentService,
};
