import { useCallback, useEffect, useMemo, useState } from "react";
import { getActiveNatureOfWorks } from "../../natureOfWork/services/natureOfWork.service";
import { getActiveUoms } from "../../natureOfWork/services/uom.service";
import {
  createLabourPieceWorker,
  deleteLabourPieceWorker,
  getLabourPieceWorkers,
  updateLabourPieceWorker,
  updateLabourPieceWorkerStatus,
} from "../services/labourPieceWorker.service";

export function useLabourPieceWorkers(queryParams = {}) {
  const [workers, setWorkers] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [natureOfWorks, setNatureOfWorks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const stableQuery = useMemo(() => JSON.stringify(queryParams), [queryParams]);

  const loadWorkers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getLabourPieceWorkers(JSON.parse(stableQuery));
      setWorkers(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err.userMessage || err.response?.data?.message || "Failed to load labour/piece workers.");
    } finally {
      setLoading(false);
    }
  }, [stableQuery]);

  const loadOptions = useCallback(async () => {
    try {
      const [uomResponse, natureResponse] = await Promise.all([
        getActiveUoms(),
        getActiveNatureOfWorks(),
      ]);
      setUoms(Array.isArray(uomResponse.data) ? uomResponse.data : []);
      setNatureOfWorks(Array.isArray(natureResponse.data) ? natureResponse.data : []);
    } catch (err) {
      setError(err.userMessage || err.response?.data?.message || "Failed to load dropdown options.");
    }
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    void loadWorkers();
  }, [loadWorkers]);

  const saveWorker = async ({ mode, values, editingWorker }) => {
    setSaving(true);
    setError("");
    try {
      if (mode === "edit" && editingWorker?._id) {
        await updateLabourPieceWorker(editingWorker._id, values);
      } else {
        await createLabourPieceWorker(values);
      }
      await loadWorkers();
      return { success: true };
    } catch (err) {
      const message =
        err.response?.data?.errors?.[0]?.message ||
        err.userMessage ||
        err.response?.data?.message ||
        "Failed to save labour/piece worker.";
      setError(message);
      return { success: false, message, errors: err.response?.data?.errors || [] };
    } finally {
      setSaving(false);
    }
  };

  const removeWorker = async (workerId) => {
    setSaving(true);
    setError("");
    try {
      await deleteLabourPieceWorker(workerId);
      await loadWorkers();
      return { success: true };
    } catch (err) {
      const message =
        err.response?.data?.errors?.[0]?.message ||
        err.userMessage ||
        err.response?.data?.message ||
        "Failed to delete labour/piece worker.";
      setError(message);
      return { success: false, message, errors: err.response?.data?.errors || [] };
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (workerId, payload) => {
    setSaving(true);
    setError("");
    try {
      await updateLabourPieceWorkerStatus(workerId, payload);
      await loadWorkers();
      return { success: true };
    } catch (err) {
      const message =
        err.response?.data?.errors?.[0]?.message ||
        err.userMessage ||
        err.response?.data?.message ||
        "Failed to update labour/piece worker status.";
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
    natureOfWorks,
    refresh: loadWorkers,
    removeWorker,
    saveWorker,
    saving,
    uoms,
    workers,
  };
}
