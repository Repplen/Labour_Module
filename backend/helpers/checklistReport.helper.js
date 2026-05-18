const CHECKLIST_TASK_REPORT_EXCEL_SHEET_NAME = "Checklist Task Report";
const IST_OFFSET_MS = 330 * 60 * 1000;

const checklistTaskReportExcelColumns = [
  { header: "#", key: "serialNumber", width: 8 },
  { header: "Task Number", key: "taskNumber", width: 18 },
  { header: "Checklist Number", key: "checklistNumber", width: 18 },
  { header: "Checklist Name", key: "checklistName", width: 30 },
  { header: "Employee", key: "employee", width: 26 },
  { header: "Department", key: "department", width: 28 },
  { header: "Priority", key: "priority", width: 12 },
  { header: "Schedule", key: "schedule", width: 20 },
  { header: "Start", key: "start", width: 22 },
  { header: "End", key: "end", width: 22 },
  { header: "Submitted At", key: "submittedAt", width: 22 },
  { header: "Scoring", key: "scoring", width: 30 },
  { header: "Time Status", key: "timeStatus", width: 16 },
  { header: "Final Mark", key: "finalMark", width: 14 },
  { header: "Current Approver", key: "currentApprover", width: 26 },
  { header: "Approval Workflow", key: "approvalWorkflow", width: 34 },
  { header: "Approval Status", key: "approvalStatus", width: 18 },
];

const checklistTaskReportDelayRowFill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFE5E5" },
};

const reportMarkFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const normalizeText = (value) => String(value || "").trim();

const capitalizeLabel = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).replace(/_/g, " ");
};

const formatEmployeeDisplayName = (employee) => {
  if (!employee) return "";

  const employeeCode = normalizeText(employee.employeeCode);
  const employeeName = normalizeText(employee.employeeName);

  if (employeeCode && employeeName) return `${employeeCode} - ${employeeName}`;
  return employeeCode || employeeName;
};

const parseOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
};

const roundMarkValue = (value) => {
  const parsedValue = parseOptionalNumber(value);
  if (parsedValue === null) return null;
  return Math.round(parsedValue * 100) / 100;
};

const formatReportDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
};

const formatDepartmentList = (departments = []) =>
  (Array.isArray(departments) ? departments : departments ? [departments] : [])
    .map((department) => normalizeText(department?.name || department))
    .filter(Boolean)
    .join(", ");

const formatTaskDepartmentLabel = (task = {}) =>
  formatDepartmentList(
    task?.assignedEmployee?.department || task?.departmentDetails || task?.department
  ) ||
  normalizeText(task?.departmentDisplay) ||
  "-";

const normalizeTaskTimingStatus = (value) => {
  const normalized = normalizeText(value).toLowerCase();

  if (normalized === "advanced") return "advance";
  if (normalized === "delay") return "delayed";
  return normalized || "pending";
};

const isNilChecklistTask = (task = {}) => {
  const normalizedStatus = normalizeText(task?.status).toLowerCase();
  const normalizedApprovalType = normalizeText(task?.approvalType).toLowerCase();

  return (
    task?.isNilApproval === true ||
    normalizedApprovalType === "nil" ||
    normalizedStatus === "nil_for_approval" ||
    normalizedStatus === "nil_approved"
  );
};

const getReportDayStartValue = (value) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const shiftedDate = new Date(date.getTime() + IST_OFFSET_MS);

  return Date.UTC(
    shiftedDate.getUTCFullYear(),
    shiftedDate.getUTCMonth(),
    shiftedDate.getUTCDate()
  );
};

const getReportDayDifference = (leftValue, rightValue) => {
  const leftDayStart = getReportDayStartValue(leftValue);
  const rightDayStart = getReportDayStartValue(rightValue);

  if (leftDayStart === null || rightDayStart === null) return 0;
  return Math.round((leftDayStart - rightDayStart) / (24 * 60 * 60 * 1000));
};

