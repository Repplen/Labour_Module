import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import ChecklistAssistantWidget from "./components/ChecklistAssistantWidget";
import ScrollToTopButton from "./components/ScrollToTopButton";
import { ModuleSettingsProvider } from "./context/ModuleSettingsContext";
import { PermissionProvider } from "./context/PermissionContext";
import { useModuleSettings } from "./context/useModuleSettings";
import { usePermissions } from "./context/usePermissions";

import AccessDenied from "./pages/AccessDenied";
import Dashboard from "./pages/Dashboard";
import Dashboard2Summary from "./pages/Dashboard2Summary";
import EmployeeForm from "./pages/EmployeeForm";
import EmployeeEdit from "./pages/EmployeeEdit";
import EmployeeList from "./pages/EmployeeList";
import EmployeeQrProfile from "./pages/EmployeeQrProfile";
import EmployeeView from "./pages/EmployeeView";
import Login from "./pages/Login";
import ModulePlaceholderPage from "./pages/ModulePlaceholderPage";
import OwnTasks from "./pages/OwnTasks";
import ChatModule from "./pages/ChatModule";
import RoleDashboard from "./pages/RoleDashboard";
import RolePermissionSetup from "./pages/RolePermissionSetup";
import ModuleSettings from "./pages/ModuleSettings";
import UsersAdmin from "./pages/UsersAdmin";
import IntroWelcomeScreen from "./pages/IntroWelcomeScreen";
import ComplaintsDashboard from "./pages/complaints/ComplaintsDashboard";
import ComplaintsReport from "./pages/complaints/ComplaintsReport";
import ChecklistList from "./pages/checklists/ChecklistList";
import ChecklistCreate from "./pages/checklists/ChecklistCreate";
import ChecklistView from "./pages/checklists/ChecklistView";
import ChecklistTasksAdmin from "./pages/checklists/ChecklistTasksAdmin";
import ChecklistTaskView from "./pages/checklists/ChecklistTaskView";
import YourChecklist from "./pages/checklists/YourChecklist";
import ChecklistApprovals from "./pages/checklists/ChecklistApprovals";
import ChecklistAdminApprovals from "./pages/checklists/ChecklistAdminApprovals";
import ChecklistReport from "./pages/reports/ChecklistReport";
import PollList from "./pages/polls/PollList";
import PollCreate from "./pages/polls/PollCreate";
import PollResponse from "./pages/polls/PollResponse";
import PollReport from "./pages/polls/PollReport";

import CompanyMaster from "./pages/masters/CompanyMaster";
import DepartmentMaster from "./pages/masters/DepartmentMaster";
import DesignationMaster from "./pages/masters/DesignationMaster";
import ChecklistTransferMaster from "./pages/masters/ChecklistTransferMaster";
import MainLocation from "./pages/masters/MainLocation";
import MaterialMaster from "./pages/masters/MaterialMaster";
import NatureOfWork from "./pages/masters/NatureOfWork";
import SiteMaster from "./pages/masters/SiteMaster";
import AttendanceDashboard from "./pages/attendance/AttendanceDashboard";
import AttendanceDailyEntry from "./pages/attendance/AttendanceDailyEntry";
import AttendanceRegularization from "./pages/attendance/AttendanceRegularization";
import AttendanceReport from "./pages/attendance/AttendanceReport";
import AttendanceSettings from "./pages/attendance/AttendanceSettings";
import SelfAttendance from "./pages/attendance/SelfAttendance";
import {
  getStoredUser,
  shouldShowPostLoginWelcome,
} from "./utils/postLoginWelcome";

const hasSession = () => Boolean(localStorage.getItem("token")) && Boolean(getStoredUser());

export function FullPageLoader() {
  return <div className="container py-5 text-center">Loading workspace permissions...</div>;
}

export function ModuleDisabledPage() {
  return (
    <div className="container py-5">
      <div className="alert alert-warning mb-0" role="alert">
        This module is currently disabled.
      </div>
    </div>
  );
}

export function PrivateRoute({ children }) {
  if (!hasSession()) {
    return <Navigate to="/login" replace />;
  }

  if (shouldShowPostLoginWelcome()) {
    return <Navigate to="/welcome" replace />;
  }

  return children;
}

