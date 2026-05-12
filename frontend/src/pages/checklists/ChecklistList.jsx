import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { usePermissions } from "../../context/usePermissions";
import {
  formatApprovalLabel,
  formatApprovalTypeLabel,
  formatChecklistDependencyLabel,
  formatChecklistDependencyStatus,
  formatChecklistTaskStatus,
  formatChecklistScoreLabel,
  formatCurrentApproverLabel,
  formatDateTime,
  formatEmployeeLabel,
  formatPriorityLabel,
  formatScheduleLabel,
  formatTaskFinalMarkLabel,
  formatTaskMarkDayLabel,
  formatTargetDayCountLabel,
  getApprovalTypeBadgeClass,
  getChecklistDependencyStatusBadgeClass,
  getPriorityBadgeClass,
  getPriorityRowClass,
  getChecklistTaskStatusBadgeClass,
} from "../../utils/checklistDisplay";
import {
  EXCEL_IMPORT_ACCEPT,
  EXCEL_IMPORT_OPTIONS,
  validateFile,
} from "../../utils/fileValidation";

const getChecklistSiteName = (site) =>
  String(typeof site === "string" ? site : site?.name || "").trim();

const EMPTY_CHECKLIST_COLUMN_FILTERS = {
  checklistNumber: "",
  name: "",
  sourceSite: "",
  employee: "",
  priority: "",
  schedule: "",
  startDate: "",
  endDate: "",
  nextTaskDate: "",
  approverMapping: "",
  dependency: "",
  status: "",
};

const checklistDateInputFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const normalizeFilterText = (value) => String(value || "").trim().toLowerCase();

const textIncludesFilter = (value, filterValue) => {
  const normalizedFilter = normalizeFilterText(filterValue);
  if (!normalizedFilter) return true;
  return normalizeFilterText(value).includes(normalizedFilter);
};

const getDateFilterValue = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = checklistDateInputFormatter
    .formatToParts(date)
    .reduce((accumulator, part) => {
      if (part.type !== "literal") {
        accumulator[part.type] = part.value;
      }

      return accumulator;
    }, {});

  return parts.year && parts.month && parts.day
    ? `${parts.year}-${parts.month}-${parts.day}`
    : "";
};

const getApproverMappingFilterLabel = (checklist) =>
  String(checklist?.approvalHierarchy || "").toLowerCase() === "custom"
    ? formatApprovalLabel(checklist)
    : "Default";

const hasChecklistColumnFilters = (filters = {}) =>
  Object.values(filters).some((value) => String(value || "").trim());

const getChecklistColumnFilterOptions = (rows = []) => {
  const sourceSites = new Set();
  const employees = new Set();
  const approverMappings = new Set();

  rows.forEach((row) => {
    const sourceSite = getChecklistSiteName(row.checklistSourceSite);
    const employee = formatEmployeeLabel(row.assignedToEmployee);
    const approverMapping = getApproverMappingFilterLabel(row);

    if (sourceSite) sourceSites.add(sourceSite);
    if (employee && employee !== "-") employees.add(employee);
    if (approverMapping && approverMapping !== "-") approverMappings.add(approverMapping);
  });

  const sortLabels = (left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" });

  return {
    sourceSites: [...sourceSites].sort(sortLabels),
    employees: [...employees].sort(sortLabels),
    approverMappings: [...approverMappings].sort(sortLabels),
  };
};

const filterChecklistRowsByColumns = (rows = [], filters = {}) => {
  if (!hasChecklistColumnFilters(filters)) return rows;

  return rows.filter((row) => {
    const priority = normalizeFilterText(row.priority);
    const schedule = normalizeFilterText(row.scheduleType || row.repeatType);
    const status = row.status ? "active" : "inactive";
    const dependency = row.isDependentTask ? "yes" : "no";
    const sourceSite = getChecklistSiteName(row.checklistSourceSite);
    const employee = formatEmployeeLabel(row.assignedToEmployee);
    const approverMapping = getApproverMappingFilterLabel(row);

    return (
      textIncludesFilter(row.checklistNumber, filters.checklistNumber) &&
      textIncludesFilter(row.checklistName, filters.name) &&
      (!filters.sourceSite ||
        normalizeFilterText(sourceSite) === normalizeFilterText(filters.sourceSite)) &&
      textIncludesFilter(employee, filters.employee) &&
      (!filters.priority || priority === normalizeFilterText(filters.priority)) &&
      (!filters.schedule || schedule === normalizeFilterText(filters.schedule)) &&
      (!filters.startDate || getDateFilterValue(row.startDate) === filters.startDate) &&
      (!filters.endDate || getDateFilterValue(row.endDate) === filters.endDate) &&
      (!filters.nextTaskDate ||
        getDateFilterValue(row.nextOccurrenceAt) === filters.nextTaskDate) &&
      textIncludesFilter(approverMapping, filters.approverMapping) &&
      (!filters.dependency || dependency === normalizeFilterText(filters.dependency)) &&
      (!filters.status || status === normalizeFilterText(filters.status))
    );
  });
};

function ViewIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.087.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.12 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z" />
      <path d="M8 5.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5M4.5 8a3.5 3.5 0 1 1 7 0a3.5 3.5 0 0 1-7 0" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M12.854.146a.5.5 0 0 1 .707 0l2.586 2.586a.5.5 0 0 1 0 .707l-10 10L3 14l.561-3.146zM11.207 2L4 9.207V12h2.793L14 4.793z" />
      <path
        fillRule="evenodd"
        d="M1 13.5V16h2.5l7.373-7.373l-2.5-2.5zM15 3.793L12.207 1L13.5-.293a1 1 0 0 1 1.414 0l1.379 1.379a1 1 0 0 1 0 1.414z"
      />
    </svg>
  );
}

