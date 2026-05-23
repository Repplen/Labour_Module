const Employee = require("../models/Employee");
const Department = require("../models/Department");
const Site = require("../models/Site");
const NatureOfWork = require("../models/NatureOfWork");
const Uom = require("../models/Uom");
const ExcelJS = require("exceljs");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { Types } = require("mongoose");
const {
  buildEmployeeScopeFilter,
  isAllScope,
  resolveAccessibleEmployeeIds,
} = require("../services/accessScope.service");
const {
  normalizeEmployeeCode,
  normalizeEmployeeEmail,
  normalizeEmployeeMobile,
} = require("../utils/employeeContactNormalization");
const {
  EMPLOYEE_SKILL_TYPES,
  EMPLOYEE_WORK_TYPES,
  LABOUR_RATE_TYPES,
  PIECE_WORKER_RATE_TYPES,
  calculateEmployeeWorkRates,
  createEmployeeWorkError,
  normalizeOptionalObjectId,
  normalizeText,
  toBoolean,
} = require("../helpers/employeeWorkRate.helper");

const normalizeSites = (value) =>
  Array.isArray(value) ? value : value ? [value] : [];
const duplicateEmployeeMessage = "Duplicate employee data found";
const duplicateEmployeeFieldMessages = {
  employeeCode: "This employee code already exists.",
  email: "This email ID already exists.",
  mobile: "This mobile number already exists.",
};
const qrFieldKeys = ["qrToken", "qrCodeUrl", "qrGeneratedAt", "qrEnabled"];
const stripQrFields = (value = {}) => {
  const nextValue = { ...value };
  qrFieldKeys.forEach((fieldKey) => {
    delete nextValue[fieldKey];
  });
  return nextValue;
};

const normalizeIdList = (value) => {
  const rawValues = Array.isArray(value) ? value : value ? [value] : [];
  const seen = new Set();

  return rawValues
    .map((item) => String(item?._id || item || "").trim())
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
};

const normalizeDocumentList = (value) =>
  (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean);

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildExactTrimmedRegex = (value, options = "") =>
  new RegExp(`^\\s*${escapeRegExp(value)}\\s*$`, options);

const buildWhitespaceAgnosticMobileRegex = (mobile) =>
  new RegExp(`^\\s*${[...mobile].map(escapeRegExp).join("[\\s-]*")}\\s*$`);

const buildDuplicateEmployeeError = (field) => ({
  field,
  message: duplicateEmployeeFieldMessages[field],
});

const sendDuplicateEmployeeResponse = (res, errors) =>
  res.status(409).json({
    success: false,
    message: duplicateEmployeeMessage,
    errors,
  });

const getDuplicateKeyEmployeeErrors = (error) => {
  if (error?.code !== 11000) return [];

  const duplicateFields = new Set([
    ...Object.keys(error.keyPattern || {}),
    ...Object.keys(error.keyValue || {}),
  ]);

  return ["employeeCode", "email", "mobile"]
    .filter((field) => duplicateFields.has(field))
    .map(buildDuplicateEmployeeError);
};

const findDuplicateEmployeeErrors = async (employeeData = {}, currentEmployeeId = null) => {
  const employeeCode = normalizeEmployeeCode(employeeData.employeeCode);
  const email = normalizeEmployeeEmail(employeeData.email);
  const mobile = normalizeEmployeeMobile(employeeData.mobile);
  const duplicateFilters = [];

  if (employeeCode) {
    duplicateFilters.push({ employeeCode: { $regex: buildExactTrimmedRegex(employeeCode) } });
  }

  if (email) {
    duplicateFilters.push({ email: { $regex: buildExactTrimmedRegex(email, "i") } });
  }

  if (mobile) {
    duplicateFilters.push({ mobile: { $regex: buildWhitespaceAgnosticMobileRegex(mobile) } });
  }

  if (!duplicateFilters.length) {
    return {
      errors: [],
      normalizedValues: { employeeCode, email, mobile },
    };
  }

  const filter = { $or: duplicateFilters };

  if (currentEmployeeId) {
    filter._id = { $ne: currentEmployeeId };
  }

  const duplicateRows = await Employee.find(filter, "employeeCode email mobile").lean();
  const errors = [];

  if (
    employeeCode &&
    duplicateRows.some(
      (employee) => normalizeEmployeeCode(employee.employeeCode) === employeeCode
    )
  ) {
    errors.push(buildDuplicateEmployeeError("employeeCode"));
  }

  if (
    email &&
    duplicateRows.some((employee) => normalizeEmployeeEmail(employee.email) === email)
  ) {
    errors.push(buildDuplicateEmployeeError("email"));
  }

  if (
    mobile &&
    duplicateRows.some((employee) => normalizeEmployeeMobile(employee.mobile) === mobile)
  ) {
    errors.push(buildDuplicateEmployeeError("mobile"));
  }

  return {
    errors,
    normalizedValues: { employeeCode, email, mobile },
  };
};

