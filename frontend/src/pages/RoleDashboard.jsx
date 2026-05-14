import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { usePermissions } from "../context/usePermissions";

const getRoleDashboardCopy = (dashboardType, roleName) => {
  switch (dashboardType) {
    case "admin":
      return {
        title: "Admin Dashboard",
        subtitle: "Full workspace access across masters, reports, roles, and approvals.",
      };
    case "superior":
      return {
        title: "Superior Dashboard",
        subtitle: "Review managed-team approvals, pending workload, and escalation-ready reports.",
      };
    case "site":
      return {
        title: "Site User Dashboard",
        subtitle: "Focus on site-scoped checklist activity, approvals, reports, and communication.",
      };
    case "department":
      return {
        title: "Department User Dashboard",
        subtitle: "Track department-level pending work, approvals, and filtered operational reports.",
      };
    case "employee":
      return {
        title: "Employee Dashboard",
        subtitle: "Open assigned checklist tasks, reminders, notifications, and your own profile.",
      };
    default:
      return {
        title: roleName ? `${roleName} Dashboard` : "Workspace Dashboard",
        subtitle: "Your screen shortcuts and permitted modules are ready below.",
      };
  }
};

const formatValue = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : "-";
};

const featuredShortcutOrder = [
  "dashboard_analytics",
  "employee_master",
  "company_master",
  "site_master",
  "department_master",
  "designation_master",
  "checklist_master",
  "approval_inbox",
  "employee_attendance",
  "complaints",
  "complaint_dashboard",
  "reports",
  "checklist_report",
  "user_management",
  "role_permission_setup",
  "module_settings",
];

export default function RoleDashboard() {
  const { getVisibleModules, role, can, canAny, modules } = usePermissions();
  const [welcomeSummary, setWelcomeSummary] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const visibleShortcutModules = useMemo(
    () => {
      const moduleRank = new Map(
        featuredShortcutOrder.map((moduleKey, index) => [moduleKey, index])
      );
      const allVisibleModules = [
        ...getVisibleModules(),
        ...(canAny([
          { moduleKey: "dashboard_analytics", actionKey: "view" },
          { moduleKey: "dashboard_analytics", actionKey: "report_view" },
        ])
          ? (modules || []).filter((moduleItem) => moduleItem.key === "dashboard_analytics")
          : []),
      ].filter(
        (moduleItem, index, rows) =>
          moduleItem.routePath &&
          moduleItem.showOnDashboard !== false &&
          moduleItem.key !== "dashboard" &&
          rows.findIndex((row) => row.key === moduleItem.key) === index
      );
      const condensedModules = allVisibleModules.filter((moduleItem) => {
        if (
          moduleItem.key === "assigned_checklists" &&
          allVisibleModules.some((visibleModule) => visibleModule.key === "checklist_master")
        ) {
          return false;
        }

        if (
          moduleItem.key === "own_profile" &&
          allVisibleModules.some((visibleModule) => visibleModule.key === "employee_master")
        ) {
          return false;
        }

        return moduleItem.key !== "notifications";
      });
      const sortedModules = [...condensedModules].sort((left, right) => {
        const leftRank = moduleRank.get(left.key) ?? Number.MAX_SAFE_INTEGER;
        const rightRank = moduleRank.get(right.key) ?? Number.MAX_SAFE_INTEGER;

        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        return Number(left.order || 0) - Number(right.order || 0);
      });

      const uniqueRouteModules = sortedModules.filter(
        (moduleItem, index, rows) =>
          rows.findIndex((row) => row.routePath === moduleItem.routePath) === index
      );

      if (role?.dashboardType === "admin") {
        return uniqueRouteModules.slice(0, 8);
      }

      return uniqueRouteModules;
    },
    [canAny, getVisibleModules, modules, role?.dashboardType]
  );
  const dashboardCopy = getRoleDashboardCopy(role?.dashboardType, role?.name);

  useEffect(() => {
    let active = true;

    const loadSummary = async () => {
      try {
        const summaryResponse = await api.get("/dashboard/welcome-summary");
        if (active) {
          setWelcomeSummary(summaryResponse.data || null);
        }
      } catch {
        if (active) {
          setWelcomeSummary(null);
        }
      }

      if (!can("dashboard", "view")) {
        return;
      }

      try {
        const statsResponse = await api.get("/dashboard");
        if (active) {
          setDashboardStats(statsResponse.data || null);
        }
      } catch {
        if (active) {
          setDashboardStats(null);
        }
      }
    };

    void loadSummary();

    return () => {
      active = false;
    };
  }, [can]);

  const stats = [
    {
      label: "Pending Tasks",
      value: formatValue(welcomeSummary?.pendingTaskCount),
      meta: "Checklist and reminder items waiting for action",
    },
    {
      label: "Department Pending",
      value: formatValue(welcomeSummary?.departmentPendingCount),
      meta: "Visible only when your role manages a team",
    },
    {
      label: "Employees In Scope",
      value: formatValue(dashboardStats?.total),
      meta: "Filtered by your role and mapping",
    },
    {
      label: "Checklist Tasks",
      value: formatValue(dashboardStats?.totalChecklistTasks),
      meta: "Current task volume available in your dashboard scope",
    },
  ];

  return (
    <div className="container-fluid mt-4 mb-5">
      <div className="page-intro-card mb-4 role-dashboard-hero">
        <div className="page-kicker">Role Based Workspace</div>
        <h3 className="mb-2">{dashboardCopy.title}</h3>
        <p className="page-subtitle mb-0">{dashboardCopy.subtitle}</p>
      </div>

      <div className="row g-3 mb-4">
        {stats.map((stat) => (
          <div key={stat.label} className="col-12 col-md-6 col-xl-3">
            <div className="soft-card h-100 role-dashboard-stat">
              <div className="small text-uppercase text-muted fw-semibold">{stat.label}</div>
              <div className="display-6 fw-bold mt-2">{stat.value}</div>
              <div className="form-help mt-2">{stat.meta}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="page-intro-card mb-3">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Shortcuts</div>
            <h4 className="mb-1">Quick Access</h4>
            <div className="page-subtitle">
              {role?.dashboardType === "admin"
                ? "Your primary admin screens are shown here. Use the grouped top menus for the full module list."
                : "Only modules enabled for your role or user override are shown here."}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        {visibleShortcutModules.map((moduleItem) => (
          <div className="col-12 col-md-6 col-xl-4" key={moduleItem.key}>
            <Link className="text-decoration-none" to={moduleItem.routePath}>
              <div className="soft-card h-100 role-dashboard-shortcut">
                <div className="page-kicker">{moduleItem.category}</div>
                <h5 className="mb-2 text-dark">{moduleItem.name}</h5>
                <div className="text-muted">{moduleItem.description || "Open this module."}</div>
              </div>
            </Link>
          </div>
        ))}
        {!visibleShortcutModules.length ? (
          <div className="col-12">
            <div className="soft-card text-muted">No dashboard shortcuts are available for this role.</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