function ToggleIcon({ active }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      {active ? (
        <>
          <path d="M11 9a3 3 0 1 0 0-6a3 3 0 0 0 0 6" />
          <path
            fillRule="evenodd"
            d="M0 4a4 4 0 0 1 4-4h7a4 4 0 1 1 0 8H4a4 4 0 0 1-4-4m4-3a3 3 0 0 0 0 6h7a3 3 0 1 0 0-6z"
          />
        </>
      ) : (
        <>
          <path d="M5 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6" />
          <path
            fillRule="evenodd"
            d="M0 8a4 4 0 0 1 4-4h7a4 4 0 1 1 0 8H4a4 4 0 0 1-4-4m4-3a3 3 0 0 0 0 6h7a3 3 0 1 0 0-6z"
          />
        </>
      )}
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0A.5.5 0 0 1 8.5 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z" />
      <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 1 1 0-2H5V1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1h2.5a1 1 0 0 1 1 1M6 1v1h4V1z" />
    </svg>
  );
}

const buildChecklistImportCompletionMessage = (responseData = {}) => {
  const createdCount = Number(responseData?.createdCount || 0);
  const skippedRows = Array.isArray(responseData?.skippedRows)
    ? responseData.skippedRows
    : [];
  const failedRows = Array.isArray(responseData?.failedRows)
    ? responseData.failedRows
    : Array.isArray(responseData?.failures)
    ? responseData.failures
    : [];
  const failedCount = Number(responseData?.failedCount || 0);
  const skippedCount = Number(responseData?.skippedCount ?? skippedRows.length);
  const ignoredRows = Number(responseData?.ignoredRows || 0);
  const generatedTaskCount = Number(responseData?.generatedTaskCount || 0);
  const schedulerSkipped = responseData?.schedulerSkipped === true;
  const skippedDetails = skippedRows
    .map((row) => {
      const message = row.message || "Checklist already exists";
      return `Row ${row.rowNumber}: ${message}`;
    })
    .join("\n");
  const failedDetails = failedRows
    .map((row) => `Row ${row.rowNumber}: ${row.message}`)
    .join("\n");
  const ignoredRowsMessage = ignoredRows
    ? `(${ignoredRows} template or empty row${ignoredRows === 1 ? "" : "s"} ignored)`
    : "";
  const alertLines = [
    "Import completed.",
    "",
    `${createdCount} checklist master${createdCount === 1 ? "" : "s"} created.`,
    `${generatedTaskCount} generated task${generatedTaskCount === 1 ? "" : "s"} created.`,
    "",
    "Summary:",
    `- ${skippedCount} row${skippedCount === 1 ? "" : "s"} skipped (already exist)`,
    `- ${failedCount} row${failedCount === 1 ? "" : "s"} failed`,
  ];

  if (schedulerSkipped) {
    alertLines.push(
      "",
      "Task generation was already running. New checklist tasks will be picked up by the scheduler."
    );
  }

  if (ignoredRowsMessage) {
    alertLines.push("", ignoredRowsMessage);
  }

  if (skippedDetails) {
    alertLines.push("", "Skipped rows:", skippedDetails);
  }

  if (failedDetails) {
    alertLines.push("", "Failed rows:", failedDetails);
  }

  return alertLines.join("\n");
};

