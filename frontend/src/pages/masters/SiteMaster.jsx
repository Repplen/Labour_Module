import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import SearchableCheckboxSelector from "../../components/SearchableCheckboxSelector";
import { formatSiteLabel } from "../../utils/siteDisplay";
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

const duplicateSiteMessage = "This site name already exists.";

const normalizeMasterName = (value) => String(value || "").trim().toLowerCase();

const getApiNameDuplicateError = (error) => {
  const errors = Array.isArray(error?.response?.data?.errors)
    ? error.response.data.errors
    : [];
  const hasNameError = errors.some(
    (row) => String(row?.field || row?.path || "").trim() === "name"
  );

  if (error?.response?.status === 409 && hasNameError) {
    return duplicateSiteMessage;
  }

  return "";
};

export default function SiteMaster() {
  const [sites, setSites] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [companyName, setCompanyName] = useState("");
  const [name, setName] = useState("");
  const [headEmployeeIds, setHeadEmployeeIds] = useState([]);
  const [legacyHeadNames, setLegacyHeadNames] = useState([]);
  const [siteLeadEmployeeIds, setSiteLeadEmployeeIds] = useState([]);
  const [legacySiteLeadNames, setLegacySiteLeadNames] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [serverNameError, setServerNameError] = useState("");

  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedSiteName, setSelectedSiteName] = useState("");
  const [subPath, setSubPath] = useState([]);
  const [subSites, setSubSites] = useState([]);
  const [subName, setSubName] = useState("");
  const [subHeadEmployeeIds, setSubHeadEmployeeIds] = useState([]);
  const [legacySubHeadNames, setLegacySubHeadNames] = useState([]);
  const [subEditingId, setSubEditingId] = useState("");
  const [subLoading, setSubLoading] = useState(false);

  const currentSubLevel = subPath.length + 1;
  const currentParentId = subPath.length ? subPath[subPath.length - 1]._id : "";

  useEffect(() => {
    fetchSites();
    fetchCompanies();
    fetchEmployees();
  }, []);

  const fetchSites = async () => {
    try {
      const res = await api.get("/sites");
      setSites(res.data || []);
    } catch (err) {
      console.error("Load sites failed:", err);
      setSites([]);
    }
  };

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

  const companyOptions = useMemo(() => {
    const rows = [...companies];
    if (
      companyName &&
      !rows.some((item) => String(item.name || "").trim() === companyName.trim())
    ) {
      rows.unshift({ _id: `legacy-${companyName}`, name: companyName });
    }

    return rows;
  }, [companies, companyName]);

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
    const validationMessage = validateMasterName(name, "Site");
    if (validationMessage) return validationMessage;

    const nextName = normalizeMasterName(name);

    const hasDuplicate = sites.some(
      (site) =>
        String(site?._id || "") !== String(editingId || "") &&
        normalizeMasterName(site?.name) === nextName
    );

    return hasDuplicate ? duplicateSiteMessage : "";
  }, [editingId, name, sites]);
  const nameError = clientNameError || serverNameError;
  const hasNameError = Boolean(nameError);
  const subNameError = useMemo(() => {
    const names = parseNames(subName);
    if (!names.length) return "";

    const invalidName = names
      .map((item) => validateMasterName(item, "Sub site"))
      .find(Boolean);

    return invalidName || "";
  }, [subName]);

  const resetForm = () => {
    setCompanyName("");
    setName("");
    setHeadEmployeeIds([]);
    setLegacyHeadNames([]);
    setSiteLeadEmployeeIds([]);
    setLegacySiteLeadNames([]);
    setEditingId("");
    setServerNameError("");
  };

  const saveSite = async () => {
    const trimmedCompanyName = companyName.trim();
    const names = parseNames(name);
    const trimmedName = name.trim();

    if (!trimmedCompanyName) return alert("Select company name");
    if (!trimmedName || hasNameError) return;
    if (names.length > 1) {
      return alert("Only one site name can be added at a time");
    }
    if (hasNameError) return;

    setLoading(true);
    setServerNameError("");
    try {
      if (editingId) {
        await api.put(`/sites/${editingId}`, {
          companyName: trimmedCompanyName,
          name: trimmedName,
          headEmployeeIds,
          headNames: legacyHeadNames,
          siteLeadEmployeeIds,
          siteLeadNames: legacySiteLeadNames,
        });
      } else {
        await api.post("/sites", {
          companyName: trimmedCompanyName,
          name: trimmedName,
          headEmployeeIds,
          headNames: legacyHeadNames,
          siteLeadEmployeeIds,
          siteLeadNames: legacySiteLeadNames,
        });
      }

      resetForm();
      fetchSites();
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

  const editRow = (row) => {
    const { selectedEmployeeIds, legacyHeadNames: legacyNames } =
      buildHeadSelectionState(row.headNames || [], employees);
    const { selectedEmployeeIds: selectedSiteLeadIds, legacyHeadNames: legacySiteLeadLabels } =
      buildHeadSelectionState(row.siteLeadNames || [], employees);
    setCompanyName(row.companyName || "");
    setName(row.name || "");
    setHeadEmployeeIds(selectedEmployeeIds);
    setLegacyHeadNames(legacyNames);
    setSiteLeadEmployeeIds(selectedSiteLeadIds);
    setLegacySiteLeadNames(legacySiteLeadLabels);
    setEditingId(row._id);
    setServerNameError("");
  };

  const deleteRow = async (id) => {
    if (!window.confirm("Delete this site?")) return;

    try {
      await api.delete(`/sites/${id}`);
      if (editingId === id) resetForm();
      if (selectedSiteId === id) clearSubSiteContext();
      fetchSites();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const clearSubSiteContext = () => {
    setSelectedSiteId("");
    setSelectedSiteName("");
    setSubPath([]);
    setSubSites([]);
    setSubName("");
    setSubHeadEmployeeIds([]);
    setLegacySubHeadNames([]);
    setSubEditingId("");
  };

  const openSubSiteManager = async (site) => {
    setSelectedSiteId(site._id);
    setSelectedSiteName(formatSiteLabel(site));
    setSubPath([]);
    setSubName("");
    setSubEditingId("");
    await fetchSubSites(site._id, "");
  };

  const fetchSubSites = async (siteId, parentId = "") => {
    try {
      const params = parentId ? { parentId } : {};
      const res = await api.get(`/sites/${siteId}/sub-sites`, { params });
      setSubSites(res.data || []);
    } catch (err) {
      console.error("Load sub sites failed:", err);
      setSubSites([]);
      alert(err.response?.data?.message || "Failed to load sub sites");
    }
  };

  const resetSubSiteForm = () => {
    setSubName("");
    setSubHeadEmployeeIds([]);
    setLegacySubHeadNames([]);
    setSubEditingId("");
  };

  const saveSubSite = async () => {
    if (!selectedSiteId) return;

    const names = parseNames(subName);
    if (!names.length || subNameError) return;
    if (!subHeadEmployeeIds.length && !legacySubHeadNames.length) {
      return alert("Select at least one sub site head");
    }
    if (subEditingId && names.length !== 1) {
      return alert("While editing, enter only one sub site name");
    }

    setSubLoading(true);
    try {
      if (subEditingId) {
        await api.put(
          `/sites/${selectedSiteId}/sub-sites/${subEditingId}`,
          {
            name: names[0],
            headEmployeeIds: subHeadEmployeeIds,
            headNames: legacySubHeadNames,
          }
        );
      } else {
        await api.post(`/sites/${selectedSiteId}/sub-sites`, {
          parentId: currentParentId || undefined,
          names: names.length > 1 ? names : undefined,
          name: names[0],
          headEmployeeIds: subHeadEmployeeIds,
          headNames: legacySubHeadNames,
        });
      }

      resetSubSiteForm();
      await fetchSubSites(selectedSiteId, currentParentId);
      fetchSites();
    } catch (err) {
      alert(err.response?.data?.message || "Save failed");
    } finally {
      setSubLoading(false);
    }
  };

  const editSubSite = (row) => {
    const { selectedEmployeeIds, legacyHeadNames: legacyNames } =
      buildHeadSelectionState(row.headNames || [], employees);
    setSubName(row.name || "");
    setSubHeadEmployeeIds(selectedEmployeeIds);
    setLegacySubHeadNames(legacyNames);
    setSubEditingId(row._id);
  };

  const deleteSubSite = async (subId) => {
    if (!selectedSiteId) return;
    if (!window.confirm("Delete this sub site?")) return;

    try {
      await api.delete(`/sites/${selectedSiteId}/sub-sites/${subId}`);
      if (subEditingId === subId) resetSubSiteForm();
      await fetchSubSites(selectedSiteId, currentParentId);
      fetchSites();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const openNextSubLevel = async (subRow) => {
    if (!selectedSiteId) return;
    if (currentSubLevel >= 4) return;

    const nextPath = [...subPath, { _id: subRow._id, name: subRow.name }];
    setSubPath(nextPath);
    resetSubSiteForm();
    await fetchSubSites(selectedSiteId, subRow._id);
  };

  const jumpToSubLevel = async (pathIndex) => {
    if (!selectedSiteId) return;

    if (pathIndex < 0) {
      setSubPath([]);
      resetSubSiteForm();
      await fetchSubSites(selectedSiteId, "");
      return;
    }

    const nextPath = subPath.slice(0, pathIndex + 1);
    const parentId = nextPath[nextPath.length - 1]?._id || "";
    setSubPath(nextPath);
    resetSubSiteForm();
    await fetchSubSites(selectedSiteId, parentId);
  };

  return (
    <div className="container mt-4 mb-5">
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Masters</div>
            <h3 className="mb-1">Site Master</h3>
            <p className="page-subtitle mb-0">
              Maintain site mappings, site heads, leads, and nested sub-site levels.
            </p>
          </div>

          <div className="list-summary">
            <span className="summary-chip">{sites.length} sites</span>
            <span className="summary-chip summary-chip--neutral">
              {headEmployeeIds.length} heads selected
            </span>
          </div>
        </div>
      </div>

      <div className="soft-card mb-4">
        <select
          className="form-select mb-2"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        >
          <option value="">Select Company</option>
          {companyOptions.map((company) => (
            <option key={company._id} value={company.name}>
              {company.name}
            </option>
          ))}
        </select>

        {companyOptions.length === 0 && (
          <div className="alert alert-warning py-2 mb-2">
            Create company names in Company Master first.
          </div>
        )}

        <input
          className={`form-control${nameError ? " is-invalid" : " mb-2"}`}
          placeholder="Site Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setServerNameError("");
          }}
          aria-invalid={nameError ? "true" : "false"}
          aria-describedby={nameError ? "site-name-duplicate-error" : undefined}
        />
        {nameError ? (
          <div className="invalid-feedback d-block mb-2" id="site-name-duplicate-error">
            {nameError}
          </div>
        ) : null}
        <SearchableCheckboxSelector
          label="Site Heads"
          helperText="Pick one or more site heads from the employee master."
          options={employeeSelectionOptions}
          selectedValues={headEmployeeIds}
          onChange={setHeadEmployeeIds}
          searchPlaceholder="Search site heads"
          emptyMessage="No employees are available to map as site heads yet."
        />

        <div className="mt-3">
          <SearchableCheckboxSelector
            label="Site Leads"
            helperText="Pick one or more site leads from the employee master."
            options={employeeSelectionOptions}
            selectedValues={siteLeadEmployeeIds}
            onChange={setSiteLeadEmployeeIds}
            searchPlaceholder="Search site leads"
            emptyMessage="No employees are available to map as site leads yet."
          />
        </div>

        {legacyHeadNames.length > 0 && (
          <div className="alert alert-warning py-2 mb-2 d-flex justify-content-between align-items-center gap-2">
            <span>Legacy site heads preserved: {legacyHeadNames.join(", ")}</span>
            <button
              type="button"
              className="btn btn-sm btn-outline-warning"
              onClick={() => setLegacyHeadNames([])}
            >
              Clear Legacy
            </button>
          </div>
        )}

        {legacySiteLeadNames.length > 0 && (
          <div className="alert alert-warning py-2 mb-2 d-flex justify-content-between align-items-center gap-2">
            <span>Legacy site leads preserved: {legacySiteLeadNames.join(", ")}</span>
            <button
              type="button"
              className="btn btn-sm btn-outline-warning"
              onClick={() => setLegacySiteLeadNames([])}
            >
              Clear Legacy
            </button>
          </div>
        )}

        <div className="d-flex flex-wrap gap-2">
          <button
            className="btn btn-success"
            onClick={saveSite}
          disabled={loading || hasNameError}
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

      <div className="table-shell mb-4">
        <div className="table-responsive">
          <table className="table table-bordered mb-0">
            <thead>
              <tr>
                <th>#</th>
                <th>Company</th>
                <th>Site</th>
                <th>Site Heads</th>
                <th>Site Leads</th>
                <th>Sub Sites</th>
                <th width="290">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s, i) => (
                <tr key={s._id}>
                  <td>{i + 1}</td>
                  <td>{s.companyName || "-"}</td>
                  <td>{s.name}</td>
                  <td>{s.headNames?.length ? s.headNames.join(", ") : "-"}</td>
                  <td>{s.siteLeadNames?.length ? s.siteLeadNames.join(", ") : "-"}</td>
                  <td>
                    {s.subSites?.length
                      ? s.subSites
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
                      <button className="btn btn-sm btn-primary" onClick={() => openSubSiteManager(s)}>
                        Manage Sub
                      </button>
                      <button className="btn btn-sm btn-warning" onClick={() => editRow(s)}>
                        Edit
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteRow(s._id)}>
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

      {selectedSiteId && (
        <div className="soft-card mb-4">
          <h5 className="mb-3">
            Sub Site Master {currentSubLevel} - {selectedSiteName}
          </h5>

          <div className="mb-3 d-flex flex-wrap align-items-center gap-2">
            <span className="fw-semibold">Path:</span>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => jumpToSubLevel(-1)}>
              Sub Site Master 1
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
                    ? `Enter Sub Site Master ${currentSubLevel} name`
                    : `Enter multiple names with comma or new line for Sub Site Master ${currentSubLevel}`
                }
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                aria-invalid={subNameError ? "true" : "false"}
                aria-describedby={subNameError ? "sub-site-name-error" : undefined}
                rows={2}
              />
              {subNameError ? (
                <div className="invalid-feedback d-block mb-2" id="sub-site-name-error">
                  {subNameError}
                </div>
              ) : null}
              <SearchableCheckboxSelector
                label="Sub Site Heads"
                helperText="Pick one or more sub site heads from the employee master."
                options={employeeSelectionOptions}
                selectedValues={subHeadEmployeeIds}
                onChange={setSubHeadEmployeeIds}
                searchPlaceholder="Search sub site heads"
                emptyMessage="No employees are available to map as sub site heads yet."
              />
              {legacySubHeadNames.length > 0 && (
                <div className="alert alert-warning py-2 mt-2 mb-0 d-flex justify-content-between align-items-center gap-2">
                  <span>Legacy sub site heads preserved: {legacySubHeadNames.join(", ")}</span>
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
                onClick={saveSubSite}
                disabled={subLoading || Boolean(subNameError)}
              >
                {subLoading ? "Saving..." : subEditingId ? "Update" : "Add"}
              </button>
              {subEditingId && (
                <button className="btn btn-secondary" onClick={resetSubSiteForm}>
                  Cancel
                </button>
              )}
              <button className="btn btn-outline-secondary" onClick={clearSubSiteContext}>
                Close
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered mb-0">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Sub Site Master {currentSubLevel}</th>
                  <th>Sub Site Heads</th>
                  <th width="250">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subSites.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center">
                      No sub sites found
                    </td>
                  </tr>
                )}

                {subSites.map((sub, index) => (
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
                        <button className="btn btn-sm btn-warning" onClick={() => editSubSite(sub)}>
                          Edit
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteSubSite(sub._id)}>
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
