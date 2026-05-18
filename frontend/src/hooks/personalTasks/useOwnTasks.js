import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  completePersonalTask,
  createPersonalTask,
  deletePersonalTask,
  getPersonalTaskById,
  getPersonalTasks,
  getPersonalTaskUploadBaseUrl,
  getShareableEmployees,
  markPersonalTaskRead,
  sharePersonalTask,
  updatePersonalTask,
} from "../../services/personalTask.service";
import { IMAGE_FILE_OPTIONS, validateFile } from "../../utils/fileValidation";
import { buildBrowserNotificationBody, formatPersonalTaskStatus, formatReminderTypeLabel } from "../../utils/personalTaskDisplay";
import {
  buildPersonalTaskFormData,
  getPermissionLabel,
  getRecurrenceDefaultsFromDate,
  getStoredUser,
  initialPersonalTaskFormState,
  isOwnTaskEmployeeUser,
} from "../../utils/personalTaskForm";
import { showToast } from "../../utils/toastUtils";

export const useOwnTasks = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const user = getStoredUser();
  const isEmployee = isOwnTaskEmployeeUser(user);
  const attachmentInputRef = useRef(null);
  const editAttachmentInputRef = useRef(null);
  const editTargetTaskIdRef = useRef("");
  const loadTasksRef = useRef(async () => {});
  const loadTaskDetailRef = useRef(async () => {});
  const notifiedDueTaskIdsRef = useRef(new Set());

  const [form, setForm] = useState(initialPersonalTaskFormState);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState("");
  const [rows, setRows] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reminderTypeFilter, setReminderTypeFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState("");
  const [confirmCompleteTaskId, setConfirmCompleteTaskId] = useState("");
  const [shareableEmployees, setShareableEmployees] = useState([]);
  const [shareEmployeeSearch, setShareEmployeeSearch] = useState("");
  const [shareModalTask, setShareModalTask] = useState(null);
  const [shareListLoading, setShareListLoading] = useState(false);
  const [sharingTaskId, setSharingTaskId] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", variant: "success" });
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(initialPersonalTaskFormState);
  const [editAttachmentFile, setEditAttachmentFile] = useState(null);
  const [editAttachmentPreview, setEditAttachmentPreview] = useState("");
  const [updating, setUpdating] = useState(false);
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof window !== "undefined" && "Notification" in window
      ? window.Notification.permission
      : "unsupported"
  );

  const uploadBaseUrl = useMemo(() => getPersonalTaskUploadBaseUrl(), []);
  const selectedTaskFromList = useMemo(
    () => rows.find((row) => String(row._id) === String(id || "")) || null,
    [id, rows]
  );
  const taskDetail = selectedTask || selectedTaskFromList;
  const taskAttachmentUrl = useMemo(() => {
    if (!taskDetail?.attachment) return "";
    return `${uploadBaseUrl}/uploads/${encodeURIComponent(taskDetail.attachment)}`;
  }, [taskDetail?.attachment, uploadBaseUrl]);

  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const completedCount = rows.filter((row) => row.status === "completed").length;
  const dueCount = rows.filter((row) => row.notificationState === "due").length;
  const upcomingCount = rows.filter((row) => row.notificationState === "upcoming").length;
  const sharedByMeCount = rows.filter((row) => row.viewerRelationship === "creator").length;
  const assignedToMeCount = rows.filter((row) => row.viewerRelationship === "assignee").length;
  const hasFilters = Boolean(search.trim() || statusFilter || reminderTypeFilter);

  const tableRows = reminderTypeFilter
    ? rows.filter((row) => row.reminderType === reminderTypeFilter)
    : rows;

  const stats = useMemo(
    () => [
      {
        label: "Total Tasks",
        value: rows.length,
        meta: "Own and shared reminders",
        accentClass: "page-stat-card--primary",
      },
      {
        label: "Pending Focus",
        value: pendingCount,
        meta: "Still waiting for action",
        accentClass: "page-stat-card--warning",
      },
      {
        label: "Completed",
        value: completedCount,
        meta: "Closed reminders",
        accentClass: "page-stat-card--success",
      },
      {
        label: "Due Now",
        value: dueCount,
        meta: "Need attention first",
        accentClass: "page-stat-card--danger",
      },
      {
        label: "Upcoming",
        value: upcomingCount,
        meta: "Scheduled next reminders",
        accentClass: "page-stat-card--accent",
      },
      {
        label: "Shared by You",
        value: sharedByMeCount,
        meta: `${assignedToMeCount} currently assigned to you`,
        accentClass: "page-stat-card--neutral",
      },
    ],
    [
      rows.length,
      pendingCount,
      completedCount,
      dueCount,
      upcomingCount,
      sharedByMeCount,
      assignedToMeCount,
    ]
  );

  const activeFilterPills = [
    search.trim() ? `Search: ${search.trim()}` : "",
    statusFilter ? `Status: ${formatPersonalTaskStatus(statusFilter)}` : "",
    reminderTypeFilter ? `Type: ${formatReminderTypeLabel(reminderTypeFilter)}` : "",
  ].filter(Boolean);

  const visibleShareableEmployees = useMemo(() => {
    const normalizedSearch = String(shareEmployeeSearch || "").trim().toLowerCase();

    return (Array.isArray(shareableEmployees) ? shareableEmployees : []).filter((employee) => {
      if (!normalizedSearch) return true;

      return [employee.employeeCode, employee.employeeName, employee.displayName, employee.email]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [shareEmployeeSearch, shareableEmployees]);

  useEffect(() => {
    void loadTasksRef.current();
  }, [search, statusFilter]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadTasksRef.current();
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window) ||
      window.Notification.permission !== "granted"
    ) return;

    const currentDueIds = new Set(
      rows
        .filter((r) => r.notificationState === "due" && r.hasUnreadNotification)
        .map((r) => String(r._id))
    );

    rows
      .filter(
        (r) =>
          r.notificationState === "due" &&
          r.hasUnreadNotification &&
          !notifiedDueTaskIdsRef.current.has(String(r._id))
      )
      .forEach((task) => {
        new window.Notification(task.title || "Own Task Reminder", {
          body: buildBrowserNotificationBody(task) || "This reminder is now due.",
        });
        notifiedDueTaskIdsRef.current.add(String(task._id));
      });

    for (const notifiedId of notifiedDueTaskIdsRef.current) {
      if (!currentDueIds.has(notifiedId)) {
        notifiedDueTaskIdsRef.current.delete(notifiedId);
      }
    }
  }, [rows]);

  useEffect(() => {
    if (!id) {
      setSelectedTask(null);
      return;
    }

    void loadTaskDetailRef.current(id);
  }, [id]);

  useEffect(() => {
    return () => {
      if (attachmentPreview.startsWith("blob:")) {
        URL.revokeObjectURL(attachmentPreview);
      }
    };
  }, [attachmentPreview]);

  const syncTaskInState = (task) => {
    if (!task?._id) return;

    setRows((currentValue) => {
      const hasExistingTask = currentValue.some(
        (row) => String(row._id) === String(task._id)
      );

      if (!hasExistingTask) {
        return [task, ...currentValue];
      }

      return currentValue.map((row) =>
        String(row._id) === String(task._id) ? task : row
      );
    });

    if (String(id || "") === String(task._id)) {
      setSelectedTask(task);
    }
  };

  const loadTasks = async () => {
    setLoading(true);

    try {
      const response = await getPersonalTasks({ search, status: statusFilter });
      setRows(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Personal task list load failed:", err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const markReminderRead = async (taskId) => {
    try {
      const response = await markPersonalTaskRead(taskId);
      const updatedTask = response.data?.task;

      if (updatedTask) {
        syncTaskInState(updatedTask);
      }
    } catch (err) {
      console.error("Failed to mark reminder as read:", err);
    }
  };

  const loadTaskDetail = async (taskId) => {
    setDetailLoading(true);

    try {
      const response = await getPersonalTaskById(taskId);
      const nextTask = response.data || null;

      setSelectedTask(nextTask);

      if (nextTask?.hasUnreadNotification) {
        await markReminderRead(taskId);
      } else if (nextTask?._id) {
        syncTaskInState(nextTask);
      }
    } catch (err) {
      console.error("Personal task detail load failed:", err);

      if (err.response?.status === 404) {
        navigate("/own-tasks", { replace: true });
      }
    } finally {
      setDetailLoading(false);
    }
  };

  loadTasksRef.current = loadTasks;
  loadTaskDetailRef.current = loadTaskDetail;

  const loadShareableEmployees = async () => {
    setShareListLoading(true);

    try {
      const response = await getShareableEmployees();
      setShareableEmployees(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Shareable employees load failed:", err);
      setShareableEmployees([]);
      showToast(setToast, err.response?.data?.message || "Failed to load employees.", "error");
    } finally {
      setShareListLoading(false);
    }
  };

  const openShareModal = async (task) => {
    if (!task?.canShare || task.status === "completed") {
      return;
    }

    setShareModalTask(task);
    setShareEmployeeSearch("");

    if (!shareableEmployees.length) {
      await loadShareableEmployees();
    }
  };

  const closeShareModal = () => {
    if (sharingTaskId) return;

    setShareModalTask(null);
    setShareEmployeeSearch("");
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;

    setForm((currentValue) => {
      const nextValue = {
        ...currentValue,
        [name]: value,
      };

      if (name === "reminderDate") {
        const derivedValues = getRecurrenceDefaultsFromDate(value);

        if (currentValue.reminderType === "weekly" && !currentValue.weeklyDayOfWeek) {
          nextValue.weeklyDayOfWeek = derivedValues.weeklyDayOfWeek;
        }

        if (currentValue.reminderType === "monthly" && !currentValue.monthlyDayOfMonth) {
          nextValue.monthlyDayOfMonth = derivedValues.monthlyDayOfMonth;
        }
      }

      if (name === "reminderType") {
        const derivedValues = getRecurrenceDefaultsFromDate(currentValue.reminderDate);

        if (value === "weekly") {
          nextValue.weeklyDayOfWeek =
            currentValue.weeklyDayOfWeek || derivedValues.weeklyDayOfWeek;
        } else {
          nextValue.weeklyDayOfWeek = "";
        }

        if (value === "monthly") {
          nextValue.monthlyDayOfMonth =
            currentValue.monthlyDayOfMonth || derivedValues.monthlyDayOfMonth;
        } else {
          nextValue.monthlyDayOfMonth = "";
        }
      }

      return nextValue;
    });
  };

  const clearAttachmentSelection = () => {
    setAttachmentFile(null);
    setAttachmentPreview((currentValue) => {
      if (currentValue.startsWith("blob:")) {
        URL.revokeObjectURL(currentValue);
      }
      return "";
    });

    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  };

  const resetCreateForm = () => {
    setForm(initialPersonalTaskFormState);
    clearAttachmentSelection();
  };

  const handleAttachmentChange = (event) => {
    const file = event.target.files?.[0] || null;
    const validationMessage = validateFile(file, IMAGE_FILE_OPTIONS);

    if (validationMessage) {
      showToast(setToast, validationMessage, "warning");
      event.target.value = "";
      clearAttachmentSelection();
      return;
    }

    setAttachmentFile(file);
    setAttachmentPreview((currentValue) => {
      if (currentValue.startsWith("blob:")) {
        URL.revokeObjectURL(currentValue);
      }

      return file ? URL.createObjectURL(file) : "";
    });
  };

  const handleCreateTask = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await createPersonalTask(
        buildPersonalTaskFormData(form, attachmentFile)
      );
      const createdTask = response.data?.task;

      resetCreateForm();
      setSearch("");
      setStatusFilter("");

      if (createdTask?._id) {
        syncTaskInState(createdTask);
        navigate(`/own-tasks/${createdTask._id}`);
      }

      await loadTasks();

      if (
        notificationPermission === "default" &&
        typeof window !== "undefined" &&
        "Notification" in window
      ) {
        const permission = await window.Notification.requestPermission();
        setNotificationPermission(permission);
      }
    } catch (err) {
      console.error("Personal task create failed:", err);
      showToast(setToast, err.response?.data?.message || "Failed to create reminder.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleShareTask = async (task, assignedEmployeeId) => {
    if (!task?._id || !assignedEmployeeId) return;

    setSharingTaskId(String(task._id));

    try {
      const response = await sharePersonalTask(task._id, assignedEmployeeId);
      const updatedTask = response.data?.task;

      if (updatedTask) {
        syncTaskInState(updatedTask);
      }

      closeShareModal();
      await loadTasks();
    } catch (err) {
      console.error("Personal task share failed:", err);
      showToast(setToast, err.response?.data?.message || "Failed to share task.", "error");
    } finally {
      setSharingTaskId("");
    }
  };

  const handleCompleteTask = async (taskId) => {
    setCompletingTaskId(String(taskId));

    try {
      const response = await completePersonalTask(taskId);
      const updatedTask = response.data?.task;

      if (updatedTask) {
        syncTaskInState(updatedTask);
      }

      showToast(setToast, "Task marked as completed.", "success");
      await loadTasks();
    } catch (err) {
      console.error("Personal task completion failed:", err);
      showToast(setToast, err.response?.data?.message || "Failed to complete task.", "error");
      await loadTasksRef.current();
    } finally {
      setCompletingTaskId("");
    }
  };

  const openEditModal = (task) => {
    if (!task) return;

    editTargetTaskIdRef.current = String(task._id);
    setEditForm({
      title: task.title || "",
      description: task.description || "",
      reminderDate: task.reminderDate || "",
      reminderTime: task.reminderTime || "",
      reminderType: task.reminderType || "one_time",
      weeklyDayOfWeek:
        task.weeklyDayOfWeek !== undefined && task.weeklyDayOfWeek !== null
          ? String(task.weeklyDayOfWeek)
          : "",
      monthlyDayOfMonth:
        task.monthlyDayOfMonth !== undefined && task.monthlyDayOfMonth !== null
          ? String(task.monthlyDayOfMonth)
          : "",
    });
    setEditAttachmentFile(null);
    setEditAttachmentPreview("");
    setEditMode(true);
  };

  const closeEditModal = () => {
    setEditMode(false);
    setEditForm(initialPersonalTaskFormState);
    setEditAttachmentFile(null);
    setEditAttachmentPreview((v) => {
      if (v.startsWith("blob:")) URL.revokeObjectURL(v);
      return "";
    });
    if (editAttachmentInputRef.current) {
      editAttachmentInputRef.current.value = "";
    }
    editTargetTaskIdRef.current = "";
  };

  const handleEditFieldChange = (event) => {
    const { name, value } = event.target;

    setEditForm((currentValue) => {
      const nextValue = { ...currentValue, [name]: value };

      if (name === "reminderDate") {
        const derivedValues = getRecurrenceDefaultsFromDate(value);
        if (currentValue.reminderType === "weekly" && !currentValue.weeklyDayOfWeek) {
          nextValue.weeklyDayOfWeek = derivedValues.weeklyDayOfWeek;
        }
        if (currentValue.reminderType === "monthly" && !currentValue.monthlyDayOfMonth) {
          nextValue.monthlyDayOfMonth = derivedValues.monthlyDayOfMonth;
        }
      }

      if (name === "reminderType") {
        const derivedValues = getRecurrenceDefaultsFromDate(currentValue.reminderDate);
        if (value === "weekly") {
          nextValue.weeklyDayOfWeek = currentValue.weeklyDayOfWeek || derivedValues.weeklyDayOfWeek;
        } else {
          nextValue.weeklyDayOfWeek = "";
        }
        if (value === "monthly") {
          nextValue.monthlyDayOfMonth =
            currentValue.monthlyDayOfMonth || derivedValues.monthlyDayOfMonth;
        } else {
          nextValue.monthlyDayOfMonth = "";
        }
      }

      return nextValue;
    });
  };

  const handleEditAttachmentChange = (event) => {
    const file = event.target.files?.[0] || null;
    const validationMessage = validateFile(file, IMAGE_FILE_OPTIONS);

    if (validationMessage) {
      showToast(setToast, validationMessage, "warning");
      event.target.value = "";
      return;
    }

    setEditAttachmentFile(file);
    setEditAttachmentPreview((v) => {
      if (v.startsWith("blob:")) URL.revokeObjectURL(v);
      return file ? URL.createObjectURL(file) : "";
    });
  };

  const handleUpdateTask = async (event) => {
    event.preventDefault();
    const taskId = editTargetTaskIdRef.current;
    if (!taskId) return;

    setUpdating(true);

    try {
      const response = await updatePersonalTask(
        taskId,
        buildPersonalTaskFormData(editForm, editAttachmentFile)
      );
      const updatedTask = response.data?.task;

      if (updatedTask) {
        syncTaskInState(updatedTask);
      }

      closeEditModal();
      showToast(setToast, "Task updated successfully.", "success");
    } catch (err) {
      console.error("Personal task update failed:", err);
      showToast(setToast, err.response?.data?.message || "Failed to update task.", "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!confirmDeleteTaskId) return;

    setDeleting(true);

    try {
      await deletePersonalTask(confirmDeleteTaskId);

      setRows((currentValue) =>
        currentValue.filter((row) => String(row._id) !== String(confirmDeleteTaskId))
      );

      if (String(id || "") === String(confirmDeleteTaskId)) {
        navigate("/own-tasks", { replace: true });
      }

      setConfirmDeleteTaskId("");
      showToast(setToast, "Task deleted.", "success");
    } catch (err) {
      console.error("Personal task deletion failed:", err);
      showToast(setToast, err.response?.data?.message || "Failed to delete task.", "error");
    } finally {
      setDeleting(false);
    }
  };

  const requestBrowserNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    try {
      const permission = await window.Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === "granted") {
        const previewTask =
          taskDetail || rows.find((row) => row.notificationState === "due") || rows[0];
        if (previewTask) {
          new window.Notification(previewTask.title || "Own Task Reminder", {
            body:
              buildBrowserNotificationBody(previewTask) ||
              "Your personal reminder notifications are now enabled.",
          });
        }
      }
    } catch (err) {
      console.error("Browser notification permission request failed:", err);
    }
  };

  return {
    access: {
      isEmployee,
    },
    toast: {
      toast,
      onClose: () => setToast((t) => ({ ...t, show: false })),
    },
    header: {
      activeFilterPills,
      notificationPermission,
      notificationPermissionLabel: getPermissionLabel(notificationPermission),
      requestBrowserNotifications,
      stats,
    },
    form: {
      attachmentInputRef,
      attachmentPreview,
      form,
      handleAttachmentChange,
      handleCreateTask,
      handleFieldChange,
      resetCreateForm,
      saving,
    },
    detail: {
      completingTaskId,
      detailLoading,
      id,
      markReminderRead,
      navigateToList: () => navigate("/own-tasks"),
      onCompleteTask: (taskId) => setConfirmCompleteTaskId(String(taskId)),
      onDeleteTask: (taskId) => setConfirmDeleteTaskId(String(taskId)),
      onEditTask: openEditModal,
      onOpenShareModal: openShareModal,
      sharingTaskId,
      taskAttachmentUrl,
      taskDetail,
    },
    filters: {
      hasFilters,
      reminderTypeFilter,
      search,
      setReminderTypeFilter,
      setSearch,
      setStatusFilter,
      statusFilter,
      clearFilters: () => {
        setSearch("");
        setStatusFilter("");
        setReminderTypeFilter("");
      },
    },
    table: {
      completingTaskId,
      hasFilters,
      id,
      loading,
      onCompleteTask: (taskId) => setConfirmCompleteTaskId(String(taskId)),
      onDeleteTask: (taskId) => setConfirmDeleteTaskId(String(taskId)),
      onEditTask: openEditModal,
      onOpenShareModal: openShareModal,
      onViewTask: (taskId) => navigate(`/own-tasks/${taskId}`),
      rows: tableRows,
      sharingTaskId,
    },
    confirmComplete: {
      open: Boolean(confirmCompleteTaskId),
      loading: Boolean(completingTaskId),
      onConfirm: async () => {
        await handleCompleteTask(confirmCompleteTaskId);
        setConfirmCompleteTaskId("");
      },
      onCancel: () => setConfirmCompleteTaskId(""),
    },
    confirmDelete: {
      open: Boolean(confirmDeleteTaskId),
      loading: deleting,
      onConfirm: handleDeleteTask,
      onCancel: () => setConfirmDeleteTaskId(""),
    },
    editModal: {
      attachmentInputRef: editAttachmentInputRef,
      attachmentPreview: editAttachmentPreview,
      form: editForm,
      handleAttachmentChange: handleEditAttachmentChange,
      handleFieldChange: handleEditFieldChange,
      onClose: closeEditModal,
      onSubmit: handleUpdateTask,
      open: editMode,
      saving: updating,
    },
    shareModal: {
      employees: visibleShareableEmployees,
      loading: shareListLoading,
      onClose: closeShareModal,
      onSelectEmployee: (employeeId) => {
        void handleShareTask(shareModalTask, employeeId);
      },
      setShareSearch: setShareEmployeeSearch,
      shareSearch: shareEmployeeSearch,
      sharing: shareModalTask
        ? String(sharingTaskId) === String(shareModalTask._id)
        : false,
      task: shareModalTask,
    },
  };
};
