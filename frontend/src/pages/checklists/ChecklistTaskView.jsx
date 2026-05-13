import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/axios";
import {
  GENERAL_ATTACHMENT_ACCEPT,
  GENERAL_ATTACHMENT_OPTIONS,
  validateFile,
  validateFiles,
} from "../../utils/fileValidation";
import {
  formatApprovalTypeLabel,
  formatChecklistDependencyLabel,
  formatChecklistDependencyStatus,
  formatCurrentApproverLabel,
  formatChecklistTaskStatus,
  formatDateTime,
  formatEmployeeLabel,
  formatMarkAdjustment,
  formatMarkValue,
  formatPriorityLabel,
  formatScheduleLabel,
  formatTaskFinalMarkLabel,
  formatTaskMarkDayLabel,
  formatTargetDayCountLabel,
  formatTimelinessLabel,
  formatTaskStatus,
  getTaskTargetDateTime,
  getApprovalTypeBadgeClass,
  getChecklistDependencyStatusBadgeClass,
  getTaskMarkSummary,
  getChecklistTaskStatusBadgeClass,
  getPriorityBadgeClass,
  getTimelinessBadgeClass,
  isNilChecklistTask,
} from "../../utils/checklistDisplay";

const getUser = () => JSON.parse(localStorage.getItem("user") || "{}");

const normalizeTaskText = (value) => String(value || "").trim();

const getEmployeeTaskAnswer = (value) => {
  const answer = normalizeTaskText(
    value?.employeeAnswerRemark || value?.answer || value?.remarks
  );
  if (answer) return answer;
  return value?.verified ? "Completed" : "";
};

const getSuperiorTaskAnswer = (value) => normalizeTaskText(value?.superiorAnswerRemark);

const formatHistoryActionLabel = (action) => {
  switch (normalizeTaskText(action).toLowerCase()) {
    case "submitted":
      return "Submitted";
    case "resubmitted":
      return "Resubmitted";
    case "approved":
      return "Approved";
    case "nil_approved":
      return "Nil Approved";
    case "rejected":
      return "Rejected";
    default:
      return action || "-";
  }
};

const buildTaskStageSummary = (task) => {
  const normalizedStatus = String(task?.status || "").trim().toLowerCase();
  const isNilTaskFlow = isNilChecklistTask(task);
  const hasSubmission = Boolean(task?.submittedAt);
  const hasApprovalReview =
    hasSubmission ||
    ["approved", "nil_approved", "rejected"].includes(normalizedStatus);

  return [
    { label: "Assigned", active: true },
    { label: isNilTaskFlow ? "Nil Submitted" : "Submitted", active: hasSubmission },
    { label: isNilTaskFlow ? "Nil Under Approval" : "Under Approval", active: hasApprovalReview },
    {
      label: isNilTaskFlow ? "Nil Approved / Completed" : "Approved / Completed",
      active: ["approved", "nil_approved"].includes(normalizedStatus),
    },
  ];
};

const IMAGE_ATTACHMENT_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "svg",
  "avif",
]);

const VIDEO_ATTACHMENT_EXTENSIONS = new Set([
  "mp4",
  "webm",
  "ogg",
  "mov",
  "m4v",
  "avi",
  "mkv",
]);

const AUDIO_ATTACHMENT_EXTENSIONS = new Set([
  "mp3",
  "wav",
  "ogg",
  "webm",
  "m4a",
  "aac",
  "flac",
]);

const AUDIO_MIME_TYPE_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
  "audio/mpeg",
  "audio/wav",
];

const VOICE_RECORDING_START_ERROR = "Unable to start voice recording on this browser.";
const MAX_CHECKLIST_ATTACHMENTS = 10;

const getSupportedAudioMimeType = () => {
  if (
    typeof window === "undefined" ||
    typeof window.MediaRecorder === "undefined" ||
    typeof window.MediaRecorder.isTypeSupported !== "function"
  ) {
    return "";
  }

  return (
    AUDIO_MIME_TYPE_CANDIDATES.find((mimeType) =>
      window.MediaRecorder.isTypeSupported(mimeType)
    ) || ""
  );
};

const getAudioFileExtension = (mimeType) => {
  const normalizedType = String(mimeType || "").toLowerCase();
  if (normalizedType.includes("mp4") || normalizedType.includes("aac")) return "m4a";
  if (normalizedType.includes("mpeg")) return "mp3";
  if (normalizedType.includes("ogg")) return "ogg";
  if (normalizedType.includes("wav")) return "wav";
  return "webm";
};

