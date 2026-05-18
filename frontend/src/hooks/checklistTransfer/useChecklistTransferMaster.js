import { useEffect, useMemo, useState } from "react";
import { usePermissions } from "../../context/usePermissions";
import { getEmployees } from "../../services/employee.service";
import {
  createPermanentChecklistTransfer,
  createTemporaryChecklistTransfer,
  getChecklistTransferChecklists,
  getChecklistTransferHistory,
} from "../../services/checklistTransfer.service";
import { formatDateTime, formatScheduleLabel } from "../../utils/checklistDisplay";
import {
  buildTransferConfirmationMessage,
  initialTransferFormState,
  validatePermanentTransfer,
  validateTemporaryTransfer,
} from "../../validators/checklistTransfer.validator";

export const getEmployeeLabel = (employee) => {
  const employeeCode = String(employee?.employeeCode || "").trim();
  const employeeName = String(employee?.employeeName || "").trim();

  if (employeeCode && employeeName) return `${employeeCode} - ${employeeName}`;
  return employeeCode || employeeName || "Unknown Employee";
};

export const formatSiteLabel = (site) => {
  if (!site) return "";

  const companyName = String(site.companyName || "").trim();
  const name = String(site.name || "").trim();

  if (companyName && name) return `${companyName} - ${name}`;
  return name || companyName;
};

export const isActiveEmployee = (employee) => employee?.isActive !== false;

const buildChecklistOption = (checklist) => {
  const labelBase =
    [checklist?.checklistNumber, checklist?.checklistName].filter(Boolean).join(" - ") ||
    checklist?.checklistName ||
    "Checklist";
  const description = [
    formatSiteLabel(checklist?.employeeAssignedSite),
    formatScheduleLabel(checklist),
    checklist?.status ? "Active" : "Inactive",
    checklist?.approvalHierarchy
      ? `${String(checklist.approvalHierarchy).trim()} approval`
      : "",
    checklist?.nextOccurrenceAt
      ? `Next task ${formatDateTime(checklist.nextOccurrenceAt)}`
      : "No next task scheduled",
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    value: checklist?._id,
    label: labelBase,
    description,
  };
};