const getChecklistTaskTargetDateTime = (task = {}) =>
  task?.dependencyTargetDateTime || task?.targetDateTime || task?.endDateTime || null;

const getChecklistMarkConfig = (task = {}) => {
  if (isNilChecklistTask(task)) {
    return {
      enableMark: false,
      baseMark: null,
      delayPenaltyPerDay: null,
      advanceBonusPerDay: null,
      finalMark: roundMarkValue(parseOptionalNumber(task?.finalMark) ?? 0) ?? 0,
      isNilApproval: true,
    };
  }

  const explicitEnableMark =
    typeof task?.enableMark === "boolean" ? task.enableMark : null;
  const baseMark = parseOptionalNumber(task?.baseMark);
  const legacyChecklistMark = parseOptionalNumber(task?.checklistMark);
  const resolvedBaseMark = baseMark ?? legacyChecklistMark;
  const enableMark =
    explicitEnableMark !== null
      ? explicitEnableMark && resolvedBaseMark !== null
      : resolvedBaseMark !== null;

  if (!enableMark || resolvedBaseMark === null) {
    return {
      enableMark: false,
      baseMark: null,
      delayPenaltyPerDay: null,
      advanceBonusPerDay: null,
      finalMark: null,
      isNilApproval: false,
    };
  }

  return {
    enableMark: true,
    baseMark: roundMarkValue(resolvedBaseMark),
    delayPenaltyPerDay: roundMarkValue(
      parseOptionalNumber(task?.delayPenaltyPerDay) ?? 0.5
    ),
    advanceBonusPerDay: roundMarkValue(
      parseOptionalNumber(task?.advanceBonusPerDay) ?? 0.5
    ),
    finalMark: roundMarkValue(parseOptionalNumber(task?.finalMark)),
    isNilApproval: false,
  };
};

const getChecklistTaskMarkSummary = (task = {}) => {
  const markConfig = getChecklistMarkConfig(task);

  if (markConfig.isNilApproval) {
    return {
      ...markConfig,
      direction: "nil",
      dayCount: 0,
      delayDays: 0,
      advanceDays: 0,
      adjustment: null,
    };
  }

  if (!markConfig.enableMark) {
    return {
      ...markConfig,
      direction: "disabled",
      dayCount: 0,
      delayDays: 0,
      advanceDays: 0,
      adjustment: null,
    };
  }

  const targetDateTime = getChecklistTaskTargetDateTime(task);

  if (!task?.submittedAt || !targetDateTime) {
    return {
      ...markConfig,
      direction: "pending",
      dayCount: 0,
      delayDays: 0,
      advanceDays: 0,
      adjustment: null,
    };
  }

  const dayDifference = getReportDayDifference(task.submittedAt, targetDateTime);
  const isSameDayLate =
    dayDifference === 0 &&
    new Date(task.submittedAt).getTime() > new Date(targetDateTime).getTime();
  const delayDays = Math.max(0, dayDifference) + (isSameDayLate ? 1 : 0);
  const advanceDays = Math.max(0, dayDifference * -1);
  const calculatedAdjustment =
    advanceDays * (markConfig.advanceBonusPerDay || 0) -
    delayDays * (markConfig.delayPenaltyPerDay || 0);
  const finalMark =
    markConfig.finalMark !== null
      ? markConfig.finalMark
      : roundMarkValue(Math.max(0, (markConfig.baseMark || 0) + calculatedAdjustment));
  const timingStatus = normalizeTaskTimingStatus(
    task?.submissionTimingStatus || task?.timelinessStatus
  );
  const direction =
    delayDays > 0
      ? "delay"
      : advanceDays > 0
      ? "advance"
      : timingStatus === "delayed"
      ? "delay"
      : "on_time";

  return {
    ...markConfig,
    finalMark,
    direction,
    dayCount: delayDays || advanceDays,
    delayDays,
    advanceDays,
    adjustment: roundMarkValue((finalMark || 0) - (markConfig.baseMark || 0)),
  };
};

