import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import SearchableCheckboxSelector from "../../components/SearchableCheckboxSelector";



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



const showToast = (setToast, message) => {
  setToast(message);
  setTimeout(() => setToast(""), 3000);
};



export default function CompanyMaster() {
  const [companies, setCompanies]                     = useState([]);
  const [employees, setEmployees]                     = useState([]);
  const [name, setName]                               = useState("");
  const [directorEmployeeIds, setDirectorEmployeeIds] = useState([]);
  const [legacyDirectorNames, setLegacyDirectorNames] = useState([]);
  const [editingId, setEditingId]                     = useState("");
  const [loading, setLoading]                         = useState(false);
  const [nameError, setNameError]                     = useState(""); // from backend only
  const [toast, setToast]                             = useState(""); // success message

  useEffect(() => {
    fetchCompanies();
    fetchEmployees();
  }, []);

  

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

  

  const fetchCompanies = async () => {
    try {
      const res = await api.get("/companies");
      setCompanies(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
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

  

  const resetForm = () => {
    setName("");
    setDirectorEmployeeIds([]);
    setLegacyDirectorNames([]);
    setEditingId("");
    setNameError("");
  };

  

  const saveCompany = async () => {
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

  // ── Edit ─────────────────────────────────────────────────────────────────────

  const editRow = (row) => {
    const { selectedEmployeeIds, legacyDirectorNames: legacyNames } =
      buildDirectorSelectionState(row.directorNames || [], employees);

    setName(row.name || "");
    setDirectorEmployeeIds(selectedEmployeeIds);
    setLegacyDirectorNames(legacyNames);
    setEditingId(row._id);
    setNameError("");
    setToast("");
  };

  

  const deleteRow = async (id) => {
    if (!window.confirm("Delete this company?")) return;

    try {
      await api.delete(`/companies/${id}`);
      if (editingId === id) resetForm();
      setNameError(""); 
      fetchCompanies();
      showToast(setToast, "Company deleted successfully!");
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="container mt-4 mb-5">

      {/* Success toast — auto hides after 3 seconds */}
      {toast && (
        <div
          className="alert alert-success alert-dismissible d-flex align-items-center gap-2 mb-3"
          role="alert"
        >
          <span>✓</span>
          <span>{toast}</span>
          <button
            type="button"
            className="btn-close ms-auto"
            onClick={() => setToast("")}
            aria-label="Close"
          />
        </div>
      )}

      {/* Page header */}
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

      {/* Form */}
      <div className="soft-card mb-4">
        <div className="row g-3">
          <div className="col-lg-4">
            <label className="form-label fw-semibold">Company Name</label>
            <input
              className={`form-control${nameError ? " is-invalid" : ""}`}
              placeholder="Company Name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(""); 
              }}
              aria-invalid={nameError ? "true" : "false"}
              aria-describedby={nameError ? "company-name-error" : undefined}
            />
            {nameError && (
              <div className="invalid-feedback d-block" id="company-name-error">
                {nameError}
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

        {/* Legacy director names */}
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

        {/* Buttons */}
        <div className="d-flex gap-2 mt-3">
          <button
            className="btn btn-success"
            onClick={saveCompany}
            disabled={loading}
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

      {/* Table */}
      <div className="table-shell">
        <div className="table-responsive">
          <table className="table table-bordered align-middle">
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
                        onClick={() => deleteRow(company._id)}
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
