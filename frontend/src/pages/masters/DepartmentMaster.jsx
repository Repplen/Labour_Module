import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import SearchableCheckboxSelector from "../../components/SearchableCheckboxSelector";
import { getApiFieldError, validateMasterName } from "../../utils/masterNameValidation";

const parseNames = (value) => {
  const seen = new Set();
  return String(value || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const getEmployeeHeadLabel = (employee) => {
  const code = String(employee?.employeeCode || "").trim();
  const name = String(employee?.employeeName || "").trim();
  if (code && name) return `${code} - ${name}`;
  return code || name;
};

const buildHeadSelectionState = (savedHeadNames = [], employeeRows = []) => {
  const normalizedSaved = Array.isArray(savedHeadNames)
    ? savedHeadNames.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  const byLookup = new Map();
  employeeRows.forEach((employee) => {
    const employeeId = String(employee._id || "");
    const label = getEmployeeHeadLabel(employee);
    const lookups = [
      label,
      String(employee.employeeName || "").trim(),
      String(employee.employeeCode || "").trim(),
    ]
      .map((item) => item.toLowerCase())
      .filter(Boolean);

    lookups.forEach((item) => {
      if (!byLookup.has(item)) {
        byLookup.set(item, employeeId);
      }
    });
  });

  const selectedEmployeeIds = [];
  const legacyHeadNames = [];
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

    legacyHeadNames.push(item);
  });

  return { selectedEmployeeIds, legacyHeadNames };
};

const duplicateDepartmentMessage = "This department name already exists.";

const normalizeMasterName = (value) => String(value || "").trim().toLowerCase();

const getApiNameDuplicateError = (error) => {
  const errors = Array.isArray(error?.response?.data?.errors)
    ? error.response.data.errors
    : [];
  const hasNameError = errors.some(
    (row) => String(row?.field || row?.path || "").trim() === "name"
  );

  if (error?.response?.status === 409 && hasNameError) {
    return duplicateDepartmentMessage;
  }

  return "";
};

