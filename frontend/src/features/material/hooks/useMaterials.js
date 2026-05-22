import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createMaterial,
  deleteMaterial,
  getMaterials,
  updateMaterial,
  updateMaterialStatus,
} from "../services/material.service";
import { getActiveUoms } from "../../natureOfWork/services/uom.service";

export function useMaterials(queryParams = {}) {
  const [materials, setMaterials] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const stableQuery = useMemo(() => JSON.stringify(queryParams), [queryParams]);

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getMaterials(JSON.parse(stableQuery));
      setMaterials(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err.userMessage || err.response?.data?.message || "Failed to load materials.");
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
    void loadMaterials();
  }, [loadMaterials]);

  const saveMaterial = async ({ mode, values, editingMaterial }) => {
    setSaving(true);
    setError("");
    try {
      if (mode === "edit" && editingMaterial?._id) {
        await updateMaterial(editingMaterial._id, values);
      } else {
        await createMaterial(values);
      }
      await loadMaterials();
      return { success: true };
    } catch (err) {
      const message =
        err.response?.data?.errors?.[0]?.message ||
        err.userMessage ||
        err.response?.data?.message ||
        "Failed to save material.";
      setError(message);
      return { success: false, message, errors: err.response?.data?.errors || [] };
    } finally {
      setSaving(false);
    }
  };

  const removeMaterial = async (materialId) => {
    setSaving(true);
    setError("");
    try {
      await deleteMaterial(materialId);
      await loadMaterials();
      return { success: true };
    } catch (err) {
      const message =
        err.response?.data?.errors?.[0]?.message ||
        err.userMessage ||
        err.response?.data?.message ||
        "Failed to delete material.";
      setError(message);
      return { success: false, message, errors: err.response?.data?.errors || [] };
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (materialId, payload) => {
    setSaving(true);
    setError("");
    try {
      await updateMaterialStatus(materialId, payload);
      await loadMaterials();
      return { success: true };
    } catch (err) {
      const message =
        err.response?.data?.errors?.[0]?.message ||
        err.userMessage ||
        err.response?.data?.message ||
        "Failed to update material status.";
      setError(message);
      return { success: false, message, errors: err.response?.data?.errors || [] };
    } finally {
      setSaving(false);
    }
  };

  return {
    changeStatus,
    error,
    loading,
    materials,
    refresh: loadMaterials,
    removeMaterial,
    saveMaterial,
    saving,
    uoms,
  };
}