const formatRecordingDuration = (value) => {
  const totalSeconds = Math.max(0, Number(value || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const formatLocalFileSize = (value) => {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";

  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb >= 1 ? 1 : 2)} MB`;
};

const getLocalAttachmentKey = (file) =>
  [file?.name, file?.size, file?.lastModified, file?.type]
    .map((value) => String(value || ""))
    .join("|");

const PDF_ATTACHMENT_EXTENSIONS = new Set(["pdf"]);
const SPREADSHEET_ATTACHMENT_EXTENSIONS = new Set(["xls", "xlsx", "csv"]);
const DOCUMENT_ATTACHMENT_EXTENSIONS = new Set([
  "doc",
  "docx",
  "ppt",
  "pptx",
  "rtf",
  "odt",
]);
const TEXT_ATTACHMENT_EXTENSIONS = new Set(["txt", "log", "json", "xml", "md"]);
const ARCHIVE_ATTACHMENT_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz"]);

const getAttachmentExtension = (value) => {
  const normalizedValue = normalizeTaskText(value);
  if (!normalizedValue.includes(".")) return "";
  return normalizedValue.split(".").pop()?.toLowerCase() || "";
};

const buildAttachmentUrl = (uploadBaseUrl, fileName) => {
  const normalizedFileName = normalizeTaskText(fileName);
  return normalizedFileName
    ? `${uploadBaseUrl}/uploads/${encodeURIComponent(normalizedFileName)}`
    : "";
};

const getAttachmentTypeMeta = (file) => {
  const attachmentName = normalizeTaskText(file?.originalName || file?.fileName);
  const extension = getAttachmentExtension(attachmentName);
  const mimeType = normalizeTaskText(file?.mimeType || file?.mimetype).toLowerCase();

  if (mimeType.startsWith("audio/")) {
    return {
      kind: "audio",
      label: "Audio",
      icon: "AUD",
      badgeClass: "bg-success-subtle text-success border",
      description: "Audio preview available",
      extensionLabel: extension ? extension.toUpperCase() : "AUDIO",
    };
  }

  if (mimeType.startsWith("video/")) {
    return {
      kind: "video",
      label: "Video",
      icon: "VID",
      badgeClass: "bg-danger-subtle text-danger border",
      description: "Video preview available",
      extensionLabel: extension ? extension.toUpperCase() : "VIDEO",
    };
  }

  if (IMAGE_ATTACHMENT_EXTENSIONS.has(extension)) {
    return {
      kind: "image",
      label: "Image",
      icon: "IMG",
      badgeClass: "bg-primary-subtle text-primary border",
      description: "Image preview available",
      extensionLabel: extension.toUpperCase(),
    };
  }

  if (VIDEO_ATTACHMENT_EXTENSIONS.has(extension)) {
    return {
      kind: "video",
      label: "Video",
      icon: "VID",
      badgeClass: "bg-danger-subtle text-danger border",
      description: "Video preview available",
      extensionLabel: extension.toUpperCase(),
    };
  }

  if (AUDIO_ATTACHMENT_EXTENSIONS.has(extension)) {
    return {
      kind: "audio",
      label: "Audio",
      icon: "AUD",
      badgeClass: "bg-success-subtle text-success border",
      description: "Audio preview available",
      extensionLabel: extension.toUpperCase(),
    };
  }

  if (PDF_ATTACHMENT_EXTENSIONS.has(extension)) {
    return {
      kind: "pdf",
      label: "PDF",
      icon: "PDF",
      badgeClass: "bg-warning-subtle text-warning-emphasis border",
      description: "Portable document attachment",
      extensionLabel: "PDF",
    };
  }

  if (SPREADSHEET_ATTACHMENT_EXTENSIONS.has(extension)) {
    return {
      kind: "spreadsheet",
      label: "Sheet",
      icon: "XLS",
      badgeClass: "bg-success-subtle text-success border",
      description: "Spreadsheet attachment",
      extensionLabel: extension.toUpperCase(),
    };
  }

  if (DOCUMENT_ATTACHMENT_EXTENSIONS.has(extension)) {
    return {
      kind: "document",
      label: "Document",
      icon: "DOC",
      badgeClass: "bg-info-subtle text-info-emphasis border",
      description: "Document attachment",
      extensionLabel: extension.toUpperCase(),
    };
  }

  if (TEXT_ATTACHMENT_EXTENSIONS.has(extension)) {
    return {
      kind: "text",
      label: "Text",
      icon: "TXT",
      badgeClass: "bg-secondary-subtle text-secondary-emphasis border",
      description: "Text-based attachment",
      extensionLabel: extension.toUpperCase(),
    };
  }

  if (ARCHIVE_ATTACHMENT_EXTENSIONS.has(extension)) {
    return {
      kind: "archive",
      label: "Archive",
      icon: "ZIP",
      badgeClass: "bg-dark-subtle text-dark border",
      description: "Compressed file attachment",
      extensionLabel: extension.toUpperCase(),
    };
  }

  return {
    kind: "file",
    label: "File",
    icon: extension ? extension.slice(0, 4).toUpperCase() : "FILE",
    badgeClass: "bg-secondary-subtle text-secondary-emphasis border",
    description: "File attachment",
    extensionLabel: extension ? extension.toUpperCase() : "FILE",
  };
};

export default function ChecklistTaskView() {
  const { id } = useParams();
  const user = getUser();
  const mediaRecorderRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingCancelRef = useRef(false);
  const recordingTimerRef = useRef(null);
  const recordingSecondsRef = useRef(0);
  const attachmentInputRef = useRef(null);

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionRemarks, setDecisionRemarks] = useState("");
  const [employeeRemarks, setEmployeeRemarks] = useState("");
  const [itemResponses, setItemResponses] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [recordingState, setRecordingState] = useState("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedVoiceFile, setRecordedVoiceFile] = useState(null);
  const [recordedVoicePreviewUrl, setRecordedVoicePreviewUrl] = useState("");
  const [recordedVoiceDuration, setRecordedVoiceDuration] = useState(0);
  const [voiceRecordingError, setVoiceRecordingError] = useState("");
  const uploadBaseUrl = (api.defaults.baseURL || "http://localhost:5000/api").replace(
    /\/api\/?$/,
    ""
  );

  const isAssignedEmployee =
    String(task?.assignedEmployee?._id || task?.assignedEmployee || "") === String(user?.id || "");
  const isCurrentApprover =
    String(task?.currentApprovalEmployee?._id || task?.currentApprovalEmployee || "") ===
    String(user?.id || "");
  const isNilTaskFlow = isNilChecklistTask(task);
  const normalizedTaskStatus = String(task?.status || "").trim().toLowerCase();
  const isRejectedTask = normalizedTaskStatus === "rejected";
  const isWaitingOnDependency = normalizedTaskStatus === "waiting_dependency";
  const approvalHistory = Array.isArray(task?.approvalHistory) ? task.approvalHistory : [];
  const latestRejection =
    [...approvalHistory]
      .reverse()
      .find((entry) => normalizeTaskText(entry?.action).toLowerCase() === "rejected") ||
    (isRejectedTask
      ? {
          remarks:
            task?.rejectionRemarks ||
            task?.approvalSteps?.find?.((step) => step?.status === "rejected")?.remarks,
          actedAt:
            task?.rejectedAt ||
            task?.approvalSteps?.find?.((step) => step?.status === "rejected")?.actedAt,
          actorEmployee: task?.rejectedBy,
        }
      : null);
  const latestRejectionRemark = normalizeTaskText(latestRejection?.remarks);

  const canSubmit = isAssignedEmployee && ["open", "rejected"].includes(normalizedTaskStatus);
  const supportsVoiceRecording =
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia);
  const canDecide =
    isCurrentApprover && ["submitted", "nil_for_approval"].includes(String(task?.status || ""));
  const markSummary = getTaskMarkSummary(task || {});
  const taskStageSummary = buildTaskStageSummary(task);
  const requiredSuperiorRemarksComplete =
    !Array.isArray(task?.checklistItems) ||
    task.checklistItems.every((item) => {
      if (item?.isRequired === false) return true;

      const response =
        itemResponses.find(
          (row) =>
            String(row.checklistItemId) === String(item.checklistItemId || item._id)
        ) || {};

      return Boolean(
        normalizeTaskText(response.superiorAnswerRemark || item.superiorAnswerRemark)
      );
    });
  const pageDescription = canDecide
    ? isNilTaskFlow
      ? "Review the submitted questions and complete the Nil approval flow without applying any task mark."
      : "Review the submitted questions and enter your superior remark for each required question before approving or rejecting."
    : isWaitingOnDependency
    ? `This task is locked until ${formatChecklistDependencyLabel(task)} is completed.`
    : isRejectedTask && isAssignedEmployee
    ? "Review the rejection reason, correct the task answers, and resubmit it for approval."
    : canSubmit
    ? "Review the assigned task, answer each question, and submit it for approval."
    : isAssignedEmployee
    ? "Review your submitted answers and track the approval progress."
    : "Review the task questions and the superior review details.";

  const clearVoiceRecordingResources = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    recordingStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    mediaRecorderRef.current = null;
  };

  const clearRecordedVoice = () => {
    setRecordedVoiceFile(null);
    setRecordedVoiceDuration(0);
    setRecordedVoicePreviewUrl((currentValue) => {
      if (currentValue) {
        window.URL.revokeObjectURL(currentValue);
      }

      return "";
    });
  };

  const loadTask = useCallback(async () => {
    setLoading(true);

    try {
      const response = await api.get(`/checklists/tasks/${id}`);
      const taskData = response.data || null;

      setTask(taskData);
      setEmployeeRemarks(taskData?.employeeRemarks || "");
      setItemResponses(
        Array.isArray(taskData?.checklistItems)
          ? taskData.checklistItems.map((item) => ({
              checklistItemId: item.checklistItemId || item._id,
              employeeAnswerRemark: getEmployeeTaskAnswer(item),
              superiorAnswerRemark: getSuperiorTaskAnswer(item),
            }))
          : []
      );
      setAttachments([]);
      setVoiceRecordingError("");
      setRecordedVoiceFile(null);
      setRecordedVoiceDuration(0);
      setRecordedVoicePreviewUrl((currentValue) => {
        if (currentValue) {
          window.URL.revokeObjectURL(currentValue);
        }

        return "";
      });
      setDecisionRemarks("");
    } catch (err) {
      console.error("Checklist task load failed:", err);
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadTask();
  }, [loadTask]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }

      if (mediaRecorderRef.current?.state === "recording") {
        recordingCancelRef.current = true;
        mediaRecorderRef.current.stop();
      }

      recordingStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    return () => {
      if (recordedVoicePreviewUrl) {
        window.URL.revokeObjectURL(recordedVoicePreviewUrl);
      }
    };
  }, [recordedVoicePreviewUrl]);

  const updateItemResponse = (checklistItemId, key, value) => {
    setItemResponses((prev) =>
      prev.map((item) =>
        String(item.checklistItemId) === String(checklistItemId)
          ? { ...item, [key]: value }
          : item
      )
    );
  };

  const handleAttachmentChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    const validationMessage = validateFiles(selectedFiles, GENERAL_ATTACHMENT_OPTIONS);

    if (validationMessage) {
      alert(validationMessage);
      event.target.value = "";
      return;
    }

    const existingFileKeys = new Set(attachments.map((file) => getLocalAttachmentKey(file)));
    const nextAttachments = [...attachments];

    selectedFiles.forEach((file) => {
      const fileKey = getLocalAttachmentKey(file);
      if (!existingFileKeys.has(fileKey)) {
        existingFileKeys.add(fileKey);
        nextAttachments.push(file);
      }
    });

    const reservedVoiceSlot = recordedVoiceFile ? 1 : 0;
    if (nextAttachments.length + reservedVoiceSlot > MAX_CHECKLIST_ATTACHMENTS) {
      alert(`You can attach up to ${MAX_CHECKLIST_ATTACHMENTS} files per submission.`);
      event.target.value = "";
      return;
    }

    setAttachments(nextAttachments);
    setVoiceRecordingError("");
    event.target.value = "";
  };

  const removeAttachment = (attachmentIndex) => {
    setAttachments((currentAttachments) =>
      currentAttachments.filter((_, index) => index !== attachmentIndex)
    );
  };

  const clearAttachments = () => {
    setAttachments([]);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  };

  const buildVoiceFileFromChunks = (chunks, mimeType) => {
    const resolvedMimeType =
      String(mimeType || chunks[0]?.type || "").split(";")[0] || "audio/webm";
    const extension = getAudioFileExtension(resolvedMimeType);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const audioBlob = new Blob(chunks, { type: resolvedMimeType });

    return new File([audioBlob], `checklist-voice-${timestamp}.${extension}`, {
      type: resolvedMimeType,
    });
  };

  const attachRecordedVoice = (voiceFile, durationSeconds) => {
    const validationMessage = validateFile(voiceFile, GENERAL_ATTACHMENT_OPTIONS);

    if (validationMessage) {
      setVoiceRecordingError(validationMessage);
      return;
    }

    if (attachments.length + 1 > MAX_CHECKLIST_ATTACHMENTS) {
      setVoiceRecordingError(
        `You can attach up to ${MAX_CHECKLIST_ATTACHMENTS} files per submission.`
      );
      return;
    }

    setRecordedVoiceFile(voiceFile);
    setRecordedVoiceDuration(durationSeconds);
    setRecordedVoicePreviewUrl((currentValue) => {
      if (currentValue) {
        window.URL.revokeObjectURL(currentValue);
      }

      return window.URL.createObjectURL(voiceFile);
    });
    setVoiceRecordingError("");
  };

  const startVoiceRecording = async () => {
    setVoiceRecordingError("");

    if (recordingState !== "idle" || saving) {
      return;
    }

    if (!supportsVoiceRecording) {
      setVoiceRecordingError(VOICE_RECORDING_START_ERROR);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      clearRecordedVoice();

      const mimeType = getSupportedAudioMimeType();
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recordingChunksRef.current = [];
      recordingCancelRef.current = false;
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = () => {
        recordingCancelRef.current = true;
        setRecordingState("idle");
        setRecordingSeconds(0);
        recordingSecondsRef.current = 0;
        clearVoiceRecordingResources();
        setVoiceRecordingError("Voice recording failed. Please try again.");
      };

      mediaRecorder.onstop = () => {
        const chunks = recordingChunksRef.current;
        const wasCancelled = recordingCancelRef.current;
        const recordedMimeType = mediaRecorder.mimeType || mimeType;
        const durationSeconds = recordingSecondsRef.current;

        recordingChunksRef.current = [];
        recordingCancelRef.current = false;
        clearVoiceRecordingResources();
        setRecordingState("idle");
        setRecordingSeconds(0);
        recordingSecondsRef.current = 0;

        if (wasCancelled) return;

        if (!chunks.length) {
          setVoiceRecordingError("No voice audio was captured. Please try again.");
          return;
        }

        attachRecordedVoice(buildVoiceFileFromChunks(chunks, recordedMimeType), durationSeconds);
      };

      mediaRecorder.start();
      setRecordingState("recording");
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;
      recordingTimerRef.current = window.setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
      }, 1000);
    } catch (err) {
      console.error("Checklist voice recording start failed:", err);
      clearVoiceRecordingResources();
      setRecordingState("idle");
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;
      setVoiceRecordingError(VOICE_RECORDING_START_ERROR);
    }
  };

  const stopVoiceRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    setRecordingState("processing");
    recorder.stop();
  };

  const handleSubmitTask = async (submissionType = "normal") => {
    if (recordingState !== "idle") {
      setVoiceRecordingError("Stop the voice recording before submitting this task.");
      return;
    }

    setSaving(true);

    try {
      const payload = new FormData();
      payload.append("employeeRemarks", employeeRemarks);
      payload.append("submissionType", submissionType);
      payload.append(
        "itemResponses",
        JSON.stringify(
          itemResponses.map((item) => ({
            checklistItemId: item.checklistItemId,
            employeeAnswerRemark: item.employeeAnswerRemark,
            answer: item.employeeAnswerRemark,
          }))
        )
      );

      Array.from(attachments || []).forEach((file) => {
        payload.append("attachments", file);
      });

      if (recordedVoiceFile) {
        payload.append("attachments", recordedVoiceFile);
      }

      await api.post(`/checklists/tasks/${id}/submit`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await loadTask();
      alert(
        submissionType === "nil"
          ? "Task submitted for nil approval successfully."
          : "Task answers submitted successfully."
      );
    } catch (err) {
      console.error("Checklist task submit failed:", err);
      alert(err.response?.data?.message || "Failed to submit task answers");
    } finally {
      setSaving(false);
    }
  };

  const handleDecision = async (action) => {
    setDecisionLoading(true);

    try {
      await api.post(`/checklists/tasks/${id}/decision`, {
        action,
        remarks: decisionRemarks,
        itemResponses: itemResponses.map((item) => ({
          checklistItemId: item.checklistItemId,
          superiorAnswerRemark: item.superiorAnswerRemark,
        })),
      });

      await loadTask();
      const actionLabelMap = {
        approve: "approved",
        reject: "rejected",
        nil_approve: "nil approved",
      };
      alert(`Task answers ${actionLabelMap[action] || "updated"} successfully.`);
    } catch (err) {
      console.error("Checklist decision failed:", err);
      alert(err.response?.data?.message || "Failed to update checklist approval");
    } finally {
      setDecisionLoading(false);
    }
  };

  if (loading) {
    return <div className="container mt-4">Loading checklist task...</div>;
  }

  if (!task) {
    return (
      <div className="container mt-4">
        <div className="alert alert-danger">Checklist task not found.</div>
        <Link className="btn btn-outline-secondary" to="/checklists">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="container mt-4 mb-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h3 className="mb-1">Checklist Task</h3>
          <div className="text-muted">{pageDescription}</div>
        </div>

        <Link className="btn btn-outline-secondary" to="/checklists">
          Back
        </Link>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          {isWaitingOnDependency ? (
            <div className="alert alert-warning mb-3">
              Waiting for Previous Task Completion. This checklist will unlock automatically after{" "}
              <span className="fw-semibold">{formatChecklistDependencyLabel(task)}</span> is completed.
            </div>
          ) : null}

          <div className="row g-3">
            <Info label="Task Number" value={task.taskNumber} />
            <Info label="Checklist Number" value={task.checklistNumber} />
            <Info label="Checklist Name" value={task.checklistName} />
            <Info label="Assigned Employee" value={formatEmployeeLabel(task.assignedEmployee)} />
            <Info label="Dependent Task" value={task.isDependentTask ? "Yes" : "No"} />
            <Info
              label="Previous Task"
              value={task.isDependentTask ? formatChecklistDependencyLabel(task) : "-"}
            />
            <Info
              label="Dependency Status"
              value={
                task.isDependentTask ? (
                  <span className={`badge ${getChecklistDependencyStatusBadgeClass(task)}`}>
                    {formatChecklistDependencyStatus(task)}
                  </span>
                ) : (
                  "No Dependency"
                )
              }
            />
            <Info
              label="Target Day Count"
              value={task.isDependentTask ? formatTargetDayCountLabel(task.targetDayCount) : "-"}
            />
            <Info
              label="Previous Task Completed At"
              value={formatDateTime(task.dependencyCompletedAt)}
            />
            <Info
              label="Target Date / Time"
              value={formatDateTime(getTaskTargetDateTime(task))}
            />
            <Info
              label="Auto Created From Dependency"
              value={task.autoCreatedFromDependency ? "Yes" : "No"}
            />
            <Info label="Unlocked At" value={formatDateTime(task.unlockedAt)} />
            <Info
              label="Priority"
              value={
                <span className={`badge ${getPriorityBadgeClass(task.priority || task.checklist)}`}>
                  {formatPriorityLabel(task)}
                </span>
              }
            />
            <Info label="Schedule Type" value={formatScheduleLabel(task)} />
            <Info label="Start Date / Time" value={formatDateTime(task.occurrenceDate)} />
            <Info label="End Date / Time" value={formatDateTime(task.endDateTime)} />
            <Info label="Submitted At" value={formatDateTime(task.submittedAt)} />
            <Info
              label="Approval Type"
              value={
                <span className={`badge ${getApprovalTypeBadgeClass(task)}`}>
                  {formatApprovalTypeLabel(task)}
                </span>
              }
            />
            <Info label="Current Approver" value={formatCurrentApproverLabel(task)} />
            <Info
              label="Time Status"
              value={
                <span
                  className={`badge ${getTimelinessBadgeClass(
                    task.submissionTimingStatus || task.timelinessStatus
                  )}`}
                >
                  {formatTimelinessLabel(
                    task.submissionTimingStatus || task.timelinessStatus
                  )}
                </span>
              }
            />
            <Info
              label="Status"
              value={
                <span className={`badge ${getChecklistTaskStatusBadgeClass(task.status)}`}>
                  {formatChecklistTaskStatus(task.status)}
                </span>
              }
            />
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <div className="d-flex flex-wrap align-items-center gap-2">
            {taskStageSummary.map((stage) => (
              <span
                key={stage.label}
                className={`summary-chip${stage.active ? "" : " summary-chip--neutral"}`}
              >
                {stage.label}
              </span>
            ))}
            {String(task.status || "").trim().toLowerCase() === "rejected" ? (
              <span className="badge text-bg-danger">Rejected</span>
            ) : null}
          </div>

          {isRejectedTask ? (
            <div className="alert alert-danger mt-3 mb-0" role="alert">
              <div className="fw-semibold">Rejection Reason</div>
              <div>{latestRejectionRemark || "No rejection remark was recorded."}</div>
              <div className="small mt-1">
                {latestRejection?.actorEmployee
                  ? `Rejected by ${formatEmployeeLabel(latestRejection.actorEmployee)}`
                  : "Rejected"}
                {latestRejection?.actedAt ? ` on ${formatDateTime(latestRejection.actedAt)}` : ""}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Task Score</h5>
            <span
              className={`badge ${
                markSummary.isNilApproval
                  ? "bg-info text-dark border"
                  : markSummary.enableMark
                  ? "bg-success-subtle text-success border"
                  : "bg-light text-dark border"
              }`}
            >
              {markSummary.isNilApproval
                ? "Nil Approval / No Mark"
                : markSummary.enableMark
                ? "Scored Task"
                : "No Scoring"}
            </span>
          </div>

          <div className="row g-3">
            <Info
              label="Base Mark"
              value={
                markSummary.isNilApproval
                  ? "No Mark"
                  : markSummary.enableMark
                  ? formatMarkValue(markSummary.baseMark)
                  : "Not enabled"
              }
            />
            <Info
              label="Delay/Advance Days"
              value={formatTaskMarkDayLabel(task)}
            />
            <Info
              label="Adjustment"
              value={
                markSummary.isNilApproval
                  ? "No Mark"
                  : markSummary.enableMark
                  ? markSummary.adjustment !== null
                    ? formatMarkAdjustment(markSummary.adjustment)
                    : "Pending"
                  : "Not enabled"
              }
            />
            <Info
              label="Final Mark"
              value={formatTaskFinalMarkLabel(task)}
            />
            <Info
              label="Delay Penalty / Day"
              value={
                markSummary.isNilApproval
                  ? "No Mark"
                  : markSummary.enableMark
                  ? formatMarkValue(markSummary.delayPenaltyPerDay)
                  : "Not enabled"
              }
            />
            <Info
              label="Advance Bonus / Day"
              value={
                markSummary.isNilApproval
                  ? "No Mark"
                  : markSummary.enableMark
                  ? formatMarkValue(markSummary.advanceBonusPerDay)
                  : "Not enabled"
              }
            />
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Task Related Questions</h5>
            {canSubmit ? (
              <span className="badge bg-primary">Employee Answer Required</span>
            ) : canDecide ? (
              <span className="badge bg-warning text-dark">Superior Remark Required</span>
            ) : (
              <span className="badge bg-light text-dark border">Read Only</span>
            )}
          </div>

          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Question</th>
                  <th>Guidance</th>
                  <th style={{ width: "34%" }}>
                    {canDecide
                      ? "Superior Answer / Remark"
                      : isAssignedEmployee
                      ? canSubmit
                        ? "Answer / Remark"
                        : "Your Answer / Remark"
                      : "Superior Answer / Remark"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {task.checklistItems?.map((item, index) => {
                  const response =
                    itemResponses.find(
                      (row) => String(row.checklistItemId) === String(item.checklistItemId || item._id)
                    ) || {};

                  return (
                    <tr key={item._id || item.checklistItemId || index}>
                      <td>{index + 1}</td>
                      <td>
                        {item.label}
                        {item.isRequired !== false && (
                          <span className="badge bg-light text-dark border ms-2">Required</span>
                        )}
                      </td>
                      <td>{item.detail || "-"}</td>
                      <td>
                        {canSubmit ? (
                          <textarea
                            className="form-control"
                            rows="3"
                            value={response.employeeAnswerRemark || ""}
                            onChange={(event) =>
                              updateItemResponse(
                                item.checklistItemId || item._id,
                                "employeeAnswerRemark",
                                event.target.value
                              )
                            }
                            placeholder={
                              item.isRequired !== false
                                ? "Enter the required answer or remark"
                                : "Enter the answer or remark"
                            }
                          />
                        ) : canDecide ? (
                          <textarea
                            className="form-control"
                            rows="3"
                            value={response.superiorAnswerRemark || ""}
                            onChange={(event) =>
                              updateItemResponse(
                                item.checklistItemId || item._id,
                                "superiorAnswerRemark",
                                event.target.value
                              )
                            }
                            placeholder={
                              item.isRequired !== false
                                ? "Enter the required superior answer or remark"
                                : "Enter the superior answer or remark"
                            }
                          />
                        ) : isAssignedEmployee ? (
                          <div className="small text-dark">
                            {getEmployeeTaskAnswer(response) ||
                              getEmployeeTaskAnswer(item) ||
                              "No answer submitted."}
                          </div>
                        ) : (
                          <div className="small text-dark">
                            {getSuperiorTaskAnswer(response) ||
                              getSuperiorTaskAnswer(item) ||
                              "No superior remark submitted."}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="row g-3 mt-1">
            {canSubmit || isAssignedEmployee ? (
              <div className={canSubmit ? "col-md-8" : "col-12"}>
                <label className="form-label fw-semibold">Submission Summary</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={employeeRemarks}
                  disabled={!canSubmit}
                  onChange={(event) => setEmployeeRemarks(event.target.value)}
                  placeholder="Add an overall note for the submitted answers"
                />
              </div>
            ) : null}

            {canSubmit ? (
              <div className="col-md-4">
                <label className="form-label fw-semibold" htmlFor="checklist-task-attachments">
                  Attachments
                </label>
                <input
                  id="checklist-task-attachments"
                  ref={attachmentInputRef}
                  type="file"
                  multiple
                  className="visually-hidden"
                  accept={GENERAL_ATTACHMENT_ACCEPT}
                  onChange={handleAttachmentChange}
                />

                <div className="checklist-attachment-picker">
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => attachmentInputRef.current?.click()}
                      disabled={
                        saving ||
                        attachments.length + (recordedVoiceFile ? 1 : 0) >=
                          MAX_CHECKLIST_ATTACHMENTS
                      }
                    >
                      Add Attachments
                    </button>
                    {attachments.length ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={clearAttachments}
                        disabled={saving}
                      >
                        Clear Files
                      </button>
                    ) : null}
                  </div>

                  {attachments.length ? (
                    <ul className="checklist-attachment-list mt-2">
                      {attachments.map((file, index) => (
                        <li
                          className="checklist-attachment-list__item"
                          key={`${getLocalAttachmentKey(file)}-${index}`}
                        >
                          <div className="checklist-attachment-list__meta">
                            <div className="fw-semibold text-break">
                              {normalizeTaskText(file.name) || `Attachment ${index + 1}`}
                            </div>
                            <div className="small text-muted">
                              {formatLocalFileSize(file.size)}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => removeAttachment(index)}
                            disabled={saving}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="checklist-voice-recorder mt-3">
                  {recordingState === "recording" ? (
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <span className="checklist-voice-recorder__status" aria-live="polite">
                        Recording {formatRecordingDuration(recordingSeconds)}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={stopVoiceRecording}
                        disabled={saving}
                      >
                        Stop
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => {
                        void startVoiceRecording();
                      }}
                      disabled={saving || recordingState === "processing"}
                      title={
                        supportsVoiceRecording
                          ? "Record voice attachment"
                          : "Voice recording is not supported in this browser"
                      }
                    >
                      {recordingState === "processing" ? "Processing Voice..." : "Record Voice"}
                    </button>
                  )}

                  {voiceRecordingError ? (
                    <div className="checklist-voice-recorder__error" role="status">
                      {voiceRecordingError}
                    </div>
                  ) : null}

                  {recordedVoiceFile && recordedVoicePreviewUrl ? (
                    <div className="checklist-voice-preview">
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div>
                          <div className="fw-semibold text-break">{recordedVoiceFile.name}</div>
                          <div className="small text-muted">
                            Duration {formatRecordingDuration(recordedVoiceDuration)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={clearRecordedVoice}
                          disabled={saving}
                        >
                          Remove
                        </button>
                      </div>
                      <audio controls className="w-100 mt-2" src={recordedVoicePreviewUrl}>
                        Your browser does not support audio playback.
                      </audio>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {Array.isArray(task.employeeAttachments) && task.employeeAttachments.length > 0 && (
            <div className="mt-3">
              <div className="fw-semibold mb-2">
                {canSubmit || isAssignedEmployee ? "Submitted Attachments" : "Employee Attachments"}
              </div>
              <div className="row g-3">
                {task.employeeAttachments.map((file, index) => (
                  <div className="col-12 col-md-6 col-xl-4" key={`${file.fileName}-${index}`}>
                    <AttachmentCard file={file} uploadBaseUrl={uploadBaseUrl} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {canSubmit && (
            <div className="d-flex flex-wrap justify-content-end gap-2 mt-3">
              {!isRejectedTask || isNilTaskFlow ? (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => handleSubmitTask("nil")}
                  disabled={saving || recordingState !== "idle"}
                >
                  {saving ? "Submitting..." : "Nil For Approval"}
                </button>
              ) : null}
              {!isRejectedTask || !isNilTaskFlow ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleSubmitTask("normal")}
                  disabled={saving || recordingState !== "idle"}
                >
                  {saving ? "Submitting..." : "Submit For Approval"}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Approval Workflow</h5>
            {canDecide && (
              <span
                className={`badge ${
                  isNilTaskFlow ? "bg-info text-dark" : "bg-warning text-dark"
                }`}
              >
                {isNilTaskFlow ? "Nil Approval Pending" : "Approval Pending"}
              </span>
            )}
          </div>

          <div className="table-responsive">
            <table className="table table-bordered align-middle">
              <thead className="table-light">
                <tr>
                  <th>Level</th>
                  <th>Approver</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Acted At</th>
                </tr>
              </thead>
              <tbody>
                {task.approvalSteps?.map((step) => (
                  <tr key={`${step.approvalLevel}-${step.approverEmployee?._id || step.approverEmployee}`}>
                    <td>{step.approvalLevel}</td>
                    <td>{formatEmployeeLabel(step.approverEmployee)}</td>
                    <td>{formatTaskStatus(step.status)}</td>
                    <td>{step.remarks || "-"}</td>
                    <td>{formatDateTime(step.actedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {approvalHistory.length ? (
            <div className="mt-4">
              <h6 className="mb-2">Activity History</h6>
              <div className="table-responsive">
                <table className="table table-sm table-bordered align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Action</th>
                      <th>Employee</th>
                      <th>Remarks</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalHistory.map((entry, index) => (
                      <tr key={entry._id || `${entry.action}-${entry.actedAt}-${index}`}>
                        <td>{formatHistoryActionLabel(entry.action)}</td>
                        <td>{formatEmployeeLabel(entry.actorEmployee || entry.approverEmployee)}</td>
                        <td>{entry.remarks || "-"}</td>
                        <td>{formatDateTime(entry.actedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {canDecide && (
            <div className="border rounded p-3 mt-3">
              <div className="small text-muted mb-3">
                Enter the superior answer or remark for every required question to enable approval actions.
              </div>

              <label className="form-label fw-semibold">Approval Summary</label>
              <textarea
                className="form-control mb-3"
                rows="3"
                value={decisionRemarks}
                onChange={(event) => setDecisionRemarks(event.target.value)}
                placeholder="Add an approval or rejection summary if needed"
              />
              <div className="form-text mb-3">A rejection remark is required before rejecting.</div>

              <div className="d-flex justify-content-end gap-2">
                {isNilTaskFlow ? (
                  <button
                    type="button"
                    className="btn btn-outline-info"
                    onClick={() => handleDecision("nil_approve")}
                    disabled={decisionLoading || !requiredSuperiorRemarksComplete}
                  >
                    {decisionLoading ? "Saving..." : "Nil Approve"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={() => handleDecision("approve")}
                    disabled={decisionLoading || !requiredSuperiorRemarksComplete}
                  >
                    {decisionLoading ? "Saving..." : "Approve"}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => handleDecision("reject")}
                  disabled={decisionLoading || !normalizeTaskText(decisionRemarks)}
                >
                  {decisionLoading ? "Saving..." : "Reject"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="col-md-4">
      <div className="small text-muted">{label}</div>
      <div>{value || value === 0 ? value : "-"}</div>
    </div>
  );
}

function AttachmentCard({ file, uploadBaseUrl }) {
  const fileName = normalizeTaskText(file?.originalName || file?.fileName) || "Attachment";
  const fileUrl = buildAttachmentUrl(uploadBaseUrl, file?.fileName);
  const attachmentType = getAttachmentTypeMeta(file);

  if (!fileUrl) {
    return null;
  }

  const previewHeight = { maxHeight: "220px" };
  const previewStyles = {
    image: { ...previewHeight, objectFit: "cover", width: "100%" },
    video: { ...previewHeight, width: "100%", backgroundColor: "#111827" },
  };

  return (
    <div className="card h-100 shadow-sm border">
      {attachmentType.kind === "image" ? (
        <a href={fileUrl} target="_blank" rel="noreferrer" className="text-decoration-none">
          <img
            src={fileUrl}
            alt={fileName}
            className="card-img-top border-bottom"
            style={previewStyles.image}
          />
        </a>
      ) : attachmentType.kind === "video" ? (
        <video controls className="w-100 rounded-top border-bottom" style={previewStyles.video}>
          <source src={fileUrl} />
        </video>
      ) : attachmentType.kind === "audio" ? (
        <div className="p-3 border-bottom bg-light">
          <div className="d-flex align-items-center gap-3 mb-3">
            <div
              className="d-inline-flex align-items-center justify-content-center rounded-3 border bg-white fw-bold text-success"
              style={{ width: "64px", height: "64px", letterSpacing: "0.08em" }}
            >
              {attachmentType.icon}
            </div>
            <div className="small text-muted">Audio preview available for this attachment.</div>
          </div>
          <audio controls className="w-100">
            <source src={fileUrl} />
          </audio>
        </div>
      ) : (
        <div className="p-3 border-bottom bg-light">
          <div className="d-flex align-items-center gap-3">
            <div
              className="d-inline-flex align-items-center justify-content-center rounded-3 border bg-white fw-bold text-primary"
              style={{ width: "64px", height: "64px", letterSpacing: "0.08em" }}
            >
              {attachmentType.icon}
            </div>
            <div className="small text-muted">{attachmentType.description}</div>
          </div>
        </div>
      )}

      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
          <span className={`badge ${attachmentType.badgeClass}`}>{attachmentType.label}</span>
          <span className="small text-muted text-uppercase">{attachmentType.extensionLabel}</span>
        </div>
        <div className="fw-semibold text-break">{fileName}</div>
      </div>

      <div className="card-footer bg-white border-0 pt-0 pb-3 d-flex flex-wrap gap-2">
        <a
          href={fileUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-sm btn-outline-primary"
        >
          Open
        </a>
        <a href={fileUrl} download={fileName} className="btn btn-sm btn-outline-secondary">
          Download
        </a>
      </div>
    </div>
  );
}
