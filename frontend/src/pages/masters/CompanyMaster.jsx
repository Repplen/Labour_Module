import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/axios";
import SearchableCheckboxSelector from "../../components/SearchableCheckboxSelector";
import ConfirmDialog from "../../components/ConfirmDialog";
import Toast from "../../components/Toast";
import { showToast } from "../../utils/toastUtils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getEmployeeDirectorLabel = (employee) => {
  const code = String(employee?.employeeCode || "").trim();
  const name = String(employee?.employeeName || "").trim();
  if (code && name) return `${code} - ${name}`;
  return code || name;
};

const buildDirectorSelectionState = (savedDirectorNames = [], employeeRows = []) => {
  const normalizedSaved = Array.isArray(savedDirectorNames)
    ? savedDirectorNames.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  const byLookup = new Map();
  employeeRows.forEach((employee) => {
    const employeeId = String(employee._id || "");
    const label = getEmployeeDirectorLabel(employee);
    const lookups = [
      label,
      String(employee.employeeName || "").trim(),
      String(employee.employeeCode || "").trim(),
    ]
      .map((item) => item.toLowerCase())
      .filter(Boolean);
    lookups.forEach((item) => {
      if (!byLookup.has(item)) byLookup.set(item, employeeId);
    });
  });

  const selectedEmployeeIds = [];
  const legacyDirectorNames = [];
  const seenIds = new Set();

  normalizedSaved.forEach((item) => {
    const matchId = byLookup.get(item.toLowerCase());
    if (matchId) {
      if (!seenIds.has(matchId)) {
        seenIds.add(matchId);
        selectedEmployeeIds.push(matchId);
      }
      return;
    }
    legacyDirectorNames.push(item);
  });

  return { selectedEmployeeIds, legacyDirectorNames };
};

