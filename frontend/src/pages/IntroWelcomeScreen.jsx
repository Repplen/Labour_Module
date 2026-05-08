import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import WelcomeCard from "../components/WelcomeCard";
import { usePermissions } from "../context/usePermissions";
import {
  dismissPostLoginWelcome,
  getPostLoginWelcomeSessionId,
  getStoredUser,
} from "../utils/postLoginWelcome";
import {
  formatAttendanceDuration,
  getAttendanceStatusBadgeClass,
} from "../utils/attendance";
import "../styles/postLoginFlow.css";

const AUTO_SLIDE_MS = 4000;
const SWIPE_THRESHOLD = 56;
const WELCOME_MESSAGES = [
  "Complete your tasks on time for better performance.",
  "On-time completion improves your score.",
  "Avoid delays to maintain your performance marks.",
  "Every completed task moves you forward.",
  "Stay updated with your checklist tasks.",
  "Let's start your tasks.",
];

const DEFAULT_CHECKLIST_SUMMARY = {
  userName: "User",
  pendingTaskCount: 0,
  pendingChecklistCount: 0,
  pendingReminderCount: 0,
  isDepartmentSuperior: false,
  departmentPendingCount: 0,
};

const DEFAULT_ATTENDANCE_STATE = {
  settings: null,
  employee: null,
  todayRecord: null,
};

const DEFAULT_POLL_SUMMARY = {
  assignedActiveCount: 0,
  pendingCount: 0,
};

const toSafeCount = (value) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue < 0) return 0;
  return Math.round(parsedValue);
};

const buildSeedValue = (value) =>
  String(value || "").split("").reduce((total, character) => total + character.charCodeAt(0), 0);

const pickWelcomeMessages = (seedSource, count = 3) => {
  const availableMessages = [...WELCOME_MESSAGES];
  const selectedMessages = [];
  let seed = buildSeedValue(seedSource) || 17;

  while (availableMessages.length && selectedMessages.length < count) {
    const index = seed % availableMessages.length;
    selectedMessages.push(availableMessages.splice(index, 1)[0]);
    seed = seed * 31 + 7;
  }

  return selectedMessages;
};

const getReminderText = (todayRecord, settings, canViewSelfAttendance) => {
  if (!canViewSelfAttendance) {
    return "Review your attendance module from the dashboard whenever you need a detailed update.";
  }

  if (!todayRecord) {
    return "Your attendance snapshot is on the way.";
  }

  if (Number(todayRecord.lateMinutes || 0) > 0 && settings?.lateAlertEnabled) {
    return `You are ${Number(todayRecord.lateMinutes || 0)} minute(s) late today. Keep the rest of the shift on track.`;
  }

  if (!todayRecord.checkInTime) {
    return "Don't forget to check-in before your shift starts.";
  }

  if (!todayRecord.checkOutTime) {
    return "Don't forget to check-out before you wrap up for the day.";
  }

  return "Your check-in and check-out look aligned for today.";
};

const getAttendanceModulePath = (can, canAny) => {
  if (can("employee_attendance", "view")) return "/attendance";
  if (
    canAny([
      { moduleKey: "employee_attendance", actionKey: "add" },
      { moduleKey: "employee_attendance", actionKey: "edit" },
    ])
  ) {
    return "/attendance/daily";
  }
  if (can("attendance_regularization", "view")) return "/attendance/regularization";
  if (
    canAny([
      { moduleKey: "attendance_reports", actionKey: "report_view" },
      { moduleKey: "attendance_reports", actionKey: "view" },
    ])
  ) {
    return "/attendance/reports";
  }
  if (can("attendance_settings", "view")) return "/attendance/settings";
  return "";
};

const getChecklistModulePath = (can, canAny) => {
  if (can("checklist_master", "view") || can("assigned_checklists", "view")) return "/checklists";
  if (can("approval_inbox", "view")) return "/checklists/approvals";
  if (can("checklist_master", "approve") || can("checklist_master", "reject")) {
    return "/checklists/admin-approvals";
  }
  if (
    canAny([
      { moduleKey: "reports", actionKey: "view" },
      { moduleKey: "reports", actionKey: "report_view" },
    ])
  ) {
    return "/reports/checklists";
  }
  if (can("checklist_transfer", "view")) return "/masters/checklist-transfer";
  return "";
};

