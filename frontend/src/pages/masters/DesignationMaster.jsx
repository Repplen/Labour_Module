import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/axios";
import ConfirmDialog from "../../components/ConfirmDialog";
import Toast from "../../components/Toast";
import { showToast } from "../../utils/toastUtils";

const getBackendError = (err) => {
  const data = err?.response?.data;
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  if (errors.length > 0) return errors[0]?.message || "";
  if (data?.message) return data.message;
  return "Something went wrong. Please try again.";
};

export default function DesignationMaster() {
  const [list, setList]               = useState([]);
  const [name, setName]               = useState("");
  const [editingId, setEditingId]     = useState("");
  const [loading, setLoading]         = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [nameError, setNameError]     = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast]             = useState({ show: false, message: "", variant: "success" });

  const formRef = useRef(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await api.get("/designations");
      setList(res.data || []);
    } catch (err) {
      console.error("Load designations failed:", err);
      setList([]);
    }
  };

  // "required" only shows after user touches the field — same pattern as CompanyMaster
  const liveNameError = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) return nameTouched ? "Designation name is required." : "";
    if (trimmed.length < 2) return "Designation name must be at least 2 characters.";
    if (trimmed.length > 100) return "Designation name must not exceed 100 characters.";
    if (!/[a-zA-Z0-9]/.test(trimmed))
      return "Designation name must contain at least one letter or number.";
    const isDuplicate = list.some(
      (d) =>
        String(d._id) !== String(editingId) &&
        d.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    return isDuplicate ? "This designation name already exists." : "";
  }, [name, list, editingId, nameTouched]);

  const displayError = liveNameError || nameError;

  const resetForm = () => {
    setName("");
    setEditingId("");
    setNameError("");
    setNameTouched(false);
  };

  const saveData = async () => {
    if (!name.trim()) {
      setNameTouched(true);
      return;
    }
    if (liveNameError) return;

    setLoading(true);
    setNameError("");
    try {
      if (editingId) {
        await api.put(`/designations/${editingId}`, { name: name.trim() });
        showToast(setToast, "Designation updated successfully!");
      } else {
        await api.post("/designations", { name: name.trim() });
        showToast(setToast, "Designation added successfully!");
      }
      resetForm();
      fetchData();
    } catch (err) {
      setNameError(getBackendError(err));
    } finally {
      setLoading(false);
    }
  };

  const editRow = (row) => {
    setName(row.name || "");
    setEditingId(row._id);
    setNameError("");
    setNameTouched(false);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/designations/${deleteTarget.id}`);
      if (editingId === deleteTarget.id) resetForm();
      setList((prev) => prev.filter((d) => String(d._id) !== String(deleteTarget.id)));
      fetchData();
      showToast(setToast, `"${deleteTarget.name}" deleted successfully!`);
    } catch (err) {
      showToast(setToast, err.response?.data?.message || "Delete failed.", "error");
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="container mt-4 mb-5">

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        variant="danger"
        title="Delete Designation"
        message={
          <>
            Are you sure you want to delete{" "}
            <strong>{deleteTarget?.name}</strong>?{" "}
            This action cannot be undone.
          </>
        }
        confirmLabel="Yes, Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleteLoading}
      />

      <Toast
        toast={toast}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />

      {/* ── Page header ── */}
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Masters</div>
            <h3 className="mb-1">Designation Master</h3>
            <p className="page-subtitle mb-0">
              Maintain designation names used across employee and workflow setup.
            </p>
          </div>
          <div className="list-summary">
            <span className="summary-chip">{list.length} designations</span>
          </div>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="soft-card mb-4" ref={formRef}>
        <div className="row g-3">
          <div className="col-lg-4">
            <label className="form-label fw-semibold">Designation Name</label>
            <input
              className={`form-control${displayError ? " is-invalid" : ""}`}
              placeholder="e.g. Software Engineer"
              value={name}
              maxLength={100}
              onChange={(e) => {
                setName(e.target.value);
                setNameError("");
                setNameTouched(true);
              }}
              aria-invalid={displayError ? "true" : "false"}
              aria-describedby={displayError ? "designation-name-error" : undefined}
            />
            {displayError && (
              <div className="invalid-feedback d-block" id="designation-name-error">
                {displayError}
              </div>
            )}
          </div>
        </div>

        <div className="d-flex gap-2 mt-3">
          <button
            className="btn btn-success"
            onClick={saveData}
            disabled={loading || Boolean(liveNameError)}
          >
            {loading ? "Saving..." : editingId ? "Update Designation" : "Save Designation"}
          </button>
          {editingId && (
            <button className="btn btn-outline-secondary" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="table-shell">
        <div className="table-responsive">
          <table className="table table-bordered table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>#</th>
                <th>Designation</th>
                <th width="170">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan="3" className="text-center py-4 text-muted">
                    No designations found
                  </td>
                </tr>
              ) : (
                list.map((d, i) => (
                  <tr key={d._id}>
                    <td>{i + 1}</td>
                    <td>{d.name}</td>
                    <td>
                      <div className="d-flex gap-2">
                        <button className="btn btn-sm btn-warning" onClick={() => editRow(d)}>
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => setDeleteTarget({ id: d._id, name: d.name })}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