export function WelcomeRoute({ children }) {
  const location = useLocation();
  const { loading, getHomePath } = usePermissions();
  const searchParams = new URLSearchParams(location.search);
  const isWelcomePreview = searchParams.get("preview") === "1";

  if (!hasSession()) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return <FullPageLoader />;
  }

  if (!shouldShowPostLoginWelcome() && !isWelcomePreview) {
    return <Navigate to={getHomePath()} replace />;
  }

  return children;
}

export function PermissionRoute({ children, moduleKey, actionKey = "view", anyOf = [] }) {
  const location = useLocation();
  const { loading, can, canAny } = usePermissions();
  const {
    areAllPermissionModulesDisabled,
    isPermissionModuleEnabled,
    loading: moduleSettingsLoading,
  } = useModuleSettings();

  if (!hasSession()) {
    return <Navigate to="/login" replace />;
  }

  if (shouldShowPostLoginWelcome()) {
    return <Navigate to="/welcome" replace />;
  }

  if (loading || moduleSettingsLoading) {
    return <FullPageLoader />;
  }

  if (
    (moduleKey && !isPermissionModuleEnabled(moduleKey)) ||
    (!moduleKey && areAllPermissionModulesDisabled(anyOf))
  ) {
    return <ModuleDisabledPage />;
  }

  const isAllowed = anyOf.length ? canAny(anyOf) : can(moduleKey, actionKey);
  if (!isAllowed) {
    return <Navigate to="/access-denied" replace state={{ from: location.pathname }} />;
  }

  return children;
}

function MyProfileRedirect() {
  const { user, getHomePath } = usePermissions();

  if (!user?.id) {
    return <Navigate to={getHomePath()} replace />;
  }

  return <Navigate to={`/view/${user.id}`} replace />;
}

function AuthenticatedHomeRedirect() {
  const { loading, getHomePath, getVisibleModules } = usePermissions();
  const { isRouteModuleEnabled, loading: moduleSettingsLoading } = useModuleSettings();

  if (!hasSession()) {
    return <Navigate to="/login" replace />;
  }

  if (loading || moduleSettingsLoading) {
    return <FullPageLoader />;
  }

  const firstVisibleModule = getVisibleModules().find(
    (moduleItem) => moduleItem.routePath && moduleItem.key !== "dashboard"
  );
  const resolvedHomePath = getHomePath();
  const targetPath =
    resolvedHomePath &&
    isRouteModuleEnabled(resolvedHomePath) &&
    (resolvedHomePath !== "/dashboard" || !firstVisibleModule)
      ? resolvedHomePath
      : firstVisibleModule?.routePath || "/access-denied";

  return <Navigate to={targetPath} replace />;
}