const getChecklistTaskTimeStatusSummary = (task = {}) => {
  const targetDateTime = getChecklistTaskTargetDateTime(task);

  if (!task?.submittedAt) {
    return { status: "pending", dayCount: 0 };
  }

  if (!targetDateTime) {
    return {
      status: normalizeTaskTimingStatus(task?.submissionTimingStatus || task?.timelinessStatus),
      dayCount: 0,
    };
  }

  const submittedDate = new Date(task.submittedAt);
  const targetDate = new Date(targetDateTime);
  if (Number.isNaN(submittedDate.getTime()) || Number.isNaN(targetDate.getTime())) {
    return {
      status: normalizeTaskTimingStatus(task?.submissionTimingStatus || task?.timelinessStatus),
      dayCount: 0,
    };
  }

  const dayDifference = getReportDayDifference(task.submittedAt, targetDateTime);

  if (submittedDate.getTime() > targetDate.getTime()) {
    return { status: "delayed", dayCount: Math.max(1, dayDifference) };
  }

  if (submittedDate.getTime() < targetDate.getTime()) {
    const advanceDays = Math.max(0, dayDifference * -1);

    if (advanceDays > 0) {
      return { status: "advance", dayCount: advanceDays };
    }
  }

  return { status: "on_time", dayCount: 0 };
};

const formatTimeStatusDayCount = (value) =>
  `${value} day${value === 1 ? "" : "s"}`;

const formatChecklistTaskReportTimeStatusLabel = (task = {}) => {
  const summary = getChecklistTaskTimeStatusSummary(task);

  switch (normalizeTaskTimingStatus(summary.status)) {
    case "advance":
      return summary.dayCount > 0
        ? `Advance - ${formatTimeStatusDayCount(summary.dayCount)}`
        : "Advance";
    case "delayed":
      return summary.dayCount > 0
        ? `Delay - ${formatTimeStatusDayCount(summary.dayCount)}`
        : "Delay";
    case "on_time":
      return "On Time";
    case "pending":
    default:
      return "Pending";
  }
};

const formatReportMarkValue = (value) => {
  const normalizedValue = roundMarkValue(value);
  return normalizedValue === null
    ? reportMarkFormatter.format(0)
    : reportMarkFormatter.format(normalizedValue);
};

const formatChecklistTaskScoringLabel = (task = {}) => {
  const markConfig = getChecklistMarkConfig(task);

  if (markConfig.isNilApproval) return "Nil approval | No Mark";
  if (!markConfig.enableMark) return "Disabled";

  return `Base ${formatReportMarkValue(markConfig.baseMark)}`;
};

const formatChecklistTaskFinalMarkLabel = (task = {}) => {
  const markSummary = getChecklistTaskMarkSummary(task);

  if (markSummary.isNilApproval) return "No Mark";
  if (markSummary.enableMark) {
    return markSummary.finalMark !== null
      ? formatReportMarkValue(markSummary.finalMark)
      : "Pending";
  }

  return "Not enabled";
};

const formatChecklistTaskPriorityLabel = (task = {}) =>
  capitalizeLabel(task?.priority || task?.checklist?.priority) || "-";

const formatChecklistTaskScheduleLabel = (task = {}) => {
  const scheduleType = normalizeText(task?.scheduleType || task?.repeatType).toLowerCase();
  if (!scheduleType) return "-";

  if (scheduleType === "custom") {
    const repeatSummary = normalizeText(task?.repeatSummary);
    return repeatSummary ? `Custom (${repeatSummary})` : "Custom";
  }

  return capitalizeLabel(scheduleType) || "-";
};