const applyNormalizedEmployeeContactFields = (target, normalizedValues = {}) => {
  if (Object.prototype.hasOwnProperty.call(target, "employeeCode")) {
    target.employeeCode = normalizedValues.employeeCode || undefined;
  }

  if (Object.prototype.hasOwnProperty.call(target, "email")) {
    target.email = normalizedValues.email || undefined;
  }

  if (Object.prototype.hasOwnProperty.call(target, "mobile")) {
    target.mobile = normalizedValues.mobile || undefined;
  }

  return target;
};

const isSubDepartmentMatch = (row, subDepartmentRef) =>
  String(row?._id) === String(subDepartmentRef) ||
  String(row?.name || "").trim().toLowerCase() ===
    String(subDepartmentRef || "").trim().toLowerCase();

const findSubDepartmentById = (rows = [], subDepartmentId) => {
  for (const row of rows) {
    if (String(row._id) === String(subDepartmentId)) return row;
    const child = findSubDepartmentById(row.children || [], subDepartmentId);
    if (child) return child;
  }
  return null;
};

const findSubDepartmentTrail = (rows = [], subDepartmentRef, trail = []) => {
  for (const row of rows) {
    const nextTrail = [...trail, row.name];
    if (isSubDepartmentMatch(row, subDepartmentRef)) return nextTrail;

    const childTrail = findSubDepartmentTrail(row.children || [], subDepartmentRef, nextTrail);
    if (childTrail) return childTrail;
  }

  return null;
};

const findSubDepartmentName = (department, subDepartmentRef) => {
  if (!department || !subDepartmentRef) return "";
  const trail = findSubDepartmentTrail(department.subDepartments || [], subDepartmentRef);
  return trail?.[trail.length - 1] || "";
};

const findSubDepartmentPath = (department, subDepartmentRef) => {
  if (!department || !subDepartmentRef) return "";
  const trail = findSubDepartmentTrail(department.subDepartments || [], subDepartmentRef);
  return trail?.join(" > ") || "";
};

const findSubDepartmentDetails = (departments, subDepartmentRefs) =>
  normalizeIdList(subDepartmentRefs)
    .map((subDepartmentRef) => {
      for (const department of normalizeDocumentList(departments)) {
        const name = findSubDepartmentName(department, subDepartmentRef);
        const path = findSubDepartmentPath(department, subDepartmentRef);

        if (!name && !path) continue;

        return {
          _id: subDepartmentRef,
          departmentId: String(department._id || ""),
          departmentName: department.name || "",
          name,
          path:
            department.name && (path || name)
              ? `${department.name} > ${path || name}`
              : path || name,
        };
      }

      return null;
    })
    .filter(Boolean);

const buildDepartmentDetails = (departments) =>
  normalizeDocumentList(departments).map((department) => ({
    _id: String(department._id || ""),
    name: department.name || "",
    headNames: department.headNames || [],
  }));

const findSubSiteById = (rows = [], subSiteId) => {
  for (const row of rows) {
    if (String(row._id) === String(subSiteId)) return row;
    const child = findSubSiteById(row.children || [], subSiteId);
    if (child) return child;
  }
  return null;
};

const findSubSiteTrail = (rows = [], subSiteId, trail = []) => {
  for (const row of rows) {
    const nextTrail = [...trail, row.name];
    if (String(row._id) === String(subSiteId)) return nextTrail;

    const childTrail = findSubSiteTrail(row.children || [], subSiteId, nextTrail);
    if (childTrail) return childTrail;
  }
  return null;
};

const formatEmployeeDisplayName = (employee) => {
  if (!employee) return "";
  const code = String(employee.employeeCode || "").trim();
  const name = String(employee.employeeName || "").trim();
  if (code && name) return `${code} - ${name}`;
  return code || name;
};

const formatSiteDisplayName = (site) => {
  if (!site) return "";
  const companyName = String(site.companyName || "").trim();
  const name = String(site.name || "").trim();
  if (companyName && name) return `${companyName} - ${name}`;
  return name || companyName;
};

const normalizePublicBaseUrl = (value) => {
  const normalizedValue = String(value || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalizedValue)) return "";
  return normalizedValue.replace(/\/api$/i, "");
};

const getRequestPublicBaseUrl = (req) =>
  normalizePublicBaseUrl(
    req.body?.publicBaseUrl ||
      req.body?.baseUrl ||
      process.env.PUBLIC_APP_URL ||
      process.env.APP_BASE_URL ||
      process.env.FRONTEND_URL ||
      req.headers.origin ||
      `${req.protocol}://${req.get("host")}`
  );

const buildQrCodeUrl = (req, qrToken) => {
  const publicBaseUrl = getRequestPublicBaseUrl(req);
  return `${publicBaseUrl || ""}/employee-qr/${encodeURIComponent(qrToken)}`;
};

