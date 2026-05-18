const ExcelJS = require("exceljs");
const Checklist = require("../models/Checklist");
const ChecklistTask = require("../models/ChecklistTask");
const Department = require("../models/Department");
const Employee = require("../models/Employee");
const Site = require("../models/Site");
const {
  buildDepartmentScopeFilter,
  buildEmployeeScopeFilter,
  buildSiteScopeFilter,
  isAllScope,
  resolveAccessibleEmployeeIds,
} = require("./accessScope.service");
const {
  TASK_TIMELINESS_STATUSES,
  checklistTaskPopulateQuery,
  isValidObjectId,
  parseDateBoundary,
} = require("./checklistWorkflow.service");
const {
  CHECKLIST_TASK_REPORT_EXCEL_SHEET_NAME,
  applyChecklistTaskReportExcelStyles,
  buildChecklistTaskReportPdfBuffer,
  buildChecklistTaskReportRow,
  checklistTaskReportExcelColumns,
  normalizeText,
} = require("../helpers/checklistReport.helper");

const mergeQueryFilters = (...filters) => {
  const activeFilters = filters.filter(
    (filter) => filter && typeof filter === "object" && Object.keys(filter).length
  );

  if (!activeFilters.length) return {};
  if (activeFilters.length === 1) return activeFilters[0];
  return { $and: activeFilters };
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeIdList = (value) =>
  (Array.isArray(value) ? value : value ? [value] : [])
    .map((item) => normalizeText(item?._id || item))
    .filter(Boolean);

const toPlainObject = (value) => {
  if (!value) return {};
  if (typeof value.toObject === "function") {
    return value.toObject({ depopulate: false, virtuals: false });
  }
  return value;
};

const findNestedDepartmentNode = (rows = [], nodeId, trail = []) => {
  const targetId = normalizeText(nodeId);
  if (!targetId) return null;

  for (const row of rows || []) {
    const nextTrail = [...trail, normalizeText(row?.name)].filter(Boolean);

    if (normalizeText(row?._id) === targetId) {
      return {
        _id: targetId,
        name: normalizeText(row?.name),
        path: nextTrail.join(" > "),
      };
    }

    const child = findNestedDepartmentNode(row?.children || [], targetId, nextTrail);
    if (child) return child;
  }

  return null;
};

const getEmployeeDepartmentRows = (employee = {}) =>
  (Array.isArray(employee.department)
    ? employee.department
    : employee.department
    ? [employee.department]
    : []
  ).filter(Boolean);

const getEmployeeDepartmentDetails = (employee = {}) =>
  getEmployeeDepartmentRows(employee)
    .map((department) => ({
      _id: normalizeText(department?._id || department),
      name: normalizeText(department?.name),
      headNames: Array.isArray(department?.headNames) ? department.headNames : [],
    }))
    .filter((department) => department._id || department.name);

const getEmployeeSubDepartmentDetails = (employee = {}) => {
  const departmentRows = getEmployeeDepartmentRows(employee);

  return normalizeIdList(employee.subDepartment)
    .map((subDepartmentId) => {
      for (const department of departmentRows) {
        const match = findNestedDepartmentNode(department?.subDepartments || [], subDepartmentId);
        if (!match) continue;

        return {
          _id: subDepartmentId,
          departmentId: normalizeText(department?._id || department),
          departmentName: normalizeText(department?.name),
          name: match.name,
          path:
            normalizeText(department?.name) && match.path
              ? `${normalizeText(department.name)} > ${match.path}`
              : match.path || match.name,
        };
      }

      return null;
    })
    .filter(Boolean);
};

const mapChecklistReportEmployee = (employeeDoc) => {
  const employee = toPlainObject(employeeDoc);
  const departmentDetails = getEmployeeDepartmentDetails(employee);
  const subDepartmentDetails = getEmployeeSubDepartmentDetails(employee);
  const departmentNames = departmentDetails.map((department) => department.name).filter(Boolean);
  const subDepartmentNames = subDepartmentDetails
    .map((subDepartment) => subDepartment.name)
    .filter(Boolean);
  const subDepartmentPaths = subDepartmentDetails
    .map((subDepartment) => subDepartment.path)
    .filter(Boolean);

  return {
    ...employee,
    departmentIds: departmentDetails.map((department) => department._id).filter(Boolean),
    departmentDetails,
    departmentName: departmentNames.join(", "),
    departmentDisplay: departmentNames.join(", "),
    subDepartment: normalizeIdList(employee.subDepartment),
    subDepartmentDetails,
    subDepartmentNames,
    subDepartmentPaths,
    subDepartmentName: subDepartmentNames.join(", "),
    subDepartmentPath: subDepartmentPaths.join(", "),
    subDepartmentDisplay: subDepartmentPaths.join(", "),
  };
};

const extractFilterIds = (filter = {}) =>
  filter?._id?.$in ? normalizeIdList(filter._id.$in) : [];

const loadChecklistTaskReportOptions = async (access = {}) => {
  const employeeFilter = await buildEmployeeScopeFilter(access || {});
  const employees = await Employee.find({
    ...employeeFilter,
    isActive: true,
  })
    .populate("department", "name subDepartments headNames")
    .populate("superiorEmployee", "employeeCode employeeName")
    .populate("sites", "name companyName subSites")
    .sort({ employeeCode: 1, employeeName: 1 });

  if (isAllScope(access || {})) {
    const [departments, sites] = await Promise.all([
      Department.find({ isActive: { $ne: false } }).sort({ name: 1 }),
      Site.find({ isActive: { $ne: false } }).sort({ companyName: 1, name: 1 }),
    ]);

    return { employees: employees.map(mapChecklistReportEmployee), departments, sites };
  }

  const [departmentScopeFilter, siteScopeFilter] = await Promise.all([
    buildDepartmentScopeFilter(access || {}),
    buildSiteScopeFilter(access || {}),
  ]);
  const employeeDepartmentIds = normalizeIdList(
    employees.flatMap((employee) => employee?.department || [])
  );
  const employeeSiteIds = normalizeIdList(
    employees.flatMap((employee) => employee?.sites || [])
  );
  const departmentIds = normalizeIdList([
    ...employeeDepartmentIds,
    ...extractFilterIds(departmentScopeFilter),
  ]);
  const siteIds = normalizeIdList([
    ...employeeSiteIds,
    ...extractFilterIds(siteScopeFilter),
  ]);
  const [departments, sites] = await Promise.all([
    departmentIds.length
      ? Department.find({
          _id: { $in: departmentIds },
          isActive: { $ne: false },
        }).sort({ name: 1 })
      : Promise.resolve([]),
    siteIds.length
      ? Site.find({
          _id: { $in: siteIds },
          isActive: { $ne: false },
        }).sort({ companyName: 1, name: 1 })
      : Promise.resolve([]),
  ]);

  return { employees: employees.map(mapChecklistReportEmployee), departments, sites };
};

const getTaskFilters = (query = {}) => {
  const search = normalizeText(query.search);
  const status = normalizeText(query.status).toLowerCase();
  const scheduleType = normalizeText(query.scheduleType).toLowerCase();
  const rawTimingStatus = normalizeText(
    query.submissionTimingStatus || query.timelinessStatus
  ).toLowerCase();
  const submissionTimingStatus =
    rawTimingStatus === "advanced"
      ? "advance"
      : rawTimingStatus === "delay"
      ? "delayed"
      : rawTimingStatus;
  const legacyTimelinessStatus =
    submissionTimingStatus === "advance"
      ? "advanced"
      : submissionTimingStatus === "delayed"
      ? "delay"
      : submissionTimingStatus;
  const filter = {};

  if (search) {
    filter.$or = [
      { taskNumber: { $regex: escapeRegex(search), $options: "i" } },
      { checklistNumber: { $regex: escapeRegex(search), $options: "i" } },
      { checklistName: { $regex: escapeRegex(search), $options: "i" } },
    ];
  }

  if (status) {
    filter.status = status;
  }

  if (scheduleType) {
    filter.scheduleType = scheduleType;
  }

  if (["pending", "advance", "on_time", "delayed"].includes(submissionTimingStatus)) {
    filter.$and = [
      ...(Array.isArray(filter.$and) ? filter.$and : []),
      {
        $or: [
          { submissionTimingStatus },
          ...(TASK_TIMELINESS_STATUSES.includes(legacyTimelinessStatus)
            ? [{ timelinessStatus: legacyTimelinessStatus }]
            : []),
        ],
      },
    ];
  }

  return filter;
};

const buildChecklistTaskReportFilter = async (query = {}) => {
  const filter = getTaskFilters(query);
  const assignedEmployee = normalizeText(query.assignedEmployee);
  const approverEmployee = normalizeText(query.approverEmployee);
  const companyName = normalizeText(query.companyName);
  const siteId = normalizeText(query.siteId || query.site);
  const department = normalizeText(query.department);
  const subDepartment = normalizeText(query.subDepartment);
  const fromDateRaw = normalizeText(query.fromDate);
  const toDateRaw = normalizeText(query.toDate);

  if (approverEmployee) {
    filter.currentApprovalEmployee = approverEmployee;
  }

  const fromDate = parseDateBoundary(fromDateRaw, "start");
  const toDate = parseDateBoundary(toDateRaw, "end");

  if (fromDateRaw && !fromDate) {
    return { error: "Invalid from date filter", status: 400 };
  }

  if (toDateRaw && !toDate) {
    return { error: "Invalid to date filter", status: 400 };
  }

  if (fromDate && toDate && fromDate > toDate) {
    return { error: "From date cannot be greater than to date", status: 400 };
  }

  if (fromDate || toDate) {
    filter.occurrenceDate = {};
    if (fromDate) filter.occurrenceDate.$gte = fromDate;
    if (toDate) filter.occurrenceDate.$lte = toDate;
  }

  if (companyName || siteId) {
    if (siteId && !isValidObjectId(siteId)) {
      return { filter: null };
    }

    const siteFilter = {};
    if (companyName) {
      siteFilter.companyName = companyName;
    }
    if (siteId) {
      siteFilter._id = siteId;
    }

    const matchingSites = await Site.find(siteFilter, "_id").lean();

    if (!matchingSites.length) {
      return { filter: null };
    }

    const matchingChecklists = await Checklist.find(
      {
        employeeAssignedSite: { $in: matchingSites.map((site) => site._id) },
      },
      "_id"
    ).lean();

    if (!matchingChecklists.length) {
      return { filter: null };
    }

    filter.checklist = {
      $in: matchingChecklists.map((checklist) => checklist._id),
    };
  }

  if (department || subDepartment) {
    const employeeFilter = {};

    if (assignedEmployee) {
      employeeFilter._id = assignedEmployee;
    }

    if (department) {
      employeeFilter.department = department;
    }

    if (subDepartment) {
      employeeFilter.subDepartment = subDepartment;
    }

    const matchingEmployees = await Employee.find(employeeFilter, "_id").lean();

    if (!matchingEmployees.length) {
      return { filter: null };
    }

    filter.assignedEmployee = {
      $in: matchingEmployees.map((employee) => employee._id),
    };
  } else if (assignedEmployee) {
    filter.assignedEmployee = assignedEmployee;
  }

  return { filter };
};

const buildChecklistTaskReportScopeFilter = async (access = {}) => {
  if (isAllScope(access || {})) {
    return {};
  }

  const employeeIds = await resolveAccessibleEmployeeIds(access || {});

  return employeeIds.length
    ? { assignedEmployee: { $in: employeeIds } }
    : { _id: null };
};

const loadChecklistTaskReportRows = async (query = {}, access = {}) => {
  const filterResult = await buildChecklistTaskReportFilter(query);

  if (filterResult?.error) {
    return filterResult;
  }

  if (filterResult?.filter === null) {
    return { tasks: [] };
  }

  const scopeFilter = await buildChecklistTaskReportScopeFilter(access);
  if (scopeFilter?._id === null) {
    return { tasks: [] };
  }

  const tasks = await ChecklistTask.find(
    mergeQueryFilters(filterResult.filter, scopeFilter)
  )
    .populate(checklistTaskPopulateQuery)
    .sort({ occurrenceDate: -1, createdAt: -1 });

  return { tasks };
};

const buildChecklistTaskReportWorkbook = (tasks = []) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Check List Workspace";

  const worksheet = workbook.addWorksheet(CHECKLIST_TASK_REPORT_EXCEL_SHEET_NAME);
  worksheet.columns = checklistTaskReportExcelColumns;
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: checklistTaskReportExcelColumns.length },
  };

  tasks.forEach((task, index) => {
    worksheet.addRow(buildChecklistTaskReportRow(task, index));
  });
  applyChecklistTaskReportExcelStyles(worksheet);

  return workbook;
};

module.exports = {
  buildChecklistTaskReportPdfBuffer,
  buildChecklistTaskReportWorkbook,
  loadChecklistTaskReportOptions,
  loadChecklistTaskReportRows,
};
