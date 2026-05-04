import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import { usePermissions } from "../../context/usePermissions";
import {
  formatApprovalLabel,
  formatChecklistDependencyLabel,
  formatChecklistScoreLabel,
  formatEmployeeLabel,
  formatMarkValue,
  formatPriorityLabel,
  formatScheduleLabel,
  formatTargetDayCountLabel,
} from "../../utils/checklistDisplay";
import { getCustomRepeatSummary } from "../../utils/checklistRepeat";
import { formatDepartmentList } from "../../utils/departmentDisplay";

const defaultForm = {
  checklistNumber: "",
  checklistName: "",
  enableMark: false,
  baseMark: "",
  delayPenaltyPerDay: "0.5",
  advanceBonusPerDay: "0.5",
  checklistSourceSite: "",
  priority: "medium",
  assignedToEmployee: "",
  employeeAssignedSite: "",
  isDependentTask: false,
  dependencyChecklistId: "",
  targetDayCount: "",
  scheduleType: "daily",
  startDate: "",
  scheduleTime: "09:00",
  endDate: "",
  endTime: "18:00",
  customRepeatInterval: "1",
  customRepeatUnit: "daily",
  repeatDayOfMonth: "",
  repeatDayOfWeek: "",
  repeatMonthOfYear: "",
  approvalHierarchy: "default",
};

const weekDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const customRepeatUnitOptions = [
  { value: "daily", label: "Day" },
  { value: "weekly", label: "Week" },
  { value: "monthly", label: "Month" },
  { value: "yearly", label: "Year" },
];

const monthOfYearOptions = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const toIndiaInputDate = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const shifted = new Date(date.getTime() + 330 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const createItemRow = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  label: "",
  detail: "",
  isRequired: true,
});

const createApprovalRow = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  approvalEmployee: "",
});

const employeeHasSite = (employee, siteId) =>
  (employee?.sites || []).some((site) => String(site?._id || site) === String(siteId));

const getUniqueSites = (employees = []) => {
  const siteMap = new Map();

  employees.forEach((employee) => {
    (employee?.sites || []).forEach((site) => {
      const siteId = String(site?._id || site || "");
      if (!siteId || siteMap.has(siteId)) return;
      siteMap.set(siteId, site);
    });
  });

  return Array.from(siteMap.values());
};

const getChecklistSiteName = (site) => String(site?.name || "").trim();

const flattenSubDepartments = (rows = [], trail = [], department = null) =>
  rows.flatMap((item) => {
    const nextTrail = [...trail, item.name];

    return [
      {
        _id: item._id,
        name: item.name,
        departmentId: department?._id || "",
        departmentName: department?.name || "",
        label: department?.name
          ? `${department.name} > ${nextTrail.join(" > ")}`
          : nextTrail.join(" > "),
      },
      ...flattenSubDepartments(item.children || [], nextTrail, department),
    ];
  });

const buildSubDepartmentOptions = (departmentRows = [], selectedDepartmentId = "") =>
  (departmentRows || [])
    .filter((department) => String(department._id) === String(selectedDepartmentId || ""))
    .flatMap((department) =>
      flattenSubDepartments(department.subDepartments || [], [], department)
    );

const VALIDATION_FOCUS_ORDER = [
  "employeeAssignedSite",
  "assignedToEmployee",
  "checklistName",
  "baseMark",
  "delayPenaltyPerDay",
  "advanceBonusPerDay",
  "dependencyChecklistId",
  "targetDayCount",
  "startDate",
  "scheduleTime",
  "endDate",
  "endTime",
  "customRepeatInterval",
  "customRepeatUnit",
  "repeatDayOfWeek",
  "repeatMonthOfYear",
  "repeatDayOfMonth",
  "taskRelatedQuestions",
  "approvalSection",
];

const normalizeChecklistItems = (items = []) =>
  items
    .map((item) => ({
      label: String(item?.label || "").trim(),
      detail: String(item?.detail || "").trim(),
      isRequired: item?.isRequired !== false,
    }))
    .filter((item) => item.label);

const normalizeApprovalRows = (approvalRows = [], approvalHierarchy = "default") =>
  approvalHierarchy === "custom"
    ? approvalRows
        .map((row) => row.approvalEmployee)
        .filter(Boolean)
        .map((approvalEmployee, index) => ({
          approvalLevel: index + 1,
          approvalEmployee,
        }))
    : [];