export const useChecklistTransferMaster = () => {
  const { can } = usePermissions();
  const canTransferChecklist = can("checklist_transfer", "transfer");
  const canApplyTransferDirectly = can("checklist_master", "approve");
  const usesApprovalRequestFlow = canTransferChecklist && !canApplyTransferDirectly;
  const transferIntroText = !canTransferChecklist
    ? "Review mapped employees, available checklist masters, and transfer history. Submission actions stay disabled until transfer permission is granted."
    : usesApprovalRequestFlow
    ? "Prepare checklist transfer requests and send them for admin approval before any assignment change is applied."
    : "Reassign selected checklist masters between employees with either permanent movement or temporary date-based transfer windows while keeping the checklist configuration and workflow mapping unchanged.";

  const [activeOption, setActiveOption] = useState("");
  const [form, setForm] = useState(initialTransferFormState);
  const [employees, setEmployees] = useState([]);
  const [eligibleToEmployees, setEligibleToEmployees] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [selectedChecklistIds, setSelectedChecklistIds] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const sortedEmployees = useMemo(
    () =>
      [...employees].sort((left, right) => {
        const activeRank = Number(isActiveEmployee(right)) - Number(isActiveEmployee(left));
        if (activeRank !== 0) return activeRank;
        return getEmployeeLabel(left).localeCompare(getEmployeeLabel(right));
      }),
    [employees]
  );

  const selectedFromEmployee = useMemo(
    () =>
      sortedEmployees.find(
        (employee) => String(employee._id) === String(form.fromEmployeeId)
      ) || null,
    [form.fromEmployeeId, sortedEmployees]
  );

  const sortedEligibleToEmployees = useMemo(
    () =>
      [...eligibleToEmployees].sort((left, right) => {
        const activeRank = Number(isActiveEmployee(right)) - Number(isActiveEmployee(left));
        if (activeRank !== 0) return activeRank;
        return getEmployeeLabel(left).localeCompare(getEmployeeLabel(right));
      }),
    [eligibleToEmployees]
  );

  const selectedToEmployee = useMemo(
    () =>
      sortedEligibleToEmployees.find(
        (employee) => String(employee._id) === String(form.toEmployeeId)
      ) || null,
    [form.toEmployeeId, sortedEligibleToEmployees]
  );

  const toEmployeeOptions = useMemo(
    () =>
      sortedEligibleToEmployees.filter(
        (employee) =>
          isActiveEmployee(employee) &&
          String(employee._id) !== String(form.fromEmployeeId || "")
      ),
    [form.fromEmployeeId, sortedEligibleToEmployees]
  );

  const fromEmployeeSiteLabel = useMemo(() => {
    if (!selectedFromEmployee) return "No site assigned";

    if (Array.isArray(selectedFromEmployee.siteLabels) && selectedFromEmployee.siteLabels.length) {
      return selectedFromEmployee.siteLabels.join(", ");
    }

    if (Array.isArray(selectedFromEmployee.sites) && selectedFromEmployee.sites.length) {
      return selectedFromEmployee.sites.map((site) => formatSiteLabel(site)).filter(Boolean).join(", ");
    }

    return "No site assigned";
  }, [selectedFromEmployee]);

  const fromEmployeeDepartmentLabel = useMemo(() => {
    if (!selectedFromEmployee) return "No department assigned";

    if (String(selectedFromEmployee.departmentDisplay || "").trim()) {
      return selectedFromEmployee.departmentDisplay;
    }

    if (
      Array.isArray(selectedFromEmployee.departmentNames) &&
      selectedFromEmployee.departmentNames.length
    ) {
      return selectedFromEmployee.departmentNames.join(", ");
    }

    if (
      Array.isArray(selectedFromEmployee.departmentDetails) &&
      selectedFromEmployee.departmentDetails.length
    ) {
      return selectedFromEmployee.departmentDetails
        .map((department) => String(department?.name || "").trim())
        .filter(Boolean)
        .join(", ");
    }

    return "No department assigned";
  }, [selectedFromEmployee]);

  const checklistOptions = useMemo(
    () => checklists.map((checklist) => buildChecklistOption(checklist)),
    [checklists]
  );

  const allChecklistIds = useMemo(
    () => checklistOptions.map((option) => String(option.value)),
    [checklistOptions]
  );

  const allChecklistsSelected =
    allChecklistIds.length > 0 &&
    allChecklistIds.every((checklistId) => selectedChecklistIds.includes(checklistId));
  const isPermanentTransfer = activeOption === "permanent";
  const isTemporaryTransfer = activeOption === "temporary";
  const hasInvalidTemporaryDateRange =
    Boolean(form.fromDate) && Boolean(form.toDate) && form.fromDate > form.toDate;

  useEffect(() => {
    const loadPage = async () => {
      setPageLoading(true);
      setHistoryLoading(true);
      setError("");

      try {
        const [employeeResponse, historyResponse] = await Promise.all([
          getEmployees(),
          getChecklistTransferHistory({ limit: 25 }),
        ]);

        setEmployees(Array.isArray(employeeResponse.data) ? employeeResponse.data : []);
        setHistoryRows(Array.isArray(historyResponse.data) ? historyResponse.data : []);
      } catch (err) {
        console.error("Checklist transfer page load failed:", err);
        setEmployees([]);
        setHistoryRows([]);
        setError(err.response?.data?.message || "Failed to load checklist transfer setup.");
      } finally {
        setPageLoading(false);
        setHistoryLoading(false);
      }
    };

    void loadPage();
  }, []);

  useEffect(() => {
    if (!form.fromEmployeeId) {
      setEligibleToEmployees([]);
      setChecklists([]);
      setSelectedChecklistIds([]);
      return;
    }

    const loadChecklists = async () => {
      setChecklistLoading(true);
      setError("");
      setSuccess("");

      try {
        const response = await getChecklistTransferChecklists(form.fromEmployeeId);

        const nextChecklists = Array.isArray(response.data?.checklists)
          ? response.data.checklists
          : [];
        const nextEligibleEmployees = Array.isArray(response.data?.toEmployees)
          ? response.data.toEmployees
          : [];

        setEligibleToEmployees(nextEligibleEmployees);
        setChecklists(nextChecklists);
        setSelectedChecklistIds([]);
      } catch (err) {
        console.error("Checklist transfer checklist load failed:", err);
        setEligibleToEmployees([]);
        setChecklists([]);
        setSelectedChecklistIds([]);
        setError(
          err.response?.data?.message || "Failed to load checklists for the selected employee."
        );
      } finally {
        setChecklistLoading(false);
      }
    };

    void loadChecklists();
  }, [form.fromEmployeeId]);

  useEffect(() => {
    if (!form.toEmployeeId) return;

    const isValidToEmployee = toEmployeeOptions.some(
      (employee) => String(employee._id) === String(form.toEmployeeId)
    );

    if (!isValidToEmployee) {
      setForm((currentValue) => ({
        ...currentValue,
        toEmployeeId: "",
      }));
      setSelectedChecklistIds([]);
    }
  }, [form.toEmployeeId, toEmployeeOptions]);

  const refreshHistory = async () => {
    setHistoryLoading(true);

    try {
      const response = await getChecklistTransferHistory({ limit: 25 });
      setHistoryRows(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Checklist transfer history refresh failed:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const refreshSelectedEmployeeChecklists = async (fromEmployeeId) => {
    if (!fromEmployeeId) {
      setEligibleToEmployees([]);
      setChecklists([]);
      setSelectedChecklistIds([]);
      return;
    }

    setChecklistLoading(true);

    try {
      const response = await getChecklistTransferChecklists(fromEmployeeId);

      const nextChecklists = Array.isArray(response.data?.checklists)
        ? response.data.checklists
        : [];
      const nextEligibleEmployees = Array.isArray(response.data?.toEmployees)
        ? response.data.toEmployees
        : [];

      setEligibleToEmployees(nextEligibleEmployees);
      setChecklists(nextChecklists);
      setSelectedChecklistIds([]);
    } catch (err) {
      console.error("Checklist transfer checklist refresh failed:", err);
      setEligibleToEmployees([]);
      setChecklists([]);
      setSelectedChecklistIds([]);
      setError(
        err.response?.data?.message || "Failed to refresh checklists after transfer."
      );
    } finally {
      setChecklistLoading(false);
    }
  };

  const handleOptionOpen = (optionKey) => {
    setActiveOption(optionKey);
    setError("");
    setSuccess("");
  };

  const handleEmployeeChange = (event) => {
    const { name, value } = event.target;

    setForm((currentValue) => {
      if (name === "fromEmployeeId") {
        return {
          ...currentValue,
          fromEmployeeId: value,
          toEmployeeId: "",
        };
      }

      return {
        ...currentValue,
        [name]: value,
      };
    });

    setError("");
    setSuccess("");

    if (name === "fromEmployeeId") {
      setEligibleToEmployees([]);
    }
  };

  const selectAllChecklists = () => {
    setSelectedChecklistIds(allChecklistIds);
  };

  const clearSelectedChecklists = () => {
    setSelectedChecklistIds([]);
  };

  const handlePermanentTransfer = async () => {
    setError("");
    setSuccess("");

    const validationError = validatePermanentTransfer({
      form,
      selectedChecklistIds,
      toEmployeeOptions,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    const confirmed = window.confirm(
      buildTransferConfirmationMessage({
        transferType: "permanent",
        count: selectedChecklistIds.length,
        fromEmployeeLabel: getEmployeeLabel(selectedFromEmployee),
        toEmployeeLabel: getEmployeeLabel(selectedToEmployee),
        requiresApproval: usesApprovalRequestFlow,
      })
    );

    if (!confirmed) return;

    setSubmitting(true);

    try {
      const response = await createPermanentChecklistTransfer({
        fromEmployeeId: form.fromEmployeeId,
        toEmployeeId: form.toEmployeeId,
        checklistIds: selectedChecklistIds,
      });

      const transferredCount = Number(
        response.data?.transferredCount || selectedChecklistIds.length
      );

      setSuccess(
        response.data?.message ||
          `${transferredCount} checklist${
            transferredCount === 1 ? "" : "s"
          } transferred successfully to ${getEmployeeLabel(selectedToEmployee)}.`
      );
      setForm((currentValue) => ({
        ...currentValue,
        toEmployeeId: "",
      }));

      if (!usesApprovalRequestFlow) {
        await Promise.all([
          refreshSelectedEmployeeChecklists(form.fromEmployeeId),
          refreshHistory(),
        ]);
      }
    } catch (err) {
      console.error("Checklist permanent transfer failed:", err);
      setError(err.response?.data?.message || "Failed to transfer selected checklists.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTemporaryTransfer = async () => {
    setError("");
    setSuccess("");

    const validationError = validateTemporaryTransfer({
      form,
      selectedChecklistIds,
      toEmployeeOptions,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    const confirmed = window.confirm(
      buildTransferConfirmationMessage({
        transferType: "temporary",
        count: selectedChecklistIds.length,
        fromEmployeeLabel: getEmployeeLabel(selectedFromEmployee),
        toEmployeeLabel: getEmployeeLabel(selectedToEmployee),
        fromDate: form.fromDate,
        toDate: form.toDate,
        requiresApproval: usesApprovalRequestFlow,
      })
    );

    if (!confirmed) return;

    setSubmitting(true);

    try {
      const response = await createTemporaryChecklistTransfer({
        fromEmployeeId: form.fromEmployeeId,
        toEmployeeId: form.toEmployeeId,
        fromDate: form.fromDate,
        toDate: form.toDate,
        checklistIds: selectedChecklistIds,
      });

      const transferredCount = Number(
        response.data?.transferredCount || selectedChecklistIds.length
      );
      const transferStatus = String(response.data?.transferStatus || "").trim().toLowerCase();

      setSuccess(
        response.data?.message ||
          `${transferredCount} checklist${
            transferredCount === 1 ? "" : "s"
          } scheduled for temporary transfer to ${getEmployeeLabel(selectedToEmployee)}${
            transferStatus === "active"
              ? ` from ${form.fromDate} to ${form.toDate}.`
              : ` for ${form.fromDate} to ${form.toDate}.`
          }`
      );
      setForm((currentValue) => ({
        ...currentValue,
        toEmployeeId: "",
        fromDate: "",
        toDate: "",
      }));
      setSelectedChecklistIds([]);

      if (!usesApprovalRequestFlow) {
        await Promise.all([
          refreshSelectedEmployeeChecklists(form.fromEmployeeId),
          refreshHistory(),
        ]);
      }
    } catch (err) {
      console.error("Checklist temporary transfer failed:", err);
      setError(
        err.response?.data?.message || "Failed to save the temporary checklist transfer."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return {
    activeOption,
    allChecklistIds,
    allChecklistsSelected,
    canTransferChecklist,
    checklistLoading,
    checklistOptions,
    checklists,
    clearSelectedChecklists,
    error,
    form,
    fromEmployeeDepartmentLabel,
    fromEmployeeSiteLabel,
    handleEmployeeChange,
    handleOptionOpen,
    handlePermanentTransfer,
    handleTemporaryTransfer,
    hasInvalidTemporaryDateRange,
    historyLoading,
    historyRows,
    isPermanentTransfer,
    isTemporaryTransfer,
    pageLoading,
    selectAllChecklists,
    selectedChecklistIds,
    selectedFromEmployee,
    selectedToEmployee,
    setSelectedChecklistIds,
    sortedEmployees,
    submitting,
    success,
    toEmployeeOptions,
    transferIntroText,
    usesApprovalRequestFlow,
  };
};
