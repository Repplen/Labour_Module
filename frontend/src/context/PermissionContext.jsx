import { useEffect, useMemo, useState } from "react";
import { getCurrentPermissionProfile } from "../api/permissionApi";
import {
  clearPostLoginWelcomeSession,
  getPostLoginDestination,
  getStoredUser,
} from "../utils/postLoginWelcome";
import { useModuleSettings } from "./useModuleSettings";
import PermissionContext from "./permissionContextStore";

const hasSession = () => Boolean(localStorage.getItem("token")) && Boolean(getStoredUser());

const clearStoredSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  clearPostLoginWelcomeSession();
};

const defaultScope = {
  strategy: "mapped",
  companyIds: [],
  siteIds: [],
  departmentIds: [],
  subDepartmentIds: [],
  employeeIds: [],
};

const buildDefaultState = () => {
  const storedUser = getStoredUser();

  return {
    loading: false,
    user: storedUser,
    role: null,
    modules: [],
    permissions: {},
    scope: defaultScope,
    homePath: getPostLoginDestination(storedUser),
  };
};

const buildPermissionState = (responseData = {}, fallbackUser = getStoredUser()) => {
  const nextUser = responseData.user || fallbackUser;

  if (nextUser) {
    localStorage.setItem("user", JSON.stringify(nextUser));
  }

  return {
    loading: false,
    user: nextUser,
    role: responseData.role || null,
    modules: Array.isArray(responseData.modules) ? responseData.modules : [],
    permissions: responseData.permissions || {},
    scope: responseData.scope || defaultScope,
    homePath:
      responseData.homePath || nextUser?.homePath || getPostLoginDestination(nextUser),
  };
};

export function PermissionProvider({ children }) {
  const { isPermissionModuleEnabled } = useModuleSettings();
  const [state, setState] = useState(() => ({
    ...buildDefaultState(),
    loading: hasSession(),
  }));

  useEffect(() => {
    let active = true;

    if (!hasSession()) {
      return undefined;
    }

    const loadPermissions = async () => {
      setState((currentValue) => ({
        ...currentValue,
        loading: true,
      }));

      try {
        const response = await getCurrentPermissionProfile();
        if (!active) return;

        setState(buildPermissionState(response.data));
      } catch (error) {
        if (!active) return;

        if ([401, 403].includes(error?.response?.status)) {
          clearStoredSession();
        }

        setState(buildDefaultState());
      }
    };

    void loadPermissions();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => {
    const moduleMap = new Map(
      (state.modules || []).map((moduleItem) => [moduleItem.key, moduleItem])
    );

    const can = (moduleKey, actionKey = "view") => {
      if (!isPermissionModuleEnabled(moduleKey)) return false;

      const permissionRow = state.permissions?.[moduleKey];
      if (!permissionRow) return false;

      const actionFieldMap = {
        view: "canView",
        add: "canAdd",
        edit: "canEdit",
        delete: "canDelete",
        approve: "canApprove",
        reject: "canReject",
        status_update: "canStatusUpdate",
        transfer: "canTransfer",
        export: "canExport",
        report_view: "canReportView",
      };

      return Boolean(permissionRow[actionFieldMap[actionKey]]);
    };

    const canAny = (permissionChecks = []) =>
      permissionChecks.some(({ moduleKey, actionKey = "view" }) => can(moduleKey, actionKey));

    const getModule = (moduleKey) => moduleMap.get(moduleKey) || null;
    const getVisibleModules = () =>
      (state.modules || []).filter(
        (moduleItem) => isPermissionModuleEnabled(moduleItem.key) && can(moduleItem.key, "view")
      );
    const getHomePath = () =>
      state.homePath || state.user?.homePath || getPostLoginDestination(state.user);

    return {
      ...state,
      can,
      canAny,
      getHomePath,
      getModule,
      getVisibleModules,
      refresh: async () => {
        const response = await getCurrentPermissionProfile();
        setState(buildPermissionState(response.data));
      },
    };
  }, [isPermissionModuleEnabled, state]);

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}
