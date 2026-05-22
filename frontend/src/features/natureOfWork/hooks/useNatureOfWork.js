import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createChildNatureOfWork,
  createNatureOfWork,
  deleteNatureOfWork,
  getNatureOfWorks,
  updateNatureOfWork,
  updateNatureOfWorkStatus,
} from "../services/natureOfWork.service";
import { getActiveUoms } from "../services/uom.service";

export function useNatureOfWork(queryParams = {}) {
  const [works, setWorks] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const stableQuery = useMemo(() => JSON.stringify(queryParams), [queryParams]);

  const loadWorks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getNatureOfWorks(JSON.parse(stableQuery));
      setWorks(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err.userMessage || err.response?.data?.message || "Failed to load nature of work.");
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
    void loadWorks();
  }, [loadWorks]);

  const saveWork = async ({ mode, values, editingWork }) => {
    setSaving(true);
    setError("");
    try {
      if (mode === "edit" && editingWork?._id) {
        await updateNatureOfWork(editingWork._id, values);
      } else if (values.parentWorkId) {
        await createChildNatureOfWork(values.parentWorkId, values);
      } else {
        await createNatureOfWork(values);
      }
      await loadWorks();
      return { success: true };
    } catch (err) {
      const message =
        err.response?.data?.errors?.[0]?.message ||
        err.userMessage ||
        err.response?.data?.message ||
        "Failed to save nature of work.";
      setError(message);
      return { success: false, message, errors: err.response?.data?.errors || [] };
    } finally {
      setSaving(false);
    }
  };

  const removeWork = async (workId, options = {}) => {
    setSaving(true);
    setError("");
    try {
      await deleteNatureOfWork(workId, options);
      await loadWorks();
      return { success: true };
    } catch (err) {
      const message =
        err.response?.data?.errors?.[0]?.message ||
        err.userMessage ||
        err.response?.data?.message ||
        "Failed to delete nature of work.";
      setError(message);
      return { success: false, message, errors: err.response?.data?.errors || [] };
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (workId, payload) => {
    setSaving(true);
    setError("");
    try {
      await updateNatureOfWorkStatus(workId, payload);
      await loadWorks();
      return { success: true };
    } catch (err) {
      const message =
        err.response?.data?.errors?.[0]?.message ||
        err.userMessage ||
        err.response?.data?.message ||
        "Failed to update nature of work status.";
      setError(message);
      return { success: false, message, errors: err.response?.data?.errors || [] };
    } finally {
      setSaving(false);
    }
  };

  return { changeStatus, error, loading, refresh: loadWorks, removeWork, saveWork, saving, uoms, works };
}