const generateQrTokenValue = () =>
  crypto
    .randomBytes(24)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const createUniqueEmployeeQrToken = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = generateQrTokenValue();
    // eslint-disable-next-line no-await-in-loop
    const existingEmployee = await Employee.exists({ qrToken: token });
    if (!existingEmployee) return token;
  }

  const error = new Error("Failed to generate a unique employee QR token");
  error.status = 500;
  throw error;
};

const parseSubSitesPayload = (rawValue) => {
  if (rawValue === undefined || rawValue === null || rawValue === "") return [];

  let parsed = rawValue;

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      const error = new Error("Sub sites payload must be valid JSON");
      error.status = 400;
      throw error;
    }
  }

  if (!Array.isArray(parsed)) {
    const error = new Error("Sub sites payload must be an array");
    error.status = 400;
    throw error;
  }

  return parsed
    .map((row) => ({
      site: String(row?.site || "").trim(),
      subSite: String(row?.subSite || "").trim(),
    }))
    .filter((row) => row.site && row.subSite);
};

const validateSubSites = async (siteIds, rawSubSites) => {
  const subSiteRows = parseSubSitesPayload(rawSubSites);
  if (!subSiteRows.length) return [];

  const selectedSiteIds = new Set((siteIds || []).map((id) => String(id)));
  const hasInvalidSiteSelection = subSiteRows.some(
    (row) => !selectedSiteIds.has(String(row.site))
  );

  if (hasInvalidSiteSelection) {
    const error = new Error("Selected sub sites must belong to selected sites");
    error.status = 400;
    throw error;
  }

  const uniqueSiteIds = [...new Set(subSiteRows.map((row) => String(row.site)))];
  const siteRows = await Site.find(
    { _id: { $in: uniqueSiteIds } },
    "name subSites"
  );
  const siteMap = new Map(siteRows.map((row) => [String(row._id), row]));

  const dedupe = new Set();
  const normalized = [];

  for (const row of subSiteRows) {
    const site = siteMap.get(String(row.site));
    if (!site) {
      const error = new Error("One or more selected sites do not exist");
      error.status = 400;
      throw error;
    }

    const hasSubSite = !!findSubSiteById(site.subSites || [], row.subSite);
    if (!hasSubSite) {
      const error = new Error("One or more selected sub sites are invalid");
      error.status = 400;
      throw error;
    }

    const key = `${row.site}:${row.subSite}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);

    normalized.push({
      site: row.site,
      subSite: row.subSite,
    });
  }

  return normalized;
};

const validateDepartmentAndSubDepartment = async (departmentId, subDepartmentId) => {
  const normalizedDepartmentIds = normalizeIdList(departmentId);
  const normalizedSubDepartmentIds = normalizeIdList(subDepartmentId);
  if (!normalizedDepartmentIds.length) {
    const error = new Error("At least one department is required");
    error.status = 400;
    throw error;
  }

  const departmentRows = await Department.find(
    { _id: { $in: normalizedDepartmentIds } },
    "name subDepartments"
  );

  if (departmentRows.length !== normalizedDepartmentIds.length) {
    const error = new Error("One or more selected departments are invalid");
    error.status = 400;
    throw error;
  }

  if (!normalizedSubDepartmentIds.length) {
    return {
      department: normalizedDepartmentIds,
      subDepartment: [],
    };
  }

  for (const subDepartmentRef of normalizedSubDepartmentIds) {
    const isValid = departmentRows.some((department) =>
      !!findSubDepartmentById(department.subDepartments || [], subDepartmentRef)
    );

    if (!isValid) {
      const error = new Error(
        "Selected sub department does not belong to selected department"
      );
      error.status = 400;
      throw error;
    }
  }

  return {
    department: normalizedDepartmentIds,
    subDepartment: normalizedSubDepartmentIds,
  };
};

const validateSuperiorEmployee = async (superiorEmployeeId, employeeId = null) => {
  const normalizedId = String(superiorEmployeeId || "").trim();
  if (!normalizedId) return null;

  if (employeeId && String(normalizedId) === String(employeeId)) {
    const error = new Error("Employee cannot be assigned as their own superior");
    error.status = 400;
    throw error;
  }

  const superior = await Employee.findById(normalizedId, "_id");
  if (!superior) {
    const error = new Error("Selected superior employee does not exist");
    error.status = 400;
    throw error;
  }

  return normalizedId;
};

const toOptionalNonNegativeNumber = (value, { field, message }) => {
  if (value === "" || value === null || typeof value === "undefined") return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw createEmployeeWorkError(message, 400, field);
  }
  return numericValue;
};

const toRequiredNonNegativeNumber = (value, { field, message }) => {
  if (value === "" || value === null || typeof value === "undefined") {
    throw createEmployeeWorkError(message, 400, field);
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw createEmployeeWorkError(message, 400, field);
  }
  return numericValue;
};

const toOptionalDate = (value) => {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return null;
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) {
    throw createEmployeeWorkError("Rate effective date must be valid", 400, "rateEffectiveFrom");
  }
  return date;
};

const getNatureOfWorkSnapshot = async ({ natureOfWorkId, subNatureOfWorkId, required = false }) => {
  const normalizedNatureId = normalizeOptionalObjectId(natureOfWorkId);
  const normalizedSubNatureId = normalizeOptionalObjectId(subNatureOfWorkId);
  const targetNatureId = normalizedSubNatureId || normalizedNatureId;

  if (!targetNatureId) {
    if (required) {
      throw createEmployeeWorkError("Nature of work is required.", 400, "natureOfWorkId");
    }
    return {
      natureOfWorkId: null,
      natureOfWorkPath: "",
      subNatureOfWorkId: null,
      subNatureOfWorkPath: "",
    };
  }

  const selectedWork = await NatureOfWork.findOne({
    _id: targetNatureId,
    isActive: true,
    isDeleted: { $ne: true },
  }).lean();

  if (!selectedWork) {
    throw createEmployeeWorkError("Nature of work is required.", 400, "natureOfWorkId");
  }

  let parentWork = null;
  if (normalizedNatureId && normalizedNatureId !== targetNatureId) {
    parentWork = await NatureOfWork.findOne({
      _id: normalizedNatureId,
      isActive: true,
      isDeleted: { $ne: true },
    }).lean();
  }

  return {
    natureOfWorkId: parentWork?._id || selectedWork._id,
    natureOfWorkPath: parentWork?.path || selectedWork.path || selectedWork.workName || "",
    subNatureOfWorkId: parentWork ? selectedWork._id : null,
    subNatureOfWorkPath: parentWork ? selectedWork.path || selectedWork.workName || "" : "",
  };
};

const getUomSnapshot = async ({ uomId, required = false }) => {
  const normalizedUomId = normalizeOptionalObjectId(uomId);
  if (!normalizedUomId) {
    if (required) throw createEmployeeWorkError("UOM is required.", 400, "uomId");
    return {
      uomId: null,
      uomName: "",
      uomSymbol: "",
    };
  }

  const uom = await Uom.findOne({
    _id: normalizedUomId,
    isActive: true,
    isDeleted: { $ne: true },
  }).lean();

  if (!uom) throw createEmployeeWorkError("UOM is required.", 400, "uomId");

  return {
    uomId: uom._id,
    uomName: uom.uomName,
    uomSymbol: uom.symbol || "",
  };
};

const normalizeEmployeeWorkPayload = async (payload = {}) => {
  const employeeWorkType = normalizeText(payload.employeeWorkType) || "General Employee";
  if (!EMPLOYEE_WORK_TYPES.includes(employeeWorkType)) {
    throw createEmployeeWorkError("Employee work type is required.", 400, "employeeWorkType");
  }

  const emptyWorkPayload = {
    employeeWorkType: "General Employee",
    skillType: "",
    natureOfWorkId: null,
    natureOfWorkPath: "",
    subNatureOfWorkId: null,
    subNatureOfWorkPath: "",
    uomId: null,
    uomName: "",
    uomSymbol: "",
    rateType: "",
    standardRate: null,
    overtimeRate: null,
    pieceRate: null,
    gstApplicable: false,
    gstPercent: null,
    gstAmount: null,
    grossRate: null,
    netRate: null,
    rateEffectiveFrom: null,
    rateEffectiveTo: null,
    rateRemarks: "",
  };

  if (employeeWorkType === "General Employee") return emptyWorkPayload;

  const skillType = normalizeText(payload.skillType);
  const rateType = normalizeText(payload.rateType);
  const gstApplicable = toBoolean(payload.gstApplicable);
  const allowedRateTypes =
    employeeWorkType === "Piece Worker" ? PIECE_WORKER_RATE_TYPES : LABOUR_RATE_TYPES;

  if (employeeWorkType === "Labour" && !skillType) {
    throw createEmployeeWorkError("Skill / work nature is required.", 400, "skillType");
  }
  if (skillType && !EMPLOYEE_SKILL_TYPES.includes(skillType)) {
    throw createEmployeeWorkError("Skill / work nature is required.", 400, "skillType");
  }
  if (!rateType || !allowedRateTypes.includes(rateType)) {
    throw createEmployeeWorkError("Rate type is required.", 400, "rateType");
  }

  const standardRate = toRequiredNonNegativeNumber(payload.standardRate, {
    field: "standardRate",
    message: "Standard rate must be a positive number.",
  });
  const overtimeRate = toOptionalNonNegativeNumber(payload.overtimeRate, {
    field: "overtimeRate",
    message: "Overtime rate must be zero or positive.",
  });
  const pieceRate = toOptionalNonNegativeNumber(payload.pieceRate, {
    field: "pieceRate",
    message: "Piece rate must be zero or positive.",
  });

  let gstPercent = null;
  if (gstApplicable) {
    gstPercent = toRequiredNonNegativeNumber(payload.gstPercent, {
      field: "gstPercent",
      message: "GST percentage must be between 0 and 100.",
    });
    if (gstPercent < 0 || gstPercent > 100) {
      throw createEmployeeWorkError("GST percentage must be between 0 and 100.", 400, "gstPercent");
    }
  }

  const natureSnapshot = await getNatureOfWorkSnapshot({
    natureOfWorkId: payload.natureOfWorkId,
    subNatureOfWorkId: payload.subNatureOfWorkId,
    required: employeeWorkType === "Piece Worker",
  });
  const uomSnapshot = await getUomSnapshot({
    uomId: payload.uomId,
    required: employeeWorkType === "Piece Worker",
  });

  return {
    employeeWorkType,
    skillType: employeeWorkType === "Labour" ? skillType : "",
    ...natureSnapshot,
    ...uomSnapshot,
    rateType,
    standardRate,
    overtimeRate: employeeWorkType === "Labour" ? overtimeRate : null,
    pieceRate: employeeWorkType === "Piece Worker" ? pieceRate : null,
    gstApplicable,
    gstPercent,
    ...calculateEmployeeWorkRates({ standardRate, gstApplicable, gstPercent }),
    rateEffectiveFrom: toOptionalDate(payload.rateEffectiveFrom),
    rateEffectiveTo: toOptionalDate(payload.rateEffectiveTo),
    rateRemarks: normalizeText(payload.rateRemarks),
  };
};

const mapSubSitesForEmployee = (employee) => {
  const siteRows = employee.sites || [];
  const subSiteRows = employee.subSites || [];

  return subSiteRows
    .map((row) => {
      const siteId = row.site?._id || row.site;
      const subSiteId = row.subSite?._id || row.subSite;
      const site = siteRows.find((item) => String(item._id) === String(siteId));
      if (!site) return null;

      const trail = findSubSiteTrail(site.subSites || [], subSiteId);
      if (!trail) return null;

      return {
        siteId: String(site._id),
        siteName: formatSiteDisplayName(site),
        subSiteId: String(subSiteId),
        subSiteName: trail[trail.length - 1] || "",
        subSitePath: `${formatSiteDisplayName(site)} > ${trail.join(" > ")}`,
      };
    })
    .filter(Boolean);
};

const mapEmployee = (employeeDoc) => {
  const employee = employeeDoc.toObject ? employeeDoc.toObject() : employeeDoc;
  const safeEmployee = { ...employee };
  delete safeEmployee.password;
  delete safeEmployee.qrToken;
  const departmentDetails = buildDepartmentDetails(employee.department);
  const departmentNames = departmentDetails.map((row) => row.name).filter(Boolean);
  const subSiteDetails = mapSubSitesForEmployee(employee);
  const subSitePaths = subSiteDetails.map((row) => row.subSitePath);
  const subDepartmentDetails = findSubDepartmentDetails(
    employee.department,
    employee.subDepartment
  );
  const subDepartmentNames = subDepartmentDetails.map((row) => row.name).filter(Boolean);
  const subDepartmentPaths = subDepartmentDetails.map((row) => row.path).filter(Boolean);

  return {
    ...safeEmployee,
    departmentIds: normalizeIdList(employee.department),
    departmentDetails,
    departmentName: departmentNames.join(", "),
    departmentDisplay: departmentNames.join(", "),
    subDepartment: normalizeIdList(employee.subDepartment),
    superiorEmployeeName: formatEmployeeDisplayName(employee.superiorEmployee),
    subDepartmentDetails,
    subDepartmentNames,
    subDepartmentPaths,
    subDepartmentName: subDepartmentNames.join(", "),
    subDepartmentPath: subDepartmentPaths.join(", "),
    subDepartmentDisplay: subDepartmentPaths.join(", "),
    subSiteDetails,
    subSitePaths,
    subSiteDisplay: subSitePaths.join(", "),
  };
};

const getEmployeePhotoUrl = (req, employee = {}) => {
  const photo = String(employee?.photo || "").trim();
  if (!photo) return "";

  const publicBaseUrl = normalizePublicBaseUrl(
    process.env.PUBLIC_API_URL ||
      process.env.API_BASE_URL ||
      `${req.protocol}://${req.get("host")}`
  );

  return `${publicBaseUrl}/uploads/${encodeURIComponent(photo)}`;
};