const getPollingModulePath = (can) => {
  if (can("assigned_polls", "view")) return "/polls";
  return "";
};

const getComplaintModulePath = (can) => {
  if (can("complaints", "view")) return "/complaints";
  return "";
};

function AttendanceIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="attendanceIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#26c6da" />
          <stop offset="100%" stopColor="#0d8fd8" />
        </linearGradient>
      </defs>
      <rect x="10" y="12" width="44" height="40" rx="12" fill="url(#attendanceIconGradient)" />
      <path
        d="M20 26h24M20 34h14M20 42h11"
        stroke="#f5fffe"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="46" cy="42" r="8" fill="#fff4d1" />
      <path
        d="M46 38v5l3 2"
        stroke="#8f5b00"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="checklistIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff9f7f" />
          <stop offset="100%" stopColor="#ff5f6d" />
        </linearGradient>
      </defs>
      <rect x="12" y="10" width="40" height="44" rx="12" fill="url(#checklistIconGradient)" />
      <path
        d="M22 24l3 3 5-6M22 34l3 3 5-6M22 44l3 3 5-6"
        fill="none"
        stroke="#fff8ef"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M34 23h10M34 33h10M34 43h10"
        stroke="#fff8ef"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PollingIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="pollingIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffcf5a" />
          <stop offset="100%" stopColor="#ff8a3d" />
        </linearGradient>
      </defs>
      <rect x="10" y="12" width="44" height="40" rx="12" fill="url(#pollingIconGradient)" />
      <path
        d="M21 42V31M32 42V24M43 42V28"
        fill="none"
        stroke="#fff8ef"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M20 22c3 0 5.5 2.5 8 2.5s4-4.5 8-4.5c2.6 0 4.2 1.1 8 1.1"
        fill="none"
        stroke="#8f4b00"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ComplaintIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="complaintIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9b8cff" />
          <stop offset="100%" stopColor="#ff6f9f" />
        </linearGradient>
      </defs>
      <rect x="10" y="12" width="44" height="40" rx="12" fill="url(#complaintIconGradient)" />
      <path
        d="M21 25h22M21 32h22M21 39h13"
        stroke="#fff7fb"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="46" cy="40" r="7" fill="#fff2f8" />
      <path
        d="M46 36v6M46 45h.01"
        stroke="#b42362"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CountUpNumber({ value, duration = 900 }) {
  const targetValue = toSafeCount(value);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || targetValue <= 0) {
      return undefined;
    }

    let frameId = 0;
    let animationStart = 0;

    const animate = (timestamp) => {
      if (!animationStart) {
        animationStart = timestamp;
      }

      const progress = Math.min(1, (timestamp - animationStart) / duration);
      const easedProgress = 1 - (1 - progress) ** 3;

      setDisplayValue(Math.round(targetValue * easedProgress));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
      }
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [duration, targetValue]);

  if (targetValue <= 0) {
    return <>{targetValue}</>;
  }

  return <>{displayValue}</>;
}

function ModuleMetric({ label, value, meta, badgeClass = "", countUp = false }) {
  return (
    <div className="intro-slider__metric-card">
      <div className="intro-slider__metric-label">{label}</div>
      {badgeClass ? (
        <span className={`badge intro-slider__metric-badge ${badgeClass}`}>{value}</span>
      ) : (
        <div className={`intro-slider__metric-value${countUp ? " intro-slider__metric-value--count" : ""}`}>
          {countUp ? <CountUpNumber value={value} /> : value}
        </div>
      )}
      {meta ? <div className="intro-slider__metric-meta">{meta}</div> : null}
    </div>
  );
}

