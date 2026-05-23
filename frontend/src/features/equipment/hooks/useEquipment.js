import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createEquipment,
  deleteEquipment,
  getEquipment,
  updateEquipment,
  updateEquipmentStatus,
} from "../services/equipment.service";
import { getActiveUoms } from "../../natureOfWork/services/uom.service";

export function useEquipment(queryParams = {}) {
  const [equipment, setEquipment] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const stableQuery = useMemo(() => JSON.stringify(queryParams), [queryParams]);

  const loadEquipment = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getEquipment(JSON.parse(stableQuery));
      setEquipment(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err.userMessage || err.response?.data?.message || "Failed to load equipment.");
    } finally {
      setLoading(false);
    }
  }, [stableQuery]);

  const loadUoms = useCallback(async () => {
    try {
      const response = await getActiveUoms();
      setUoms(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err.userMessage || err.response?.data?.message || "Failed to load UOMs.");
    }
  }, []);

  useEffect(() => {
    void loadUoms();
  }, [loadUoms]);

  useEffect(() => {
    void loadEquipment();
  }, [loadEquipment]);

  const saveEquipment = async ({ mode, values, editingEquipment }) => {
    setSaving(true);
    setError("");
    try {
      if (mode === "edit" && editingEquipment?._id) {
        await updateEquipment(editingEquipment._id, values);
      } else {
        await createEquipment(values);
      }
      await loadEquipment();
      return { success: true };
    } catch (err) {
      const message =
        err.response?.data?.errors?.[0]?.message ||
        err.userMessage ||
        err.response?.data?.message ||
        "Failed to save equipment.";
      setError(message);
      return { success: false, message, errors: err.response?.data?.errors || [] };
    } finally {
      setSaving(false);
    }
  };

  const removeEquipment = async (equipmentId) => {
    setSaving(true);
    setError("");
    try {
      await deleteEquipment(equipmentId);
      await loadEquipment();
      return { success: true };
    } catch (err) {
      const message =
        err.response?.data?.errors?.[0]?.message ||
        err.userMessage ||
        err.response?.data?.message ||
        "Failed to delete equipment.";
      setError(message);
      return { success: false, message, errors: err.response?.data?.errors || [] };
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (equipmentId, payload) => {
    setSaving(true);
    setError("");
    try {
      await updateEquipmentStatus(equipmentId, payload);
      await loadEquipment();
      return { success: true };
    } catch (err) {
      const message =
        err.response?.data?.errors?.[0]?.message ||
        err.userMessage ||
        err.response?.data?.message ||
        "Failed to update equipment status.";
      setError(message);
      return { success: false, message, errors: err.response?.data?.errors || [] };
    } finally {
      setSaving(false);
    }
  };

  return {
    changeStatus,
    equipment,
    error,
    loading,
    refresh: loadEquipment,
    removeEquipment,
    saveEquipment,
    saving,
    uoms,
  };
}