function AppRoutes() {
  const location = useLocation();
  const { loading } = usePermissions();
  const hideNavbar =
    location.pathname === "/login" ||
    location.pathname.startsWith("/welcome") ||
    location.pathname.startsWith("/employee-qr");

  useEffect(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-bs-theme");
    document.body.removeAttribute("data-theme");
    document.body.removeAttribute("data-bs-theme");
    localStorage.removeItem("app-theme");
  }, []);

  return (
    <div className={`app-layout${hideNavbar ? " app-layout--auth" : ""}`}>
      {!hideNavbar ? <Navbar /> : null}
      {!hideNavbar && hasSession() && !loading ? <ChecklistAssistantWidget /> : null}
      {!hideNavbar && hasSession() ? <ScrollToTopButton /> : null}

      <main className="app-layout__content">
        <Routes>
          <Route
            path="/login"
            element={
              hasSession() ? (
                shouldShowPostLoginWelcome() ? (
                  <Navigate to="/welcome" replace />
                ) : (
                  <AuthenticatedHomeRedirect />
                )
              ) : (
                <Login />
              )
            }
          />

          <Route
            path="/welcome"
            element={
              <WelcomeRoute>
                <IntroWelcomeScreen />
              </WelcomeRoute>
            }
          />

          <Route
            path="/welcome/attendance"
            element={<Navigate to="/welcome" replace />}
          />

          <Route
            path="/welcome/checklist"
            element={<Navigate to="/welcome" replace />}
          />

          <Route
            path="/access-denied"
            element={
              <PrivateRoute>
                <AccessDenied />
              </PrivateRoute>
            }
          />

          <Route path="/employee-qr/:qrToken" element={<EmployeeQrProfile />} />

          <Route
            path="/dashboard"
            element={
              <PermissionRoute moduleKey="dashboard">
                <RoleDashboard />
              </PermissionRoute>
            }
          />

          <Route
            path="/dashboard-1"
            element={
              <PermissionRoute
                anyOf={[
                  { moduleKey: "overview_1", actionKey: "view" },
                  { moduleKey: "overview_1", actionKey: "report_view" },
                  { moduleKey: "dashboard_analytics", actionKey: "view" },
                  { moduleKey: "dashboard_analytics", actionKey: "report_view" },
                ]}
              >
                <Dashboard
                  pageTitle="Overview 1"
                  drilldownVariant="company-site"
                  drilldownLayout="columns"
                  fullWidth
                  showDrilldownCardMarks
                  companyOverviewOnly
                  companyDetailPath="/dashboard-1/company"
                  showEmployeeOverallSection={false}
                />
              </PermissionRoute>
            }
          />

          <Route
            path="/dashboard-1/company/:companyId"
            element={
              <PermissionRoute
                anyOf={[
                  { moduleKey: "overview_1", actionKey: "view" },
                  { moduleKey: "overview_1", actionKey: "report_view" },
                  { moduleKey: "dashboard_analytics", actionKey: "view" },
                  { moduleKey: "dashboard_analytics", actionKey: "report_view" },
                ]}
              >
                <Dashboard
                  pageTitle="Overview 1"
                  drilldownVariant="company-site"
                  drilldownLayout="columns"
                  fullWidth
                  showDrilldownCardMarks
                  hideCompanyStep
                  useRouteCompanyId
                  companyOverviewPath="/dashboard-1"
                  employeeDetailMode="checklists"
                />
              </PermissionRoute>
            }
          />

          <Route
            path="/dashboard-2"
            element={
              <PermissionRoute
                anyOf={[
                  { moduleKey: "overview_2", actionKey: "view" },
                  { moduleKey: "overview_2", actionKey: "report_view" },
                  { moduleKey: "dashboard_analytics", actionKey: "view" },
                  { moduleKey: "dashboard_analytics", actionKey: "report_view" },
                ]}
              >
                <Dashboard
                  pageTitle="Overview 2"
                  drilldownVariant="company-site"
                  markHierarchySource="workflow"
                  drilldownLayout="columns"
                  fullWidth
                  showDrilldownCardMarks
                  showSiteLeadStep
                  showDepartmentLeadStep
                  companyOverviewOnly
                  companyDetailPath="/dashboard-2/company"
                  showEmployeeOverallSection={false}
                />
              </PermissionRoute>
            }
          />

          <Route
            path="/dashboard-2/company/:companyId"
            element={
              <PermissionRoute
                anyOf={[
                  { moduleKey: "overview_2", actionKey: "view" },
                  { moduleKey: "overview_2", actionKey: "report_view" },
                  { moduleKey: "dashboard_analytics", actionKey: "view" },
                  { moduleKey: "dashboard_analytics", actionKey: "report_view" },
                ]}
              >
                <Dashboard
                  pageTitle="Overview 2"
                  drilldownVariant="company-site"
                  markHierarchySource="workflow"
                  drilldownLayout="columns"
                  fullWidth
                  showDrilldownCardMarks
                  showSiteLeadStep
                  showDepartmentLeadStep
                  hideCompanyStep
                  useRouteCompanyId
                  companyOverviewPath="/dashboard-2"
                  employeeDetailMode="checklists"
                />
              </PermissionRoute>
            }
          />

          <Route
            path="/dashboard-summary"
            element={
              <PermissionRoute
                anyOf={[
                  { moduleKey: "dashboard_summary", actionKey: "view" },
                  { moduleKey: "dashboard_summary", actionKey: "report_view" },
                  { moduleKey: "dashboard_analytics", actionKey: "view" },
                  { moduleKey: "dashboard_analytics", actionKey: "report_view" },
                ]}
              >
                <Dashboard2Summary />
              </PermissionRoute>
            }
          />

          <Route
            path="/employees"
            element={
              <PermissionRoute moduleKey="employee_master">
                <EmployeeList />
              </PermissionRoute>
            }
          />

          <Route
            path="/me"
            element={
              <PermissionRoute moduleKey="own_profile">
                <MyProfileRedirect />
              </PermissionRoute>
            }
          />

          <Route
            path="/view/:id"
            element={
              <PermissionRoute
                anyOf={[
                  { moduleKey: "employee_master", actionKey: "view" },
                  { moduleKey: "own_profile", actionKey: "view" },
                ]}
              >
                <EmployeeView />
              </PermissionRoute>
            }
          />

          <Route
            path="/add"
            element={
              <PermissionRoute moduleKey="employee_master" actionKey="add">
                <EmployeeForm />
              </PermissionRoute>
            }
          />

          <Route
            path="/edit/:id"
            element={
              <PermissionRoute moduleKey="employee_master" actionKey="edit">
                <EmployeeEdit />
              </PermissionRoute>
            }
          />

          <Route
            path="/masters/companies"
            element={
              <PermissionRoute moduleKey="company_master">
                <CompanyMaster />
              </PermissionRoute>
            }
          />

          <Route
            path="/masters/departments"
            element={
              <PermissionRoute
                anyOf={[
                  { moduleKey: "department_master", actionKey: "view" },
                  { moduleKey: "sub_department_master", actionKey: "view" },
                ]}
              >
                <DepartmentMaster />
              </PermissionRoute>
            }
          />

          <Route
            path="/masters/designations"
            element={
              <PermissionRoute moduleKey="designation_master">
                <DesignationMaster />
              </PermissionRoute>
            }
          />

          <Route
            path="/masters/sites"
            element={
              <PermissionRoute moduleKey="site_master">
                <SiteMaster />
              </PermissionRoute>
            }
          />

          <Route
            path="/masters/main-locations"
            element={
              <PermissionRoute moduleKey="main_location">
                <MainLocation />
              </PermissionRoute>
            }
          />

          <Route
            path="/masters/materials"
            element={
              <PermissionRoute moduleKey="material_master">
                <MaterialMaster />
              </PermissionRoute>
            }
          />

          <Route
            path="/masters/nature-of-work"
            element={
              <PermissionRoute moduleKey="nature_of_work">
                <NatureOfWork />
              </PermissionRoute>
            }
          />

          <Route
            path="/your-checklist"
            element={
              <PermissionRoute
                anyOf={[
                  { moduleKey: "your_checklist", actionKey: "view" },
                  { moduleKey: "assigned_checklists", actionKey: "view" },
                ]}
              >
                <YourChecklist />
              </PermissionRoute>
            }
          />

          <Route
            path="/checklists"
            element={
              <PermissionRoute
                anyOf={[
                  { moduleKey: "checklist_master", actionKey: "view" },
                  { moduleKey: "assigned_checklists", actionKey: "view" },
                ]}
              >
                <ChecklistList />
              </PermissionRoute>
            }
          />

          <Route
            path="/polls"
            element={
              <PermissionRoute
                anyOf={[
                  { moduleKey: "poll_master", actionKey: "view" },
                  { moduleKey: "assigned_polls", actionKey: "view" },
                ]}
              >
                <PollList />
              </PermissionRoute>
            }
          />

          <Route
            path="/polls/create"
            element={
              <PermissionRoute moduleKey="poll_master" actionKey="add">
                <PollCreate />
              </PermissionRoute>
            }
          />

          <Route
            path="/polls/edit/:id"
            element={
              <PermissionRoute moduleKey="poll_master" actionKey="edit">
                <PollCreate />
              </PermissionRoute>
            }
          />

          <Route
            path="/polls/my/:assignmentId"
            element={
              <PermissionRoute moduleKey="assigned_polls" actionKey="view">
                <PollResponse />
              </PermissionRoute>
            }
          />

          <Route
            path="/checklists/create"
            element={
              <PermissionRoute moduleKey="checklist_master" actionKey="add">
                <ChecklistCreate />
              </PermissionRoute>
            }
          />

          <Route
            path="/checklists/tasks"
            element={
              <PermissionRoute
                anyOf={[
                  { moduleKey: "tasks", actionKey: "view" },
                  { moduleKey: "checklist_master", actionKey: "view" },
                ]}
              >
                <ChecklistTasksAdmin />
              </PermissionRoute>
            }
          />

          <Route
            path="/checklists/edit/:id"
            element={
              <PermissionRoute moduleKey="checklist_master" actionKey="edit">
                <ChecklistCreate mode="edit" />
              </PermissionRoute>
            }
          />

          <Route
            path="/checklists/:id"
            element={
              <PermissionRoute moduleKey="checklist_master" actionKey="view">
                <ChecklistView />
              </PermissionRoute>
            }
          />

          <Route
            path="/checklists/tasks/:id"
            element={
              <PermissionRoute
                anyOf={[
                  { moduleKey: "assigned_checklists", actionKey: "view" },
                  { moduleKey: "approval_inbox", actionKey: "view" },
                  { moduleKey: "reports", actionKey: "view" },
                  { moduleKey: "reports", actionKey: "report_view" },
                  { moduleKey: "checklist_master", actionKey: "view" },
                ]}
              >
                <ChecklistTaskView />
              </PermissionRoute>
            }
          />

          <Route
            path="/checklists/approvals"
            element={
              <PermissionRoute moduleKey="approval_inbox" actionKey="view">
                <ChecklistApprovals />
              </PermissionRoute>
            }
          />

          <Route
            path="/checklists/admin-approvals"
            element={
              <PermissionRoute
                anyOf={[
                  { moduleKey: "admin_approvals", actionKey: "view" },
                  { moduleKey: "admin_approvals", actionKey: "approve" },
                  { moduleKey: "checklist_master", actionKey: "approve" },
                  { moduleKey: "checklist_master", actionKey: "reject" },
                ]}
              >
                <ChecklistAdminApprovals />
              </PermissionRoute>
            }
          />

          <Route
            path="/masters/checklist-transfer"
            element={
              <PermissionRoute moduleKey="checklist_transfer" actionKey="view">
                <ChecklistTransferMaster />
              </PermissionRoute>
            }
          />

          <Route
            path="/own-tasks"
            element={
              <PermissionRoute moduleKey="own_task" actionKey="view">
                <OwnTasks />
              </PermissionRoute>
            }
          />

          <Route
            path="/own-tasks/:id"
            element={
              <PermissionRoute moduleKey="own_task" actionKey="view">
                <OwnTasks />
              </PermissionRoute>
            }
          />

          <Route
            path="/complaints"
            element={
              <PermissionRoute
                anyOf={[
                  { moduleKey: "complaint_dashboard", actionKey: "view" },
                  { moduleKey: "complaints", actionKey: "view" },
                ]}
              >
                <ComplaintsDashboard />
              </PermissionRoute>
            }
          />

          <Route
            path="/complaints/reports"
            element={
              <PermissionRoute
                anyOf={[
                  { moduleKey: "complaint_report", actionKey: "view" },
                  { moduleKey: "complaint_report", actionKey: "report_view" },
                  { moduleKey: "complaints", actionKey: "view" },
                ]}
              >
                <ComplaintsReport />
              </PermissionRoute>
            }
          />

          <Route
            path="/chat"
            element={
              <PermissionRoute moduleKey="site_chat" actionKey="view">
                <ChatModule key="site-chat" chatType="site" apiBasePath="/chat" />
              </PermissionRoute>
            }
          />

          <Route
            path="/department-chat"
            element={
              <PermissionRoute moduleKey="department_chat" actionKey="view">
                <ChatModule
                  key="department-chat"
                  chatType="department"
                  apiBasePath="/department-chat"
                />
              </PermissionRoute>
            }
          />

          <Route
            path="/reports/checklists"
            element={
              <PermissionRoute
                anyOf={[
                  { moduleKey: "checklist_report", actionKey: "view" },
                  { moduleKey: "checklist_report", actionKey: "report_view" },
                  { moduleKey: "reports", actionKey: "view" },
                  { moduleKey: "reports", actionKey: "report_view" },
                ]}
              >
                <ChecklistReport />
              </PermissionRoute>
            }
          />

          <Route
            path="/reports/polls"
            element={
              <PermissionRoute
                anyOf={[
                  { moduleKey: "poll_results", actionKey: "view" },
                  { moduleKey: "poll_results", actionKey: "report_view" },
                  { moduleKey: "poll_report", actionKey: "view" },
                  { moduleKey: "poll_report", actionKey: "report_view" },
                  { moduleKey: "poll_master", actionKey: "report_view" },
                ]}
              >
                <PollReport />
              </PermissionRoute>
            }
          />

          <Route
            path="/attendance"
            element={
              <PermissionRoute moduleKey="employee_attendance" actionKey="view">
                <AttendanceDashboard />
              </PermissionRoute>
            }
          />

          <Route
            path="/attendance/daily"
            element={
              <PermissionRoute
                anyOf={[
                  { moduleKey: "employee_attendance", actionKey: "add" },
                  { moduleKey: "employee_attendance", actionKey: "edit" },
                ]}
              >
                <AttendanceDailyEntry />
              </PermissionRoute>
            }
          />

          <Route
            path="/attendance/self"
            element={
              <PermissionRoute moduleKey="employee_attendance" actionKey="view">
                <SelfAttendance />
              </PermissionRoute>
            }
          />

          <Route
            path="/attendance/reports"
            element={
              <PermissionRoute moduleKey="attendance_reports" actionKey="report_view">
                <AttendanceReport />
              </PermissionRoute>
            }
          />

          <Route
            path="/attendance/regularization"
            element={
              <PermissionRoute moduleKey="attendance_regularization" actionKey="view">
                <AttendanceRegularization />
              </PermissionRoute>
            }
          />

          <Route
            path="/attendance/settings"
            element={
              <PermissionRoute moduleKey="attendance_settings" actionKey="view">
                <AttendanceSettings />
              </PermissionRoute>
            }
          />

          <Route
            path="/users"
            element={
              <PermissionRoute moduleKey="user_management" actionKey="view">
                <UsersAdmin />
              </PermissionRoute>
            }
          />

          <Route
            path="/permissions/roles"
            element={
              <PermissionRoute moduleKey="role_permission_setup" actionKey="view">
                <RolePermissionSetup />
              </PermissionRoute>
            }
          />

          <Route
            path="/module-settings"
            element={
              <PermissionRoute moduleKey="module_settings" actionKey="view">
                <ModuleSettings />
              </PermissionRoute>
            }
          />

          <Route
            path="/workflow-mapping"
            element={
              <PermissionRoute moduleKey="workflow_mapping" actionKey="view">
                <ModulePlaceholderPage
                  title="Workflow Mapping"
                  description="This module shell is now permission-enabled. You can map it to the final workflow setup UI next."
                />
              </PermissionRoute>
            }
          />

          <Route
            path="/approval-hierarchy"
            element={
              <PermissionRoute moduleKey="approval_hierarchy" actionKey="view">
                <ModulePlaceholderPage
                  title="Approval Hierarchy"
                  description="This approval hierarchy screen is permission-ready and protected by role/user overrides."
                />
              </PermissionRoute>
            }
          />

          <Route
            path="/shared-tasks"
            element={
              <PermissionRoute moduleKey="shared_task" actionKey="view">
                <ModulePlaceholderPage
                  title="Shared Task"
                  description="The dedicated shared-task module shell is ready for future workflow expansion."
                />
              </PermissionRoute>
            }
          />

          <Route
            path="/notifications"
            element={
              <PermissionRoute moduleKey="notifications" actionKey="view">
                <ModulePlaceholderPage
                  title="Notifications"
                  description="Notification access is now role-aware. This screen shell can be expanded into a full notification center."
                />
              </PermissionRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <PermissionRoute moduleKey="settings_masters" actionKey="view">
                <ModulePlaceholderPage
                  title="Settings / Masters"
                  description="General settings and master-shell routing are now protected by the permission matrix."
                />
              </PermissionRoute>
            }
          />

          <Route
            path="/"
            element={
              hasSession() ? (
                shouldShowPostLoginWelcome() ? (
                  <Navigate to="/welcome" replace />
                ) : (
                  <AuthenticatedHomeRedirect />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="*"
            element={hasSession() ? <AuthenticatedHomeRedirect /> : <Navigate to="/login" replace />}
          />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ModuleSettingsProvider>
      <PermissionProvider>
        <AppRoutes />
      </PermissionProvider>
    </ModuleSettingsProvider>
  );
}