export default function ChecklistList() {
  const { can } = usePermissions();
  const canManageChecklistMasters = can("checklist_master", "view");
  const canCreateChecklistMaster = can("checklist_master", "add");
  const canEditChecklistMaster = can("checklist_master", "edit");
  const canDeleteChecklistMaster = can("checklist_master", "delete");
  const canStatusUpdateChecklistMaster = can("checklist_master", "status_update");
  const canExportChecklistMaster = can("checklist_master", "export");
  const canViewOwnTasks = can("own_task", "view");
  const canViewApprovalInbox = can("approval_inbox", "view");

  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [scheduleType, setScheduleType] = useState("");
  const [loading, setLoading] = useState(false);
  const [schedulerLoading, setSchedulerLoading] = useState(false);
  const [selectedChecklistIds, setSelectedChecklistIds] = useState([]);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importSaving, setImportSaving] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [pendingImportFile, setPendingImportFile] = useState(null);
  const [statusConfirmation, setStatusConfirmation] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [columnFiltersVisible, setColumnFiltersVisible] = useState(false);
  const [columnFilters, setColumnFilters] = useState(EMPTY_CHECKLIST_COLUMN_FILTERS);
  const [appliedColumnFilters, setAppliedColumnFilters] = useState(
    EMPTY_CHECKLIST_COLUMN_FILTERS
  );
  const importInputRef = useRef(null);

  const filteredRows = useMemo(
    () => filterChecklistRowsByColumns(rows, appliedColumnFilters),
    [appliedColumnFilters, rows]
  );
  const columnFilterOptions = useMemo(() => getChecklistColumnFilterOptions(rows), [rows]);
  const hasColumnFilters =
    hasChecklistColumnFilters(columnFilters) || hasChecklistColumnFilters(appliedColumnFilters);

  useEffect(() => {
    const loadRows = async () => {
      setLoading(true);

      try {
        const response = await api.get(
          canManageChecklistMasters ? "/checklists" : "/checklists/tasks/my",
          {
            params: {
              search: search || undefined,
              status: status || undefined,
              scheduleType: scheduleType || undefined,
            },
          }
        );

        setRows(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Checklist list load failed:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    void loadRows();
  }, [canManageChecklistMasters, reloadToken, scheduleType, search, status]);

  useEffect(() => {
    if (!canManageChecklistMasters) {
      setSelectedChecklistIds([]);
      return;
    }

    setSelectedChecklistIds((currentValue) =>
      currentValue.filter((selectedId) =>
        filteredRows.some((row) => String(row._id) === String(selectedId))
      )
    );
  }, [canManageChecklistMasters, filteredRows]);

  const removeRowsFromState = (checklistIds) => {
    const normalizedIds = checklistIds.map((id) => String(id));

    setRows((currentValue) =>
      currentValue.filter((row) => !normalizedIds.includes(String(row._id)))
    );
    setSelectedChecklistIds((currentValue) =>
      currentValue.filter((selectedId) => !normalizedIds.includes(String(selectedId)))
    );
  };

  const updateColumnFilter = (field, value) => {
    setColumnFilters((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  };

  const applyColumnFilters = () => {
    setAppliedColumnFilters(columnFilters);
  };

  const clearColumnFilters = () => {
    setColumnFilters(EMPTY_CHECKLIST_COLUMN_FILTERS);
    setAppliedColumnFilters(EMPTY_CHECKLIST_COLUMN_FILTERS);
  };

  const toggleChecklistSelection = (id) => {
    const normalizedId = String(id);

    setSelectedChecklistIds((currentValue) =>
      currentValue.includes(normalizedId)
        ? currentValue.filter((selectedId) => selectedId !== normalizedId)
        : [...currentValue, normalizedId]
    );
  };

  const toggleAllChecklistSelections = () => {
    const visibleChecklistIds = rows.map((row) => String(row._id));

    if (
      visibleChecklistIds.length &&
      visibleChecklistIds.every((checklistId) => selectedChecklistIds.includes(checklistId))
    ) {
      setSelectedChecklistIds([]);
      return;
    }

    setSelectedChecklistIds(visibleChecklistIds);
  };

  const openChecklistStatusConfirmation = (checklist) => {
    setStatusMessage("");
    setStatusError("");
    setStatusConfirmation(checklist);
  };

  const closeChecklistStatusConfirmation = () => {
    if (statusSaving) return;
    setStatusConfirmation(null);
    setStatusError("");
  };

  const confirmChecklistStatusChange = async () => {
    if (!statusConfirmation) return;

    const nextStatus = !statusConfirmation.status;
    setStatusSaving(true);
    setStatusError("");

    try {
      await api.patch(`/checklists/${statusConfirmation._id}/status`, {
        isActive: nextStatus,
        status: nextStatus ? "Active" : "Inactive",
      });
      setStatusConfirmation(null);
      setStatusMessage("Checklist status updated successfully");
      setReloadToken((currentValue) => currentValue + 1);
    } catch (err) {
      console.error("Checklist status toggle failed:", err);
      setStatusError(err.response?.data?.message || "Failed to update checklist status");
    } finally {
      setStatusSaving(false);
    }
  };

  const deleteChecklist = async (id) => {
    if (
      !window.confirm(
        "Delete this checklist master? If generated employee tasks already exist, deletion will be blocked and you should disable it instead."
      )
    ) {
      return;
    }

    try {
      await api.delete(`/checklists/${id}`);
      removeRowsFromState([id]);
    } catch (err) {
      console.error("Checklist delete failed:", err);
      alert(err.response?.data?.message || "Failed to delete checklist master");
    }
  };

  const deleteSelectedChecklists = async () => {
    if (!selectedChecklistIds.length) {
      return;
    }

    const checklistIdsToDelete = [...selectedChecklistIds];

    if (
      !window.confirm(
        `Delete ${checklistIdsToDelete.length} selected checklist master${
          checklistIdsToDelete.length === 1 ? "" : "s"
        }? Masters with generated employee tasks will be skipped and should be disabled instead.`
      )
    ) {
      return;
    }

    setBulkDeleteLoading(true);

    try {
      const response = await api.post("/checklists/bulk-delete", {
        checklistIds: checklistIdsToDelete,
      });
      const deletedCount = Number(response.data?.deletedCount || checklistIdsToDelete.length);

      removeRowsFromState(checklistIdsToDelete);
      alert(
        `${deletedCount} checklist master${
          deletedCount === 1 ? "" : "s"
        } deleted successfully.`
      );
    } catch (err) {
      console.error("Checklist bulk delete failed:", err);
      alert(err.response?.data?.message || "Failed to delete selected checklist masters");
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const runScheduler = async () => {
    setSchedulerLoading(true);

    try {
      const response = await api.post("/checklists/scheduler/run");
      const created = Number(response.data?.created || 0);
      alert(`Scheduler completed. ${created} task${created === 1 ? "" : "s"} created.`);
    } catch (err) {
      console.error("Checklist scheduler run failed:", err);
      alert(err.response?.data?.message || "Failed to run checklist scheduler");
    } finally {
      setSchedulerLoading(false);
    }
  };

  const exportChecklistExcel = async () => {
    setExportLoading(true);

    try {
      const response = await api.get("/checklists/export/excel", {
        params: {
          search: search || undefined,
          status: status || undefined,
          scheduleType: scheduleType || undefined,
        },
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "checklist-masters.xlsx";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Checklist export failed:", err);
      alert(err.response?.data?.message || "Failed to export checklist masters");
    } finally {
      setExportLoading(false);
    }
  };

  const openChecklistImportPicker = () => {
    if (importLoading || importSaving || importPreview) return;
    importInputRef.current?.click();
  };

  const importChecklistExcel = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const validationMessage = validateFile(file, EXCEL_IMPORT_OPTIONS);
    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", "preview");
    setImportLoading(true);
    setImportPreview(null);
    setPendingImportFile(file);

    try {
      const response = await api.post("/checklists/import/excel", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setImportPreview({
        ...(response.data || {}),
        fileName: file.name,
      });
    } catch (err) {
      console.error("Checklist import failed:", err);
      setPendingImportFile(null);
      alert(err.response?.data?.message || "Failed to import checklist masters");
    } finally {
      setImportLoading(false);
    }
  };

  const cancelChecklistImportPreview = () => {
    if (importSaving) return;
    setImportPreview(null);
    setPendingImportFile(null);
  };

  const confirmChecklistImportPreview = async () => {
    if (!pendingImportFile) {
      setImportPreview(null);
      return;
    }

    const formData = new FormData();
    formData.append("file", pendingImportFile);
    formData.append("mode", "commit");
    setImportSaving(true);

    try {
      const response = await api.post("/checklists/import/excel", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setImportPreview(null);
      setPendingImportFile(null);
      alert(buildChecklistImportCompletionMessage(response.data));
      setReloadToken((currentValue) => currentValue + 1);
    } catch (err) {
      console.error("Checklist import save failed:", err);
      alert(err.response?.data?.message || "Failed to import checklist masters");
    } finally {
      setImportSaving(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setScheduleType("");
    clearColumnFilters();
  };

  return canManageChecklistMasters ? (
    <>
      <input
        ref={importInputRef}
        type="file"
        accept={EXCEL_IMPORT_ACCEPT}
        className="d-none"
        onChange={importChecklistExcel}
      />
      <AdminChecklistMasterList
        rows={filteredRows}
        loading={loading}
        search={search}
        status={status}
        scheduleType={scheduleType}
        setSearch={setSearch}
        setStatus={setStatus}
        setScheduleType={setScheduleType}
        columnFiltersVisible={columnFiltersVisible}
        setColumnFiltersVisible={setColumnFiltersVisible}
        columnFilters={columnFilters}
        columnFilterOptions={columnFilterOptions}
        updateColumnFilter={updateColumnFilter}
        applyColumnFilters={applyColumnFilters}
        clearColumnFilters={clearColumnFilters}
        hasColumnFilters={hasColumnFilters}
        openChecklistStatusConfirmation={openChecklistStatusConfirmation}
        deleteChecklist={deleteChecklist}
        selectedChecklistIds={selectedChecklistIds}
        toggleChecklistSelection={toggleChecklistSelection}
        toggleAllChecklistSelections={toggleAllChecklistSelections}
        deleteSelectedChecklists={deleteSelectedChecklists}
        bulkDeleteLoading={bulkDeleteLoading}
        runScheduler={runScheduler}
        schedulerLoading={schedulerLoading}
        clearFilters={clearFilters}
        exportChecklistExcel={exportChecklistExcel}
        exportLoading={exportLoading}
        openChecklistImportPicker={openChecklistImportPicker}
        importLoading={importLoading || importSaving}
        canDelete={canDeleteChecklistMaster}
        canCreate={canCreateChecklistMaster}
        canEdit={canEditChecklistMaster}
        canToggle={canStatusUpdateChecklistMaster}
        canRunScheduler={canStatusUpdateChecklistMaster}
        canExport={canExportChecklistMaster}
        canImport={canCreateChecklistMaster}
        statusMessage={statusMessage}
      />
      {statusConfirmation ? (
        <ChecklistStatusConfirmationModal
          checklist={statusConfirmation}
          saving={statusSaving}
          error={statusError}
          onCancel={closeChecklistStatusConfirmation}
          onConfirm={confirmChecklistStatusChange}
        />
      ) : null}
      {importPreview ? (
        <ChecklistImportPreviewModal
          preview={importPreview}
          saving={importSaving}
          onCancel={cancelChecklistImportPreview}
          onConfirm={confirmChecklistImportPreview}
        />
      ) : null}
    </>
  ) : (
    <EmployeeChecklistTaskList
      rows={rows}
      loading={loading}
      search={search}
      status={status}
      scheduleType={scheduleType}
      setSearch={setSearch}
      setStatus={setStatus}
      setScheduleType={setScheduleType}
      clearFilters={clearFilters}
      canViewOwnTasks={canViewOwnTasks}
      canViewApprovalInbox={canViewApprovalInbox}
    />
  );
}

function AdminChecklistMasterList({
  rows,
  loading,
  search,
  status,
  scheduleType,
  setSearch,
  setStatus,
  setScheduleType,
  columnFiltersVisible,
  setColumnFiltersVisible,
  columnFilters,
  columnFilterOptions,
  updateColumnFilter,
  applyColumnFilters,
  clearColumnFilters,
  hasColumnFilters,
  openChecklistStatusConfirmation,
  deleteChecklist,
  selectedChecklistIds,
  toggleChecklistSelection,
  toggleAllChecklistSelections,
  deleteSelectedChecklists,
  bulkDeleteLoading,
  runScheduler,
  schedulerLoading,
  clearFilters,
  exportChecklistExcel,
  exportLoading,
  openChecklistImportPicker,
  importLoading,
  canExport,
  canImport,
  canDelete,
  canCreate,
  canEdit,
  canToggle,
  canRunScheduler,
  statusMessage,
}) {
  const allRowsSelected =
    rows.length > 0 &&
    rows.every((row) => selectedChecklistIds.includes(String(row._id)));
  const activeCount = rows.filter((row) => row.status).length;
  const inactiveCount = rows.length - activeCount;
  const hasFilters = Boolean(search.trim() || status || scheduleType || hasColumnFilters);

  return (
    <div className="container-fluid mt-4 mb-5" data-testid="checklist-master-page">
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Checklists</div>
            <h3 className="mb-1">Checklist Master</h3>
            <div className="page-subtitle">
              Create recurring checklist definitions and auto-generate employee tasks.
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2">
            <Link to="/checklists/tasks" className="btn btn-outline-dark">
              Tasks
            </Link>
            {canDelete ? (
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={deleteSelectedChecklists}
                disabled={!selectedChecklistIds.length || bulkDeleteLoading}
              >
                {bulkDeleteLoading
                  ? "Deleting..."
                  : `Delete Selected${selectedChecklistIds.length ? ` (${selectedChecklistIds.length})` : ""}`}
              </button>
            ) : null}
            {canExport ? (
              <button
                type="button"
                className="btn btn-outline-success"
                onClick={exportChecklistExcel}
                disabled={exportLoading}
              >
                {exportLoading ? "Exporting..." : "Export Excel"}
              </button>
            ) : null}
            {canImport ? (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={openChecklistImportPicker}
                disabled={importLoading}
              >
                {importLoading ? "Importing..." : "Import Excel"}
              </button>
            ) : null}
            {canRunScheduler ? (
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={runScheduler}
                disabled={schedulerLoading}
              >
                {schedulerLoading ? "Running..." : "Run Scheduler"}
              </button>
            ) : null}
            {canCreate ? (
              <Link
                to="/checklists/create"
                className="btn btn-success"
                data-testid="add-checklist-button"
              >
                Create Master
              </Link>
            ) : null}
          </div>
        </div>

        {statusMessage ? (
          <div className="alert alert-success py-2 mt-3 mb-0" role="status">
            {statusMessage}
          </div>
        ) : null}

        <div className="list-summary mt-3">
          <span className="summary-chip">{rows.length} masters</span>
          <span className="summary-chip summary-chip--neutral">{activeCount} active</span>
          <span className="summary-chip summary-chip--neutral">{inactiveCount} inactive</span>
          {selectedChecklistIds.length ? (
            <span className="summary-chip">{selectedChecklistIds.length} selected</span>
          ) : null}
        </div>
      </div>

      <div className="filter-card mb-4">
        <div className="list-toolbar">
          <div>
            <h6 className="mb-1">Filters</h6>
            <div className="form-help">
              Click Filter to enable table-heading filters for checklist masters.
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn ${columnFiltersVisible ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setColumnFiltersVisible((currentValue) => !currentValue)}
              aria-expanded={columnFiltersVisible}
              aria-controls="checklist-table-heading-filters"
            >
              {columnFiltersVisible ? "Hide Filters" : "Filter"}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={clearFilters}
              disabled={!hasFilters}
            >
              Clear Filters
            </button>
          </div>
        </div>

        <div className="row g-2 mt-1">
          <div className="col-md-5">
            <input
              className="form-control"
              placeholder="Search checklist number or name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="col-md-3">
            <select
              className="form-select"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="col-md-4">
            <select
              className="form-select"
              value={scheduleType}
              onChange={(event) => setScheduleType(event.target.value)}
            >
              <option value="">All schedules</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-shell">
      <div className="table-responsive">
        <table
          className="table table-bordered table-striped align-middle checklist-master-table"
          data-testid="checklist-table"
        >
          <thead className="table-dark">
            <tr>
              {canDelete ? (
                <th className="text-center" style={{ width: "56px" }}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={allRowsSelected}
                    onChange={toggleAllChecklistSelections}
                    disabled={!rows.length || bulkDeleteLoading}
                    aria-label="Select all checklist masters"
                  />
                </th>
              ) : null}
              <th>#</th>
              <th>Checklist Number</th>
              <th>Name</th>
              <th>Scoring</th>
              <th>Source Site</th>
              <th>Employee</th>
              <th>Priority</th>
              <th>Schedule</th>
              <th>Start</th>
              <th>End</th>
              <th>Next Task</th>
              <th>Approver Mapping</th>
              <th>Dependency</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
            {columnFiltersVisible ? (
              <ChecklistColumnFilterRow
                canDelete={canDelete}
                filters={columnFilters}
                options={columnFilterOptions}
                onChange={updateColumnFilter}
                onApply={applyColumnFilters}
                onClear={clearColumnFilters}
                hasFilters={hasColumnFilters}
              />
            ) : null}
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={canDelete ? "16" : "15"} className="text-center">
                  Loading checklist masters...
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={canDelete ? "16" : "15"} className="text-center">
                  No checklist masters found
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row, index) => (
                <tr key={row._id} className={getPriorityRowClass(row)}>
                  {canDelete ? (
                    <td className="text-center">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selectedChecklistIds.includes(String(row._id))}
                        onChange={() => toggleChecklistSelection(row._id)}
                        disabled={bulkDeleteLoading}
                        aria-label={`Select checklist master ${row.checklistNumber}`}
                      />
                    </td>
                  ) : null}
                  <td>{index + 1}</td>
                  <td>{row.checklistNumber}</td>
                  <td className="fw-semibold">{row.checklistName}</td>
                  <td>{formatChecklistScoreLabel(row)}</td>
                  <td>{getChecklistSiteName(row.checklistSourceSite) || "-"}</td>
                  <td>{formatEmployeeLabel(row.assignedToEmployee)}</td>
                  <td>
                    <span className={`badge ${getPriorityBadgeClass(row)}`}>
                      {formatPriorityLabel(row)}
                    </span>
                  </td>
                  <td>{formatScheduleLabel(row)}</td>
                  <td>
                    {formatDateTime(row.startDate)}
                    <div className="small text-muted">{row.scheduleTime || "-"}</div>
                  </td>
                  <td>
                    {formatDateTime(row.endDate)}
                    <div className="small text-muted">{row.endTime || "-"}</div>
                  </td>
                  <td>{formatDateTime(row.nextOccurrenceAt)}</td>
                  <td>{getApproverMappingFilterLabel(row)}</td>
                  <td>
                    <div>{formatChecklistDependencyLabel(row)}</div>
                    {row.isDependentTask ? (
                      <div className="small text-muted">
                        Target: {formatTargetDayCountLabel(row.targetDayCount)}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <span className={`badge ${row.status ? "bg-success" : "bg-secondary"}`}>
                      {row.status ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="app-icon-action-group justify-content-center">
                      <Link
                        className="btn btn-sm btn-outline-info app-icon-action-btn"
                        to={`/checklists/${row._id}`}
                        title="View checklist master"
                        aria-label={`View checklist master ${row.checklistNumber}`}
                      >
                        <ViewIcon />
                      </Link>
                      {canEdit ? (
                        <Link
                          className="btn btn-sm btn-outline-warning app-icon-action-btn"
                          to={`/checklists/edit/${row._id}`}
                          title="Edit checklist master"
                          aria-label={`Edit checklist master ${row.checklistNumber}`}
                        >
                          <EditIcon />
                        </Link>
                      ) : null}
                      {canToggle ? (
                        <button
                          type="button"
                          data-testid="checklist-status-toggle"
                          className={`btn btn-sm app-icon-action-btn ${
                            row.status ? "btn-outline-secondary" : "btn-outline-success"
                          }`}
                          onClick={() => openChecklistStatusConfirmation(row)}
                          title={row.status ? "Deactivate checklist master" : "Activate checklist master"}
                          aria-label={`${
                            row.status ? "Deactivate" : "Activate"
                          } checklist master ${row.checklistNumber}`}
                        >
                          <ToggleIcon active={row.status} />
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger app-icon-action-btn"
                          onClick={() => deleteChecklist(row._id)}
                          title="Delete checklist master"
                          aria-label={`Delete checklist master ${row.checklistNumber}`}
                        >
                          <DeleteIcon />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}

function ChecklistColumnFilterRow({
  canDelete,
  filters,
  options,
  onChange,
  onApply,
  onClear,
  hasFilters,
}) {
  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      onApply();
    }
  };

  return (
    <tr className="checklist-table-filter-row" id="checklist-table-heading-filters">
      {canDelete ? <th aria-label="Selection filter" /> : null}
      <th aria-label="Serial number filter" />
      <th>
        <input
          type="text"
          className="form-control form-control-sm checklist-table-filter-control"
          placeholder="Number"
          value={filters.checklistNumber}
          onChange={(event) => onChange("checklistNumber", event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Filter by checklist number"
        />
      </th>
      <th>
        <input
          type="text"
          className="form-control form-control-sm checklist-table-filter-control"
          placeholder="Name"
          value={filters.name}
          onChange={(event) => onChange("name", event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Filter by checklist name"
        />
      </th>
      <th aria-label="Scoring filter" />
      <th>
        <select
          className="form-select form-select-sm checklist-table-filter-control"
          value={filters.sourceSite}
          onChange={(event) => onChange("sourceSite", event.target.value)}
          aria-label="Filter by source site"
        >
          <option value="">All</option>
          {options.sourceSites.map((sourceSite) => (
            <option key={sourceSite} value={sourceSite}>
              {sourceSite}
            </option>
          ))}
        </select>
      </th>
      <th>
        <input
          type="search"
          list="checklist-master-employee-filter-options"
          className="form-control form-control-sm checklist-table-filter-control"
          placeholder="Employee"
          value={filters.employee}
          onChange={(event) => onChange("employee", event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Filter by employee"
        />
        <datalist id="checklist-master-employee-filter-options">
          {options.employees.map((employee) => (
            <option key={employee} value={employee} />
          ))}
        </datalist>
      </th>
      <th>
        <select
          className="form-select form-select-sm checklist-table-filter-control"
          value={filters.priority}
          onChange={(event) => onChange("priority", event.target.value)}
          aria-label="Filter by priority"
        >
          <option value="">All</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </th>
      <th>
        <select
          className="form-select form-select-sm checklist-table-filter-control"
          value={filters.schedule}
          onChange={(event) => onChange("schedule", event.target.value)}
          aria-label="Filter by schedule"
        >
          <option value="">All</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
          <option value="custom">Custom</option>
        </select>
      </th>
      <th>
        <input
          type="date"
          className="form-control form-control-sm checklist-table-filter-control"
          value={filters.startDate}
          onChange={(event) => onChange("startDate", event.target.value)}
          aria-label="Filter by start date"
        />
      </th>
      <th>
        <input
          type="date"
          className="form-control form-control-sm checklist-table-filter-control"
          value={filters.endDate}
          onChange={(event) => onChange("endDate", event.target.value)}
          aria-label="Filter by end date"
        />
      </th>
      <th>
        <input
          type="date"
          className="form-control form-control-sm checklist-table-filter-control"
          value={filters.nextTaskDate}
          onChange={(event) => onChange("nextTaskDate", event.target.value)}
          aria-label="Filter by next task date"
        />
      </th>
      <th>
        <input
          type="search"
          list="checklist-master-approver-filter-options"
          className="form-control form-control-sm checklist-table-filter-control"
          placeholder="Approver"
          value={filters.approverMapping}
          onChange={(event) => onChange("approverMapping", event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Filter by approver mapping"
        />
        <datalist id="checklist-master-approver-filter-options">
          {options.approverMappings.map((approverMapping) => (
            <option key={approverMapping} value={approverMapping} />
          ))}
        </datalist>
      </th>
      <th>
        <select
          className="form-select form-select-sm checklist-table-filter-control"
          value={filters.dependency}
          onChange={(event) => onChange("dependency", event.target.value)}
          aria-label="Filter by dependency"
        >
          <option value="">All</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </th>
      <th>
        <select
          className="form-select form-select-sm checklist-table-filter-control"
          value={filters.status}
          onChange={(event) => onChange("status", event.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </th>
      <th>
        <div className="checklist-table-filter-actions">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={onApply}
            aria-label="Apply table filters"
          >
            Apply
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-light"
            onClick={onClear}
            disabled={!hasFilters}
            aria-label="Clear table filters"
          >
            Clear
          </button>
        </div>
      </th>
    </tr>
  );
}

function ChecklistStatusConfirmationModal({ checklist, saving, error, onCancel, onConfirm }) {
  const isDeactivation = Boolean(checklist.status);
  const checklistLabel =
    [checklist.checklistNumber, checklist.checklistName].filter(Boolean).join(" - ") ||
    "this checklist";

  return (
    <div
      className="modal fade show d-block app-modal-overlay"
      data-testid="confirm-status-modal"
      tabIndex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checklist-status-confirmation-title"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-1" id="checklist-status-confirmation-title">
                {isDeactivation
                  ? "Are you sure you want to deactivate this checklist?"
                  : "Do you want to activate this checklist?"}
              </h5>
              <div className="text-muted small">{checklistLabel}</div>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onCancel}
              disabled={saving}
            />
          </div>
          <div className="modal-body">
            <div
              className={`alert ${
                isDeactivation ? "alert-warning" : "alert-info"
              } d-flex gap-3 align-items-start mb-0`}
              role="alert"
            >
              <span className="fs-4 lh-1" aria-hidden="true">
                {isDeactivation ? "⚠️" : "ℹ️"}
              </span>
              <div>
                {isDeactivation
                  ? "New employee tasks will not be generated from this checklist after deactivation. Existing generated tasks will remain unchanged."
                  : "This checklist will start generating employee tasks again based on its schedule."}
              </div>
            </div>

            {error ? (
              <div className="alert alert-danger py-2 mt-3 mb-0" role="alert">
                {error}
              </div>
            ) : null}
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              data-testid="confirm-cancel-button"
              onClick={onCancel}
              disabled={saving}
            >
              No, Cancel
            </button>
            <button
              type="button"
              className={`btn ${isDeactivation ? "btn-danger" : "btn-success"}`}
              data-testid="confirm-ok-button"
              onClick={onConfirm}
              disabled={saving}
            >
              {saving
                ? "Updating..."
                : isDeactivation
                ? "Yes, Deactivate"
                : "Yes, Activate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChecklistImportPreviewModal({ preview, saving, onCancel, onConfirm }) {
  const readyRows = Array.isArray(preview?.readyRows) ? preview.readyRows : [];
  const skippedRows = Array.isArray(preview?.skippedRows) ? preview.skippedRows : [];
  const failedRows = Array.isArray(preview?.failedRows)
    ? preview.failedRows
    : Array.isArray(preview?.failures)
    ? preview.failures
    : [];
  const readyCount = Number(preview?.readyCount ?? readyRows.length);
  const skippedCount = Number(preview?.skippedCount ?? skippedRows.length);
  const failedCount = Number(preview?.failedCount ?? failedRows.length);
  const processedCount = Number(preview?.processedCount || 0);
  const ignoredRows = Number(preview?.ignoredRows || 0);
  const canConfirm = readyCount > 0 && !saving;
  const displayedReadyRows = readyRows.slice(0, 8);
  const remainingReadyRows = Math.max(0, readyRows.length - displayedReadyRows.length);

  return (
    <div
      className="modal fade show d-block app-modal-overlay"
      data-testid="checklist-import-preview-modal"
      tabIndex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checklist-import-preview-title"
    >
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-1" id="checklist-import-preview-title">
                Preview Checklist Import
              </h5>
              <div className="text-muted small">
                {preview?.fileName || "Selected Excel file"} has not been saved yet.
              </div>
            </div>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onCancel}
              disabled={saving}
            />
          </div>

          <div className="modal-body">
            <div className="alert alert-info py-2" role="status">
              Review the summary. Click OK to save checklist data, or Cancel to reject this import.
            </div>

            <div className="list-summary mb-3">
              <span className="summary-chip">{processedCount} processed</span>
              <span className="summary-chip summary-chip--neutral">{readyCount} ready</span>
              <span className="summary-chip summary-chip--neutral">{skippedCount} skipped</span>
              <span className="summary-chip summary-chip--neutral">{failedCount} failed</span>
              <span className="summary-chip summary-chip--neutral">{ignoredRows} ignored</span>
            </div>

            {readyCount > 0 ? (
              <div className="table-responsive mb-3">
                <table className="table table-sm table-bordered align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Row</th>
                      <th>Checklist Number</th>
                      <th>Name</th>
                      <th>Assigned Site</th>
                      <th>Employee</th>
                      <th>Schedule</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedReadyRows.map((row) => (
                      <tr key={`${row.rowNumber}-${row.checklistName}`}>
                        <td>{row.rowNumber}</td>
                        <td>{row.checklistNumber || "Auto number"}</td>
                        <td className="fw-semibold">{row.checklistName || "-"}</td>
                        <td>{row.assignedSite || "-"}</td>
                        <td>{row.assignedEmployee || "-"}</td>
                        <td>
                          {row.scheduleType || "-"}
                          <div className="small text-muted">
                            {row.startDate || "-"} {row.startTime || ""} to{" "}
                            {row.endDate || "-"} {row.endTime || ""}
                          </div>
                        </td>
                        <td>{row.status || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {remainingReadyRows ? (
                  <div className="form-help mt-2">
                    {remainingReadyRows} more ready row
                    {remainingReadyRows === 1 ? "" : "s"} will be imported.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="alert alert-warning py-2">
                No checklist rows are ready to import from this file.
              </div>
            )}

            {skippedRows.length ? (
              <div className="mb-3">
                <h6 className="mb-2">Skipped Rows</h6>
                <ul className="mb-0">
                  {skippedRows.slice(0, 6).map((row) => (
                    <li key={`skipped-${row.rowNumber}`}>
                      Row {row.rowNumber}: {row.message || "Checklist already exists"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {failedRows.length ? (
              <div className="alert alert-warning mb-0">
                <h6 className="mb-2">Failed Rows</h6>
                <ul className="mb-0">
                  {failedRows.slice(0, 6).map((row) => (
                    <li key={`failed-${row.rowNumber}`}>
                      Row {row.rowNumber}: {row.message || "Failed to import row"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary"
              data-testid="checklist-import-cancel"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              data-testid="checklist-import-ok"
              onClick={onConfirm}
              disabled={!canConfirm}
            >
              {saving ? "Saving..." : "OK"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmployeeChecklistTaskList({
  rows,
  loading,
  search,
  status,
  scheduleType,
  setSearch,
  setStatus,
  setScheduleType,
  clearFilters,
  canViewOwnTasks,
  canViewApprovalInbox,
}) {
  const openCount = rows.filter((row) => row.status === "open").length;
  const waitingDependencyCount = rows.filter(
    (row) => String(row.status || "").trim().toLowerCase() === "waiting_dependency"
  ).length;
  const pendingApprovalCount = rows.filter((row) =>
    ["submitted", "nil_for_approval"].includes(String(row.status || ""))
  ).length;
  const hasFilters = Boolean(search.trim() || status || scheduleType);

  return (
    <div className="container-fluid mt-4 mb-5">
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Checklists</div>
            <h3 className="mb-1">My Checklist Tasks</h3>
            <div className="page-subtitle">
              Open your assigned recurring tasks, answer the task questions, and submit them for approval.
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2">
            {canViewOwnTasks ? (
              <Link to="/own-tasks" className="btn btn-outline-secondary">
                Own Tasks
              </Link>
            ) : null}
            {canViewApprovalInbox ? (
              <Link to="/checklists/approvals" className="btn btn-outline-primary">
                Approval Inbox
              </Link>
            ) : null}
          </div>
        </div>

        <div className="list-summary mt-3">
          <span className="summary-chip">{rows.length} tasks</span>
          <span className="summary-chip summary-chip--neutral">{openCount} assigned</span>
          <span className="summary-chip summary-chip--neutral">
            {waitingDependencyCount} waiting dependency
          </span>
          <span className="summary-chip summary-chip--neutral">
            {pendingApprovalCount} under approval
          </span>
        </div>
      </div>

      <div className="filter-card mb-4">
        <div className="list-toolbar">
          <div>
            <h6 className="mb-1">Filters</h6>
            <div className="form-help">Narrow tasks by name, status, or schedule.</div>
          </div>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={clearFilters}
            disabled={!hasFilters}
          >
            Clear Filters
          </button>
        </div>

        <div className="row g-2 mt-1">
          <div className="col-md-6">
            <input
              className="form-control"
              placeholder="Search task number or checklist name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="col-md-3">
            <select
              className="form-select"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="waiting_dependency">Waiting for Dependency</option>
              <option value="open">Assigned</option>
              <option value="submitted">Under Approval</option>
              <option value="nil_for_approval">Nil For Approval</option>
              <option value="approved">Approved / Completed</option>
              <option value="nil_approved">Nil Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="col-md-3">
            <select
              className="form-select"
              value={scheduleType}
              onChange={(event) => setScheduleType(event.target.value)}
            >
              <option value="">All schedules</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-shell">
      <div className="table-responsive">
        <table className="table table-bordered table-striped align-middle">
          <thead className="table-dark">
            <tr>
              <th>#</th>
              <th>Task Number</th>
              <th>Checklist</th>
              <th>Priority</th>
              <th>Schedule</th>
              <th>Occurrence</th>
              <th>Delay/Advance</th>
              <th>Final Mark</th>
              <th>Approval Type</th>
              <th>Current Approver</th>
              <th>Dependency</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="13" className="text-center">
                  Loading checklist tasks...
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan="13" className="text-center">
                  No checklist tasks found
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row, index) => {
                return (
                <tr key={row._id} className={getPriorityRowClass(row)}>
                  <td>{index + 1}</td>
                  <td>{row.taskNumber}</td>
                  <td className="fw-semibold">{row.checklistName}</td>
                  <td>
                    <span className={`badge ${getPriorityBadgeClass(row)}`}>
                      {formatPriorityLabel(row)}
                    </span>
                  </td>
                  <td>{formatScheduleLabel(row)}</td>
                  <td>{formatDateTime(row.occurrenceDate)}</td>
                  <td>{formatTaskMarkDayLabel(row)}</td>
                  <td>{formatTaskFinalMarkLabel(row)}</td>
                  <td>
                    <span className={`badge ${getApprovalTypeBadgeClass(row)}`}>
                      {formatApprovalTypeLabel(row)}
                    </span>
                  </td>
                  <td>{formatCurrentApproverLabel(row)}</td>
                  <td>
                    {row.isDependentTask ? (
                      <>
                        <span className={`badge ${getChecklistDependencyStatusBadgeClass(row)}`}>
                          {formatChecklistDependencyStatus(row)}
                        </span>
                        <div className="small text-muted mt-1">
                          {formatChecklistDependencyLabel(row)}
                        </div>
                        <div className="small text-muted">
                          Target: {formatTargetDayCountLabel(row.targetDayCount)}
                        </div>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <span className={`badge ${getChecklistTaskStatusBadgeClass(row.status)}`}>
                      {formatChecklistTaskStatus(row.status)}
                    </span>
                  </td>
                  <td>
                    {String(row.status || "").trim().toLowerCase() === "waiting_dependency" ? (
                      <button type="button" className="btn btn-sm btn-secondary" disabled>
                        Locked
                      </button>
                    ) : (
                      <Link className="btn btn-sm btn-info" to={`/checklists/tasks/${row._id}`}>
                        Open
                      </Link>
                    )}
                  </td>
                </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}

