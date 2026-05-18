const normalizeText = (value) => String(value || "").trim();

const normalizeIdList = (value) =>
  (Array.isArray(value) ? value : [value])
    .map((item) => normalizeText(item?._id || item))
    .filter(Boolean);

const mergeQueryFilters = (...filters) => {
  const activeFilters = filters.filter(
    (filter) => filter && typeof filter === "object" && Object.keys(filter).length
  );

  if (!activeFilters.length) return {};
  if (activeFilters.length === 1) return activeFilters[0];
  return { $and: activeFilters };
};

const formatSiteDisplayName = (site) => {
  if (!site) return "";

  const companyName = normalizeText(site.companyName);
  const name = normalizeText(site.name);

  if (companyName && name) return `${companyName} - ${name}`;
  return name || companyName;
};

const formatEmployeeDisplayName = (employee) => {
  if (!employee) return "";

  const employeeCode = normalizeText(employee.employeeCode);
  const employeeName = normalizeText(employee.employeeName);

  if (employeeCode && employeeName) return `${employeeCode} - ${employeeName}`;
  return employeeCode || employeeName;
};

const employeeHasSite = (employee, siteId) =>
  (employee?.sites || []).some((site) => String(site?._id || site) === String(siteId));

const employeeHasDepartment = (employee, departmentId) =>
  (employee?.department || []).some(
    (department) => String(department?._id || department) === String(departmentId)
  );

const getEmployeeTransferSiteIds = (employee, allowedSiteIds = []) => {
  const normalizedAllowedSiteIds = normalizeIdList(
    Array.isArray(allowedSiteIds) ? allowedSiteIds : allowedSiteIds ? [allowedSiteIds] : []
  );

  return normalizeIdList(employee?.sites).filter(
    (siteId) =>
      !normalizedAllowedSiteIds.length || normalizedAllowedSiteIds.includes(String(siteId))
  );
};

const getEmployeeTransferDepartmentIds = (employee) => normalizeIdList(employee?.department);

const getSharedEmployeeSiteIds = (fromEmployee, toEmployee, allowedSiteIds = []) => {
  const fromSiteIds = getEmployeeTransferSiteIds(fromEmployee, allowedSiteIds);
  if (!fromSiteIds.length) return [];

  return fromSiteIds.filter((siteId) => employeeHasSite(toEmployee, siteId));
};

const getSharedEmployeeDepartmentIds = (fromEmployee, toEmployee) => {
  const fromDepartmentIds = getEmployeeTransferDepartmentIds(fromEmployee);
  if (!fromDepartmentIds.length) return [];

  return fromDepartmentIds.filter((departmentId) => employeeHasDepartment(toEmployee, departmentId));
};

const mapChecklistTransferEmployee = (employee, allowedSiteIds = []) => {
  const siteIds = getEmployeeTransferSiteIds(employee, allowedSiteIds);
  const departmentIds = getEmployeeTransferDepartmentIds(employee);
  const siteLabels = (employee?.sites || [])
    .filter((site) => siteIds.includes(normalizeText(site?._id || site)))
    .map((site) => formatSiteDisplayName(site))
    .filter(Boolean);
  const departmentNames = (employee?.department || [])
    .map((department) => normalizeText(department?.name))
    .filter(Boolean);

  return {
    _id: employee?._id || null,
    employeeCode: normalizeText(employee?.employeeCode),
    employeeName: normalizeText(employee?.employeeName),
    email: normalizeText(employee?.email),
    isActive: employee?.isActive !== false,
    siteIds,
    siteLabels,
    departmentIds,
    departmentNames,
    departmentDisplay: departmentNames.join(", "),
  };
};

const buildDisplaySnapshot = (sections = []) => ({
  sections: sections.filter((section) => Array.isArray(section?.fields) && section.fields.length),
});

const getSnapshotFieldMap = (snapshot = {}) => {
  const fieldMap = new Map();

  (snapshot?.sections || []).forEach((section) => {
    (section?.fields || []).forEach((field) => {
      if (!field?.key) return;
      fieldMap.set(field.key, {
        key: field.key,
        label: field.label || field.key,
        value: field.value ?? "-",
        sectionTitle: section.title || "",
      });
    });
  });

  return fieldMap;
};

const capitalizeLabel = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).replace(/_/g, " ");
};

const normalizeComparisonValue = (value) =>
  String(value === null || value === undefined ? "" : value)
    .trim()
    .replace(/\s+/g, " ");

