import { useEffect, useMemo, useRef, useState } from "react";
import {
  createDesignation,
  deleteDesignationById,
  getDesignations,
  updateDesignation,
} from "../../services/designation.service";
import {
  getBackendError,
  getDesignationNameError,
} from "../../validators/designation.validator";
import { showToast } from "../../utils/toastUtils";

export const useDesignationMaster = () => {
  const [designations, setDesignations] = useState([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [serverNameError, setServerNameError] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "", variant: "success" });

  const formRef = useRef(null);

  const fetchDesignations = async () => {
    try {
      const res = await getDesignations();
      setDesignations(res.data || []);
    } catch (err) {
      console.error("Load designations failed:", err);
      setDesignations([]);
    }
  };

  useEffect(() => {
    fetchDesignations();
  }, []);

  const liveNameError = useMemo(
    () =>
      getDesignationNameError({
        name,
        designations,
        editingId,
        shouldShowRequired: nameTouched,
      }),
    [designations, editingId, name, nameTouched]
  );

  const displayError = liveNameError || serverNameError;

  const resetForm = () => {
    setName("");
    setEditingId("");
    setServerNameError("");
    setNameTouched(false);
  };

  const saveDesignation = async () => {
    if (!name.trim()) {
      setNameTouched(true);
      return;
    }
    if (liveNameError) return;

    setLoading(true);
    setServerNameError("");
    try {
      if (editingId) {
        await updateDesignation(editingId, { name: name.trim() });
        showToast(setToast, "Designation updated successfully!");
      } else {
        await createDesignation({ name: name.trim() });
        showToast(setToast, "Designation added successfully!");
      }

      resetForm();
      fetchDesignations();
    } catch (err) {
      setServerNameError(getBackendError(err));
    } finally {
      setLoading(false);
    }
  };

  const editDesignation = (row) => {
    setName(row.name || "");
    setEditingId(row._id);
    setServerNameError("");
    setNameTouched(false);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleteLoading(true);
    try {
      await deleteDesignationById(deleteTarget.id);
      if (editingId === deleteTarget.id) resetForm();
      setDesignations((prev) =>
        prev.filter((designation) => String(designation._id) !== String(deleteTarget.id))
      );
      fetchDesignations();
      showToast(setToast, `"${deleteTarget.name}" deleted successfully!`);
    } catch (err) {
      showToast(setToast, err.response?.data?.message || "Delete failed.", "error");
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  return {
    confirmDialog: {
      confirmDelete,
      deleteLoading,
      deleteTarget,
      setDeleteTarget,
    },
    form: {
      displayError,
      editingId,
      formRef,
      liveNameError,
      loading,
      name,
      resetForm,
      saveDesignation,
      setName: (value) => {
        setName(value);
        setServerNameError("");
        setNameTouched(true);
      },
    },
    header: {
      designationCount: designations.length,
    },
    table: {
      designations,
      editDesignation,
      setDeleteTarget,
    },
    toastState: {
      closeToast: () => setToast((current) => ({ ...current, show: false })),
      toast,
    },
  };
};
