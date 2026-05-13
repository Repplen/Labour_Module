import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";

const duplicateDesignationMessage = "This designation name already exists.";

const normalizeMasterName = (value) => String(value || "").trim().toLowerCase();

const getApiNameDuplicateError = (error) => {
  const errors = Array.isArray(error?.response?.data?.errors)
    ? error.response.data.errors
    : [];
  const hasNameError = errors.some(
    (row) => String(row?.field || row?.path || "").trim() === "name"
  );

  if (hasNameError || error?.response?.status === 409) {
    return duplicateDesignationMessage;
  }

  return "";
};

export default function DesignationMaster() {
  const [list, setList] = useState([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverNameError, setServerNameError] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get("/designations");
      setList(res.data || []);
    } catch (err) {
      console.error("Load designations failed:", err);
      setList([]);
    }
  };
  const clientNameError = useMemo(() => {
    const nextName = normalizeMasterName(name);
    if (!nextName) return "";

    const hasDuplicate = list.some(
      (designation) =>
        String(designation?._id || "") !== String(editingId || "") &&
        normalizeMasterName(designation?.name) === nextName
    );

    return hasDuplicate ? duplicateDesignationMessage : "";
  }, [editingId, list, name]);
  const nameError = clientNameError || serverNameError;
  const hasDuplicateError = Boolean(nameError);

  const resetForm = () => {
    setName("");
    setEditingId("");
    setServerNameError("");
  };

  const saveData = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return alert("Enter designation");
    if (hasDuplicateError) return;

    setLoading(true);
    setServerNameError("");
    try {
      if (editingId) {
        await api.put(`/designations/${editingId}`, { name: trimmedName });
      } else {
        await api.post("/designations", { name: trimmedName });
      }

      resetForm();
      fetchData();
    } catch (err) {
      const duplicateError = getApiNameDuplicateError(err);
      if (duplicateError) {
        setServerNameError(duplicateError);
        return;
      }

      alert(err.response?.data?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const editRow = (row) => {
    setName(row.name || "");
    setEditingId(row._id);
    setServerNameError("");
  };

  const deleteRow = async (id) => {
    if (!window.confirm("Delete this designation?")) return;

    try {
      await api.delete(`/designations/${id}`);
      if (editingId === id) resetForm();
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  return (
    <div className="container mt-4 mb-5">
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

      <div className="soft-card mb-4">
        <input
          className={`form-control${nameError ? " is-invalid" : " mb-2"}`}
          placeholder="Designation Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setServerNameError("");
          }}
          aria-invalid={nameError ? "true" : "false"}
          aria-describedby={nameError ? "designation-name-duplicate-error" : undefined}
        />
        {nameError ? (
          <div className="invalid-feedback d-block mb-2" id="designation-name-duplicate-error">
            {nameError}
          </div>
        ) : null}

        <div className="d-flex flex-wrap gap-2">
          <button
            className="btn btn-success"
            onClick={saveData}
            disabled={loading || hasDuplicateError}
          >
            {loading ? "Saving..." : editingId ? "Update" : "Save"}
          </button>
          {editingId && (
            <button className="btn btn-secondary" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="table-shell">
        <div className="table-responsive">
          <table className="table table-bordered mb-0">
            <thead>
              <tr>
                <th>#</th>
                <th>Designation</th>
                <th width="170">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d, i) => (
                <tr key={d._id}>
                  <td>{i + 1}</td>
                  <td>{d.name}</td>
                  <td>
                    <div className="d-flex flex-wrap gap-2">
                      <button className="btn btn-sm btn-warning" onClick={() => editRow(d)}>
                        Edit
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteRow(d._id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