const validateChecklistForm = ({
  form,
  items,
  approvalRows,
  defaultApprover,
  isEditMode,
  checklistId,
}) => {
  const errors = {};
  const normalizedItems = normalizeChecklistItems(items);
  const normalizedApprovals = normalizeApprovalRows(approvalRows, form.approvalHierarchy);

  if (!String(form.employeeAssignedSite || "").trim()) {
    errors.employeeAssignedSite = "Select the assigned site.";
  }

  if (!String(form.assignedToEmployee || "").trim()) {
    errors.assignedToEmployee = "Select the employee.";
  }

  if (!String(form.checklistName || "").trim()) {
    errors.checklistName = "Enter the checklist name.";
  }

  const hasIncompleteQuestionRow = items.some((item) => {
    const label = String(item?.label || "").trim();
    const detail = String(item?.detail || "").trim();
    return !label && Boolean(detail);
  });

  if (hasIncompleteQuestionRow) {
    errors.taskRelatedQuestions = "Enter a question text or remove the empty row.";
  }

  if (form.enableMark) {
    const baseMark = Number(form.baseMark);
    const delayPenaltyPerDay = Number(form.delayPenaltyPerDay);
    const advanceBonusPerDay = Number(form.advanceBonusPerDay);

    if (form.baseMark === "" || Number.isNaN(baseMark) || baseMark < 0) {
      errors.baseMark = "Base mark is required when task scoring is enabled.";
    }

    if (
      form.delayPenaltyPerDay === "" ||
      Number.isNaN(delayPenaltyPerDay) ||
      delayPenaltyPerDay < 0
    ) {
      errors.delayPenaltyPerDay = "Delay penalty per day must be zero or greater.";
    }

    if (
      form.advanceBonusPerDay === "" ||
      Number.isNaN(advanceBonusPerDay) ||
      advanceBonusPerDay < 0
    ) {
      errors.advanceBonusPerDay = "Advance bonus per day must be zero or greater.";
    }
  }

  if (form.isDependentTask && !String(form.dependencyChecklistId || "").trim()) {
    errors.dependencyChecklistId =
      "Select the old task number / previous task number for the dependent task.";
  }

  if (
    form.isDependentTask &&
    (form.targetDayCount === "" ||
      Number.isNaN(Number(form.targetDayCount)) ||
      Number(form.targetDayCount) <= 0)
  ) {
    errors.targetDayCount = "Target day count is required and must be greater than 0.";
  }

  if (
    form.isDependentTask &&
    isEditMode &&
    String(form.dependencyChecklistId || "") === String(checklistId || "")
  ) {
    errors.dependencyChecklistId = "The same task cannot depend on itself.";
  }

  if (!String(form.startDate || "").trim()) {
    errors.startDate = "Select the start date.";
  }

  if (!String(form.scheduleTime || "").trim()) {
    errors.scheduleTime = "Select the start task time.";
  }

  if (!String(form.endDate || "").trim()) {
    errors.endDate = "Select the end date.";
  }

  if (!String(form.endTime || "").trim()) {
    errors.endTime = "Select the end time.";
  }

  if (
    String(form.startDate || "").trim() &&
    String(form.scheduleTime || "").trim() &&
    String(form.endDate || "").trim() &&
    String(form.endTime || "").trim()
  ) {
    const startWindow = new Date(`${form.startDate}T${form.scheduleTime}`);
    const endWindow = new Date(`${form.endDate}T${form.endTime}`);

    if (
      Number.isNaN(startWindow.getTime()) ||
      Number.isNaN(endWindow.getTime()) ||
      endWindow <= startWindow
    ) {
      errors.endTime = "End date and end time must be later than start date and start task time.";
    }
  }

  if (form.scheduleType === "custom") {
    const interval = Number(form.customRepeatInterval || 0);

    if (form.customRepeatInterval === "" || Number.isNaN(interval) || interval < 1) {
      errors.customRepeatInterval = "Enter a valid repeat interval for the custom schedule.";
    }

    if (!String(form.customRepeatUnit || "").trim()) {
      errors.customRepeatUnit = "Select the repeat unit for the custom schedule.";
    }

    if (form.customRepeatUnit === "weekly" && !String(form.repeatDayOfWeek || "").trim()) {
      errors.repeatDayOfWeek = "Select a day of week for the custom weekly schedule.";
    }

    if (
      form.customRepeatUnit === "monthly" &&
      (!form.repeatDayOfMonth ||
        Number.isNaN(Number(form.repeatDayOfMonth)) ||
        Number(form.repeatDayOfMonth) < 1 ||
        Number(form.repeatDayOfMonth) > 31)
    ) {
      errors.repeatDayOfMonth = "Select a valid day of month for the custom monthly schedule.";
    }

    if (
      form.customRepeatUnit === "yearly" &&
      (!form.repeatMonthOfYear ||
        Number.isNaN(Number(form.repeatMonthOfYear)) ||
        Number(form.repeatMonthOfYear) < 1 ||
        Number(form.repeatMonthOfYear) > 12)
    ) {
      errors.repeatMonthOfYear = "Select a valid month for the custom yearly schedule.";
    }

    if (
      form.customRepeatUnit === "yearly" &&
      (!form.repeatDayOfMonth ||
        Number.isNaN(Number(form.repeatDayOfMonth)) ||
        Number(form.repeatDayOfMonth) < 1 ||
        Number(form.repeatDayOfMonth) > 31)
    ) {
      errors.repeatDayOfMonth = "Select a valid day of month for the custom yearly schedule.";
    }
  }

  if (
    form.approvalHierarchy === "default" &&
    String(form.assignedToEmployee || "").trim() &&
    !defaultApprover
  ) {
    errors.approvalSection =
      "Approval mapping is incomplete. Configure the employee's Superior Employee before using default approval.";
  }

  if (form.approvalHierarchy === "custom" && !normalizedApprovals.length) {
    errors.approvalSection = "Select at least one approver for custom workflow mapping.";
  }

  return { errors, normalizedItems, normalizedApprovals };
};