const buildSafeEmployeeQrProfile = (req, employeeDoc) => {
  const employee = mapEmployee(employeeDoc);
  const siteRows = Array.isArray(employee.sites) ? employee.sites : [];
  const companyNames = [
    ...new Set(
      siteRows
        .map((site) => String(site?.companyName || "").trim())
        .filter(Boolean)
    ),
  ];

  return {
    employeeCode: employee.employeeCode || "",
    employeeName: employee.employeeName || "",
    profilePhoto: getEmployeePhotoUrl(req, employee),
    companyName: companyNames.join(", "),
    designation: employee.designation?.name || "",
    department: employee.departmentDisplay || employee.departmentName || "",
    dateOfJoining: employee.dateOfJoining || null,
    mobile: employee.mobile || "",
    status: employee.isActive === false ? "Inactive" : "Active",
    updatedAt: employee.updatedAt || employee.createdAt || null,
  };
};

const findScopedEmployeeById = async (req, employeeId) => {
  if (!isAllScope(req.access || {})) {
    const accessibleEmployeeIds = await resolveAccessibleEmployeeIds(req.access || {});
    if (!accessibleEmployeeIds.includes(String(employeeId || ""))) {
      return null;
    }
  }

  return Employee.findById(employeeId)
    .populate("department", "name subDepartments")
    .populate("designation", "name")
    .populate("superiorEmployee", "employeeCode employeeName")
    .populate("sites", "name companyName subSites");
};

