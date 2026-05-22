import { useCallback, useEffect, useMemo, useState } from "react";
import { getSites } from "../../../services/site.service";
import {
  createChildMainLocation,
  createMainLocation,
  deleteMainLocation,
  getMainLocations,
  updateMainLocation,
  updateMainLocationStatus,
} from "../services/mainLocation.service";

export function useMainLocations(queryParams = {}) {
  const [locations, setLocations] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const stableQuery = useMemo(() => JSON.stringify(queryParams), [queryParams]);

  const loadLocations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getMainLocations(JSON.parse(stableQuery));
      setLocations(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err.userMessage || err.response?.data?.message || "Failed to load locations.");
    } finally {
      setLoading(false);
    }
  }, [stableQuery]);

  const loadSites = useCallback(async () => {
    try {
      const response = await getSites();
      setSites(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err.userMessage || err.response?.data?.message || "Failed to load sites.");
    }
  }, []);

  useEffect(() => {
    void loadSites();
  }, [loadSites]);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  const saveLocation = async ({ mode, values, editingLocation }) => {
    setSaving(true);
    setError("");

    try {
      if (mode === "edit" && editingLocation?._id) {
        await updateMainLocation(editingLocation._id, { locationName: values.locationName });
      } else if (values.parentLocationId) {
        await createChildMainLocation(values.parentLocationId, {
          locationName: values.locationName,
        });
      } else {
        await createMainLocation({
          siteId: values.siteId,
          locationName: values.locationName,
        });
      }

      await loadLocations();
      return { success: true };
    } catch (err) {
      const message =
        err.response?.data?.errors?.[0]?.message ||
        err.userMessage ||
        err.response?.data?.message ||
        "Failed to save location.";
      setError(message);
      return { success: false, message, errors: err.response?.data?.errors || [] };
    } finally {
      setSaving(false);
    }
  };

  const removeLocation = async (locationId, options = {}) => {
    setSaving(true);
    setError("");

    try {
      await deleteMainLocation(locationId, options);
      await loadLocations();
      return { success: true };
    } catch (err) {
      const message =
        err.response?.data?.errors?.[0]?.message ||
        err.userMessage ||
        err.response?.data?.message ||
        "Failed to delete location.";
      setError(message);
      return { success: false, message, errors: err.response?.data?.errors || [] };
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (locationId, payload) => {
    setSaving(true);
    setError("");

    try {
      await updateMainLocationStatus(locationId, payload);
      await loadLocations();
      return { success: true };
    } catch (err) {
      const message =
        err.response?.data?.errors?.[0]?.message ||
        err.userMessage ||
        err.response?.data?.message ||
        "Failed to update location status.";
      setError(message);
      return { success: false, message, errors: err.response?.data?.errors || [] };
    } finally {
      setSaving(false);
    }
  };

  return {
    error,
    loading,
    locations,
    refresh: loadLocations,
    saveLocation,
    saving,
    sites,
    removeLocation,
    changeStatus,
  };
}
