import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import webLogo from "../assets/Web-logo.png";
import api from "../api/axios";
import {
  buildBrowserNotificationBody,
  formatPersonalTaskDateTime,
} from "../utils/personalTaskDisplay";
import {
  buildChatMentionNotificationBody,
  formatChatDateTime,
  getChatRoutePath,
} from "../utils/chatDisplay";
import { clearPostLoginWelcomeSession } from "../utils/postLoginWelcome";
import { usePermissions } from "../context/usePermissions";
import { useModuleSettings } from "../context/useModuleSettings";

const emptyReminderState = {
  counts: {
    due: 0,
    upcoming: 0,
    total: 0,
  },
  due: [],
  upcoming: [],
};

const emptyChatNotificationState = {
  counts: {
    mentions: 0,
    unreadMessages: 0,
  },
  mentions: [],
};

const emptyFeedbackNotificationState = {
  counts: {
    unread: 0,
  },
  rows: [],
};

const emptyRequestNotificationState = {
  counts: {
    unread: 0,
  },
  rows: [],
};

const emptyPollNotificationState = {
  counts: {
    unread: 0,
    reminders: 0,
    total: 0,
  },
  unread: [],
  reminders: [],
};

const emptyComplaintNotificationState = {
  counts: {
    unread: 0,
  },
  rows: [],
};

const buildDropdownItemClass = ({ isActive }) =>
  `dropdown-item${isActive ? " active" : ""}`;