export default function DepartmentMaster() {
  const [departments, setDepartments] = useState([]);
  const [name, setName] = useState("");
  const [employees, setEmployees] = useState([]);
  const [headEmployeeIds, setHeadEmployeeIds] = useState([]);
  const [legacyHeadNames, setLegacyHeadNames] = useState([]);
  const [departmentLeadEmployeeIds, setDepartmentLeadEmployeeIds] = useState([]);
  const [legacyDepartmentLeadNames, setLegacyDepartmentLeadNames] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverNameError, setServerNameError] = useState("");

  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedDepartmentName, setSelectedDepartmentName] = useState("");
  const [subPath, setSubPath] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [subName, setSubName] = useState("");
  const [subHeadEmployeeIds, setSubHeadEmployeeIds] = useState([]);
  const [legacySubHeadNames, setLegacySubHeadNames] = useState([]);
  const [subEditingId, setSubEditingId] = useState("");
  const [subLoading, setSubLoading] = useState(false);

  const currentSubLevel = subPath.length + 1;
  const currentParentId = subPath.length ? subPath[subPath.length - 1]._id : "";

  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await api.get("/departments");
      setDepartments(res.data || []);
    } catch (err) {
      console.error("Load departments failed:", err);
      setDepartments([]);
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

  const employeeOptions = useMemo(
    () =>
      [...employees].sort((left, right) =>
        getEmployeeHeadLabel(left).localeCompare(getEmployeeHeadLabel(right))
      ),
    [employees]
  );
  const employeeSelectionOptions = useMemo(
    () =>
      employeeOptions.map((employee) => ({
        value: employee._id,
        label: getEmployeeHeadLabel(employee),
      })),
    [employeeOptions]
  );
  const clientNameError = useMemo(() => {
    const validationMessage = validateMasterName(name, "Department");
    if (validationMessage) return validationMessage;

    const nextName = normalizeMasterName(name);

    const hasDuplicate = departments.some(
      (department) =>
        String(department?._id || "") !== String(editingId || "") &&
        normalizeMasterName(department?.name) === nextName
    );

    return hasDuplicate ? duplicateDepartmentMessage : "";
  }, [departments, editingId, name]);
  const nameError = clientNameError || serverNameError;
  const hasNameError = Boolean(nameError);
  const subNameError = useMemo(() => {
    const names = parseNames(subName);
    if (!names.length) return "";

    const invalidName = names
      .map((item) => validateMasterName(item, "Sub department"))
      .find(Boolean);

    return invalidName || "";
  }, [subName]);

  const resetDepartmentForm = () => {
    setName("");
    setHeadEmployeeIds([]);
    setLegacyHeadNames([]);
    setDepartmentLeadEmployeeIds([]);
    setLegacyDepartmentLeadNames([]);
    setEditingId("");
    setServerNameError("");
  };

  const saveDepartment = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || hasNameError) return;

    setLoading(true);
    setServerNameError("");
    try {
      if (editingId) {
        await api.put(`/departments/${editingId}`, {
          name: trimmedName,
          headEmployeeIds,
          headNames: legacyHeadNames,
          departmentLeadEmployeeIds,
          departmentLeadNames: legacyDepartmentLeadNames,
        });
      } else {
        await api.post("/departments", {
          name: trimmedName,
          headEmployeeIds,
          headNames: legacyHeadNames,
          departmentLeadEmployeeIds,
          departmentLeadNames: legacyDepartmentLeadNames,
        });
      }

      resetDepartmentForm();
      fetchDepartments();
    } catch (err) {
      const duplicateError = getApiNameDuplicateError(err);
      if (duplicateError) {
        setServerNameError(duplicateError);
        return;
      }
      const fieldError = getApiFieldError(err);
      if (fieldError) {
        setServerNameError(fieldError);
        return;
      }

      alert(err.response?.data?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  };

  const editDepartment = (row) => {
    const { selectedEmployeeIds, legacyHeadNames: legacyNames } =
      buildHeadSelectionState(row.headNames || [], employees);
    const {
      selectedEmployeeIds: selectedDepartmentLeadIds,
      legacyHeadNames: legacyDepartmentLeadLabels,
    } = buildHeadSelectionState(row.departmentLeadNames || [], employees);
    setName(row.name || "");
    setHeadEmployeeIds(selectedEmployeeIds);
    setLegacyHeadNames(legacyNames);
    setDepartmentLeadEmployeeIds(selectedDepartmentLeadIds);
    setLegacyDepartmentLeadNames(legacyDepartmentLeadLabels);
    setEditingId(row._id);
    setServerNameError("");
  };

  const deleteDepartment = async (id) => {
    if (!window.confirm("Delete this department?")) return;

    try {
      await api.delete(`/departments/${id}`);
      if (editingId === id) resetDepartmentForm();
      if (selectedDepartmentId === id) clearSubDepartmentContext();
      fetchDepartments();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const clearSubDepartmentContext = () => {
    setSelectedDepartmentId("");
    setSelectedDepartmentName("");
    setSubPath([]);
    setSubDepartments([]);
    resetSubDepartmentForm();
  };

  const openSubDepartmentManager = async (department) => {
    setSelectedDepartmentId(department._id);
    setSelectedDepartmentName(department.name);
    setSubPath([]);
    resetSubDepartmentForm();
    await fetchSubDepartments(department._id, "");
  };

  const fetchSubDepartments = async (departmentId, parentId = "") => {
    try {
      const params = parentId ? { parentId } : {};
      const res = await api.get(`/departments/${departmentId}/sub-departments`, { params });
      setSubDepartments(res.data || []);
    } catch (err) {
      console.error("Load sub departments failed:", err);
      setSubDepartments([]);
      alert(err.response?.data?.message || "Failed to load sub departments");
    }
  };

  const resetSubDepartmentForm = () => {
    setSubName("");
    setSubHeadEmployeeIds([]);
    setLegacySubHeadNames([]);
    setSubEditingId("");
  };

  const saveSubDepartment = async () => {
    if (!selectedDepartmentId) return;

    const names = parseNames(subName);
    if (!names.length || subNameError) return;
    if (subEditingId && names.length !== 1) {
      return alert("While editing, enter only one sub department name");
    }

    setSubLoading(true);
    try {
      if (subEditingId) {
        await api.put(
          `/departments/${selectedDepartmentId}/sub-departments/${subEditingId}`,
          {
            name: names[0],
            headEmployeeIds: subHeadEmployeeIds,
            headNames: legacySubHeadNames,
          }
        );
      } else {
        await api.post(`/departments/${selectedDepartmentId}/sub-departments`, {
          parentId: currentParentId || undefined,
          names: names.length > 1 ? names : undefined,
          name: names[0],
          headEmployeeIds: subHeadEmployeeIds,
          headNames: legacySubHeadNames,
        });
      }

      resetSubDepartmentForm();
      await fetchSubDepartments(selectedDepartmentId, currentParentId);
      fetchDepartments();
    } catch (err) {
      alert(err.response?.data?.message || "Save failed");
    } finally {
      setSubLoading(false);
    }
  };

  const editSubDepartment = (row) => {
    const { selectedEmployeeIds, legacyHeadNames: legacyNames } =
      buildHeadSelectionState(row.headNames || [], employees);
    setSubName(row.name || "");
    setSubHeadEmployeeIds(selectedEmployeeIds);
    setLegacySubHeadNames(legacyNames);
    setSubEditingId(row._id);
  };

  const deleteSubDepartment = async (subId) => {
    if (!selectedDepartmentId) return;
    if (!window.confirm("Delete this sub department?")) return;

    try {
      await api.delete(`/departments/${selectedDepartmentId}/sub-departments/${subId}`);
      if (subEditingId === subId) resetSubDepartmentForm();
      await fetchSubDepartments(selectedDepartmentId, currentParentId);
      fetchDepartments();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const openNextSubLevel = async (subRow) => {
    if (!selectedDepartmentId) return;
    if (currentSubLevel >= 4) return;

    const nextPath = [...subPath, { _id: subRow._id, name: subRow.name }];
    setSubPath(nextPath);
    resetSubDepartmentForm();
    await fetchSubDepartments(selectedDepartmentId, subRow._id);
  };

  const jumpToSubLevel = async (pathIndex) => {
    if (!selectedDepartmentId) return;

    if (pathIndex < 0) {
      setSubPath([]);
      resetSubDepartmentForm();
      await fetchSubDepartments(selectedDepartmentId, "");
      return;
    }

    const nextPath = subPath.slice(0, pathIndex + 1);
    const parentId = nextPath[nextPath.length - 1]?._id || "";
    setSubPath(nextPath);
    resetSubDepartmentForm();
    await fetchSubDepartments(selectedDepartmentId, parentId);
  };

  return (
    <div className="container mt-4 mb-5">
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Masters</div>
            <h3 className="mb-1">Department Master</h3>
            <p className="page-subtitle mb-0">
              Maintain departments, department heads, leads, and nested sub-department levels.
            </p>
          </div>

          <div className="list-summary">
            <span className="summary-chip">{departments.length} departments</span>
            <span className="summary-chip summary-chip--neutral">
              {headEmployeeIds.length} heads selected
            </span>
          </div>
        </div>
      </div>

      <div className="soft-card mb-4">
        <input
          className={`form-control${nameError ? " is-invalid" : " mb-2"}`}
          placeholder="Department Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setServerNameError("");
          }}
          aria-invalid={nameError ? "true" : "false"}
          aria-describedby={nameError ? "department-name-duplicate-error" : undefined}
        />
        {nameError ? (
          <div className="invalid-feedback d-block mb-2" id="department-name-duplicate-error">
            {nameError}
          </div>
        ) : null}
        <SearchableCheckboxSelector
          label="Department Heads"
          helperText="Pick one or more department heads from the employee master."
          options={employeeSelectionOptions}
          selectedValues={headEmployeeIds}
          onChange={setHeadEmployeeIds}
          searchPlaceholder="Search department heads"
          emptyMessage="No employees are available to map as department heads yet."
        />
        <div className="mt-3">
          <SearchableCheckboxSelector
            label="Department Leads"
            helperText="Pick one or more department leads from the employee master."
            options={employeeSelectionOptions}
            selectedValues={departmentLeadEmployeeIds}
            onChange={setDepartmentLeadEmployeeIds}
            searchPlaceholder="Search department leads"
            emptyMessage="No employees are available to map as department leads yet."
          />
        </div>
        {legacyHeadNames.length > 0 && (
          <div className="alert alert-warning py-2 mb-2 d-flex justify-content-between align-items-center gap-2">
            <span>Legacy department heads preserved: {legacyHeadNames.join(", ")}</span>
            <button
              type="button"
              className="btn btn-sm btn-outline-warning"
              onClick={() => setLegacyHeadNames([])}
            >
              Clear Legacy
            </button>
          </div>
        )}
        {legacyDepartmentLeadNames.length > 0 && (
          <div className="alert alert-warning py-2 mb-2 d-flex justify-content-between align-items-center gap-2">
            <span>
              Legacy department leads preserved: {legacyDepartmentLeadNames.join(", ")}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline-warning"
              onClick={() => setLegacyDepartmentLeadNames([])}
            >
              Clear Legacy
            </button>
          </div>
        )}
        <div className="d-flex gap-2">
          <button
            className="btn btn-success"
            onClick={saveDepartment}
            disabled={loading || hasNameError}
          >
            {loading ? "Saving..." : editingId ? "Update Department" : "Save Department"}
          </button>
          {editingId && (
            <button className="btn btn-secondary" onClick={resetDepartmentForm}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="table-shell mb-4">
        <div className="table-responsive">
          <table className="table table-bordered mb-0">
            <thead>
              <tr>
                <th>#</th>
                <th>Department</th>
                <th>Department Heads</th>
                <th>Department Leads</th>
                <th>Sub Departments</th>
                <th width="290">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d, i) => (
                <tr key={d._id}>
                  <td>{i + 1}</td>
                  <td>{d.name}</td>
                  <td>{d.headNames?.length ? d.headNames.join(", ") : "-"}</td>
                  <td>
                    {d.departmentLeadNames?.length
                      ? d.departmentLeadNames.join(", ")
                      : "-"}
                  </td>
                  <td>
                    {d.subDepartments?.length
                      ? d.subDepartments
                          .map((sub) =>
                            sub.headNames?.length
                              ? `${sub.name} (${sub.headNames.join(", ")})`
                              : sub.name
                          )
                          .join(", ")
                      : "-"}
                  </td>
                  <td>
                    <div className="d-flex flex-wrap gap-2">
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => openSubDepartmentManager(d)}
                      >
                        Manage Sub
                      </button>
                      <button className="btn btn-sm btn-warning" onClick={() => editDepartment(d)}>
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => deleteDepartment(d._id)}
                      >
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

      {selectedDepartmentId && (
        <div className="soft-card mb-4">
          <h5 className="mb-3">
            Sub Department Master {currentSubLevel} - {selectedDepartmentName}
          </h5>

          <div className="mb-3 d-flex flex-wrap align-items-center gap-2">
            <span className="fw-semibold">Path:</span>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => jumpToSubLevel(-1)}>
              Sub Department Master 1
            </button>
            {subPath.map((item, index) => (
              <button
                key={item._id}
                className="btn btn-sm btn-outline-secondary"
                onClick={() => jumpToSubLevel(index)}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="d-flex flex-column flex-lg-row align-items-start gap-2 mb-3">
            <div className="flex-grow-1">
              <textarea
                className={`form-control${subNameError ? " is-invalid" : " mb-2"}`}
                placeholder={
                  subEditingId
                    ? `Enter Sub Department Master ${currentSubLevel} name`
                    : `Enter multiple names with comma or new line for Sub Department Master ${currentSubLevel}`
                }
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                aria-invalid={subNameError ? "true" : "false"}
                aria-describedby={subNameError ? "sub-department-name-error" : undefined}
                rows={2}
              />
              {subNameError ? (
                <div className="invalid-feedback d-block mb-2" id="sub-department-name-error">
                  {subNameError}
                </div>
              ) : null}
              <SearchableCheckboxSelector
                label="Sub Department Heads"
                helperText="Pick one or more sub department heads from the employee master."
                options={employeeSelectionOptions}
                selectedValues={subHeadEmployeeIds}
                onChange={setSubHeadEmployeeIds}
                searchPlaceholder="Search sub department heads"
                emptyMessage="No employees are available to map as sub department heads yet."
              />
              {legacySubHeadNames.length > 0 && (
                <div className="alert alert-warning py-2 mt-2 mb-0 d-flex justify-content-between align-items-center gap-2">
                  <span>
                    Legacy sub department heads preserved: {legacySubHeadNames.join(", ")}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-warning"
                    onClick={() => setLegacySubHeadNames([])}
                  >
                    Clear Legacy
                  </button>
                </div>
              )}
            </div>
            <div className="d-flex flex-wrap gap-2">
              <button
                className="btn btn-success"
                onClick={saveSubDepartment}
                disabled={subLoading || Boolean(subNameError)}
              >
                {subLoading ? "Saving..." : subEditingId ? "Update" : "Add"}
              </button>
              {subEditingId && (
                <button className="btn btn-secondary" onClick={resetSubDepartmentForm}>
                  Cancel
                </button>
              )}
              <button className="btn btn-outline-secondary" onClick={clearSubDepartmentContext}>
                Close
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered mb-0">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Sub Department Master {currentSubLevel}</th>
                  <th>Sub Department Heads</th>
                  <th width="250">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subDepartments.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center">
                      No sub departments found
                    </td>
                  </tr>
                )}

                {subDepartments.map((sub, index) => (
                  <tr key={sub._id}>
                    <td>{index + 1}</td>
                    <td>{sub.name}</td>
                    <td>{sub.headNames?.length ? sub.headNames.join(", ") : "-"}</td>
                    <td>
                      <div className="d-flex flex-wrap gap-2">
                        {currentSubLevel < 4 && (
                          <button className="btn btn-sm btn-primary" onClick={() => openNextSubLevel(sub)}>
                            Next Level
                          </button>
                        )}
                        <button className="btn btn-sm btn-warning" onClick={() => editSubDepartment(sub)}>
                          Edit
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteSubDepartment(sub._id)}>
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
      )}
    </div>
  );
}