const buildEmployeeQrPayload = (employee = {}) => ({
  employeeId: employee._id,
  employeeCode: employee.employeeCode || "",
  employeeName: employee.employeeName || "",
  qrCodeUrl: employee.qrCodeUrl || "",
  qrGeneratedAt: employee.qrGeneratedAt || null,
  qrEnabled: employee.qrEnabled !== false,
});

const ensureEmployeeQrFields = async (req, employee) => {
  const nextToken = !employee.qrToken ? await createUniqueEmployeeQrToken() : employee.qrToken;
  const qrCodeUrl = buildQrCodeUrl(req, nextToken);

  employee.qrToken = nextToken;
  employee.qrCodeUrl = qrCodeUrl;
  employee.qrGeneratedAt = !employee.qrGeneratedAt ? new Date() : employee.qrGeneratedAt;

  if (typeof employee.qrEnabled !== "boolean") {
    employee.qrEnabled = true;
  }

  await employee.save();
  return employee;
};

exports.getEmployees = async (req, res) => {
  try {
    const {
      search = "",
      status = "",
      department = "",
      employeeWorkType = "",
      skillType = "",
      rateType = "",
    } = req.query;
    const scopeFilter = await buildEmployeeScopeFilter(req.access || {});
    const filter = { ...scopeFilter };

    if (search) {
      filter.$or = [
        { employeeCode: { $regex: search, $options: "i" } },
        { employeeName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
      ];
    }

    if (status === "active") filter.isActive = true;
    if (status === "inactive") filter.isActive = false;
    if (department) filter.department = department;
    if (employeeWorkType) filter.employeeWorkType = employeeWorkType;
    if (skillType) filter.skillType = skillType;
    if (rateType) filter.rateType = rateType;

    const employees = await Employee.find(filter)
      .populate("department", "name subDepartments")
      .populate("designation", "name")
      .populate("superiorEmployee", "employeeCode employeeName")
      .populate("sites", "name companyName subSites")
      .sort({ createdAt: -1 });

    res.json(employees.map(mapEmployee));
  } catch (err) {
    console.error("Get employees error:", err);
    res.status(500).json({ message: "Failed to load employees" });
  }
};

exports.getEmployeeById = async (req, res) => {
  try {
    if (!isAllScope(req.access || {})) {
      const accessibleEmployeeIds = await resolveAccessibleEmployeeIds(req.access || {});
      const isAccessible = accessibleEmployeeIds.includes(String(req.params.id || ""));

      if (!isAccessible) {
        return res.status(403).json({ message: "You do not have access to this employee record" });
      }
    }

    const emp = await Employee.findOne({ _id: req.params.id })
      .populate("department", "name subDepartments")
      .populate("designation", "name")
      .populate("superiorEmployee", "employeeCode employeeName")
      .populate("sites", "name companyName subSites");

    if (!emp) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json(mapEmployee(emp));
  } catch (err) {
    console.error("Get employee by id error:", err);
    res.status(500).json({ message: "Employee not found" });
  }
};

const listEmployeesByWorkType = async (req, res, employeeWorkType) => {
  try {
    const employees = await Employee.find({
      ...(await buildEmployeeScopeFilter(req.access || {})),
      employeeWorkType,
      isActive: true,
    })
      .populate("department", "name subDepartments")
      .populate("designation", "name")
      .populate("superiorEmployee", "employeeCode employeeName")
      .populate("sites", "name companyName subSites")
      .sort({ employeeName: 1, employeeCode: 1 });

    return res.json(employees.map(mapEmployee));
  } catch (err) {
    console.error("Get employees by work type error:", err);
    return res.status(500).json({ message: "Failed to load employees" });
  }
};

exports.getLabourEmployees = async (req, res) =>
  listEmployeesByWorkType(req, res, "Labour");

exports.getPieceWorkerEmployees = async (req, res) =>
  listEmployeesByWorkType(req, res, "Piece Worker");

exports.createEmployee = async (req, res) => {
  try {
    const safeBody = stripQrFields(req.body);
    const rawPassword = String(req.body.password || "").trim();

    if (!rawPassword) {
      return res.status(400).json({ message: "Employee login password is required" });
    }

    if (rawPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Employee login password must be at least 6 characters" });
    }

    const duplicateCheck = await findDuplicateEmployeeErrors(req.body);

    if (duplicateCheck.errors.length) {
      return sendDuplicateEmployeeResponse(res, duplicateCheck.errors);
    }

    applyNormalizedEmployeeContactFields(safeBody, duplicateCheck.normalizedValues);

    const sites = normalizeSites(req.body.sites);
    const departmentSelection = await validateDepartmentAndSubDepartment(
      req.body.department,
      req.body.subDepartment
    );
    const superiorEmployee = await validateSuperiorEmployee(req.body.superiorEmployee);
    const subSites = await validateSubSites(sites, req.body.subSites);
    Object.assign(safeBody, await normalizeEmployeeWorkPayload(req.body));

    const employee = new Employee({
      ...safeBody,
      password: await bcrypt.hash(rawPassword, 10),
      department: departmentSelection.department,
      subDepartment: departmentSelection.subDepartment,
      superiorEmployee: superiorEmployee || null,
      isActive: true,
      sites,
      subSites,
      photo: req.file ? req.file.filename : null,
    });
    employee.qrToken = await createUniqueEmployeeQrToken();
    employee.qrCodeUrl = buildQrCodeUrl(req, employee.qrToken);
    employee.qrGeneratedAt = new Date();
    employee.qrEnabled = true;

    await employee.save();
    res.json({ success: true });
  } catch (err) {
    console.error("Create employee error:", err);
    const duplicateKeyErrors = getDuplicateKeyEmployeeErrors(err);

    if (duplicateKeyErrors.length) {
      return sendDuplicateEmployeeResponse(res, duplicateKeyErrors);
    }

    res.status(err.status || 500).json({
      message: err.message || "Failed to create employee",
      errors: err.errors || [],
    });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const rawPassword = String(req.body.password || "").trim();
    const duplicateCheck = await findDuplicateEmployeeErrors(req.body, req.params.id);

    if (duplicateCheck.errors.length) {
      return sendDuplicateEmployeeResponse(res, duplicateCheck.errors);
    }

    const sites = normalizeSites(req.body.sites);
    const departmentSelection = await validateDepartmentAndSubDepartment(
      req.body.department,
      req.body.subDepartment
    );
    const hasSubSitesField = Object.prototype.hasOwnProperty.call(req.body, "subSites");
    const hasSuperiorEmployeeField = Object.prototype.hasOwnProperty.call(
      req.body,
      "superiorEmployee"
    );
    const superiorEmployee = hasSuperiorEmployeeField
      ? await validateSuperiorEmployee(req.body.superiorEmployee, req.params.id)
      : undefined;
    const subSites = hasSubSitesField
      ? await validateSubSites(sites, req.body.subSites)
      : undefined;

    const data = {
      ...stripQrFields(req.body),
      department: departmentSelection.department,
      subDepartment: departmentSelection.subDepartment,
      sites,
    };
    Object.assign(data, await normalizeEmployeeWorkPayload(req.body));
    applyNormalizedEmployeeContactFields(data, duplicateCheck.normalizedValues);

    delete data.password;

    if (hasSubSitesField) {
      data.subSites = subSites;
    }

    if (hasSuperiorEmployeeField) {
      data.superiorEmployee = superiorEmployee || null;
    }

    if (req.file) {
      data.photo = req.file.filename;
    }

    if (rawPassword) {
      if (rawPassword.length < 6) {
        return res
          .status(400)
          .json({ message: "Employee login password must be at least 6 characters" });
      }

      data.password = await bcrypt.hash(rawPassword, 10);
    }

    await Employee.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json({ success: true });
  } catch (err) {
    console.error("Update employee error:", err);
    const duplicateKeyErrors = getDuplicateKeyEmployeeErrors(err);

    if (duplicateKeyErrors.length) {
      return sendDuplicateEmployeeResponse(res, duplicateKeyErrors);
    }

    res.status(err.status || 500).json({
      message: err.message || "Failed to update employee",
      errors: err.errors || [],
    });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    employee.isActive = false;
    await employee.save();

    res.json({ success: true, isActive: false });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
};

exports.bulkDeleteEmployees = async (req, res) => {
  try {
    const employeeIds = Array.isArray(req.body?.employeeIds)
      ? req.body.employeeIds.map((id) => String(id || "").trim()).filter(Boolean)
      : [];
    const uniqueEmployeeIds = [...new Set(employeeIds)];

    if (!uniqueEmployeeIds.length) {
      return res.status(400).json({ message: "Select at least one employee to delete" });
    }

    if (uniqueEmployeeIds.some((id) => !Types.ObjectId.isValid(id))) {
      return res.status(400).json({ message: "One or more selected employees are invalid" });
    }

    const existingEmployees = await Employee.find(
      { _id: { $in: uniqueEmployeeIds } },
      "_id"
    ).lean();

    if (!existingEmployees.length) {
      return res.status(404).json({ message: "Selected employees were not found" });
    }

    const existingEmployeeIds = existingEmployees.map((employee) => employee._id);

    await Employee.updateMany(
      { _id: { $in: existingEmployeeIds } },
      { $set: { isActive: false } }
    );

    res.json({
      success: true,
      deletedCount: existingEmployeeIds.length,
    });
  } catch (err) {
    console.error("Bulk delete employees error:", err);
    res.status(500).json({ message: "Failed to delete selected employees" });
  }
};

exports.toggleEmployeeStatus = async (req, res) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) {
      return res.status(404).json({ message: "Employee not found" });
    }

    emp.isActive =
      typeof req.body?.isActive === "boolean" ? req.body.isActive : !emp.isActive;
    await emp.save();

    res.json({ success: true, isActive: emp.isActive });
  } catch (err) {
    res.status(500).json({ message: "Status update failed" });
  }
};

