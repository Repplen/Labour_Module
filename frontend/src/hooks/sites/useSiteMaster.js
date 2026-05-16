import { useEffect, useMemo, useState } from "react";
import { getCompanies } from "../../services/company.service";
import { getEmployees } from "../../services/employee.service";
import {
  createSite,
  createSubSite,
  deleteSiteById,
  deleteSubSiteById,
  getSites,
  getSubSites,
  updateSite,
  updateSubSite,
} from "../../services/site.service";
import { formatSiteLabel } from "../../utils/siteDisplay";
import {
  getApiNameDuplicateError,
  getCompanyNameError,
  getSiteApiFieldError,
  getSiteNameError,
  getSubSiteNameError,
  parseNames,
} from "../../validators/site.validator";

export const getEmployeeHeadLabel = (employee) => {
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

export const useSiteMaster = () => {
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
  const [companyTouched, setCompanyTouched] = useState(false);
  const [siteNameTouched, setSiteNameTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedSiteName, setSelectedSiteName] = useState("");
  const [subPath, setSubPath] = useState([]);
  const [subSites, setSubSites] = useState([]);
  const [subName, setSubName] = useState("");
  const [subHeadEmployeeIds, setSubHeadEmployeeIds] = useState([]);
  const [legacySubHeadNames, setLegacySubHeadNames] = useState([]);
  const [subEditingId, setSubEditingId] = useState("");
  const [subLoading, setSubLoading] = useState(false);
  const [subNameTouched, setSubNameTouched] = useState(false);
  const [subSubmitAttempted, setSubSubmitAttempted] = useState(false);

  const currentSubLevel = subPath.length + 1;
  const currentParentId = subPath.length ? subPath[subPath.length - 1]._id : "";

  const fetchSites = async () => {
    try {
      const res = await getSites();
      setSites(res.data || []);
    } catch (err) {
      console.error("Load sites failed:", err);
      setSites([]);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await getCompanies();
      setCompanies(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Load companies failed:", err);
      setCompanies([]);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await getEmployees();
      setEmployees(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Load employees failed:", err);
      setEmployees([]);
    }
  };

  useEffect(() => {
    fetchSites();
    fetchCompanies();
    fetchEmployees();
  }, []);

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

  const shouldShowCompanyRequired = companyTouched || submitAttempted;
  const shouldShowSiteRequired = siteNameTouched || submitAttempted;
  const companyNameError = useMemo(
    () => getCompanyNameError(companyName, shouldShowCompanyRequired),
    [companyName, shouldShowCompanyRequired]
  );
  const clientNameError = useMemo(
    () =>
      getSiteNameError({
        name,
        sites,
        editingId,
        shouldShowRequired: shouldShowSiteRequired,
      }),
    [editingId, name, shouldShowSiteRequired, sites]
  );
  const nameError = clientNameError || serverNameError;
  const hasNameError = Boolean(nameError);

  const shouldShowSubSiteRequired = subNameTouched || subSubmitAttempted;
  const subNameError = useMemo(
    () => getSubSiteNameError(subName, shouldShowSubSiteRequired),
    [shouldShowSubSiteRequired, subName]
  );

  const resetForm = () => {
    setCompanyName("");
    setName("");
    setHeadEmployeeIds([]);
    setLegacyHeadNames([]);
    setSiteLeadEmployeeIds([]);
    setLegacySiteLeadNames([]);
    setEditingId("");
    setServerNameError("");
    setCompanyTouched(false);
    setSiteNameTouched(false);
    setSubmitAttempted(false);
  };

  const resetSubSiteForm = () => {
    setSubName("");
    setSubHeadEmployeeIds([]);
    setLegacySubHeadNames([]);
    setSubEditingId("");
    setSubNameTouched(false);
    setSubSubmitAttempted(false);
  };

  const clearSubSiteContext = () => {
    setSelectedSiteId("");
    setSelectedSiteName("");
    setSubPath([]);
    setSubSites([]);
    resetSubSiteForm();
  };

  const saveSite = async () => {
    const trimmedCompanyName = companyName.trim();
    const names = parseNames(name);
    const trimmedName = name.trim();

    setSubmitAttempted(true);

    if (!trimmedCompanyName || !trimmedName || hasNameError) return;
    if (names.length > 1) {
      return alert("Only one site name can be added at a time");
    }
    if (hasNameError) return;

    setLoading(true);
    setServerNameError("");
    try {
      const payload = {
        companyName: trimmedCompanyName,
        name: trimmedName,
        headEmployeeIds,
        headNames: legacyHeadNames,
        siteLeadEmployeeIds,
        siteLeadNames: legacySiteLeadNames,
      };

      if (editingId) {
        await updateSite(editingId, payload);
      } else {
        await createSite(payload);
      }

      resetForm();
      fetchSites();
    } catch (err) {
      const duplicateError = getApiNameDuplicateError(err);
      if (duplicateError) {
        setServerNameError(duplicateError);
        return;
      }

      const fieldError = getSiteApiFieldError(err);
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
    const {
      selectedEmployeeIds: selectedSiteLeadIds,
      legacyHeadNames: legacySiteLeadLabels,
    } = buildHeadSelectionState(row.siteLeadNames || [], employees);
    setCompanyName(row.companyName || "");
    setName(row.name || "");
    setHeadEmployeeIds(selectedEmployeeIds);
    setLegacyHeadNames(legacyNames);
    setSiteLeadEmployeeIds(selectedSiteLeadIds);
    setLegacySiteLeadNames(legacySiteLeadLabels);
    setEditingId(row._id);
    setServerNameError("");
    setCompanyTouched(false);
    setSiteNameTouched(false);
    setSubmitAttempted(false);
  };

  const deleteRow = async (id) => {
    if (!window.confirm("Delete this site?")) return;

    try {
      await deleteSiteById(id);
      if (editingId === id) resetForm();
      if (selectedSiteId === id) clearSubSiteContext();
      fetchSites();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const fetchSubSites = async (siteId, parentId = "") => {
    try {
      const res = await getSubSites(siteId, parentId);
      setSubSites(res.data || []);
    } catch (err) {
      console.error("Load sub sites failed:", err);
      setSubSites([]);
      alert(err.response?.data?.message || "Failed to load sub sites");
    }
  };

  const openSubSiteManager = async (site) => {
    setSelectedSiteId(site._id);
    setSelectedSiteName(formatSiteLabel(site));
    setSubPath([]);
    resetSubSiteForm();
    await fetchSubSites(site._id, "");
  };

  const saveSubSite = async () => {
    if (!selectedSiteId) return;

    const names = parseNames(subName);
    setSubSubmitAttempted(true);

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
        await updateSubSite(selectedSiteId, subEditingId, {
          name: names[0],
          headEmployeeIds: subHeadEmployeeIds,
          headNames: legacySubHeadNames,
        });
      } else {
        await createSubSite(selectedSiteId, {
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
    setSubNameTouched(false);
    setSubSubmitAttempted(false);
  };

  const deleteSubSite = async (subId) => {
    if (!selectedSiteId) return;
    if (!window.confirm("Delete this sub site?")) return;

    try {
      await deleteSubSiteById(selectedSiteId, subId);
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

  return {
    siteForm: {
      companyName,
      setCompanyName: (value) => {
        setCompanyName(value);
        setCompanyTouched(true);
      },
      companyNameError,
      companyOptions,
      name,
      setName: (value) => {
        setName(value);
        setSiteNameTouched(true);
      },
      nameError,
      hasNameError,
      loading,
      editingId,
      headEmployeeIds,
      setHeadEmployeeIds,
      legacyHeadNames,
      setLegacyHeadNames,
      siteLeadEmployeeIds,
      setSiteLeadEmployeeIds,
      legacySiteLeadNames,
      setLegacySiteLeadNames,
      employeeSelectionOptions,
      saveSite,
      resetForm,
      clearServerNameError: () => setServerNameError(""),
    },
    sitesTable: {
      sites,
      openSubSiteManager,
      editRow,
      deleteRow,
    },
    summary: {
      siteCount: sites.length,
      selectedHeadCount: headEmployeeIds.length,
    },
    subSiteManager: {
      selectedSiteId,
      selectedSiteName,
      subPath,
      subSites,
      subName,
      setSubName: (value) => {
        setSubName(value);
        setSubNameTouched(true);
      },
      subNameError,
      subHeadEmployeeIds,
      setSubHeadEmployeeIds,
      legacySubHeadNames,
      setLegacySubHeadNames,
      subEditingId,
      subLoading,
      currentSubLevel,
      employeeSelectionOptions,
      clearSubSiteContext,
      saveSubSite,
      resetSubSiteForm,
      editSubSite,
      deleteSubSite,
      openNextSubLevel,
      jumpToSubLevel,
    },
  };
};
