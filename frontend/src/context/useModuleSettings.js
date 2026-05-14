import { useContext } from "react";
import {
  MODULE_FLAGS,
  areAllPermissionModulesDisabled,
  isModuleEnabled,
  isPermissionModuleEnabled,
  isRouteModuleEnabled,
} from "../config/modules";
import ModuleSettingsContext from "./moduleSettingsContextStore";

export function useModuleSettings() {
  const context = useContext(ModuleSettingsContext);

  if (context) {
    return context;
  }

  return {
    flags: MODULE_FLAGS,
    loading: false,
    refreshModuleFlags: async () => MODULE_FLAGS,
    isModuleEnabled: (moduleKey) => isModuleEnabled(moduleKey, MODULE_FLAGS),
    isPermissionModuleEnabled: (moduleKey) =>
      isPermissionModuleEnabled(moduleKey, MODULE_FLAGS),
    areAllPermissionModulesDisabled: (permissionChecks) =>
      areAllPermissionModulesDisabled(permissionChecks, MODULE_FLAGS),
    isRouteModuleEnabled: (path) => isRouteModuleEnabled(path, MODULE_FLAGS),
  };
}