exports.getOrCreateEmployeeQr = async (req, res) => {
  try {
    const employee = await findScopedEmployeeById(req, req.params.id);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    await ensureEmployeeQrFields(req, employee);
    return res.json(buildEmployeeQrPayload(employee));
  } catch (err) {
    console.error("Employee QR generation error:", err);
    return res
      .status(err.status || 500)
      .json({ message: err.message || "Failed to generate employee QR code" });
  }
};

exports.updateEmployeeQrAccess = async (req, res) => {
  try {
    const employee = await findScopedEmployeeById(req, req.params.id);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    if (!employee.qrToken) {
      await ensureEmployeeQrFields(req, employee);
    }

    employee.qrEnabled = Boolean(req.body?.qrEnabled);
    if (employee.qrToken && !employee.qrCodeUrl) {
      employee.qrCodeUrl = buildQrCodeUrl(req, employee.qrToken);
    }

    await employee.save();
    return res.json(buildEmployeeQrPayload(employee));
  } catch (err) {
    console.error("Employee QR access update error:", err);
    return res
      .status(err.status || 500)
      .json({ message: err.message || "Failed to update employee QR access" });
  }
};

exports.getEmployeeByQrToken = async (req, res) => {
  try {
    const qrToken = String(req.params.qrToken || "").trim();
    if (!qrToken) {
      return res.status(404).json({ message: "Employee not found or QR code is invalid." });
    }

    const employee = await Employee.findOne({ qrToken })
      .populate("department", "name subDepartments")
      .populate("designation", "name")
      .populate("sites", "name companyName subSites");

    if (!employee) {
      return res.status(404).json({ message: "Employee not found or QR code is invalid." });
    }

    if (employee.qrEnabled === false) {
      return res.status(403).json({ message: "QR access is disabled for this employee." });
    }

    return res.json(buildSafeEmployeeQrProfile(req, employee));
  } catch (err) {
    console.error("Employee QR profile error:", err);
    return res.status(500).json({ message: "Failed to load employee QR profile" });
  }
};