const formatChecklistTaskStatusLabel = (status) => {
  const normalizedStatus = normalizeText(status).toLowerCase();

  switch (normalizedStatus) {
    case "waiting_dependency":
      return "Waiting for Dependency";
    case "open":
      return "Assigned";
    case "submitted":
      return "Under Approval";
    case "nil_for_approval":
      return "Nil For Approval";
    case "approved":
      return "Approved";
    case "nil_approved":
      return "Nil Approved";
    case "rejected":
      return "Rejected";
    default:
      return capitalizeLabel(normalizedStatus) || "-";
  }
};

const formatChecklistTaskTimelinessLabel = (value) => {
  const normalized = normalizeTaskTimingStatus(value);

  switch (normalized) {
    case "advance":
      return "Advance";
    case "on_time":
      return "On Time";
    case "delayed":
      return "Delay";
    case "pending":
    default:
      return "Pending";
  }
};

const getCurrentApprover = (task = {}) => {
  if (task?.currentApprovalEmployee) {
    return task.currentApprovalEmployee;
  }

  const approvalSteps = Array.isArray(task?.approvalSteps) ? task.approvalSteps : [];
  const pendingStep = approvalSteps.find((step) => step?.status === "pending");

  if (pendingStep?.approverEmployee) {
    return pendingStep.approverEmployee;
  }

  const waitingStep = approvalSteps.find((step) => step?.status === "waiting");

  if (waitingStep?.approverEmployee) {
    return waitingStep.approverEmployee;
  }

  const lastActionedStep = [...approvalSteps]
    .filter((step) => step?.status && step.status !== "waiting")
    .sort(
      (left, right) =>
        (Number(left?.approvalLevel) || 0) - (Number(right?.approvalLevel) || 0)
    )
    .at(-1);

  return lastActionedStep?.approverEmployee || null;
};

const getChecklistTaskWorkflowEmployees = (task = {}) => {
  const approvalSteps = Array.isArray(task?.approvalSteps) ? task.approvalSteps : [];
  const seen = new Set();

  return approvalSteps
    .map((step) => step?.approverEmployee)
    .filter((employee) => {
      const employeeId = normalizeText(employee?._id || employee);

      if (!employeeId || seen.has(employeeId)) return false;

      seen.add(employeeId);
      return true;
    });
};

const formatChecklistTaskCurrentApproverLabel = (task = {}) =>
  formatEmployeeDisplayName(getCurrentApprover(task)) || "-";

const formatChecklistTaskWorkflowLabel = (task = {}) => {
  const labels = getChecklistTaskWorkflowEmployees(task)
    .map((employee) => formatEmployeeDisplayName(employee))
    .filter(Boolean);

  return labels.join(", ") || "-";
};

const buildChecklistTaskReportRow = (task = {}, index = 0) => ({
  serialNumber: index + 1,
  taskNumber: normalizeText(task.taskNumber) || "-",
  checklistNumber: normalizeText(task.checklistNumber) || "-",
  checklistName: normalizeText(task.checklistName) || "-",
  employee: formatEmployeeDisplayName(task.assignedEmployee) || "-",
  department: formatTaskDepartmentLabel(task),
  priority: formatChecklistTaskPriorityLabel(task),
  schedule: formatChecklistTaskScheduleLabel(task),
  start: formatReportDateTime(task.occurrenceDate),
  end: formatReportDateTime(task.endDateTime),
  submittedAt: formatReportDateTime(task.submittedAt),
  scoring: formatChecklistTaskScoringLabel(task),
  timeStatus: formatChecklistTaskReportTimeStatusLabel(task),
  finalMark: formatChecklistTaskFinalMarkLabel(task),
  currentApprover: formatChecklistTaskCurrentApproverLabel(task),
  approvalWorkflow: formatChecklistTaskWorkflowLabel(task),
  approvalStatus: formatChecklistTaskStatusLabel(task.status),
});

const applyChecklistTaskReportExcelStyles = (worksheet) => {
  const timeStatusColumnNumber =
    checklistTaskReportExcelColumns.findIndex((column) => column.key === "timeStatus") + 1;
  if (!timeStatusColumnNumber) return;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const timeStatus = normalizeText(row.getCell(timeStatusColumnNumber).value).toLowerCase();
    if (!timeStatus.startsWith("delay")) return;

    row.eachCell((cell) => {
      cell.fill = checklistTaskReportDelayRowFill;
    });
  });
};

