import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { useModuleSettings } from "../context/useModuleSettings";
import { usePermissions } from "../context/usePermissions";
import AccessDenied from "./AccessDenied";

const groupSortOrder = [
  "System",
  "Dashboard",
  "Workspace",
  "Masters",
  "Attendance",
  "Communication",
  "Reports",
  "Workflow",
  "Admin",
  "General",
];

const groupConfig = {
  System: {
    icon: "shield",
    title: "System Modules",
    description: "Protected foundation modules that keep login and access control stable.",
  },
  Dashboard: {
    icon: "dashboard",
    title: "Dashboard Modules",
    description: "Landing, overview, drilldown, and summary screens.",
  },
  Workspace: {
    icon: "workspace",
    title: "Workspace Modules",
    description: "Daily operational screens used by teams and employees.",
  },
  Masters: {
    icon: "database",
    title: "Masters Modules",
    description: "Core setup data for company, site, department, and checklist ownership.",
  },
  Attendance: {
    icon: "calendar",
    title: "Attendance Modules",
    description: "Attendance dashboard, reports, regularization, and settings.",
  },
  Communication: {
    icon: "message",
    title: "Communication Modules",
    description: "Chat, notifications, and feedback related modules.",
  },
  Reports: {
    icon: "chart",
    title: "Reports Modules",
    description: "Checklist, poll, and complaint reporting screens.",
  },
  Workflow: {
    icon: "flow",
    title: "Workflow Modules",
    description: "Workflow mapping and approval hierarchy setup.",
  },
  Admin: {
    icon: "admin",
    title: "Admin Modules",
    description: "Administrative controls, permissions, and protected settings.",
  },
  General: {
    icon: "grid",
    title: "General Modules",
    description: "Additional application modules.",
  },
};

const moduleGroupOverrides = {
  authentication: "System",
  permissions: "System",
  dashboard: "Dashboard",
  dashboard_analytics: "Dashboard",
  overview_1: "Dashboard",
  overview_2: "Dashboard",
  dashboard_summary: "Dashboard",
  employee_master: "Workspace",
  own_profile: "Workspace",
  checklist: "Workspace",
  checklist_master: "Workspace",
  tasks: "Workspace",
  your_checklist: "Workspace",
  assigned_checklists: "Workspace",
  approval_inbox: "Workspace",
  own_task: "Workspace",
  shared_task: "Workspace",
  polling: "Workspace",
  assigned_polls: "Workspace",
  complaints: "Workspace",
  complaint_dashboard: "Workspace",
  masters: "Masters",
  company_master: "Masters",
  site_master: "Masters",
  department_master: "Masters",
  sub_department_master: "Masters",
  designation_master: "Masters",
  checklist_transfer: "Masters",
  settings_masters: "Masters",
  attendance: "Attendance",
  employee_attendance: "Attendance",
  attendance_reports: "Attendance",
  attendance_regularization: "Attendance",
  attendance_settings: "Attendance",
  chat: "Communication",
  site_chat: "Communication",
  department_chat: "Communication",
  notifications: "Communication",
  feedback: "Communication",
  reports: "Reports",
  checklist_report: "Reports",
  checklist_task_report: "Reports",
  poll_results: "Reports",
  poll_report: "Reports",
  complaint_report: "Reports",
  workflow: "Workflow",
  workflow_mapping: "Workflow",
  approval_hierarchy: "Workflow",
  user_management: "Admin",
  role_permission_setup: "Admin",
  module_settings: "Admin",
  admin_approvals: "Admin",
};

const summaryCards = [
  { key: "total", label: "Total Modules", icon: "grid", tone: "primary" },
  { key: "enabled", label: "Enabled", icon: "check", tone: "success" },
  { key: "disabled", label: "Disabled", icon: "pause", tone: "warning" },
  { key: "required", label: "Required", icon: "lock", tone: "info" },
];

const getResolvedGroupName = (row = {}) =>
  moduleGroupOverrides[row.moduleKey] || row.parentGroup || "General";

const getModuleIconName = (row = {}) => {
  const key = String(row.moduleKey || "");

  if (key.includes("attendance")) return "calendar";
  if (key.includes("poll")) return "chart";
  if (key.includes("complaint")) return "alert";
  if (key.includes("chat") || key.includes("notification") || key.includes("feedback")) return "message";
  if (key.includes("report") || key.includes("overview") || key.includes("dashboard")) return "dashboard";
  if (key.includes("permission") || key.includes("setting") || key.includes("admin")) return "admin";
  if (key.includes("master") || key.includes("department") || key.includes("site")) return "database";
  if (key.includes("workflow") || key.includes("approval")) return "flow";
  if (key.includes("checklist") || key.includes("task")) return "checklist";
  if (key.includes("auth")) return "shield";

  return "grid";
};