const buildComparisonRows = (oldSnapshot = {}, newSnapshot = {}) => {
  const oldFieldMap = getSnapshotFieldMap(oldSnapshot);
  const newFieldMap = getSnapshotFieldMap(newSnapshot);
  const orderedKeys = [
    ...newFieldMap.keys(),
    ...[...oldFieldMap.keys()].filter((key) => !newFieldMap.has(key)),
  ];

  return orderedKeys.map((key) => {
    const oldField = oldFieldMap.get(key);
    const newField = newFieldMap.get(key);
    const oldValue = oldField?.value ?? "-";
    const newValue = newField?.value ?? "-";

    return {
      key,
      label: newField?.label || oldField?.label || capitalizeLabel(key),
      oldValue,
      newValue,
      changed: normalizeComparisonValue(oldValue) !== normalizeComparisonValue(newValue),
      sectionTitle: newField?.sectionTitle || oldField?.sectionTitle || "",
    };
  });
};

const formatDisplayDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const buildTransferChecklistLines = (checklists = []) => {
  const rows = (Array.isArray(checklists) ? checklists : [])
    .map((checklist, index) => {
      const label = [
        normalizeText(checklist?.checklistNumber),
        normalizeText(checklist?.checklistName),
        normalizeText(checklist?.assignedSiteName),
      ]
        .filter(Boolean)
        .join(" - ");

      return label ? `${index + 1}. ${label}` : "";
    })
    .filter(Boolean);

  return rows.length ? rows.join("\n") : "-";
};

const buildTransferDisplaySnapshot = ({
  transferType,
  fromEmployee,
  toEmployee,
  selectedChecklists,
  transferStartDate,
  transferEndDate,
}) =>
  buildDisplaySnapshot([
    {
      title: "Transfer Setup",
      fields: [
        {
          key: "fromEmployee",
          label: "From Employee",
          value: formatEmployeeDisplayName(fromEmployee) || "-",
        },
        {
          key: "toEmployee",
          label: "To Employee",
          value: formatEmployeeDisplayName(toEmployee) || "-",
        },
        {
          key: "transferType",
          label: "Transfer Type",
          value:
            transferType === "temporary"
              ? "Temporary"
              : transferType === "permanent"
              ? "Permanent"
              : "-",
        },
        {
          key: "effectiveDates",
          label: "Effective Dates",
          value:
            transferType === "temporary"
              ? `${formatDisplayDate(transferStartDate)} to ${formatDisplayDate(transferEndDate)}`
              : transferType === "permanent"
              ? "Immediate"
              : "-",
        },
      ],
    },
    {
      title: "Checklist Selection",
      fields: [
        {
          key: "checklistCount",
          label: "Checklist Count",
          value: String(Array.isArray(selectedChecklists) ? selectedChecklists.length : 0),
        },
        {
          key: "checklists",
          label: "Selected Checklists",
          value: buildTransferChecklistLines(selectedChecklists),
        },
      ],
    },
  ]);

const buildCurrentTransferDisplaySnapshot = ({ fromEmployee, selectedChecklists }) =>
  buildDisplaySnapshot([
    {
      title: "Current Assignment",
      fields: [
        {
          key: "fromEmployee",
          label: "From Employee",
          value: formatEmployeeDisplayName(fromEmployee) || "-",
        },
        {
          key: "toEmployee",
          label: "To Employee",
          value: "-",
        },
        {
          key: "transferType",
          label: "Transfer Type",
          value: "-",
        },
        {
          key: "effectiveDates",
          label: "Effective Dates",
          value: "-",
        },
      ],
    },
    {
      title: "Checklist Selection",
      fields: [
        {
          key: "checklistCount",
          label: "Checklist Count",
          value: String(Array.isArray(selectedChecklists) ? selectedChecklists.length : 0),
        },
        {
          key: "checklists",
          label: "Selected Checklists",
          value: buildTransferChecklistLines(selectedChecklists),
        },
      ],
    },
  ]);

module.exports = {
  buildComparisonRows,
  buildCurrentTransferDisplaySnapshot,
  buildDisplaySnapshot,
  buildTransferDisplaySnapshot,
  employeeHasSite,
  formatEmployeeDisplayName,
  formatSiteDisplayName,
  getEmployeeTransferDepartmentIds,
  getEmployeeTransferSiteIds,
  getSharedEmployeeDepartmentIds,
  getSharedEmployeeSiteIds,
  mapChecklistTransferEmployee,
  mergeQueryFilters,
  normalizeIdList,
  normalizeText,
};
