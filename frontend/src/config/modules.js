export const MODULE_FLAGS = {
  authentication: true,
  permissions: true,
  role_permission_setup: true,
  module_settings: true,
  user_management: true,
  dashboard: true,
  dashboard_analytics: true,
  overview_1: true,
  overview_2: true,
  dashboard_summary: true,
  employee_master: true,
  own_profile: true,
  masters: true,
  company_master: true,
  site_master: true,
  department_master: true,
  sub_department_master: true,
  designation_master: true,
  checklist: true,
  checklist_master: true,
  tasks: true,
  your_checklist: true,
  assigned_checklists: true,
  checklist_transfer: true,
  approval_inbox: true,
  own_task: true,
  shared_task: true,
  attendance: true,
  employee_attendance: true,
  attendance_reports: true,
  attendance_regularization: true,
  attendance_settings: true,
  polling: false,
  assigned_polls: true,
  poll_results: true,
  poll_report: true,
  complaints: false,
  complaint_dashboard: true,
  complaint_report: true,
  chat: true,
  site_chat: true,
  department_chat: true,
  notifications: true,
  feedback: true,
  reports: true,
  checklist_report: true,
  checklist_task_report: true,
  workflow: true,
  workflow_mapping: true,
  approval_hierarchy: true,
  admin: true,
  admin_approvals: true,
  settings_masters: true,
};

export const PERMISSION_MODULE_DEPENDENCIES = {
  authentication: ["authentication"],
  permissions: ["permissions"],
  role_permission_setup: ["permissions", "role_permission_setup"],
  module_settings: ["permissions", "module_settings"],
  user_management: ["permissions", "user_management"],
  dashboard: ["dashboard"],
  dashboard_analytics: ["dashboard", "dashboard_analytics"],
  overview_1: ["dashboard", "dashboard_analytics", "overview_1"],
  overview_2: ["dashboard", "dashboard_analytics", "overview_2"],
  dashboard_summary: ["dashboard", "dashboard_analytics", "dashboard_summary"],
  employee_master: ["employee_master"],
  own_profile: ["own_profile"],
  company_master: ["masters", "company_master"],
  site_master: ["masters", "site_master"],
  department_master: ["masters", "department_master"],
  sub_department_master: ["masters", "department_master", "sub_department_master"],
  designation_master: ["masters", "designation_master"],
  checklist: ["checklist"],
  checklist_master: ["checklist", "checklist_master"],
  tasks: ["checklist", "tasks"],
  your_checklist: ["checklist", "your_checklist", "assigned_checklists"],
  assigned_checklists: ["checklist", "assigned_checklists"],
  checklist_transfer: ["checklist", "checklist_transfer"],
  approval_inbox: ["checklist", "approval_inbox"],
  own_task: ["checklist", "own_task"],
  shared_task: ["checklist", "shared_task"],
  admin_approvals: ["checklist", "admin_approvals"],
  attendance: ["attendance"],
  employee_attendance: ["attendance", "employee_attendance"],
  attendance_reports: ["attendance", "attendance_reports"],
  attendance_regularization: ["attendance", "attendance_regularization"],
  attendance_settings: ["attendance", "attendance_settings"],
  polling: ["polling"],
  poll_master: ["polling"],
  assigned_polls: ["polling", "assigned_polls"],
  poll_results: ["polling", "poll_results"],
  poll_report: ["polling", "poll_report"],
  complaints: ["complaints"],
  complaint_dashboard: ["complaints", "complaint_dashboard"],
  complaint_report: ["complaints", "complaint_report"],
  chat: ["chat"],
  site_chat: ["chat", "site_chat"],
  department_chat: ["chat", "department_chat"],
  notifications: ["notifications"],
  feedback: ["feedback"],
  reports: ["reports"],
  checklist_report: ["reports", "checklist_report"],
  checklist_task_report: ["reports", "checklist_task_report"],
  workflow: ["workflow"],
  workflow_mapping: ["workflow", "workflow_mapping"],
  approval_hierarchy: ["workflow", "approval_hierarchy"],
  settings_masters: ["settings_masters"],
};

export const mergeModuleFlags = (flags = {}) => ({
  ...MODULE_FLAGS,
  ...(flags && typeof flags === "object" ? flags : {}),
});

export const getModuleDependencies = (moduleKey) => {
  const normalizedKey = String(moduleKey || "").trim();
  return PERMISSION_MODULE_DEPENDENCIES[normalizedKey] || [normalizedKey];
};

export const isModuleEnabled = (moduleKey, flags = MODULE_FLAGS) =>
  getModuleDependencies(moduleKey).every((dependencyKey) => flags[dependencyKey] !== false);

export const getFlagKeyForPermissionModule = (moduleKey) =>
  getModuleDependencies(moduleKey)[0] || null;

export const isPermissionModuleEnabled = (moduleKey, flags = MODULE_FLAGS) =>
  isModuleEnabled(moduleKey, flags);

export const areAllPermissionModulesDisabled = (permissionChecks = [], flags = MODULE_FLAGS) => {
  const checks = Array.isArray(permissionChecks) ? permissionChecks : [];
  return (
    checks.length > 0 &&
    checks.every(({ moduleKey }) => !isPermissionModuleEnabled(moduleKey, flags))
  );
};

export const isRouteModuleEnabled = (path = "", flags = MODULE_FLAGS) => {
  const normalizedPath = String(path || "").trim();

  if (normalizedPath.startsWith("/polls")) {
    return isModuleEnabled("polling", flags);
  }

  if (normalizedPath.startsWith("/reports/polls")) {
    return isModuleEnabled("poll_results", flags) || isModuleEnabled("poll_report", flags);
  }

  if (normalizedPath === "/complaints") {
    return isModuleEnabled("complaint_dashboard", flags);
  }

  if (normalizedPath.startsWith("/complaints/reports")) {
    return isModuleEnabled("complaint_report", flags);
  }

  if (normalizedPath.startsWith("/attendance")) {
    return isModuleEnabled("attendance", flags);
  }

  if (normalizedPath.startsWith("/reports/checklists")) {
    return isModuleEnabled("checklist_report", flags);
  }

  if (normalizedPath.startsWith("/dashboard-1")) {
    return isModuleEnabled("overview_1", flags);
  }

  if (normalizedPath.startsWith("/dashboard-2")) {
    return isModuleEnabled("overview_2", flags);
  }

  if (normalizedPath.startsWith("/dashboard-summary")) {
    return isModuleEnabled("dashboard_summary", flags);
  }

  if (normalizedPath.startsWith("/workflow-mapping")) {
    return isModuleEnabled("workflow_mapping", flags);
  }

  if (normalizedPath.startsWith("/approval-hierarchy")) {
    return isModuleEnabled("approval_hierarchy", flags);
  }

  if (normalizedPath.startsWith("/chat")) {
    return isModuleEnabled("site_chat", flags);
  }

  if (normalizedPath.startsWith("/department-chat")) {
    return isModuleEnabled("department_chat", flags);
  }

  if (normalizedPath.startsWith("/module-settings")) {
    return isModuleEnabled("module_settings", flags);
  }

  return true;
};