const getBackendError = (err) => {
  const data = err?.response?.data;
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  if (errors.length > 0) return errors[0]?.message || "";
  if (data?.message) return data.message;
  return "Something went wrong. Please try again.";
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CompanyMaster() {
  const [companies, setCompanies]                     = useState([]);
  const [employees, setEmployees]                     = useState([]);
  const [name, setName]                               = useState("");
  const [directorEmployeeIds, setDirectorEmployeeIds] = useState([]);
  const [legacyDirectorNames, setLegacyDirectorNames] = useState([]);
  const [editingId, setEditingId]                     = useState("");
  const [loading, setLoading]                         = useState(false);
  const [deleteLoading, setDeleteLoading]             = useState(false);
  const [nameError, setNameError]                     = useState("");
  const [deleteTarget, setDeleteTarget]               = useState(null);
  const [nameTouched, setNameTouched]                 = useState(false);

  // Toast state: { show, message, variant }
  const [toast, setToast] = useState({ show: false, message: "", variant: "success" });

  const formRef = useRef(null);
  const fetchVersionRef = useRef(0);

  useEffect(() => {
    fetchCompanies();
    fetchEmployees();
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const employeeOptions = useMemo(
    () =>
      [...employees]
        .sort((a, b) =>
          getEmployeeDirectorLabel(a).localeCompare(getEmployeeDirectorLabel(b))
        )
        .map((employee) => ({
          value: employee._id,
          label: getEmployeeDirectorLabel(employee),
        })),
    [employees]
  );

  const liveNameError = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) return nameTouched ? "Company name is required." : "";
    if (trimmed.length < 2) return "Company name must be at least 2 characters.";
    if (trimmed.length > 100) return "Company name must not exceed 100 characters.";
    if (!/[a-zA-Z0-9]/.test(trimmed)) return "Company name must contain at least one letter or number.";
    const isDuplicate = companies.some(
      (c) =>
        String(c._id) !== String(editingId) &&
        c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    return isDuplicate ? "This company name already exists." : "";
  }, [name, companies, editingId, nameTouched]);

  const displayError = liveNameError || nameError;

  // ── API ─────────────────────────────────────────────────────────────────────

  const fetchCompanies = async () => {
    const version = ++fetchVersionRef.current;
    try {
      const res = await api.get("/companies");
      if (version !== fetchVersionRef.current) return;
      setCompanies(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (version !== fetchVersionRef.current) return;
      console.error("Load companies failed:", err);
      setCompanies([]);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/employees");
      setEmployees(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Load employees failed:", err);
      setEmployees([]);
    }
  };

  // ── Form ─────────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setName("");
    setDirectorEmployeeIds([]);
    setLegacyDirectorNames([]);
    setEditingId("");
    setNameError("");
    setNameTouched(false);
  };

  const saveCompany = async () => {
    if (!name.trim()) {
      setNameTouched(true);
      return;
    }
    if (liveNameError) return;
    setLoading(true);
    setNameError("");
    try {
      const payload = {
        name: name.trim(),
        directorEmployeeIds,
        directorNames: legacyDirectorNames,
      };
      if (editingId) {
        await api.put(`/companies/${editingId}`, payload);
        showToast(setToast, "Company updated successfully!");
      } else {
        await api.post("/companies", payload);
        showToast(setToast, "Company added successfully!");
      }
      resetForm();
      fetchCompanies();
    } catch (err) {
      setNameError(getBackendError(err));
    } finally {
      setLoading(false);
    }
  };

  const editRow = (row) => {
    const { selectedEmployeeIds, legacyDirectorNames: legacyNames } =
      buildDirectorSelectionState(row.directorNames || [], employees);
    setName(row.name || "");
    setDirectorEmployeeIds(selectedEmployeeIds);
    setLegacyDirectorNames(legacyNames);
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
      await api.delete(`/companies/${deleteTarget.id}`);
      if (editingId === deleteTarget.id) resetForm();
      setNameError("");
      setCompanies((prev) =>
        prev.filter((c) => String(c._id) !== String(deleteTarget.id))
      );
      fetchCompanies();
      showToast(setToast, `"${deleteTarget.name}" deleted successfully!`);
    } catch (err) {
      showToast(setToast, err.response?.data?.message || "Delete failed.", "error");
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="container mt-4 mb-5">

      {/* ── Reusable confirm dialog ── */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        variant="danger"
        title="Delete Company"
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

      {/* ── Reusable toast ── */}
      <Toast
        toast={toast}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />

      {/* ── Page header ── */}
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Masters</div>
            <h3 className="mb-1">Company Master</h3>
            <p className="page-subtitle mb-0">
              Maintain company names and director mappings with searchable selections.
            </p>
          </div>
          <div className="list-summary">
            <span className="summary-chip">{companies.length} companies</span>
            <span className="summary-chip summary-chip--neutral">
              {directorEmployeeIds.length} directors selected
            </span>
          </div>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="soft-card mb-4" ref={formRef}>
        <div className="row g-3">
          <div className="col-lg-4">
            <label className="form-label fw-semibold">Company Name</label>
            <input
              className={`form-control${displayError ? " is-invalid" : ""}`}
              placeholder="Company Name"
              value={name}
              maxLength={100}
              onChange={(e) => {
                setName(e.target.value);
                setNameError("");
                setNameTouched(true);
              }}
              aria-invalid={displayError ? "true" : "false"}
              aria-describedby={displayError ? "company-name-error" : undefined}
            />
            {displayError && (
              <div className="invalid-feedback d-block" id="company-name-error">
                {displayError}
              </div>
            )}
          </div>

          <div className="col-lg-8">
            <SearchableCheckboxSelector
              label="Company Directors"
              helperText="Pick one or more directors from the employee master."
              options={employeeOptions}
              selectedValues={directorEmployeeIds}
              onChange={setDirectorEmployeeIds}
              searchPlaceholder="Search directors"
              emptyMessage="No employees are available to map as directors yet."
            />
          </div>
        </div>

        {legacyDirectorNames.length > 0 && (
          <div className="alert alert-warning py-2 mt-3 mb-0 d-flex justify-content-between align-items-center gap-2">
            <span>Legacy company directors preserved: {legacyDirectorNames.join(", ")}</span>
            <button
              type="button"
              className="btn btn-sm btn-outline-warning"
              onClick={() => setLegacyDirectorNames([])}
            >
              Clear Legacy
            </button>
          </div>
        )}

        <div className="d-flex gap-2 mt-3">
          <button
            className="btn btn-success"
            onClick={saveCompany}
            disabled={loading || Boolean(liveNameError)}
          >
            {loading ? "Saving..." : editingId ? "Update Company" : "Save Company"}
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
          <table className="table table-bordered table-hover align-middle">
            <thead className="table-light">
              <tr>
                <th>#</th>
                <th>Company</th>
                <th>Company Directors</th>
                <th width="170">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-4">
                    No companies found
                  </td>
                </tr>
              ) : (
                companies.map((company, index) => (
                  <tr key={company._id}>
                    <td>{index + 1}</td>
                    <td>{company.name}</td>
                    <td>
                      {company.directorNames?.length
                        ? company.directorNames.join(", ")
                        : "-"}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-warning me-2"
                        onClick={() => editRow(company)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() =>
                          setDeleteTarget({ id: company._id, name: company.name })
                        }
                      >
                        Delete
                      </button>
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