exports.exportEmployeesExcel = async (req, res) => {
  try {
    const { status = "", department = "" } = req.query;

    const filter = {
      ...(await buildEmployeeScopeFilter(req.access || {})),
    };
    if (status === "active") filter.isActive = true;
    if (status === "inactive") filter.isActive = false;
    if (department) filter.department = department;

    const employees = await Employee.find(filter)
      .populate("department", "name subDepartments")
      .populate("designation", "name")
      .populate("superiorEmployee", "employeeCode employeeName")
      .populate("sites", "name companyName subSites");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Employees");

    sheet.columns = [
      { header: "Employee Code", key: "employeeCode", width: 20 },
      { header: "Employee Name", key: "employeeName", width: 25 },
      { header: "Mobile", key: "mobile", width: 15 },
      { header: "Email", key: "email", width: 30 },
      { header: "Departments", key: "department", width: 30 },
      { header: "Sub Departments", key: "subDepartment", width: 32 },
      { header: "Designation", key: "designation", width: 20 },
      { header: "Superior Employee", key: "superiorEmployee", width: 30 },
      { header: "Sites", key: "sites", width: 30 },
      { header: "Sub Sites", key: "subSites", width: 40 },
      { header: "Status", key: "status", width: 15 },
    ];

    employees.map(mapEmployee).forEach((e) => {
      sheet.addRow({
        employeeCode: e.employeeCode,
        employeeName: e.employeeName,
        mobile: e.mobile,
        email: e.email,
        department: e.departmentDisplay || "",
        subDepartment: e.subDepartmentDisplay || "",
        designation: e.designation?.name || "",
        superiorEmployee: formatEmployeeDisplayName(e.superiorEmployee),
        sites: (e.sites || []).map((s) => formatSiteDisplayName(s)).join(", "),
        subSites: e.subSiteDisplay || "",
        status: e.isActive ? "Active" : "Inactive",
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=employees.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Excel export error:", err);
    res.status(500).json({ message: "Excel export failed" });
  }
};