const truncateNotificationText = (value, maxLength = 140) => {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) return "";
  if (normalizedValue.length <= maxLength) return normalizedValue;

  return `${normalizedValue.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      fill="currentColor"
      viewBox="0 0 16 16"
      aria-hidden="true"
    >
      <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2" />
      <path
        fillRule="evenodd"
        d="M8 1.918a1 1 0 0 0-.9.55A5 5 0 0 0 3 7c0 1.098-.5 6-2 7h14c-1.5-1-2-5.902-2-7a5 5 0 0 0-4.1-4.532A1 1 0 0 0 8 1.918M14 14H2c1-1 1.5-5.2 1.5-7a4.5 4.5 0 0 1 9 0c0 1.8.5 6 1.5 7"
      />
    </svg>
  );
}

export default function Navbar() {
  const { can, canAny, getHomePath, role: resolvedRole } = usePermissions();
  const { isModuleEnabled } = useModuleSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const navbarRef = useRef(null);
  const desktopNotificationMenuRef = useRef(null);
  const mobileNotificationMenuRef = useRef(null);
  const shownBrowserNotificationKeysRef = useRef(new Set());
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const role = String(user?.role || "").trim().toLowerCase();
  const isAdmin = role === "admin";
  const isEmployee = role === "employee";
  const isPollingEnabled = isModuleEnabled("polling");
  const isComplaintsEnabled = isModuleEnabled("complaints");
  const canViewAssignedPollNotifications = isPollingEnabled && can("assigned_polls", "view");
  const canViewComplaintNotifications = isComplaintsEnabled && can("complaints", "view");
  const hasRestrictedChecklistAccess =
    !isAdmin &&
    !isEmployee &&
    (role === "user" || Boolean(user?.checklistMasterAccess));
  const userName = user?.name || user?.employeeName || "Signed in";
  const userDisplayId = user?.email || user?.employeeCode || "";
  const homePath = getHomePath();

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeNavMenu, setActiveNavMenu] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [reminderNotificationData, setReminderNotificationData] =
    useState(emptyReminderState);
  const [chatNotificationData, setChatNotificationData] = useState(
    emptyChatNotificationState
  );
  const [feedbackNotificationData, setFeedbackNotificationData] = useState(
    emptyFeedbackNotificationState
  );
  const [requestNotificationData, setRequestNotificationData] = useState(
    emptyRequestNotificationState
  );
  const [pollNotificationData, setPollNotificationData] = useState(
    emptyPollNotificationState
  );
  const [complaintNotificationData, setComplaintNotificationData] = useState(
    emptyComplaintNotificationState
  );
  const [notificationLoading, setNotificationLoading] = useState(false);

  const totalNotificationCount =
    isAdmin
      ? Number(feedbackNotificationData.counts.unread || 0) +
        Number(requestNotificationData.counts.unread || 0) +
        (isComplaintsEnabled ? Number(complaintNotificationData.counts.unread || 0) : 0)
      : hasRestrictedChecklistAccess
      ? Number(requestNotificationData.counts.unread || 0) +
        (isComplaintsEnabled ? Number(complaintNotificationData.counts.unread || 0) : 0)
      : Number(reminderNotificationData.counts.total || 0) +
        Number(chatNotificationData.counts.mentions || 0) +
        (isPollingEnabled ? Number(pollNotificationData.counts.total || 0) : 0) +
        (isComplaintsEnabled ? Number(complaintNotificationData.counts.unread || 0) : 0);
  const shouldShowNotifications =
    isEmployee || isAdmin || hasRestrictedChecklistAccess || canViewComplaintNotifications;

  const workspaceLinks = useMemo(
    () =>
      [
        can("employee_master", "view")
          ? { to: "/employees", label: "Employee Master" }
          : null,
        !can("employee_master", "view") && can("own_profile", "view")
          ? { to: "/me", label: "My Profile" }
          : null,
        can("checklist_master", "view")
          ? { to: "/checklists", label: "Checklist Master" }
          : !can("checklist_master", "view") &&
            canAny([
              { moduleKey: "your_checklist", actionKey: "view" },
              { moduleKey: "assigned_checklists", actionKey: "view" },
            ])
          ? { to: "/your-checklist", label: "Your Checklist" }
          : null,
        can("checklist_master", "view")
          ? null
          : !can("checklist_master", "view") && can("assigned_checklists", "view")
          ? { to: "/checklists", label: "Tasks" }
          : null,
        canAny([
          { moduleKey: "tasks", actionKey: "view" },
          { moduleKey: "checklist_master", actionKey: "view" },
        ])
          ? { to: "/checklists/tasks", label: "Tasks" }
          : null,
        isPollingEnabled && can("poll_master", "view")
          ? { to: "/polls", label: "Polling System" }
          : isPollingEnabled && !can("poll_master", "view") && can("assigned_polls", "view")
          ? { to: "/polls", label: "Assigned Polls" }
          : null,
        can("own_task", "view") ? { to: "/own-tasks", label: "Own Task" } : null,
        isModuleEnabled("complaint_dashboard") &&
        canAny([
          { moduleKey: "complaint_dashboard", actionKey: "view" },
          { moduleKey: "complaints", actionKey: "view" },
        ])
          ? { to: "/complaints", label: "Complaint Dashboard" }
          : null,
        can("shared_task", "view") ? { to: "/shared-tasks", label: "Shared Task" } : null,
        can("approval_inbox", "view")
          ? { to: "/checklists/approvals", label: "Approval Inbox" }
          : null,
      ].filter(Boolean),
    [can, canAny, isModuleEnabled, isPollingEnabled]
  );

  const masterLinks = useMemo(
    () =>
      [
        can("company_master", "view")
          ? { to: "/masters/companies", label: "Companies" }
          : null,
        can("department_master", "view")
          ? { to: "/masters/departments", label: "Departments" }
          : null,
        can("sub_department_master", "view")
          ? { to: "/masters/departments", label: "Sub Departments" }
          : null,
        can("designation_master", "view")
          ? { to: "/masters/designations", label: "Designations" }
          : null,
        can("site_master", "view") ? { to: "/masters/sites", label: "Sites" } : null,
        can("main_location", "view")
          ? { to: "/masters/main-locations", label: "Main Location" }
          : null,
        can("material_master", "view")
          ? { to: "/masters/materials", label: "Material Master" }
          : null,
        can("nature_of_work", "view")
          ? { to: "/masters/nature-of-work", label: "Nature of Work" }
          : null,
        can("checklist_transfer", "view")
          ? { to: "/masters/checklist-transfer", label: "Checklist Transfer" }
          : null,
      ].filter(Boolean),
    [can]
  );

  const communicationLinks = useMemo(
    () =>
      [
        can("site_chat", "view") ? { to: "/chat", label: "Site Chat" } : null,
        can("department_chat", "view")
          ? { to: "/department-chat", label: "Department Chat" }
          : null,
        can("notifications", "view")
          ? { to: "/notifications", label: "Notifications" }
          : null,
      ].filter(Boolean),
    [can]
  );

  const attendanceLinks = useMemo(
    () =>
      [
        can("employee_attendance", "view")
          ? { to: "/attendance", label: "Attendance Dashboard" }
          : null,
        user?.principalType !== "employee" &&
        canAny([
          { moduleKey: "employee_attendance", actionKey: "add" },
          { moduleKey: "employee_attendance", actionKey: "edit" },
        ])
          ? { to: "/attendance/daily", label: "Daily Attendance Entry" }
          : null,
        user?.principalType === "employee" && can("employee_attendance", "view")
          ? { to: "/attendance/self", label: "Self Attendance" }
          : null,
        canAny([
          { moduleKey: "attendance_reports", actionKey: "view" },
          { moduleKey: "attendance_reports", actionKey: "report_view" },
        ])
          ? { to: "/attendance/reports", label: "Attendance Reports" }
          : null,
        can("attendance_regularization", "view")
          ? { to: "/attendance/regularization", label: "Regularization" }
          : null,
        can("attendance_settings", "view")
          ? { to: "/attendance/settings", label: "Attendance Settings" }
          : null,
      ].filter(Boolean),
    [can, canAny, user?.principalType]
  );

  const workflowLinks = useMemo(
    () =>
      [
        can("workflow_mapping", "view")
          ? { to: "/workflow-mapping", label: "Workflow Mapping" }
          : null,
        can("approval_hierarchy", "view")
          ? { to: "/approval-hierarchy", label: "Approval Hierarchy" }
          : null,
      ].filter(Boolean),
    [can]
  );

  const reportLinks = useMemo(
    () =>
      [
        isModuleEnabled("overview_1") &&
        canAny([
          { moduleKey: "overview_1", actionKey: "view" },
          { moduleKey: "overview_1", actionKey: "report_view" },
          { moduleKey: "dashboard_analytics", actionKey: "view" },
          { moduleKey: "dashboard_analytics", actionKey: "report_view" },
        ])
          ? { to: "/dashboard-1", label: "Overview 1" }
          : null,
        isModuleEnabled("overview_2") &&
        canAny([
          { moduleKey: "overview_2", actionKey: "view" },
          { moduleKey: "overview_2", actionKey: "report_view" },
          { moduleKey: "dashboard_analytics", actionKey: "view" },
          { moduleKey: "dashboard_analytics", actionKey: "report_view" },
        ])
          ? { to: "/dashboard-2", label: "Overview 2" }
          : null,
        isModuleEnabled("dashboard_summary") &&
        canAny([
          { moduleKey: "dashboard_summary", actionKey: "view" },
          { moduleKey: "dashboard_summary", actionKey: "report_view" },
          { moduleKey: "dashboard_analytics", actionKey: "view" },
          { moduleKey: "dashboard_analytics", actionKey: "report_view" },
        ])
          ? { to: "/dashboard-summary", label: "Summary" }
          : null,
        isModuleEnabled("checklist_report") &&
        canAny([
          { moduleKey: "checklist_report", actionKey: "view" },
          { moduleKey: "checklist_report", actionKey: "report_view" },
          { moduleKey: "reports", actionKey: "view" },
          { moduleKey: "reports", actionKey: "report_view" },
        ])
          ? { to: "/reports/checklists", label: "Checklist Report" }
          : null,
        isModuleEnabled("poll_results") &&
        canAny([
          { moduleKey: "poll_results", actionKey: "view" },
          { moduleKey: "poll_results", actionKey: "report_view" },
          { moduleKey: "poll_master", actionKey: "report_view" },
        ])
          ? { to: "/reports/polls", label: "Poll Results" }
          : null,
        isModuleEnabled("complaint_report") &&
        canAny([
          { moduleKey: "complaint_report", actionKey: "view" },
          { moduleKey: "complaint_report", actionKey: "report_view" },
          { moduleKey: "complaints", actionKey: "view" },
        ])
          ? { to: "/complaints/reports", label: "Complaint Report" }
          : null,
      ].filter(Boolean),
    [canAny, isModuleEnabled]
  );

  const adminLinks = useMemo(
    () =>
      [
        canAny([
          { moduleKey: "admin_approvals", actionKey: "view" },
          { moduleKey: "admin_approvals", actionKey: "approve" },
          { moduleKey: "checklist_master", actionKey: "approve" },
          { moduleKey: "checklist_master", actionKey: "reject" },
        ])
          ? { to: "/checklists/admin-approvals", label: "Admin Approvals" }
          : null,
        can("user_management", "view") ? { to: "/users", label: "Users" } : null,
        can("role_permission_setup", "view")
          ? { to: "/permissions/roles", label: "Role Permission Setup" }
          : null,
        can("module_settings", "view")
          ? { to: "/module-settings", label: "Module Settings" }
          : null,
        can("settings_masters", "view") ? { to: "/settings", label: "Settings" } : null,
      ].filter(Boolean),
    [can, canAny]
  );

  useEffect(() => {
    setMenuOpen(false);
    setActiveNavMenu("");
    setNotificationsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!activeNavMenu) return undefined;

    const handleOutsideClick = (event) => {
      if (navbarRef.current?.contains(event.target)) {
        return;
      }

      setActiveNavMenu("");
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setActiveNavMenu("");
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [activeNavMenu]);

  useEffect(() => {
    if (!isEmployee && !isAdmin && !hasRestrictedChecklistAccess && !canViewComplaintNotifications) {
      setReminderNotificationData(emptyReminderState);
      setChatNotificationData(emptyChatNotificationState);
      setFeedbackNotificationData(emptyFeedbackNotificationState);
      setRequestNotificationData(emptyRequestNotificationState);
      setPollNotificationData(emptyPollNotificationState);
      setComplaintNotificationData(emptyComplaintNotificationState);
      setNotificationLoading(false);
      return undefined;
    }

    let active = true;

    const fetchNotifications = async (showLoader = false) => {
      if (showLoader) {
        setNotificationLoading(true);
      }

      try {
        if (isAdmin) {
          const [feedbackResponse, requestResponse, complaintResponse] = await Promise.all([
            api.get("/feedback/notifications"),
            api.get("/checklists/admin-requests/notifications"),
            canViewComplaintNotifications
              ? api.get("/complaints/notifications")
              : Promise.resolve({ data: emptyComplaintNotificationState }),
          ]);

          if (!active) return;

          setFeedbackNotificationData({
            counts:
              feedbackResponse.data?.counts || emptyFeedbackNotificationState.counts,
            rows: Array.isArray(feedbackResponse.data?.rows)
              ? feedbackResponse.data.rows
              : [],
          });
          setRequestNotificationData({
            counts:
              requestResponse.data?.counts || emptyRequestNotificationState.counts,
            rows: Array.isArray(requestResponse.data?.rows)
              ? requestResponse.data.rows
              : [],
          });
          setComplaintNotificationData({
            counts:
              complaintResponse.data?.counts || emptyComplaintNotificationState.counts,
            rows: Array.isArray(complaintResponse.data?.rows)
              ? complaintResponse.data.rows
              : [],
          });
          setReminderNotificationData(emptyReminderState);
          setChatNotificationData(emptyChatNotificationState);
          setPollNotificationData(emptyPollNotificationState);
          return;
        }

        if (hasRestrictedChecklistAccess) {
          const [requestResponse, complaintResponse] = await Promise.all([
            api.get("/checklists/admin-requests/notifications"),
            canViewComplaintNotifications
              ? api.get("/complaints/notifications")
              : Promise.resolve({ data: emptyComplaintNotificationState }),
          ]);

          if (!active) return;

          setRequestNotificationData({
            counts:
              requestResponse.data?.counts || emptyRequestNotificationState.counts,
            rows: Array.isArray(requestResponse.data?.rows)
              ? requestResponse.data.rows
              : [],
          });
          setComplaintNotificationData({
            counts:
              complaintResponse.data?.counts || emptyComplaintNotificationState.counts,
            rows: Array.isArray(complaintResponse.data?.rows)
              ? complaintResponse.data.rows
              : [],
          });
          setReminderNotificationData(emptyReminderState);
          setChatNotificationData(emptyChatNotificationState);
          setFeedbackNotificationData(emptyFeedbackNotificationState);
          setPollNotificationData(emptyPollNotificationState);
          return;
        }

        const [
          taskResponse,
          siteChatResponse,
          departmentChatResponse,
          pollResponse,
          complaintResponse,
        ] = await Promise.all([
          isEmployee ? api.get("/personal-tasks/notifications") : Promise.resolve({ data: emptyReminderState }),
          isEmployee ? api.get("/chat/notifications") : Promise.resolve({ data: emptyChatNotificationState }),
          isEmployee
            ? api.get("/department-chat/notifications")
            : Promise.resolve({ data: emptyChatNotificationState }),
          isEmployee && canViewAssignedPollNotifications
            ? api.get("/polls/my/notifications")
            : Promise.resolve({ data: emptyPollNotificationState }),
          canViewComplaintNotifications
            ? api.get("/complaints/notifications")
            : Promise.resolve({ data: emptyComplaintNotificationState }),
        ]);

        if (!active) return;

        const siteChatCounts = siteChatResponse.data?.counts || emptyChatNotificationState.counts;
        const departmentChatCounts =
          departmentChatResponse.data?.counts || emptyChatNotificationState.counts;
        const combinedMentions = [
          ...(Array.isArray(siteChatResponse.data?.mentions)
            ? siteChatResponse.data.mentions
            : []),
          ...(Array.isArray(departmentChatResponse.data?.mentions)
            ? departmentChatResponse.data.mentions
            : []),
        ].sort(
          (left, right) =>
            new Date(right?.createdAt || 0).getTime() -
            new Date(left?.createdAt || 0).getTime()
        );

        setReminderNotificationData({
          counts: taskResponse.data?.counts || emptyReminderState.counts,
          due: Array.isArray(taskResponse.data?.due) ? taskResponse.data.due : [],
          upcoming: Array.isArray(taskResponse.data?.upcoming)
            ? taskResponse.data.upcoming
            : [],
        });
        setChatNotificationData({
          counts: {
            mentions:
              Number(siteChatCounts.mentions || 0) +
              Number(departmentChatCounts.mentions || 0),
            unreadMessages:
              Number(siteChatCounts.unreadMessages || 0) +
              Number(departmentChatCounts.unreadMessages || 0),
          },
          mentions: combinedMentions,
        });
        setPollNotificationData({
          counts: pollResponse.data?.counts || emptyPollNotificationState.counts,
          unread: Array.isArray(pollResponse.data?.unread) ? pollResponse.data.unread : [],
          reminders: Array.isArray(pollResponse.data?.reminders)
            ? pollResponse.data.reminders
            : [],
        });
        setComplaintNotificationData({
          counts:
            complaintResponse.data?.counts || emptyComplaintNotificationState.counts,
          rows: Array.isArray(complaintResponse.data?.rows)
            ? complaintResponse.data.rows
            : [],
        });
        setFeedbackNotificationData(emptyFeedbackNotificationState);
        setRequestNotificationData(emptyRequestNotificationState);
      } catch (err) {
        console.error("Notification load failed:", err);

        if (active) {
          setReminderNotificationData(emptyReminderState);
          setChatNotificationData(emptyChatNotificationState);
          setFeedbackNotificationData(emptyFeedbackNotificationState);
          setRequestNotificationData(emptyRequestNotificationState);
          setPollNotificationData(emptyPollNotificationState);
          setComplaintNotificationData(emptyComplaintNotificationState);
        }
      } finally {
        if (active && showLoader) {
          setNotificationLoading(false);
        }
      }
    };

    void fetchNotifications(true);

    const intervalId = setInterval(() => {
      void fetchNotifications(false);
    }, 30000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [
    canViewAssignedPollNotifications,
    canViewComplaintNotifications,
    hasRestrictedChecklistAccess,
    isAdmin,
    isComplaintsEnabled,
    isEmployee,
    isPollingEnabled,
  ]);

  useEffect(() => {
    if (!isEmployee) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (window.Notification.permission !== "granted") return;

    const dueItems = Array.isArray(reminderNotificationData.due)
      ? reminderNotificationData.due
      : [];

    dueItems.forEach((task) => {
      const notificationKey = `task:${task._id}:${task.notificationAt || task.lastTriggeredAt || ""}`;

      if (!task.notificationAt || shownBrowserNotificationKeysRef.current.has(notificationKey)) {
        return;
      }

      shownBrowserNotificationKeysRef.current.add(notificationKey);

      const notification = new window.Notification(task.title || "Own Task Reminder", {
        body: buildBrowserNotificationBody(task) || "A personal reminder is due now.",
        tag: notificationKey,
      });

      notification.onclick = () => {
        window.focus();
        void api.post(`/personal-tasks/${task._id}/read`).catch((err) => {
          console.error("Failed to mark browser reminder notification as read:", err);
        });
        navigate(`/own-tasks/${task._id}`);
        notification.close();
      };
    });
  }, [isEmployee, navigate, reminderNotificationData.due]);

  useEffect(() => {
    if (!isEmployee) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (window.Notification.permission !== "granted") return;

    const mentionItems = Array.isArray(chatNotificationData.mentions)
      ? chatNotificationData.mentions
      : [];

    mentionItems.forEach((item) => {
      const notificationKey = `chat:${item.chatType || "site"}:${item._id}`;

      if (shownBrowserNotificationKeysRef.current.has(notificationKey)) {
        return;
      }

      shownBrowserNotificationKeysRef.current.add(notificationKey);

      const notification = new window.Notification(
        item.senderName ? `${item.senderName} mentioned you` : "New chat mention",
        {
          body:
            buildChatMentionNotificationBody(item) ||
            "You were mentioned in a chat.",
          tag: notificationKey,
        }
      );

      notification.onclick = () => {
        window.focus();
        const params = new URLSearchParams();
        params.set("group", item.groupId);
        params.set("message", item._id);
        navigate(`${getChatRoutePath(item)}?${params.toString()}`);
        notification.close();
      };
    });
  }, [chatNotificationData.mentions, isEmployee, navigate]);

  useEffect(() => {
    if (!notificationsOpen) return undefined;

    const handleOutsideClick = (event) => {
      const clickedInsideDesktopMenu = Boolean(
        desktopNotificationMenuRef.current &&
          desktopNotificationMenuRef.current.contains(event.target)
      );
      const clickedInsideMobileMenu = Boolean(
        mobileNotificationMenuRef.current &&
          mobileNotificationMenuRef.current.contains(event.target)
      );

      if (!clickedInsideDesktopMenu && !clickedInsideMobileMenu) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [notificationsOpen]);

  const toggleNavMenu = (menuKey) => {
    setActiveNavMenu((currentValue) => (currentValue === menuKey ? "" : menuKey));
  };

  const isNavMenuOpen = (menuKey) => activeNavMenu === menuKey;

  const matchesPath = (prefixes = []) =>
    prefixes.some(
      (prefix) =>
        location.pathname === prefix || location.pathname.startsWith(`${prefix}/`)
    );

  const isWorkspaceMenuActive =
    (matchesPath([
      "/employees",
      "/add",
      "/edit",
      "/view",
      "/me",
      "/checklists",
      "/own-tasks",
      "/complaints",
      "/shared-tasks",
    ]) &&
      !location.pathname.startsWith("/checklists/admin-approvals")) ||
    location.pathname === "/checklists/approvals";
  const isCommunicationMenuActive = matchesPath([
    "/chat",
    "/department-chat",
    "/notifications",
  ]);
  const isWorkflowMenuActive = matchesPath([
    "/workflow-mapping",
    "/approval-hierarchy",
  ]);
  const isAttendanceMenuActive = matchesPath(["/attendance"]);
  const isReportsMenuActive = matchesPath([
    "/reports",
    "/dashboard-1",
    "/dashboard-2",
    "/dashboard-summary",
  ]);
  const isAdminMenuActive = matchesPath([
    "/users",
    "/permissions",
    "/module-settings",
    "/settings",
    "/checklists/admin-approvals",
  ]);
  const isMastersMenuActive = matchesPath(["/masters"]);

  const renderNavDropdown = (menuKey, label, links, isActive = false) => {
    if (!links.length) return null;

    return (
      <li className={`nav-item dropdown ${isNavMenuOpen(menuKey) ? "show" : ""}`} key={menuKey}>
        <button
          type="button"
          className={`nav-link dropdown-toggle border-0 bg-transparent ${
            isActive ? "active" : ""
          }`}
          onClick={() => toggleNavMenu(menuKey)}
          aria-expanded={isNavMenuOpen(menuKey)}
          aria-haspopup="true"
        >
          {label}
        </button>

        <ul className={`dropdown-menu ${isNavMenuOpen(menuKey) ? "show" : ""}`}>
          {links.map((link) => (
            <li key={`${link.to}:${link.label}`}>
              <NavLink
                className={buildDropdownItemClass}
                to={link.to}
                onClick={() => {
                  setActiveNavMenu("");
                  setMenuOpen(false);
                }}
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </li>
    );
  };

  const logout = () => {
    clearPostLoginWelcomeSession();
    localStorage.clear();
    navigate("/login");
  };

  const openReminderNotification = async (task) => {
    setNotificationsOpen(false);

    try {
      await api.post(`/personal-tasks/${task._id}/read`);
    } catch (err) {
      console.error("Reminder read update failed:", err);
    }

    navigate(`/own-tasks/${task._id}`);
  };

  const openPollNotification = async (item) => {
    if (!isPollingEnabled) return;

    setNotificationsOpen(false);

    try {
      if (!String(item._id || "").startsWith("reminder-")) {
        await api.post(`/polls/my/notifications/${item._id}/read`);
      }
    } catch (err) {
      console.error("Poll notification read update failed:", err);
    }

    navigate(item.routePath || `/polls/my/${item.assignmentId}`);
  };

  const openChatNotification = (item) => {
    setNotificationsOpen(false);

    const params = new URLSearchParams();
    params.set("group", item.groupId);
    params.set("message", item._id);

    navigate(`${getChatRoutePath(item)}?${params.toString()}`);
  };

  const openFeedbackNotification = async (item) => {
    try {
      await api.post(`/feedback/${item._id}/read`);

      setFeedbackNotificationData((currentState) => ({
        counts: {
          unread: Math.max(0, Number(currentState.counts.unread || 0) - 1),
        },
        rows: currentState.rows.filter((row) => row._id !== item._id),
      }));
    } catch (err) {
      console.error("Feedback notification read update failed:", err);
    }
  };

  const openRequestNotification = async (item) => {
    setNotificationsOpen(false);

    try {
      await api.post(`/checklists/admin-requests/notifications/${item._id}/read`);

      setRequestNotificationData((currentState) => ({
        counts: {
          unread: Math.max(0, Number(currentState.counts.unread || 0) - 1),
        },
        rows: currentState.rows.filter((row) => row._id !== item._id),
      }));
    } catch (err) {
      console.error("Checklist notification read update failed:", err);
    }

    navigate(item.routePath || (isAdmin ? "/checklists/admin-approvals" : "/checklists"));
  };

  const openComplaintNotification = async (item) => {
    if (!isComplaintsEnabled) return;

    setNotificationsOpen(false);

    try {
      await api.post(`/complaints/notifications/${item._id}/read`);

      setComplaintNotificationData((currentState) => ({
        counts: {
          unread: Math.max(0, Number(currentState.counts.unread || 0) - 1),
        },
        rows: currentState.rows.filter((row) => row._id !== item._id),
      }));
    } catch (err) {
      console.error("Complaint notification read update failed:", err);
    }

    navigate(item.routePath || `/complaints/reports?complaintId=${item.complaintId}`);
  };

  const markAllFeedbackNotificationsRead = async () => {
    try {
      await api.post("/feedback/notifications/read-all");
      setFeedbackNotificationData(emptyFeedbackNotificationState);
    } catch (err) {
      console.error("Mark all feedback notifications read failed:", err);
    }
  };

  const markAllChecklistRequestNotificationsRead = async () => {
    try {
      await api.post("/checklists/admin-requests/notifications/read-all");
      setRequestNotificationData(emptyRequestNotificationState);
    } catch (err) {
      console.error("Mark all checklist notifications read failed:", err);
    }
  };

  const markAllComplaintNotificationsRead = async () => {
    if (!isComplaintsEnabled) return;

    try {
      await api.post("/complaints/notifications/read-all");
      setComplaintNotificationData(emptyComplaintNotificationState);
    } catch (err) {
      console.error("Mark all complaint notifications read failed:", err);
    }
  };

  const markAllNotificationsRead = async () => {
    if (isAdmin) {
      await Promise.all([
        markAllFeedbackNotificationsRead(),
        markAllChecklistRequestNotificationsRead(),
        isComplaintsEnabled ? markAllComplaintNotificationsRead() : Promise.resolve(),
      ]);
      return;
    }

    if (hasRestrictedChecklistAccess) {
      await Promise.all([
        markAllChecklistRequestNotificationsRead(),
        canViewComplaintNotifications
          ? markAllComplaintNotificationsRead()
          : Promise.resolve(),
      ]);
      return;
    }

    if (canViewComplaintNotifications) {
      await markAllComplaintNotificationsRead();
    }
  };

  const renderReminderGroup = (title, rows) => {
    if (!rows.length) return null;

    return (
      <div className="notification-group">
        <div className="notification-group__title">{title}</div>
        <div className="d-flex flex-column gap-2">
          {rows.map((task) => (
            <button
              type="button"
              key={`${task._id}-${task.notificationAt || task.nextReminderAt || ""}`}
              className="notification-item"
              onClick={() => openReminderNotification(task)}
            >
              <div className="fw-semibold text-dark">{task.title || "Own Task"}</div>
              <div className="small text-muted text-start">
                {buildBrowserNotificationBody(task) ||
                  task.description ||
                  "Open to view full reminder details."}
              </div>
              <div className="small text-primary text-start">
                {formatPersonalTaskDateTime(task.notificationAt || task.nextReminderAt)}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderChatMentions = () => {
    const mentionRows = Array.isArray(chatNotificationData.mentions)
      ? chatNotificationData.mentions
      : [];

    if (!mentionRows.length) return null;

    return (
      <div className="notification-group">
        <div className="notification-group__title">Chat Mentions</div>
        <div className="d-flex flex-column gap-2">
          {mentionRows.map((item) => (
            <button
              type="button"
              key={item._id}
              className="notification-item"
              onClick={() => openChatNotification(item)}
            >
              <div className="fw-semibold text-dark">
                {item.senderName || "Chat"}
              </div>
              <div className="small text-muted text-start">
                {buildChatMentionNotificationBody(item) ||
                  "Open the chat to view the mention."}
              </div>
              <div className="small text-primary text-start">
                {formatChatDateTime(item.createdAt)}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderFeedbackNotifications = () => {
    const feedbackRows = Array.isArray(feedbackNotificationData.rows)
      ? feedbackNotificationData.rows
      : [];

    if (!feedbackRows.length) return null;

    return (
      <div className="notification-group">
        <div className="notification-group__title">Employee Feedback</div>
        <div className="d-flex flex-column gap-2">
          {feedbackRows.map((item) => {
            const sourceLabel = [item.pageTitle, item.pagePath].filter(Boolean).join(" | ");

            return (
              <button
                type="button"
                key={item._id}
                className="notification-item"
                onClick={() => openFeedbackNotification(item)}
              >
                <div className="d-flex justify-content-between align-items-start gap-2">
                  <div className="fw-semibold text-dark">
                    {item.submittedByName || item.name || "Employee Feedback"}
                  </div>
                  <span className="badge text-bg-light border text-dark">
                    {item.category || "Feedback"}
                  </span>
                </div>
                <div className="small text-muted text-start">
                  {item.email || "No email provided"}
                </div>
                {sourceLabel ? (
                  <div className="small text-muted text-start">{sourceLabel}</div>
                ) : null}
                <div className="small text-muted text-start">
                  Satisfaction: {Number(item.satisfaction || 0)}/5
                </div>
                <div className="small text-dark text-start">
                  {truncateNotificationText(
                    item.message || "Open to review the submitted feedback."
                  )}
                </div>
                <div className="small text-primary text-start">
                  {formatPersonalTaskDateTime(item.createdAt)}
                </div>
                <div className="small text-muted text-start">
                  Click to mark this feedback notification as read.
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderChecklistRequestNotifications = () => {
    const requestRows = Array.isArray(requestNotificationData.rows)
      ? requestNotificationData.rows
      : [];

    if (!requestRows.length) return null;

    return (
      <div className="notification-group">
        <div className="notification-group__title">
          {isAdmin ? "Checklist Requests" : "Checklist Updates"}
        </div>
        <div className="d-flex flex-column gap-2">
          {requestRows.map((item) => (
            <button
              type="button"
              key={item._id}
              className="notification-item"
              onClick={() => openRequestNotification(item)}
            >
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div className="fw-semibold text-dark">
                  {item.title || item.moduleName || "Checklist Notification"}
                </div>
                <span className="badge text-bg-light border text-dark">
                  {item.actionLabel || item.moduleName || "Checklist"}
                </span>
              </div>
              <div className="small text-muted text-start">
                {item.message || "Open to view the latest checklist request update."}
              </div>
              <div className="small text-primary text-start">
                {formatPersonalTaskDateTime(item.createdAt)}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderComplaintNotifications = () => {
    const complaintRows = Array.isArray(complaintNotificationData.rows)
      ? complaintNotificationData.rows
      : [];

    if (!complaintRows.length) return null;

    return (
      <div className="notification-group">
        <div className="notification-group__title">Complaints</div>
        <div className="d-flex flex-column gap-2">
          {complaintRows.map((item) => (
            <button
              type="button"
              key={item._id}
              className="notification-item"
              onClick={() => openComplaintNotification(item)}
            >
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div className="fw-semibold text-dark">
                  {item.title || "Complaint Notification"}
                </div>
                <span className="badge text-bg-light border text-dark">
                  {item.stageLabel || "Complaint"}
                </span>
              </div>
              <div className="small text-muted text-start">
                {truncateNotificationText(
                  item.message || "Open to review the complaint details."
                )}
              </div>
              <div className="small text-primary text-start">
                {formatPersonalTaskDateTime(item.createdAt)}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderPollNotifications = () => {
    const unreadRows = Array.isArray(pollNotificationData.unread)
      ? pollNotificationData.unread
      : [];
    const reminderRows = Array.isArray(pollNotificationData.reminders)
      ? pollNotificationData.reminders
      : [];

    if (!unreadRows.length && !reminderRows.length) return null;

    return (
      <div className="notification-group">
        <div className="notification-group__title">Poll Alerts</div>
        <div className="d-flex flex-column gap-2">
          {[...unreadRows, ...reminderRows].map((item) => (
            <button
              type="button"
              key={item._id}
              className="notification-item"
              onClick={() => openPollNotification(item)}
            >
              <div className="fw-semibold text-dark">{item.title || "Polling System"}</div>
              <div className="small text-muted text-start">
                {item.message || "Open to review the assigned poll."}
              </div>
              <div className="small text-primary text-start">
                {formatPersonalTaskDateTime(item.createdAt)}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderNotificationMenu = () => (
    <div className="notification-menu">
      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
        <div className="fw-semibold text-dark">Notifications</div>
        {isEmployee ? (
          <div className="d-flex gap-2 notification-menu__quick-links">
            <button
              type="button"
              className="btn btn-link btn-sm text-decoration-none p-0"
              onClick={() => navigate("/chat")}
            >
              Open Site Chat
            </button>
            <button
              type="button"
              className="btn btn-link btn-sm text-decoration-none p-0"
              onClick={() => navigate("/department-chat")}
            >
              Open Department Chat
            </button>
            <button
              type="button"
              className="btn btn-link btn-sm text-decoration-none p-0"
              onClick={() => navigate("/own-tasks")}
            >
              Open Own Tasks
            </button>
            {isPollingEnabled ? (
              <button
                type="button"
                className="btn btn-link btn-sm text-decoration-none p-0"
                onClick={() => navigate("/polls")}
              >
                Open Polls
              </button>
            ) : null}
          </div>
        ) : null}
        {isAdmin || hasRestrictedChecklistAccess || canViewComplaintNotifications ? (
          <button
            type="button"
            className="btn btn-link btn-sm text-decoration-none p-0"
            onClick={markAllNotificationsRead}
            disabled={!totalNotificationCount}
          >
            Mark All Read
          </button>
        ) : null}
      </div>

      {notificationLoading ? (
        <div className="small text-muted">Loading notifications...</div>
      ) : totalNotificationCount ? (
            <div className="d-flex flex-column gap-3">
              {isAdmin ? (
                <>
                  {isComplaintsEnabled ? renderComplaintNotifications() : null}
                  {renderChecklistRequestNotifications()}
                  {renderFeedbackNotifications()}
                </>
              ) : hasRestrictedChecklistAccess ? (
                <>
                  {isComplaintsEnabled ? renderComplaintNotifications() : null}
                  {renderChecklistRequestNotifications()}
                </>
              ) : (
                <>
                  {isComplaintsEnabled ? renderComplaintNotifications() : null}
                  {renderChatMentions()}
                  {isPollingEnabled ? renderPollNotifications() : null}
                  {renderReminderGroup("Due Now", reminderNotificationData.due)}
                  {renderReminderGroup("Upcoming", reminderNotificationData.upcoming)}
                </>
              )}
            </div>
      ) : (
        <div className="small text-muted">
          {isAdmin
            ? "No new complaint, checklist, or employee feedback notifications right now."
            : hasRestrictedChecklistAccess
            ? "No new complaint or checklist approval updates right now."
            : canViewComplaintNotifications && !isEmployee
            ? "No new complaint notifications right now."
            : "No complaint, chat, poll, or reminder alerts right now."}
        </div>
      )}
    </div>
  );

  const renderNotificationShell = (menuRef, shellClassName = "") => (
    <div className={`position-relative ${shellClassName}`.trim()} ref={menuRef}>
      <button
        type="button"
        className="notification-toggle"
        onClick={() => setNotificationsOpen((prev) => !prev)}
        aria-label="Open notifications"
        aria-expanded={notificationsOpen}
      >
        <BellIcon />
        {totalNotificationCount ? (
          <span className="notification-toggle__badge">{totalNotificationCount}</span>
        ) : null}
      </button>

      {notificationsOpen ? renderNotificationMenu() : null}
    </div>
  );

  return (
    <nav
      ref={navbarRef}
      className="navbar navbar-expand-lg navbar-light px-3 px-lg-4 app-navbar"
      data-testid="app-navbar"
    >
      {/* SVG filter: makes white pixels transparent, all other colors unchanged */}
      <svg style={{ display: "none" }} aria-hidden="true">
        <defs>
          <filter id="logo-remove-white">
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -1 -1 -1 3 0"
            />
          </filter>
        </defs>
      </svg>
      <div className="app-navbar__toprow">
        <NavLink className="navbar-brand fw-semibold d-inline-flex align-items-center gap-2" to={homePath}>
          <img
            src={webLogo}
            alt="Check List Workspace"
            style={{ height: "38px", width: "auto", flexShrink: 0, objectFit: "contain" }}
          />
        </NavLink>

        <div className="app-navbar__top-controls">
          {shouldShowNotifications
            ? renderNotificationShell(
                mobileNotificationMenuRef,
                "app-navbar__notification-shell app-navbar__notification-shell--mobile"
              )
            : null}

          <button
            className="navbar-toggler app-navbar__mobile-toggle"
            type="button"
            onClick={() => {
              setMenuOpen((prev) => !prev);
              setActiveNavMenu("");
            }}
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon" />
          </button>
        </div>
      </div>

      <div className={`collapse navbar-collapse ${menuOpen ? "show" : ""}`}>
        <ul className="navbar-nav me-auto mb-2 mb-lg-0">
          {renderNavDropdown("workspace", "Workspace", workspaceLinks, isWorkspaceMenuActive)}
          {renderNavDropdown("masters", "Masters", masterLinks, isMastersMenuActive)}
          {renderNavDropdown("attendance", "Attendance", attendanceLinks, isAttendanceMenuActive)}
          {renderNavDropdown(
            "workflow",
            "Workflow",
            workflowLinks,
            isWorkflowMenuActive
          )}
          {renderNavDropdown(
            "communication",
            "Communication",
            communicationLinks,
            isCommunicationMenuActive
          )}
          {renderNavDropdown("reports", "Reports", reportLinks, isReportsMenuActive)}
          {renderNavDropdown("admin", "Admin", adminLinks, isAdminMenuActive)}
        </ul>

        <div className="d-flex flex-wrap align-items-center justify-content-end gap-3 app-navbar__actions">
          {shouldShowNotifications
            ? renderNotificationShell(
                desktopNotificationMenuRef,
                "app-navbar__notification-shell app-navbar__notification-shell--desktop"
              )
            : null}

          <div className="text-end small app-navbar__session">
            <div className="fw-semibold">{userName}</div>
            <div className="app-navbar__session-meta">
              {userDisplayId || "Current session"}
            </div>
          </div>

          <span className="badge text-uppercase px-3 py-2 app-navbar__role-badge">
            {resolvedRole?.name || (isAdmin ? "Admin" : isEmployee ? "Employee" : "User")}
          </span>

          <button onClick={logout} className="btn btn-danger btn-sm" data-testid="logout-button">
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