const buildChecklistTaskReportFilterSummary = (query = {}) => {
  const parts = [];
  const search = normalizeText(query.search);
  const fromDate = normalizeText(query.fromDate);
  const toDate = normalizeText(query.toDate);
  const status = normalizeText(query.status);
  const scheduleType = normalizeText(query.scheduleType);
  const companyName = normalizeText(query.companyName);
  const siteId = normalizeText(query.siteId || query.site);
  const department = normalizeText(query.department);
  const subDepartment = normalizeText(query.subDepartment);
  const assignedEmployee = normalizeText(query.assignedEmployee);
  const timelinessStatus = normalizeText(
    query.submissionTimingStatus || query.timelinessStatus
  );

  if (search) parts.push(`Search: ${search}`);
  if (fromDate) parts.push(`From: ${fromDate}`);
  if (toDate) parts.push(`To: ${toDate}`);
  if (status) parts.push(`Status: ${formatChecklistTaskStatusLabel(status)}`);
  if (scheduleType) parts.push(`Schedule: ${capitalizeLabel(scheduleType)}`);
  if (companyName) parts.push(`Company: ${companyName}`);
  if (siteId) parts.push("Site Filter Applied");
  if (department) parts.push("Department Filter Applied");
  if (subDepartment) parts.push("Sub Department Filter Applied");
  if (assignedEmployee) parts.push("Employee Filter Applied");
  if (timelinessStatus) {
    parts.push(`Time: ${formatChecklistTaskTimelinessLabel(timelinessStatus)}`);
  }

  return parts.join(" | ") || "All checklist tasks";
};

const escapePdfText = (value) =>
  String(value === null || value === undefined ? "" : value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r/g, "")
    .replace(/\n/g, " ")
    .replace(/[^\x20-\x7E]/g, "?");