function AttendanceSlide({
  active,
  canViewSelfAttendance,
  loading,
  error,
  employeeLabel,
  focusLabel,
  statusLabel,
  statusBadgeClass,
  checkInLabel,
  checkOutLabel,
  workingHours,
  reminderText,
}) {
  return (
    <div
      className={`intro-slider__display-card intro-slider__display-card--attendance${
        active ? " is-active" : ""
      }`}
      style={{
        "--intro-accent": "#35d1dc",
        "--intro-accent-soft": "rgba(53, 209, 220, 0.2)",
        "--intro-glow": "rgba(13, 143, 216, 0.24)",
      }}
    >
      <div className="intro-slider__module-layout">
        <div className="intro-slider__module-hero">
          <div className="intro-slider__module-copy">
            <div className="intro-slider__card-title">Attendance Management</div>
            <p className="intro-slider__card-subtitle">
              Review today&apos;s attendance preview before you continue.
            </p>
          </div>

          <div className="intro-slider__module-spotlight">
            <div className="intro-slider__spotlight-hero">
              <div className="intro-slider__icon-wrap">
                <AttendanceIcon />
              </div>

              <div className="intro-slider__spotlight-copy">
                <div className="intro-slider__spotlight-eyebrow">{focusLabel}</div>
                <div className="intro-slider__spotlight-title">{employeeLabel}</div>
                <div className="intro-slider__spotlight-meta">
                  {loading
                    ? "Loading your latest attendance preview."
                    : reminderText}
                </div>
              </div>
            </div>

            <div className="intro-slider__status-row">
              <span className={`badge intro-slider__status-badge ${statusBadgeClass}`}>
                {statusLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="intro-slider__metric-grid intro-slider__metric-grid--three">
          <ModuleMetric
            label="Check In"
            value={checkInLabel}
            meta="Today punch"
          />
          <ModuleMetric
            label="Check Out"
            value={checkOutLabel}
            meta="Today punch"
          />
          <ModuleMetric
            label="Working Hours"
            value={workingHours}
            meta={loading ? "Loading" : canViewSelfAttendance ? "Today total" : "Open module"}
          />
        </div>

        {error ? (
          <div className="alert alert-warning py-2 px-3 mb-0" role="alert">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChecklistSlide({
  active,
  error,
  personalPendingCount,
  checklistPendingCount,
  reminderPendingCount,
  departmentPendingCount,
  showDepartmentSummary,
  focusStatusLabel,
  motivationalMessages,
}) {
  const taskLabel = personalPendingCount === 1 ? "Task" : "Tasks";
  const scoreFocusLabel = personalPendingCount > 0 ? "On Time" : "Stable";
  const trimmedMotivation = motivationalMessages[0] || "Let's start your tasks.";

  return (
    <div
      className={`intro-slider__display-card intro-slider__display-card--checklist${
        active ? " is-active" : ""
      }`}
      style={{
        "--intro-accent": "#ff7b72",
        "--intro-accent-soft": "rgba(255, 123, 114, 0.2)",
        "--intro-glow": "rgba(255, 95, 109, 0.22)",
      }}
    >
      <div className="intro-slider__module-layout">
        <div className="intro-slider__module-hero">
          <div className="intro-slider__module-copy">
            <div className="intro-slider__card-title">Checklist Task Overview</div>
            <p className="intro-slider__card-subtitle">
              Review your pending checklist items before choosing where to continue.
            </p>
          </div>

          <div className="intro-slider__module-spotlight intro-slider__module-spotlight--checklist">
            <div className="intro-slider__spotlight-hero intro-slider__spotlight-hero--checklist">
              <div className="welcome-taskboard" aria-hidden="true">
                <div className="welcome-taskboard__shell">
                  <div className="welcome-taskboard__toolbar">
                    <span className="welcome-taskboard__dot welcome-taskboard__dot--coral" />
                    <span className="welcome-taskboard__dot welcome-taskboard__dot--gold" />
                    <span className="welcome-taskboard__dot welcome-taskboard__dot--teal" />
                  </div>

                  <div className="welcome-taskboard__headline">
                    <span className="welcome-taskboard__headline-line welcome-taskboard__headline-line--strong" />
                    <span className="welcome-taskboard__headline-line" />
                  </div>

                  <div className="welcome-taskboard__columns">
                    <div className="welcome-taskboard__column welcome-taskboard__column--primary">
                      <span className="welcome-taskboard__column-title" />
                      <div className="welcome-taskboard__item">
                        <span className="welcome-taskboard__check" />
                        <span className="welcome-taskboard__item-line welcome-taskboard__item-line--strong" />
                        <span className="welcome-taskboard__pill welcome-taskboard__pill--coral" />
                      </div>
                      <div className="welcome-taskboard__item">
                        <span className="welcome-taskboard__check welcome-taskboard__check--soft" />
                        <span className="welcome-taskboard__item-line" />
                        <span className="welcome-taskboard__pill welcome-taskboard__pill--teal" />
                      </div>
                    </div>

                    <div className="welcome-taskboard__column welcome-taskboard__column--secondary">
                      <span className="welcome-taskboard__column-title welcome-taskboard__column-title--short" />
                      <div className="welcome-taskboard__stack-card">
                        <span className="welcome-taskboard__stack-bar welcome-taskboard__stack-bar--gold" />
                        <span className="welcome-taskboard__stack-bar welcome-taskboard__stack-bar--coral" />
                        <span className="welcome-taskboard__stack-bar welcome-taskboard__stack-bar--teal" />
                      </div>
                      <div className="welcome-taskboard__mini-chart">
                        <span className="welcome-taskboard__mini-chart-bar welcome-taskboard__mini-chart-bar--one" />
                        <span className="welcome-taskboard__mini-chart-bar welcome-taskboard__mini-chart-bar--two" />
                        <span className="welcome-taskboard__mini-chart-bar welcome-taskboard__mini-chart-bar--three" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="welcome-taskboard__floating welcome-taskboard__floating--left">
                  <span className="welcome-taskboard__floating-icon" />
                  <span className="welcome-taskboard__floating-line" />
                </div>

                <div className="welcome-taskboard__floating welcome-taskboard__floating--right">
                  <span className="welcome-taskboard__floating-badge" />
                </div>
              </div>

              <div className="intro-slider__spotlight-copy">
                <div className="intro-slider__spotlight-eyebrow">Today&apos;s Focus</div>
                <div className="intro-slider__spotlight-title">
                  {personalPendingCount} {taskLabel} pending
                </div>
                <div className="intro-slider__spotlight-meta">
                  {showDepartmentSummary
                    ? `Department pending: ${departmentPendingCount}`
                    : focusStatusLabel}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="intro-slider__metric-grid intro-slider__metric-grid--three">
          <ModuleMetric
            label="Checklist"
            value={checklistPendingCount}
            meta="Open tasks"
            countUp
          />
          <ModuleMetric
            label="Reminder"
            value={reminderPendingCount}
            meta="Active"
            countUp
          />
          <ModuleMetric
            label="Score Focus"
            value={scoreFocusLabel}
            meta=""
          />
        </div>

        <div className="intro-slider__trim-note">{trimmedMotivation}</div>

        {error ? (
          <div className="alert alert-warning py-2 px-3 mb-0" role="alert">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function IntroWelcomeScreen() {
  const navigate = useNavigate();
  const { user, can, canAny, getHomePath } = usePermissions();
  const storedUser = useMemo(() => getStoredUser() || {}, []);
  const currentUser = user || storedUser;
  const displayName =
    currentUser?.name ||
    currentUser?.employeeName ||
    storedUser?.name ||
    storedUser?.employeeName ||
    "User";
  const canViewSelfAttendance =
    Boolean(currentUser?.principalType === "employee") && can("employee_attendance", "view");
  const canViewAssignedPolls =
    Boolean(currentUser?.principalType === "employee") && can("assigned_polls", "view");
  const [activeIndex, setActiveIndex] = useState(0);
  const [checklistSummary, setChecklistSummary] = useState(() => ({
    ...DEFAULT_CHECKLIST_SUMMARY,
    userName: displayName,
  }));
  const [checklistLoading, setChecklistLoading] = useState(true);
  const [checklistError, setChecklistError] = useState("");
  const [attendanceData, setAttendanceData] = useState(DEFAULT_ATTENDANCE_STATE);
  const [attendanceLoading, setAttendanceLoading] = useState(canViewSelfAttendance);
  const [attendanceError, setAttendanceError] = useState("");
  const [pollSummary, setPollSummary] = useState(DEFAULT_POLL_SUMMARY);
  const [isAutoPaused, setIsAutoPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const pointerStartXRef = useRef(null);
  const slideCount = 2;

  useEffect(() => {
    let active = true;

    const loadChecklistSummary = async () => {
      setChecklistLoading(true);
      setChecklistError("");

      try {
        const response = await api.get("/dashboard/welcome-summary");
        if (!active) return;

        setChecklistSummary((currentValue) => ({
          ...currentValue,
          ...(response.data || {}),
          userName: response.data?.userName || currentValue.userName || displayName,
        }));
      } catch (error) {
        if (!active) return;

        setChecklistError(
          error.response?.data?.message ||
            "Latest checklist counts could not be loaded, but you can still continue."
        );
      } finally {
        if (active) {
          setChecklistLoading(false);
        }
      }
    };

    void loadChecklistSummary();

    return () => {
      active = false;
    };
  }, [displayName]);

  useEffect(() => {
    let active = true;

    if (!canViewSelfAttendance) {
      setAttendanceLoading(false);
      setAttendanceError("");
      setAttendanceData(DEFAULT_ATTENDANCE_STATE);
      return undefined;
    }

    const loadAttendanceSummary = async () => {
      setAttendanceLoading(true);
      setAttendanceError("");

      try {
        const response = await api.get("/attendance/self");
        if (!active) return;

        setAttendanceData({
          settings: response.data?.settings || null,
          employee: response.data?.employee || null,
          todayRecord: response.data?.todayRecord || null,
        });
      } catch (error) {
        if (!active) return;

        setAttendanceData(DEFAULT_ATTENDANCE_STATE);
        setAttendanceError(
          error.response?.data?.message ||
            "Attendance details could not be loaded right now, but you can still continue."
        );
      } finally {
        if (active) {
          setAttendanceLoading(false);
        }
      }
    };

    void loadAttendanceSummary();

    return () => {
      active = false;
    };
  }, [canViewSelfAttendance]);

  useEffect(() => {
    let active = true;

    if (!canViewAssignedPolls) {
      setPollSummary(DEFAULT_POLL_SUMMARY);
      return undefined;
    }

    const loadPollSummary = async () => {
      try {
        const response = await api.get("/polls/my");
        if (!active) return;

        const rows = Array.isArray(response.data) ? response.data : [];
        const activeAssignedRows = rows.filter(
          (row) => String(row?.pollStatus || "").trim().toLowerCase() === "active"
        );
        const pendingRows = activeAssignedRows.filter(
          (row) => String(row?.assignmentStatus || "").trim().toLowerCase() !== "submitted"
        );

        setPollSummary({
          assignedActiveCount: activeAssignedRows.length,
          pendingCount: pendingRows.length,
        });
      } catch (error) {
        if (!active) return;
        console.error("Poll welcome summary load failed:", error);
        setPollSummary(DEFAULT_POLL_SUMMARY);
      }
    };

    void loadPollSummary();

    return () => {
      active = false;
    };
  }, [canViewAssignedPolls]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    handleChange();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    }

    mediaQuery.addListener(handleChange);
    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || prefersReducedMotion || isAutoPaused) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((currentValue) => (currentValue + 1) % slideCount);
    }, AUTO_SLIDE_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeIndex, isAutoPaused, prefersReducedMotion, slideCount]);

  const personalPendingCount = toSafeCount(checklistSummary.pendingTaskCount);
  const checklistPendingCount = toSafeCount(checklistSummary.pendingChecklistCount);
  const reminderPendingCount = toSafeCount(checklistSummary.pendingReminderCount);
  const departmentPendingCount = toSafeCount(checklistSummary.departmentPendingCount);
  const showDepartmentSummary =
    Boolean(checklistSummary.isDepartmentSuperior) || departmentPendingCount > 0;
  const focusStatusLabel = checklistLoading
    ? "Refreshing your task board"
    : personalPendingCount > 0
    ? "Time to focus"
    : "All tasks clear";
  const attendanceStatusLabel = attendanceLoading
    ? "Refreshing..."
    : canViewSelfAttendance
    ? attendanceData.todayRecord?.statusLabel || "Pending"
    : "Open from module";
  const attendanceStatusBadgeClass = canViewSelfAttendance
    ? getAttendanceStatusBadgeClass(
        attendanceData.todayRecord?.status,
        attendanceData.todayRecord?.isLate
      )
    : "bg-secondary";
  const attendanceReminderText = getReminderText(
    attendanceData.todayRecord,
    attendanceData.settings,
    canViewSelfAttendance
  );
  const attendanceWorkingHours =
    attendanceData.todayRecord?.totalWorkingHoursLabel ||
    formatAttendanceDuration(attendanceData.todayRecord?.totalWorkingMinutes);
  const attendanceFocusLabel = attendanceLoading
    ? "Preparing your attendance snapshot"
    : canViewSelfAttendance
    ? "Today's attendance status"
    : "Attendance guide";
  const attendanceEmployeeLabel =
    attendanceData.employee?.displayName ||
    attendanceData.employee?.employeeName ||
    displayName;
  const sessionSeed = getPostLoginWelcomeSessionId();
  const motivationalMessages = useMemo(
    () =>
      pickWelcomeMessages(
        `${sessionSeed}:${checklistSummary.userName}:${personalPendingCount}:${departmentPendingCount}`
      ),
    [checklistSummary.userName, departmentPendingCount, personalPendingCount, sessionSeed]
  );
  const attendanceTargetPath = getAttendanceModulePath(can, canAny);
  const checklistTargetPath = getChecklistModulePath(can, canAny);
  const pollingTargetPath = getPollingModulePath(can);
  const complaintTargetPath = getComplaintModulePath(can);
  const showPollingButton = Boolean(
    pollingTargetPath && pollSummary.assignedActiveCount > 0
  );
  const pollingBadgeLabel =
    pollSummary.pendingCount > 1
      ? `${pollSummary.pendingCount} New`
      : pollSummary.pendingCount === 1
      ? "New Poll"
      : "";

  const goToSlide = (index) => {
    setActiveIndex(((index % slideCount) + slideCount) % slideCount);
  };

  const handleModuleNavigation = (path) => {
    if (!path) return;
    dismissPostLoginWelcome();
    navigate(path, { replace: true });
  };

  const handleSkipWelcome = () => {
    dismissPostLoginWelcome();
    navigate(getHomePath() || "/dashboard", { replace: true });
  };

  const handlePointerDown = (event) => {
    pointerStartXRef.current = event.clientX;
    setIsAutoPaused(true);

    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const handlePointerUp = (event) => {
    if (pointerStartXRef.current === null) {
      setIsAutoPaused(false);
      return;
    }

    const deltaX = event.clientX - pointerStartXRef.current;
    pointerStartXRef.current = null;
    setIsAutoPaused(false);

    if (typeof event.currentTarget.releasePointerCapture === "function") {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (Math.abs(deltaX) < SWIPE_THRESHOLD) {
      return;
    }

    if (deltaX < 0) {
      goToSlide(activeIndex + 1);
      return;
    }

    goToSlide(activeIndex - 1);
  };

  const handlePointerCancel = () => {
    pointerStartXRef.current = null;
    setIsAutoPaused(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToSlide(activeIndex - 1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      goToSlide(activeIndex + 1);
    }
  };

  return (
    <div className="post-login-flow post-login-flow--intro">
      <div className="post-login-flow__bg" aria-hidden="true">
        <span className="post-login-flow__orb post-login-flow__orb--one" />
        <span className="post-login-flow__orb post-login-flow__orb--two" />
        <span className="post-login-flow__orb post-login-flow__orb--three" />
        <span className="post-login-flow__grid" />
      </div>

      <WelcomeCard
        className="post-login-flow__frame"
        contentClassName="post-login-flow__card intro-slider"
      >
        <div className="intro-slider__topbar">
          <div>
            <h1 className="intro-slider__title">Hi, {checklistSummary.userName || displayName}</h1>
          </div>
          <button
            type="button"
            className="btn intro-slider__skip-btn"
            onClick={handleSkipWelcome}
          >
            Skip
          </button>
        </div>

        <div className="intro-slider__slider-panel">
          <div
            className="intro-slider__viewport"
            aria-label="Unified welcome preview slider"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerEnter={() => setIsAutoPaused(true)}
            onPointerLeave={() => setIsAutoPaused(false)}
            onFocusCapture={() => setIsAutoPaused(true)}
            onBlurCapture={() => setIsAutoPaused(false)}
            onKeyDown={handleKeyDown}
            role="region"
            tabIndex={0}
          >
            <div
              className="intro-slider__track"
              style={{ transform: `translateX(-${activeIndex * 100}%)` }}
            >
              <div className="intro-slider__slide">
                <AttendanceSlide
                  active={activeIndex === 0}
                  canViewSelfAttendance={canViewSelfAttendance}
                  loading={attendanceLoading}
                  error={attendanceError}
                  employeeLabel={attendanceEmployeeLabel}
                  focusLabel={attendanceFocusLabel}
                  statusLabel={attendanceStatusLabel}
                  statusBadgeClass={attendanceStatusBadgeClass}
                  checkInLabel={attendanceLoading ? "..." : attendanceData.todayRecord?.checkInLabel || "-"}
                  checkOutLabel={attendanceLoading ? "..." : attendanceData.todayRecord?.checkOutLabel || "-"}
                  workingHours={attendanceLoading ? "..." : attendanceWorkingHours}
                  reminderText={attendanceReminderText}
                />
              </div>

              <div className="intro-slider__slide">
                <ChecklistSlide
                  active={activeIndex === 1}
                  error={checklistError}
                  personalPendingCount={personalPendingCount}
                  checklistPendingCount={checklistPendingCount}
                  reminderPendingCount={reminderPendingCount}
                  departmentPendingCount={departmentPendingCount}
                  showDepartmentSummary={showDepartmentSummary}
                  focusStatusLabel={focusStatusLabel}
                  motivationalMessages={motivationalMessages}
                />
              </div>
            </div>
          </div>

          <div className="intro-slider__controls">
            <div className="intro-slider__dots" aria-label="Slider indicators">
              <button
                type="button"
                className={`intro-slider__dot${activeIndex === 0 ? " is-active" : ""}`}
                onClick={() => goToSlide(0)}
                aria-label="Show Attendance preview"
              />
              <button
                type="button"
                className={`intro-slider__dot${activeIndex === 1 ? " is-active" : ""}`}
                onClick={() => goToSlide(1)}
                aria-label="Show Checklist preview"
              />
            </div>
          </div>
        </div>

        <div className="intro-slider__button-row">
          <button
            type="button"
            className="btn intro-slider__quick-btn intro-slider__quick-btn--attendance"
            onClick={() => handleModuleNavigation(attendanceTargetPath)}
            disabled={!attendanceTargetPath}
          >
            <span className="intro-slider__quick-btn-icon">
              <AttendanceIcon />
            </span>
            <span>Attendance</span>
          </button>

          <button
            type="button"
            className="btn intro-slider__quick-btn intro-slider__quick-btn--checklist"
            onClick={() => handleModuleNavigation(checklistTargetPath)}
            disabled={!checklistTargetPath}
          >
            <span className="intro-slider__quick-btn-icon">
              <ChecklistIcon />
            </span>
            <span>Checklist</span>
          </button>

          <button
            type="button"
            className="btn intro-slider__quick-btn intro-slider__quick-btn--complaint"
            onClick={() => handleModuleNavigation(complaintTargetPath)}
            disabled={!complaintTargetPath}
          >
            <span className="intro-slider__quick-btn-icon">
              <ComplaintIcon />
            </span>
            <span>Complaint</span>
          </button>

          {showPollingButton ? (
            <button
              type="button"
              className="btn intro-slider__quick-btn intro-slider__quick-btn--polling"
              onClick={() => handleModuleNavigation(pollingTargetPath)}
              disabled={!pollingTargetPath}
            >
              <span className="intro-slider__quick-btn-icon">
                <PollingIcon />
              </span>
              <span>Polling</span>
              {pollingBadgeLabel ? (
                <span className="intro-slider__quick-btn-badge">{pollingBadgeLabel}</span>
              ) : null}
            </button>
          ) : null}
        </div>
      </WelcomeCard>
    </div>
  );
}