export default function ChecklistCreate({ mode = "create" }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = mode === "edit" && Boolean(id);
  const { scope, user } = usePermissions();
  const canApplyChecklistChangesDirectly =
    String(user?.role || "").toLowerCase() === "admin" &&
    (Boolean(user?.isDefaultAdmin) ||
      String(user?.roleKey || "").toLowerCase() === "main_admin");
  const usesApprovalRequestFlow = !canApplyChecklistChangesDirectly;
  const restrictedChecklistSiteId =
    Array.isArray(scope?.siteIds) && scope.siteIds.length === 1
      ? String(scope.siteIds[0] || "").trim()
      : "";

  const [form, setForm] = useState(defaultForm);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [siteOptions, setSiteOptions] = useState([]);
  const [dependencyChecklists, setDependencyChecklists] = useState([]);
  const [items, setItems] = useState([]);
  const [approvalRows, setApprovalRows] = useState([createApprovalRow()]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [numberLoading, setNumberLoading] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showWorkflowMapping, setShowWorkflowMapping] = useState(false);
  const [workflowDepartment, setWorkflowDepartment] = useState("");
  const [workflowSubDepartment, setWorkflowSubDepartment] = useState("");
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [workflowSelectedEmployeeIds, setWorkflowSelectedEmployeeIds] = useState([]);
  const fieldRefs = useRef({});
  const sectionRefs = useRef({});
  const submitErrorRef = useRef(null);

  const selectedEmployee = useMemo(
    () =>
      employees.find((employee) => String(employee._id) === String(form.assignedToEmployee)) ||
      null,
    [employees, form.assignedToEmployee]
  );
  const filteredEmployees = useMemo(() => {
    if (!form.employeeAssignedSite) return employees;
    return employees.filter((employee) => employeeHasSite(employee, form.employeeAssignedSite));
  }, [employees, form.employeeAssignedSite]);
  const availableSites = useMemo(() => {
    if (selectedEmployee) {
      return Array.isArray(selectedEmployee.sites) ? selectedEmployee.sites : [];
    }

    return getUniqueSites(employees);
  }, [employees, selectedEmployee]);
  const defaultApprover = selectedEmployee?.superiorEmployee || null;
  const selectedSourceSite = useMemo(
    () =>
      siteOptions.find((site) => String(site._id) === String(form.checklistSourceSite)) || null,
    [form.checklistSourceSite, siteOptions]
  );
  const availableDependencyChecklists = useMemo(
    () =>
      dependencyChecklists.filter(
        (checklist) => String(checklist._id) !== String(id || "")
      ),
    [dependencyChecklists, id]
  );
  const selectedDependencyChecklist = useMemo(
    () =>
      availableDependencyChecklists.find(
        (checklist) => String(checklist._id) === String(form.dependencyChecklistId)
      ) || null,
    [availableDependencyChecklists, form.dependencyChecklistId]
  );
  const customScheduleSummary = useMemo(
    () =>
      getCustomRepeatSummary({
        customRepeatInterval: form.customRepeatInterval,
        customRepeatUnit: form.customRepeatUnit,
        repeatDayOfMonth: form.repeatDayOfMonth,
        repeatDayOfWeek: form.repeatDayOfWeek,
        repeatMonthOfYear: form.repeatMonthOfYear,
      }),
    [
      form.customRepeatInterval,
      form.customRepeatUnit,
      form.repeatDayOfMonth,
      form.repeatDayOfWeek,
      form.repeatMonthOfYear,
    ]
  );
  const workflowSubDepartmentOptions = useMemo(
    () => buildSubDepartmentOptions(departments, workflowDepartment),
    [departments, workflowDepartment]
  );
  const validationResult = useMemo(
    () =>
      validateChecklistForm({
        form,
        items,
        approvalRows,
        defaultApprover,
        isEditMode,
        checklistId: id,
      }),
    [approvalRows, defaultApprover, form, id, isEditMode, items]
  );
  const validationErrors = hasAttemptedSubmit ? validationResult.errors : {};

  const registerFieldRef = (key) => (node) => {
    if (node) {
      fieldRefs.current[key] = node;
      return;
    }

    delete fieldRefs.current[key];
  };

  const registerSectionRef = (key) => (node) => {
    if (node) {
      sectionRefs.current[key] = node;
      return;
    }

    delete sectionRefs.current[key];
  };

  const focusValidationTarget = (errorKey) => {
    const target =
      fieldRefs.current[errorKey] || sectionRefs.current[errorKey] || submitErrorRef.current;

    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });

    if (typeof target.focus === "function") {
      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }
    }
  };

  const scrollToFirstValidationError = (errors) => {
    const firstErrorKey =
      VALIDATION_FOCUS_ORDER.find((key) => errors[key]) || Object.keys(errors)[0];

    if (!firstErrorKey) return;

    requestAnimationFrame(() => focusValidationTarget(firstErrorKey));
  };

  const scrollToSubmitError = () => {
    requestAnimationFrame(() => {
      submitErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const getFieldClassName = (baseClassName, errorKey) =>
    validationErrors[errorKey] ? `${baseClassName} is-invalid` : baseClassName;

  const getSectionClassName = (baseClassName, errorKey) =>
    validationErrors[errorKey] ? `${baseClassName} border-danger` : baseClassName;

  const getSectionStyle = (errorKey) =>
    validationErrors[errorKey]
      ? { backgroundColor: "#fff5f5", borderColor: "#dc3545" }
      : undefined;

  const renderFieldError = (errorKey) =>
    validationErrors[errorKey] ? (
      <div className="invalid-feedback d-block">{validationErrors[errorKey]}</div>
    ) : null;

  const renderSectionError = (errorKey) =>
    validationErrors[errorKey] ? (
      <div className="text-danger small mt-3">{validationErrors[errorKey]}</div>
    ) : null;

  useEffect(() => {
    const loadPage = async () => {
      setPageLoading(true);

      try {
        const requests = [api.get("/checklists/setup-data")];

        if (isEditMode) {
          requests.push(api.get(`/checklists/${id}`));
        }

        const [setupRes, checklistRes] = await Promise.all(requests);
        const setupData = setupRes.data || {};
        const employeeRows = Array.isArray(setupData.employees) ? setupData.employees : [];
        const departmentRows = Array.isArray(setupData.departments) ? setupData.departments : [];
        const siteRows = Array.isArray(setupData.sites) ? setupData.sites : [];
        const dependencyChecklistRows = Array.isArray(setupData.checklists)
          ? setupData.checklists
          : [];

        setEmployees(employeeRows);
        setDepartments(departmentRows);
        setSiteOptions(siteRows);
        setDependencyChecklists(dependencyChecklistRows);

        if (checklistRes?.data) {
          const checklist = checklistRes.data;
          const hasStoredBaseMark =
            checklist.baseMark !== null && checklist.baseMark !== undefined;
          const hasLegacyChecklistMark =
            checklist.checklistMark !== null && checklist.checklistMark !== undefined;
          const enableMark =
            typeof checklist.enableMark === "boolean"
              ? checklist.enableMark
              : hasStoredBaseMark || hasLegacyChecklistMark;

          setForm({
            checklistNumber: checklist.checklistNumber || "",
            checklistName: checklist.checklistName || "",
            enableMark,
            baseMark:
              checklist.baseMark !== null && checklist.baseMark !== undefined
                ? String(checklist.baseMark)
                : checklist.checklistMark !== null && checklist.checklistMark !== undefined
                ? String(checklist.checklistMark)
                : "",
            delayPenaltyPerDay:
              checklist.delayPenaltyPerDay !== null &&
              checklist.delayPenaltyPerDay !== undefined
                ? String(checklist.delayPenaltyPerDay)
                : "0.5",
            advanceBonusPerDay:
              checklist.advanceBonusPerDay !== null &&
              checklist.advanceBonusPerDay !== undefined
                ? String(checklist.advanceBonusPerDay)
                : "0.5",
            checklistSourceSite:
              checklist.checklistSourceSite?._id || checklist.checklistSourceSite || "",
            priority: checklist.priority || "medium",
            assignedToEmployee:
              checklist.assignedToEmployee?._id || checklist.assignedToEmployee || "",
            employeeAssignedSite:
              checklist.employeeAssignedSite?._id || checklist.employeeAssignedSite || "",
        isDependentTask: checklist.isDependentTask === true,
        dependencyChecklistId:
          checklist.dependencyChecklistId?._id || checklist.dependencyChecklistId || "",
        targetDayCount:
          checklist.targetDayCount !== null && checklist.targetDayCount !== undefined
            ? String(checklist.targetDayCount)
            : "",
        scheduleType: checklist.scheduleType || "daily",
            startDate: toIndiaInputDate(checklist.startDate),
            scheduleTime: checklist.scheduleTime || "09:00",
            endDate: toIndiaInputDate(checklist.endDate || checklist.startDate),
            endTime: checklist.endTime || checklist.scheduleTime || "18:00",
            customRepeatInterval: String(checklist.customRepeatInterval || 1),
            customRepeatUnit: checklist.customRepeatUnit || "daily",
            repeatDayOfMonth: checklist.repeatDayOfMonth
              ? String(checklist.repeatDayOfMonth)
              : "",
            repeatDayOfWeek: checklist.repeatDayOfWeek || "",
            repeatMonthOfYear: checklist.repeatMonthOfYear
              ? String(checklist.repeatMonthOfYear)
              : "",
            approvalHierarchy: checklist.approvalHierarchy || "default",
          });

          const checklistItems = Array.isArray(checklist.checklistItems)
            ? checklist.checklistItems.map((item) => ({
                id: item._id || createItemRow().id,
                label: item.label || "",
                detail: item.detail || "",
                isRequired: item.isRequired !== false,
              }))
            : [];
          setItems(checklistItems);

          const checklistApprovals = Array.isArray(checklist.approvals)
            ? checklist.approvals.map((row) => ({
                id: `${row.approvalLevel}-${row.approvalEmployee?._id || row.approvalEmployee}`,
                approvalEmployee: row.approvalEmployee?._id || row.approvalEmployee || "",
              }))
            : [];
          setApprovalRows(checklistApprovals.length ? checklistApprovals : [createApprovalRow()]);
        } else if (restrictedChecklistSiteId) {
          setForm((prev) => ({
            ...prev,
            employeeAssignedSite: prev.employeeAssignedSite || restrictedChecklistSiteId,
          }));
        }
      } catch (err) {
        console.error("Checklist form load failed:", err);
        alert(isEditMode ? "Failed to load checklist master" : "Failed to load checklist setup data");
      } finally {
        setPageLoading(false);
      }
    };

    void loadPage();
  }, [id, isEditMode, restrictedChecklistSiteId]);

  useEffect(() => {
    if (!form.employeeAssignedSite || isEditMode) {
      if (!form.employeeAssignedSite && !isEditMode) {
        setForm((prev) => ({ ...prev, checklistNumber: "" }));
      }
      return;
    }

    const loadNumber = async () => {
      setNumberLoading(true);

      try {
        const response = await api.get("/checklists/next-number", {
          params: { employeeAssignedSite: form.employeeAssignedSite },
        });

        setForm((prev) => ({
          ...prev,
          checklistNumber: response.data?.checklistNumber || "",
        }));
      } catch (err) {
        console.error("Checklist number load failed:", err);
        setForm((prev) => ({ ...prev, checklistNumber: "" }));
      } finally {
        setNumberLoading(false);
      }
    };

    void loadNumber();
  }, [form.employeeAssignedSite, isEditMode]);

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === "checkbox" ? checked : value;
    setSubmitError("");

    if (name === "isDependentTask") {
      const nextIsDependentTask = value === "yes";

      setForm((prev) => ({
        ...prev,
        isDependentTask: nextIsDependentTask,
        dependencyChecklistId: nextIsDependentTask ? prev.dependencyChecklistId : "",
        targetDayCount: nextIsDependentTask ? prev.targetDayCount : "",
      }));
      return;
    }

    if (name === "assignedToEmployee") {
      const nextSelectedEmployee =
        employees.find((employee) => String(employee._id) === String(nextValue)) || null;

      setForm((prev) => ({
        ...prev,
        assignedToEmployee: nextValue,
        employeeAssignedSite:
          nextSelectedEmployee && employeeHasSite(nextSelectedEmployee, prev.employeeAssignedSite)
            ? prev.employeeAssignedSite
            : "",
        checklistNumber:
          isEditMode || (nextSelectedEmployee && employeeHasSite(nextSelectedEmployee, prev.employeeAssignedSite))
            ? prev.checklistNumber
            : "",
      }));
      return;
    }

    if (name === "employeeAssignedSite") {
      setForm((prev) => {
        const canKeepEmployee =
          !prev.assignedToEmployee ||
          filteredEmployees.some(
            (employee) => String(employee._id) === String(prev.assignedToEmployee)
          ) ||
          employees.some(
            (employee) =>
              String(employee._id) === String(prev.assignedToEmployee) &&
              employeeHasSite(employee, value)
          );

        return {
          ...prev,
          employeeAssignedSite: nextValue,
          assignedToEmployee: canKeepEmployee ? prev.assignedToEmployee : "",
          checklistNumber: !isEditMode && !nextValue ? "" : prev.checklistNumber,
        };
      });
      return;
    }

    if (name === "scheduleType") {
      setForm((prev) => ({
        ...prev,
        scheduleType: nextValue,
        customRepeatInterval:
          nextValue === "custom" ? prev.customRepeatInterval || "1" : prev.customRepeatInterval,
        customRepeatUnit:
          nextValue === "custom" ? prev.customRepeatUnit || "daily" : prev.customRepeatUnit,
      }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: nextValue }));
  };

  const updateItem = (rowId, key, value) => {
    setSubmitError("");
    setItems((prev) =>
      prev.map((item) => (item.id === rowId ? { ...item, [key]: value } : item))
    );
  };

  const addItem = () => {
    setSubmitError("");
    setItems((prev) => [...prev, createItemRow()]);
  };

  const removeItem = (rowId) => {
    setSubmitError("");
    setItems((prev) => prev.filter((item) => item.id !== rowId));
  };

  const updateApprovalRow = (rowId, value) => {
    setSubmitError("");
    setApprovalRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, approvalEmployee: value } : row))
    );
  };

  const addApprovalRow = () => {
    setSubmitError("");
    setApprovalRows((prev) => [...prev, createApprovalRow()]);
  };

  const removeApprovalRow = (rowId) => {
    setSubmitError("");
    setApprovalRows((prev) => (prev.length === 1 ? prev : prev.filter((row) => row.id !== rowId)));
  };

  const openWorkflowMapping = () => {
    setWorkflowDepartment("");
    setWorkflowSubDepartment("");
    setWorkflowSearch("");
    setWorkflowSelectedEmployeeIds(
      approvalRows.map((row) => row.approvalEmployee).filter(Boolean)
    );
    setShowWorkflowMapping(true);
  };

  const closeWorkflowMapping = () => {
    setShowWorkflowMapping(false);
  };

  const toggleWorkflowEmployee = (employeeId) => {
    setWorkflowSelectedEmployeeIds((prev) => {
      const normalizedId = String(employeeId);

      if (prev.includes(normalizedId)) {
        return prev.filter((id) => id !== normalizedId);
      }

      return [...prev, normalizedId];
    });
  };

  const applyWorkflowMapping = () => {
    const nextIds = workflowSelectedEmployeeIds.filter(Boolean);

    if (!nextIds.length) {
      setApprovalRows([createApprovalRow()]);
      setShowWorkflowMapping(false);
      return;
    }

    setApprovalRows(
      nextIds.map((approvalEmployee) => ({
        id: `${Date.now()}-${approvalEmployee}`,
        approvalEmployee,
      }))
    );
    setShowWorkflowMapping(false);
  };

  const filteredWorkflowEmployees = employees
    .filter((employee) => String(employee._id) !== String(form.assignedToEmployee))
    .filter((employee) => {
      if (!workflowDepartment) return true;
      return (employee.departmentIds || []).some(
        (departmentId) => String(departmentId) === String(workflowDepartment)
      );
    })
    .filter((employee) => {
      if (!workflowSubDepartment) return true;
      return (employee.subDepartment || []).some(
        (subDepartmentId) => String(subDepartmentId) === String(workflowSubDepartment)
      );
    })
    .filter((employee) => {
      if (!workflowSearch) return true;

      const searchValue = workflowSearch.toLowerCase();
      return [
        employee.employeeCode,
        employee.employeeName,
        employee.departmentDisplay,
        employee.subDepartmentDisplay,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchValue));
    });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setHasAttemptedSubmit(true);
    setSubmitError("");

    const { errors, normalizedItems, normalizedApprovals } = validationResult;

    if (Object.keys(errors).length) {
      scrollToFirstValidationError(errors);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...form,
        checklistSourceSite: form.checklistSourceSite || undefined,
        isDependentTask: form.isDependentTask,
        checklistItems: normalizedItems,
        approvals: normalizedApprovals,
      };

      if (isEditMode) {
        await api.put(`/checklists/${id}`, payload);
      } else {
        await api.post("/checklists", payload);
      }

      navigate("/checklists");
    } catch (err) {
      console.error("Checklist save failed:", err);
      setSubmitError(
        err.response?.data?.message ||
          (isEditMode ? "Failed to update checklist master" : "Failed to create checklist master")
      );
      scrollToSubmitError();
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return <div className="container mt-4">Loading checklist form...</div>;
  }

  return (
    <div className="container mt-4 mb-5" data-testid="checklist-create-page">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="mb-1">
            {isEditMode ? "Edit Checklist Master" : "Create Checklist Master"}
          </h3>
          <div className="text-muted">
            {usesApprovalRequestFlow
              ? "Build the recurring checklist template and submit it for admin approval before it goes live."
              : "Build the recurring checklist template that will generate employee tasks automatically."}
          </div>
        </div>

        <button type="button" className="btn btn-outline-secondary" onClick={() => navigate("/checklists")}>
          Back
        </button>
      </div>

      <form className="card shadow-sm border-0" onSubmit={handleSubmit} noValidate>
        <div className="card-body">
          {submitError ? (
            <div ref={submitErrorRef} className="alert alert-danger mb-4" role="alert">
              {submitError}
            </div>
          ) : null}

          <div className="row g-4">
            <div className="col-12 col-xl-6">
              <div
                className="border rounded-4 p-4 bg-light h-100"
                data-testid="employee-assignment-section"
              >
                <div className="mb-3">
                  <h5 className="mb-1">Master Setup</h5>
                  <div className="text-muted small">
                    Map the site, employee, schedule, and priority for this checklist master.
                  </div>
                </div>

                <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label fw-semibold">Assigned Site</label>
              <select
                ref={registerFieldRef("employeeAssignedSite")}
                className={getFieldClassName("form-select", "employeeAssignedSite")}
                name="employeeAssignedSite"
                value={form.employeeAssignedSite}
                onChange={handleFormChange}
                disabled={Boolean(restrictedChecklistSiteId) || !availableSites.length}
                required
              >
                <option value="">Select Site</option>
                {availableSites.map((site) => (
                  <option key={site._id} value={site._id}>
                    {getChecklistSiteName(site)}
                  </option>
                ))}
              </select>
              {renderFieldError("employeeAssignedSite")}
              <small className="text-muted">
                Checklist number is generated from this site. Example: Head Office {"->"} HO - 001.
              </small>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">Assign To Employee</label>
              <select
                ref={registerFieldRef("assignedToEmployee")}
                className={getFieldClassName("form-select", "assignedToEmployee")}
                name="assignedToEmployee"
                value={form.assignedToEmployee}
                onChange={handleFormChange}
                required
              >
                <option value="">Select Employee</option>
                {filteredEmployees.map((employee) => (
                  <option key={employee._id} value={employee._id}>
                    {formatEmployeeLabel(employee)}
                  </option>
                ))}
              </select>
              {renderFieldError("assignedToEmployee")}
              <small className="text-muted">
                {restrictedChecklistSiteId
                  ? "Employees are limited to your mapped site."
                  : form.employeeAssignedSite
                  ? "Only employees mapped to the selected site are shown."
                  : "All active employees are shown until a site is selected."}
              </small>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold">Checklist Number</label>
              <input className="form-control" value={form.checklistNumber} readOnly />
              <small className="text-muted">
                {numberLoading
                  ? "Generating checklist number..."
                  : "Generated from selected assigned site"}
              </small>
            </div>

            <div className="col-md-8">
              <label className="form-label fw-semibold">Checklist Name</label>
              <input
                ref={registerFieldRef("checklistName")}
                className={getFieldClassName("form-control", "checklistName")}
                name="checklistName"
                value={form.checklistName}
                onChange={handleFormChange}
                required
              />
              {renderFieldError("checklistName")}
            </div>

            <div className="col-md-6">
              <div className="border rounded-3 h-100 p-3">
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <label className="form-label fw-semibold mb-1">Task Scoring</label>
                    <div className="small text-muted">
                      Enable marks only when this checklist should contribute to scoring.
                    </div>
                  </div>

                  <div className="form-check form-switch mt-1">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="enableMark"
                      name="enableMark"
                      checked={form.enableMark}
                      onChange={handleFormChange}
                    />
                    <label className="form-check-label" htmlFor="enableMark">
                      {form.enableMark ? "Enabled" : "Disabled"}
                    </label>
                  </div>
                </div>

                {form.enableMark ? (
                  <div className="row g-3 mt-1">
                    <div className="col-12">
                      <label className="form-label fw-semibold">Base Mark</label>
                      <input
                        ref={registerFieldRef("baseMark")}
                        type="number"
                        min="0"
                        step="0.5"
                        className={getFieldClassName("form-control", "baseMark")}
                        name="baseMark"
                        value={form.baseMark}
                        onChange={handleFormChange}
                        required={form.enableMark}
                      />
                      {renderFieldError("baseMark")}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Delay Penalty / Day</label>
                      <input
                        ref={registerFieldRef("delayPenaltyPerDay")}
                        type="number"
                        min="0"
                        step="0.5"
                        className={getFieldClassName("form-control", "delayPenaltyPerDay")}
                        name="delayPenaltyPerDay"
                        value={form.delayPenaltyPerDay}
                        onChange={handleFormChange}
                        required={form.enableMark}
                      />
                      {renderFieldError("delayPenaltyPerDay")}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Advance Bonus / Day</label>
                      <input
                        ref={registerFieldRef("advanceBonusPerDay")}
                        type="number"
                        min="0"
                        step="0.5"
                        className={getFieldClassName("form-control", "advanceBonusPerDay")}
                        name="advanceBonusPerDay"
                        value={form.advanceBonusPerDay}
                        onChange={handleFormChange}
                        required={form.enableMark}
                      />
                      {renderFieldError("advanceBonusPerDay")}
                    </div>

                    <div className="col-12">
                      <div className="small text-muted">
                        Example: base {formatMarkValue(form.baseMark)} | delay -
                        {formatMarkValue(form.delayPenaltyPerDay)}/day | advance +
                        {formatMarkValue(form.advanceBonusPerDay)}/day
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-light border mt-3 mb-0 small">
                    Marks are disabled. This checklist will be treated as an optional no-score task.
                  </div>
                )}
              </div>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">Checklist Source Site</label>
              <select
                className="form-select"
                name="checklistSourceSite"
                value={form.checklistSourceSite}
                onChange={handleFormChange}
                disabled={!siteOptions.length}
              >
                <option value="">Select Source Site</option>
                {siteOptions.map((site) => (
                  <option key={site._id} value={site._id}>
                    {getChecklistSiteName(site)}
                  </option>
                ))}
              </select>
              <small className="text-muted">
                Optional. Site names match the same list format shown on employee screens.
              </small>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold d-block">Dependent Task</label>
              <div className="d-flex gap-3 pt-2">
                <label className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="isDependentTask"
                    value="no"
                    checked={!form.isDependentTask}
                    onChange={handleFormChange}
                  />
                  <span className="form-check-label">No</span>
                </label>

                <label className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="isDependentTask"
                    value="yes"
                    checked={form.isDependentTask}
                    onChange={handleFormChange}
                  />
                  <span className="form-check-label">Yes</span>
                </label>
              </div>
              <small className="text-muted">
                When enabled, this task is created only after the previous task is approved or nil approved.
              </small>
            </div>

            {form.isDependentTask ? (
              <>
                <div className="col-md-8">
                  <label className="form-label fw-semibold">
                    Old Task Number / Previous Task Number
                  </label>
                  <select
                    ref={registerFieldRef("dependencyChecklistId")}
                    className={getFieldClassName("form-select", "dependencyChecklistId")}
                    name="dependencyChecklistId"
                    value={form.dependencyChecklistId}
                    onChange={handleFormChange}
                    required={form.isDependentTask}
                  >
                    <option value="">Select Previous Task</option>
                    {availableDependencyChecklists.map((checklist) => (
                      <option key={checklist._id} value={checklist._id}>
                        {[
                          checklist.checklistNumber,
                          checklist.checklistName,
                          formatEmployeeLabel(checklist.assignedToEmployee),
                        ]
                          .filter(Boolean)
                          .join(" | ")}
                      </option>
                    ))}
                  </select>
                  {renderFieldError("dependencyChecklistId")}
                  <small className="text-muted">
                    This dependent task will be auto-created only once after the selected previous
                    task reaches final completion.
                  </small>
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold">Target Day Count</label>
                  <input
                    ref={registerFieldRef("targetDayCount")}
                    type="number"
                    min="0.01"
                    step="0.5"
                    className={getFieldClassName("form-control", "targetDayCount")}
                    name="targetDayCount"
                    value={form.targetDayCount}
                    onChange={handleFormChange}
                    required={form.isDependentTask}
                  />
                  {renderFieldError("targetDayCount")}
                  <small className="text-muted">
                    Due date = previous task completed date/time + target day count.
                  </small>
                </div>
              </>
            ) : null}

            <div className="col-md-6">
              <label className="form-label fw-semibold">Schedule Type</label>
              <select
                className="form-select"
                name="scheduleType"
                value={form.scheduleType}
                onChange={handleFormChange}
                data-testid="schedule-type-select"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">Start Date</label>
              <input
                ref={registerFieldRef("startDate")}
                type="date"
                className={getFieldClassName("form-control", "startDate")}
                name="startDate"
                value={form.startDate}
                onChange={handleFormChange}
                required
              />
              {renderFieldError("startDate")}
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">Start Task Time</label>
              <input
                ref={registerFieldRef("scheduleTime")}
                type="time"
                className={getFieldClassName("form-control", "scheduleTime")}
                name="scheduleTime"
                value={form.scheduleTime}
                onChange={handleFormChange}
                required
              />
              {renderFieldError("scheduleTime")}
              <small className="text-muted">
                Tasks auto-post from Schedule Type, Start Date, and Task Time using India time (IST).
              </small>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">End Date</label>
              <input
                ref={registerFieldRef("endDate")}
                type="date"
                className={getFieldClassName("form-control", "endDate")}
                name="endDate"
                value={form.endDate}
                onChange={handleFormChange}
                required
              />
              {renderFieldError("endDate")}
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">End Time</label>
              <input
                ref={registerFieldRef("endTime")}
                type="time"
                className={getFieldClassName("form-control", "endTime")}
                name="endTime"
                value={form.endTime}
                onChange={handleFormChange}
                required
              />
              {renderFieldError("endTime")}
              <small className="text-muted">
                Reports use the end date and end time to mark each task as On Time, Delay, or Advanced.
              </small>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold">Priority</label>
              <select
                className="form-select"
                name="priority"
                value={form.priority}
                onChange={handleFormChange}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <small className="text-muted">
                Task lists use this priority to highlight urgency with color.
              </small>
            </div>

            {form.scheduleType === "custom" && (
              <>
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Custom Interval</label>
                  <input
                    ref={registerFieldRef("customRepeatInterval")}
                    type="number"
                    min="1"
                    className={getFieldClassName("form-control", "customRepeatInterval")}
                    name="customRepeatInterval"
                    value={form.customRepeatInterval}
                    onChange={handleFormChange}
                  />
                  {renderFieldError("customRepeatInterval")}
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Custom Unit</label>
                  <select
                    ref={registerFieldRef("customRepeatUnit")}
                    className={getFieldClassName("form-select", "customRepeatUnit")}
                    name="customRepeatUnit"
                    value={form.customRepeatUnit}
                    onChange={handleFormChange}
                  >
                    {customRepeatUnitOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {renderFieldError("customRepeatUnit")}
                </div>

                {form.customRepeatUnit === "weekly" && (
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Day of Week</label>
                    <select
                      ref={registerFieldRef("repeatDayOfWeek")}
                      className={getFieldClassName("form-select", "repeatDayOfWeek")}
                      name="repeatDayOfWeek"
                      value={form.repeatDayOfWeek}
                      onChange={handleFormChange}
                      data-testid="day-of-week-select"
                    >
                      <option value="">Select Day</option>
                      {weekDays.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                    {renderFieldError("repeatDayOfWeek")}
                  </div>
                )}

                {form.customRepeatUnit === "monthly" && (
                  <div className="col-md-6">
                    <label className="form-label fw-semibold">Day of Month</label>
                    <input
                      ref={registerFieldRef("repeatDayOfMonth")}
                      type="number"
                      min="1"
                      max="31"
                      className={getFieldClassName("form-control", "repeatDayOfMonth")}
                      name="repeatDayOfMonth"
                      value={form.repeatDayOfMonth}
                      onChange={handleFormChange}
                    />
                    {renderFieldError("repeatDayOfMonth")}
                  </div>
                )}

                {form.customRepeatUnit === "yearly" && (
                  <>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Month</label>
                      <select
                        ref={registerFieldRef("repeatMonthOfYear")}
                        className={getFieldClassName("form-select", "repeatMonthOfYear")}
                        name="repeatMonthOfYear"
                        value={form.repeatMonthOfYear}
                        onChange={handleFormChange}
                      >
                        <option value="">Select Month</option>
                        {monthOfYearOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {renderFieldError("repeatMonthOfYear")}
                    </div>

                    <div className="col-md-6">
                      <label className="form-label fw-semibold">Day of Month</label>
                      <input
                        ref={registerFieldRef("repeatDayOfMonth")}
                        type="number"
                        min="1"
                        max="31"
                        className={getFieldClassName("form-control", "repeatDayOfMonth")}
                        name="repeatDayOfMonth"
                        value={form.repeatDayOfMonth}
                        onChange={handleFormChange}
                      />
                      {renderFieldError("repeatDayOfMonth")}
                    </div>
                  </>
                )}

                <div className="col-12">
                  <div className="alert alert-info mb-0">
                    Custom repeat summary: {customScheduleSummary}
                  </div>
                </div>
              </>
            )}

                </div>
              </div>
            </div>

            <div className="col-12 col-xl-6">
              <div className="d-flex flex-column gap-4">
                <div
                  ref={registerSectionRef("taskRelatedQuestions")}
                  className={getSectionClassName("border rounded-4 p-4 bg-light", "taskRelatedQuestions")}
                  style={getSectionStyle("taskRelatedQuestions")}
                >
                  <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-3">
            <div>
              <h5 className="mb-1">Task Related Questions</h5>
              <div className="text-muted small">
                Optional. These questions are copied into every generated employee task and shown
                for employee answers.
              </div>
            </div>

            <button type="button" className="btn btn-sm btn-success" onClick={addItem}>
              + Add Question
            </button>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ width: "30%" }}>Question</th>
                  <th>Guidance</th>
                  <th style={{ width: "130px" }}>Required</th>
                  <th style={{ width: "90px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.length ? (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <input
                          ref={
                            validationErrors.taskRelatedQuestions &&
                            !String(item.label || "").trim() &&
                            String(item.detail || "").trim()
                              ? registerFieldRef("taskRelatedQuestions")
                              : undefined
                          }
                          className={
                            validationErrors.taskRelatedQuestions &&
                            !String(item.label || "").trim() &&
                            String(item.detail || "").trim()
                              ? "form-control is-invalid"
                              : "form-control"
                          }
                          value={item.label}
                          onChange={(event) => updateItem(item.id, "label", event.target.value)}
                          placeholder="Question text"
                        />
                      </td>
                      <td>
                        <input
                          className="form-control"
                          value={item.detail}
                          onChange={(event) => updateItem(item.id, "detail", event.target.value)}
                          placeholder="Guidance or example answer for the employee"
                        />
                      </td>
                      <td>
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={item.isRequired}
                            onChange={(event) =>
                              updateItem(item.id, "isRequired", event.target.checked)
                            }
                          />
                          <label className="form-check-label">Mandatory</label>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => removeItem(item.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center text-muted py-4">
                      Task related questions are optional. Add a question only when needed.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {renderSectionError("taskRelatedQuestions")}
                </div>

                <div
                  ref={registerSectionRef("approvalSection")}
                  className={getSectionClassName("border rounded-4 p-4 bg-light", "approvalSection")}
                  style={getSectionStyle("approvalSection")}
                >
                  <div className="mb-3">
            <h5 className="mb-1">Approval / Workflow Mapping</h5>
            <div className="text-muted small">
              After submission, the generated task moves only to the mapped approver chain.
            </div>
          </div>

          <div className="d-flex gap-3 mb-3">
            {["default", "custom"].map((option) => (
              <label className="form-check" key={option}>
                <input
                  className="form-check-input"
                  type="radio"
                  name="approvalHierarchy"
                  value={option}
                  checked={form.approvalHierarchy === option}
                  onChange={handleFormChange}
                />
                <span className="form-check-label text-capitalize">{option}</span>
              </label>
            ))}
          </div>

          {form.approvalHierarchy === "default" ? (
            <div className={`alert ${defaultApprover ? "alert-info" : "alert-warning"} mb-0`}>
              {defaultApprover
                ? `Default Department Head mapping: ${formatEmployeeLabel(defaultApprover)}`
                : "No Superior Employee mapping found for the selected employee. Configure it first to use default approval."}
            </div>
          ) : (
            <>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="small text-muted">
                  Custom workflow mapping overrides the employee's default Department Head.
                </div>

                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={openWorkflowMapping}
                  >
                    Workflow Mapping
                  </button>
                  <button type="button" className="btn btn-sm btn-success" onClick={addApprovalRow}>
                    + Add Approver
                  </button>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-bordered align-middle">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: "120px" }}>Level</th>
                      <th>Approver Employee</th>
                      <th style={{ width: "90px" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalRows.map((row, index) => (
                      <tr key={row.id}>
                        <td>{index + 1}</td>
                        <td>
                          <select
                            ref={
                              index === 0 && form.approvalHierarchy === "custom"
                                ? registerFieldRef("approvalSection")
                                : undefined
                            }
                            className={
                              validationErrors.approvalSection && !row.approvalEmployee
                                ? "form-select is-invalid"
                                : "form-select"
                            }
                            value={row.approvalEmployee}
                            onChange={(event) => updateApprovalRow(row.id, event.target.value)}
                          >
                            <option value="">Select Approver</option>
                            {employees
                              .filter(
                                (employee) =>
                                  String(employee._id) !== String(form.assignedToEmployee)
                              )
                              .map((employee) => (
                                <option key={employee._id} value={employee._id}>
                                  {formatEmployeeLabel(employee)}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => removeApprovalRow(row.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="small text-muted mt-2">
                Use <span className="fw-semibold">Workflow Mapping</span> to pick approvers by
                department and sub department, then fine-tune the level order in the table if
                needed.
              </div>
            </>
          )}
          {renderSectionError("approvalSection")}

                  {selectedEmployee && (
                    <div className="border rounded-4 p-4 bg-light">
                      <div className="fw-semibold mb-1">Assignment Summary</div>
                      <div className="small text-muted">
                        Employee: {formatEmployeeLabel(selectedEmployee)}
                      </div>
                      <div className="small text-muted">
                        Schedule: {formatScheduleLabel(form)} starting {form.startDate || "-"} at{" "}
                        {form.scheduleTime || "-"}
                      </div>
                      <div className="small text-muted">
                        End Window: {form.endDate || "-"} at {form.endTime || "-"}
                      </div>
                      <div className="small text-muted">
                        Priority: {formatPriorityLabel(form.priority)}
                      </div>
                      <div className="small text-muted">
                        Task Scoring: {formatChecklistScoreLabel(form)}
                      </div>
                      <div className="small text-muted">
                        Source Site: {getChecklistSiteName(selectedSourceSite) || "-"}
                      </div>
                      <div className="small text-muted">
                        Dependency:{" "}
                        {form.isDependentTask
                          ? formatChecklistDependencyLabel({
                              isDependentTask: true,
                              dependencyChecklistId: selectedDependencyChecklist,
                              dependencyTaskNumber:
                                selectedDependencyChecklist?.checklistNumber || "",
                            })
                          : "No"}
                      </div>
                      <div className="small text-muted">
                        Target Day Count:{" "}
                        {form.isDependentTask
                          ? formatTargetDayCountLabel(form.targetDayCount)
                          : "Not required"}
                      </div>
                      <div className="small text-muted">
                        Approval Flow:{" "}
                        {form.approvalHierarchy === "default"
                          ? defaultApprover
                            ? formatEmployeeLabel(defaultApprover)
                            : "Not configured"
                          : formatApprovalLabel({
                              approvals: approvalRows
                                .filter((row) => row.approvalEmployee)
                                .map((row, index) => ({
                                  approvalLevel: index + 1,
                                  approvalEmployee:
                                    employees.find(
                                      (employee) =>
                                        String(employee._id) === String(row.approvalEmployee)
                                    ) || null,
                                })),
                            })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card-footer bg-white d-flex justify-content-end gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate("/checklists")}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            data-testid="save-checklist-button"
          >
            {loading
              ? isEditMode
                ? usesApprovalRequestFlow
                  ? "Submitting..."
                  : "Updating..."
                : usesApprovalRequestFlow
                ? "Submitting..."
                : "Creating..."
              : isEditMode
              ? usesApprovalRequestFlow
                ? "Submit Edit Request"
                : "Update Checklist Master"
              : usesApprovalRequestFlow
              ? "Submit for Approval"
              : "Create Checklist Master"}
          </button>
        </div>
      </form>

      {showWorkflowMapping && (
        <div
          className="modal fade show d-block app-modal-overlay"
          tabIndex="-1"
        >
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <div>
                  <h5 className="modal-title mb-1">Workflow Mapping</h5>
                  <div className="small text-muted">
                    Select the approver employees who should receive this checklist after submission.
                  </div>
                </div>
                <button type="button" className="btn-close" onClick={closeWorkflowMapping} />
              </div>

              <div className="modal-body">
                <div className="row g-3 mb-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Department</label>
                    <select
                      className="form-select"
                      value={workflowDepartment}
                      onChange={(event) => {
                        setWorkflowDepartment(event.target.value);
                        setWorkflowSubDepartment("");
                      }}
                    >
                      <option value="">All Departments</option>
                      {departments.map((department) => (
                        <option key={department._id} value={department._id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Sub Department</label>
                    <select
                      className="form-select"
                      value={workflowSubDepartment}
                      onChange={(event) => setWorkflowSubDepartment(event.target.value)}
                      disabled={!workflowDepartment || !workflowSubDepartmentOptions.length}
                    >
                      <option value="">
                        {workflowDepartment ? "All Sub Departments" : "Select Department First"}
                      </option>
                      {workflowSubDepartmentOptions.map((subDepartment) => (
                        <option key={subDepartment._id} value={subDepartment._id}>
                          {subDepartment.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold">Search</label>
                    <input
                      className="form-control"
                      placeholder="Search employee code, name, or department"
                      value={workflowSearch}
                      onChange={(event) => setWorkflowSearch(event.target.value)}
                    />
                  </div>
                </div>

                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="small text-muted">
                    Selected approvers: {workflowSelectedEmployeeIds.length}
                  </div>
                </div>

                <div className="border rounded p-2" style={{ maxHeight: "320px", overflowY: "auto" }}>
                  {filteredWorkflowEmployees.length === 0 ? (
                    <div className="text-muted">No employees found for the selected workflow filters.</div>
                  ) : (
                    filteredWorkflowEmployees.map((employee) => {
                      const employeeId = String(employee._id);
                      const isChecked = workflowSelectedEmployeeIds.includes(employeeId);

                      return (
                        <label className="form-check d-flex gap-2 mb-3" key={employeeId}>
                          <input
                            className="form-check-input mt-1"
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleWorkflowEmployee(employeeId)}
                          />
                          <span>
                            <span className="fw-semibold">{formatEmployeeLabel(employee)}</span>
                            <br />
                            <small className="text-muted">
                              {employee.departmentDisplay ||
                                formatDepartmentList(employee.departmentDetails || employee.department) ||
                                "No department"}
                            </small>
                            <br />
                            <small className="text-muted">
                              {employee.subDepartmentDisplay ||
                                employee.subDepartmentPath ||
                                employee.subDepartmentName ||
                                "No sub department"}
                            </small>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={closeWorkflowMapping}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={applyWorkflowMapping}>
                  Apply Workflow Mapping
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

