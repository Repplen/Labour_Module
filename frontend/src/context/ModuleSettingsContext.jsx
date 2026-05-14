import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import {
  MODULE_FLAGS,
  areAllPermissionModulesDisabled,
  isModuleEnabled,
  isPermissionModuleEnabled,
  isRouteModuleEnabled,
  mergeModuleFlags,
} from "../config/modules";
import ModuleSettingsContext from "./moduleSettingsContextStore";

export function ModuleSettingsProvider({ children }) {
  const [flags, setFlags] = useState(MODULE_FLAGS);
  const [loading, setLoading] = useState(true);

  const refreshModuleFlags = useCallback(async () => {
    try {
      const response = await api.get("/module-settings/enabled");
      const nextFlags = mergeModuleFlags(response.data || {});
      setFlags(nextFlags);
      return nextFlags;
    } catch (error) {
      console.error("Module flags load failed:", error);
      const fallbackFlags = mergeModuleFlags();
      setFlags(fallbackFlags);
      return fallbackFlags;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshModuleFlags();
  }, [refreshModuleFlags]);

  const value = useMemo(
    () => ({
      flags,
      loading,
      refreshModuleFlags,
      isModuleEnabled: (moduleKey) => isModuleEnabled(moduleKey, flags),
      isPermissionModuleEnabled: (moduleKey) => isPermissionModuleEnabled(moduleKey, flags),
      areAllPermissionModulesDisabled: (permissionChecks) =>
        areAllPermissionModulesDisabled(permissionChecks, flags),
      isRouteModuleEnabled: (path) => isRouteModuleEnabled(path, flags),
    }),
    [flags, loading, refreshModuleFlags]
  );

  return (
    <ModuleSettingsContext.Provider value={value}>
      {children}
    </ModuleSettingsContext.Provider>
  );
}