function IconGlyph({ name }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  switch (name) {
    case "shield":
      return (
        <svg {...commonProps}>
          <path d="M12 3.5 18.5 6v5.2c0 4.2-2.6 7.3-6.5 9.3-3.9-2-6.5-5.1-6.5-9.3V6L12 3.5Z" />
          <path d="m9.3 12.1 1.8 1.8 3.8-4" />
        </svg>
      );
    case "dashboard":
      return (
        <svg {...commonProps}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="4.5" rx="1.5" />
          <rect x="13" y="10.5" width="7" height="9.5" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "workspace":
      return (
        <svg {...commonProps}>
          <path d="M4 19V7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5V19" />
          <path d="M8 5V4h8v1" />
          <path d="M4 10h16" />
          <path d="M9 14h6" />
        </svg>
      );
    case "database":
      return (
        <svg {...commonProps}>
          <ellipse cx="12" cy="6" rx="7" ry="3" />
          <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
          <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...commonProps}>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3.5v3" />
          <path d="M16 3.5v3" />
          <path d="M4 9h16" />
          <path d="m8.5 14 2 2 4.5-4.5" />
        </svg>
      );
    case "message":
      return (
        <svg {...commonProps}>
          <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H11l-4.5 4v-4A2.5 2.5 0 0 1 4 12.5v-6Z" />
          <path d="M8 8.5h8" />
          <path d="M8 11.5h5" />
        </svg>
      );
    case "chart":
      return (
        <svg {...commonProps}>
          <path d="M4 19h16" />
          <path d="M7 16v-5" />
          <path d="M12 16V7" />
          <path d="M17 16v-8" />
        </svg>
      );
    case "flow":
      return (
        <svg {...commonProps}>
          <rect x="4" y="4" width="6" height="5" rx="1.3" />
          <rect x="14" y="15" width="6" height="5" rx="1.3" />
          <path d="M10 6.5h2.5A3.5 3.5 0 0 1 16 10v5" />
          <path d="m13.5 12.5 2.5 2.5 2.5-2.5" />
        </svg>
      );
    case "admin":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8" r="3.3" />
          <path d="M5.8 19c.8-3.2 3-5 6.2-5s5.4 1.8 6.2 5" />
          <path d="M18.5 5.5v3" />
          <path d="M17 7h3" />
        </svg>
      );
    case "check":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m8.5 12.2 2.2 2.2 4.8-5" />
        </svg>
      );
    case "pause":
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9.5 8.5v7" />
          <path d="M14.5 8.5v7" />
        </svg>
      );
    case "lock":
      return (
        <svg {...commonProps}>
          <rect x="5.5" y="10" width="13" height="9" rx="2" />
          <path d="M8.5 10V7.8a3.5 3.5 0 0 1 7 0V10" />
        </svg>
      );
    case "alert":
      return (
        <svg {...commonProps}>
          <path d="M12 4 21 19H3L12 4Z" />
          <path d="M12 9v4" />
          <path d="M12 16h.01" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...commonProps}>
          <path d="m8 10 4 4 4-4" />
        </svg>
      );
    case "checklist":
      return (
        <svg {...commonProps}>
          <rect x="5" y="4" width="14" height="16" rx="2" />
          <path d="m8.2 9 1 1 2-2" />
          <path d="M13 9h3" />
          <path d="m8.2 14 1 1 2-2" />
          <path d="M13 14h3" />
        </svg>
      );
    case "grid":
    default:
      return (
        <svg {...commonProps}>
          <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
          <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
          <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
          <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
        </svg>
      );
  }
}