const wrapPdfText = (text, maxChars = 96) => {
  const normalized = String(text || "").trim();
  if (!normalized) return [""];

  const words = normalized.split(/\s+/);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    if (!currentLine) {
      currentLine = word;
      return;
    }

    if (`${currentLine} ${word}`.length <= maxChars) {
      currentLine = `${currentLine} ${word}`;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

const buildPdfContentStream = (lines = []) => {
  let content = "BT\n40 560 Td\n";
  let currentFont = "";
  let currentSize = 0;

  lines.forEach((line, index) => {
    const font = line.font || "F1";
    const size = line.size || 10;
    const gap = Number(line.gap || 12);

    if (font !== currentFont || size !== currentSize) {
      content += `/${font} ${size} Tf\n`;
      currentFont = font;
      currentSize = size;
    }

    if (index > 0) {
      content += `0 -${gap} Td\n`;
    }

    content += `(${escapePdfText(line.text)}) Tj\n`;
  });

  content += "ET";
  return content;
};

const buildSimplePdfBuffer = (pageContents = []) => {
  const contents = pageContents.length ? pageContents : [buildPdfContentStream([])];
  const objectMap = {};
  let objectId = 1;

  const catalogId = objectId++;
  const pagesId = objectId++;
  const fontRegularId = objectId++;
  const fontBoldId = objectId++;
  const pageIds = contents.map(() => objectId++);
  const contentIds = contents.map(() => objectId++);

  objectMap[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objectMap[pagesId] = `<< /Type /Pages /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageIds.length} >>`;
  objectMap[fontRegularId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";
  objectMap[fontBoldId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  contents.forEach((content, index) => {
    objectMap[pageIds[index]] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentIds[index]} 0 R >>`;
    objectMap[contentIds[index]] = `<< /Length ${Buffer.byteLength(
      content,
      "utf8"
    )} >>\nstream\n${content}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let id = 1; id < objectId; id += 1) {
    offsets[id] = Buffer.byteLength(pdf, "utf8");
    pdf += `${id} 0 obj\n${objectMap[id]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objectId}\n0000000000 65535 f \n`;

  for (let id = 1; id < objectId; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objectId} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
};

const buildChecklistTaskPdfPages = (reportRows = [], query = {}) => {
  const pages = [];
  const maxLinesPerPage = 38;
  const generatedAtLabel = formatReportDateTime(new Date());
  const filterSummary = buildChecklistTaskReportFilterSummary(query);
  let currentPage = [];

  const createPageHeader = () => [
    { text: "Checklist Task Report", font: "F2", size: 16, gap: 0 },
    { text: `Generated: ${generatedAtLabel}`, font: "F1", size: 10, gap: 18 },
    { text: `Filters: ${filterSummary}`, font: "F1", size: 9, gap: 14 },
    { text: `Total Tasks: ${reportRows.length}`, font: "F1", size: 9, gap: 12 },
    { text: "", font: "F1", size: 10, gap: 12 },
  ];

  const startNewPage = () => {
    currentPage = createPageHeader();
  };

  const ensurePageCapacity = (requiredLineCount) => {
    if (!currentPage.length) {
      startNewPage();
      return;
    }

    if (currentPage.length + requiredLineCount > maxLinesPerPage) {
      pages.push(buildPdfContentStream(currentPage));
      startNewPage();
    }
  };

  if (!reportRows.length) {
    startNewPage();
    currentPage.push({
      text: "No checklist task records found for the selected filters.",
      font: "F1",
      size: 10,
      gap: 12,
    });
    pages.push(buildPdfContentStream(currentPage));
    return pages;
  }

  reportRows.forEach((row) => {
    const block = [];
    const addWrappedBlock = (text, font = "F1", size = 10, gap = 12) => {
      wrapPdfText(text).forEach((segment, index) => {
        block.push({
          text: segment,
          font,
          size,
          gap: index === 0 ? gap : 11,
        });
      });
    };

    addWrappedBlock(`${row.serialNumber}. ${row.taskNumber} | ${row.approvalStatus}`, "F2", 11, 12);
    addWrappedBlock(`Checklist: ${row.checklistName} (${row.checklistNumber})`);
    addWrappedBlock(`Employee: ${row.employee} | Department: ${row.department}`);
    addWrappedBlock(`Priority: ${row.priority} | Schedule: ${row.schedule}`);
    addWrappedBlock(`Start: ${row.start} | End: ${row.end}`);
    addWrappedBlock(`Submitted: ${row.submittedAt}`);
    addWrappedBlock(`Current Approver: ${row.currentApprover}`);

    if (row.approvalWorkflow && row.approvalWorkflow !== "-") {
      addWrappedBlock(`Workflow: ${row.approvalWorkflow}`);
    }

    addWrappedBlock(`Scoring: ${row.scoring}`);
    addWrappedBlock(`Time Status: ${row.timeStatus} | Final Mark: ${row.finalMark}`);
    block.push({ text: "", font: "F1", size: 10, gap: 12 });

    ensurePageCapacity(block.length);
    currentPage.push(...block);
  });

  if (currentPage.length) {
    pages.push(buildPdfContentStream(currentPage));
  }

  return pages;
};

const buildChecklistTaskReportPdfBuffer = (tasks = [], query = {}) => {
  const reportRows = tasks.map((task, index) => buildChecklistTaskReportRow(task, index));
  return buildSimplePdfBuffer(buildChecklistTaskPdfPages(reportRows, query));
};

module.exports = {
  CHECKLIST_TASK_REPORT_EXCEL_SHEET_NAME,
  applyChecklistTaskReportExcelStyles,
  buildChecklistTaskReportPdfBuffer,
  buildChecklistTaskReportRow,
  checklistTaskReportExcelColumns,
  capitalizeLabel,
  formatEmployeeDisplayName,
  normalizeText,
};