export default function ModuleSettings() {
  const { user } = usePermissions();
  const { refreshModuleFlags } = useModuleSettings();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [loadError, setLoadError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [pendingToggle, setPendingToggle] = useState(null);
  const isMainAdmin = user?.roleKey === "main_admin" || user?.isDefaultAdmin;

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const response = await api.get("/module-settings");
      setRows(Array.isArray(response.data?.rows) ? response.data.rows : []);
    } catch (error) {
      setLoadError(error.response?.data?.message || "Failed to load module settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isMainAdmin) return;
    void loadSettings();
  }, [isMainAdmin, loadSettings]);

  const summary = useMemo(() => {
    const required = rows.filter((row) => row.isSystemRequired).length;
    const enabled = rows.filter((row) => row.isEnabled !== false || row.isSystemRequired).length;

    return {
      total: rows.length,
      enabled,
      disabled: Math.max(0, rows.length - enabled),
      required,
    };
  }, [rows]);

  const groupedRows = useMemo(() => {
    const groupRank = new Map(groupSortOrder.map((group, index) => [group, index]));

    return [...rows]
      .sort((left, right) => {
        const leftGroup = getResolvedGroupName(left);
        const rightGroup = getResolvedGroupName(right);
        const leftGroupRank = groupRank.get(leftGroup) ?? Number.MAX_SAFE_INTEGER;
        const rightGroupRank = groupRank.get(rightGroup) ?? Number.MAX_SAFE_INTEGER;

        if (leftGroupRank !== rightGroupRank) {
          return leftGroupRank - rightGroupRank;
        }

        return Number(left.sortOrder || 0) - Number(right.sortOrder || 0);
      })
      .reduce((result, row) => {
        const groupName = getResolvedGroupName(row);
        if (!result.has(groupName)) {
          result.set(groupName, []);
        }
        result.get(groupName).push(row);
        return result;
      }, new Map());
  }, [rows]);

  const toggleGroup = (groupName) => {
    setCollapsedGroups((currentValue) => {
      const nextValue = new Set(currentValue);
      if (nextValue.has(groupName)) {
        nextValue.delete(groupName);
      } else {
        nextValue.add(groupName);
      }
      return nextValue;
    });
  };

  const openToggleConfirmation = (row) => {
    if (row.isSystemRequired || savingKey) return;
    setPendingToggle(row);
  };

  const closeToggleConfirmation = () => {
    if (savingKey) return;
    setPendingToggle(null);
  };

  const confirmModuleToggle = async () => {
    if (!pendingToggle) return;

    const nextEnabled = pendingToggle.isEnabled === false;
    setSavingKey(pendingToggle.moduleKey);
    setStatusMessage("");

    try {
      await api.patch(`/module-settings/${pendingToggle.moduleKey}`, {
        isEnabled: nextEnabled,
      });
      await loadSettings();
      await refreshModuleFlags();
      setStatusMessage("Module status updated successfully");
      setPendingToggle(null);
    } catch (error) {
      alert(error.response?.data?.message || "Failed to update module status");
    } finally {
      setSavingKey("");
    }
  };

  if (!isMainAdmin) {
    return <AccessDenied />;
  }

  const pendingNextEnabled = pendingToggle ? pendingToggle.isEnabled === false : false;

  return (
    <div className="module-settings-page container-fluid mt-4 mb-5" data-testid="module-settings-page">
      <section className="module-settings-hero">
        <div className="module-settings-hero__copy">
          <div className="page-kicker">Administration</div>
          <h3 className="mb-2">Module Settings</h3>
          <p className="page-subtitle mb-0">
            Turn completed modules on or off without deleting code, permissions, or saved data.
          </p>
        </div>

        <div className="module-settings-summary-grid">
          {summaryCards.map((card) => (
            <div className={`module-settings-summary module-settings-summary--${card.tone}`} key={card.key}>
              <span className="module-settings-summary__icon">
                <IconGlyph name={card.icon} />
              </span>
              <span className="module-settings-summary__count">{summary[card.key]}</span>
              <span className="module-settings-summary__label">{card.label}</span>
            </div>
          ))}
        </div>
      </section>

      {statusMessage ? (
        <div className="alert alert-success py-2 px-3 module-settings-alert">{statusMessage}</div>
      ) : null}

      {loadError ? <div className="alert alert-danger module-settings-alert">{loadError}</div> : null}

      {loading ? (
        <div className="module-settings-loading">Loading module settings...</div>
      ) : (
        <div className="module-settings-group-grid">
          {[...groupedRows.entries()].map(([groupName, groupRows]) => {
            const config = groupConfig[groupName] || groupConfig.General;
            const isCollapsed = collapsedGroups.has(groupName);

            return (
              <section className="module-settings-group-card" key={groupName}>
                <button
                  type="button"
                  className="module-settings-group-card__header"
                  onClick={() => toggleGroup(groupName)}
                  aria-expanded={!isCollapsed}
                >
                  <span className="module-settings-group-card__icon">
                    <IconGlyph name={config.icon} />
                  </span>
                  <span className="module-settings-group-card__copy">
                    <span className="module-settings-group-card__title">{config.title}</span>
                    <span className="module-settings-group-card__description">{config.description}</span>
                  </span>
                  <span className="module-settings-group-card__meta">
                    <span className="module-settings-group-card__count">
                      {groupRows.length} module{groupRows.length === 1 ? "" : "s"}
                    </span>
                    <span className={`module-settings-group-card__arrow${isCollapsed ? "" : " is-open"}`}>
                      <IconGlyph name="chevron" />
                    </span>
                  </span>
                </button>

                {!isCollapsed ? (
                  <div className="module-settings-module-list">
                    {groupRows.map((row) => {
                      const isEnabled = row.isEnabled !== false || row.isSystemRequired;
                      const isSaving = savingKey === row.moduleKey;

                      return (
                        <article
                          className={`module-settings-module-row ${
                            isEnabled ? "is-enabled" : "is-disabled"
                          } ${row.isSystemRequired ? "is-required" : ""}`}
                          key={row.moduleKey}
                        >
                          <span className="module-settings-module-row__icon">
                            <IconGlyph name={getModuleIconName(row)} />
                          </span>

                          <span className="module-settings-module-row__content">
                            <span className="module-settings-module-row__topline">
                              <span className="module-settings-module-row__name">{row.moduleName}</span>
                              <span className={`module-status-badge ${isEnabled ? "is-enabled" : "is-disabled"}`}>
                                {isEnabled ? "Enabled" : "Disabled"}
                              </span>
                              {row.isSystemRequired ? (
                                <span className="module-status-badge is-required">Required</span>
                              ) : null}
                            </span>
                            <span className="module-settings-module-row__key">{row.moduleKey}</span>
                            <span className="module-settings-module-row__description">
                              {row.description || "No description available."}
                            </span>
                          </span>

                          <span className="module-settings-module-row__action">
                            {row.isSystemRequired ? (
                              <span className="module-settings-lock-pill">
                                <IconGlyph name="lock" />
                                Required
                              </span>
                            ) : (
                              <button
                                type="button"
                                className={`module-settings-toggle ${isEnabled ? "is-on" : "is-off"}`}
                                onClick={() => openToggleConfirmation(row)}
                                disabled={Boolean(savingKey)}
                                aria-pressed={isEnabled}
                                aria-label={`${isEnabled ? "Disable" : "Enable"} ${row.moduleName}`}
                              >
                                <span className="module-settings-toggle__track">
                                  <span className="module-settings-toggle__thumb" />
                                </span>
                                <span className="module-settings-toggle__label">
                                  {isSaving ? "Saving" : isEnabled ? "On" : "Off"}
                                </span>
                              </button>
                            )}
                          </span>
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      <div className="module-settings-note">
        <span className="module-settings-note__icon">
          <IconGlyph name="shield" />
        </span>
        <span>
          Required modules are protected and cannot be disabled. Disabling a module will hide it from
          the application while preserving all data.
        </span>
      </div>

      {pendingToggle ? (
        <div className="module-settings-modal-backdrop" role="presentation">
          <div className="module-settings-modal" role="dialog" aria-modal="true" aria-labelledby="module-toggle-title">
            <div className="module-settings-modal__icon">
              <IconGlyph name={pendingNextEnabled ? "check" : "pause"} />
            </div>
            <h5 id="module-toggle-title" className="module-settings-modal__title">
              {pendingNextEnabled ? "Enable Module" : "Disable Module"}
            </h5>
            <p className="module-settings-modal__copy">
              {pendingNextEnabled
                ? "Do you want to enable this module?"
                : "Do you want to disable this module? Users will not be able to access it, but saved data will remain safe."}
            </p>
            <div className="module-settings-modal__target">
              <strong>{pendingToggle.moduleName}</strong>
              <span>{pendingToggle.moduleKey}</span>
            </div>
            <div className="module-settings-modal__actions">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={closeToggleConfirmation}
                disabled={Boolean(savingKey)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`btn ${pendingNextEnabled ? "btn-success" : "btn-primary"}`}
                onClick={confirmModuleToggle}
                disabled={Boolean(savingKey)}
              >
                {savingKey ? "Saving..." : "Yes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
