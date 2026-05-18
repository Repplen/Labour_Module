import { useEffect, useMemo, useRef, useState } from "react";
import {
  createCompany,
  deleteCompanyById,
  getCompanies,
  updateCompany,
} from "../../services/company.service";
import { getEmployees } from "../../services/employee.service";
import { getBackendError, getCompanyNameError } from "../../validators/company.validator";
import { showToast } from "../../utils/toastUtils";

export const getEmployeeDirectorLabel = (employee) => {
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

export const useCompanyMaster = () => {
  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [name, setName] = useState("");
  const [directorEmployeeIds, setDirectorEmployeeIds] = useState([]);
  const [legacyDirectorNames, setLegacyDirectorNames] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [serverNameError, setServerNameError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [nameTouched, setNameTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", variant: "success" });

  const formRef = useRef(null);
  const fetchVersionRef = useRef(0);

  const fetchCompanies = async () => {
    const version = ++fetchVersionRef.current;
    try {
      const res = await getCompanies();
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
      const res = await getEmployees();
      setEmployees(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Load employees failed:", err);
      setEmployees([]);
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchEmployees();
  }, []);

  const employeeOptions = useMemo(
    () =>
      [...employees]
        .sort((left, right) =>
          getEmployeeDirectorLabel(left).localeCompare(getEmployeeDirectorLabel(right))
        )
        .map((employee) => ({
          value: employee._id,
          label: getEmployeeDirectorLabel(employee),
        })),
    [employees]
  );

  const shouldShowRequired = nameTouched || submitAttempted;
  const liveNameError = useMemo(
    () =>
      getCompanyNameError({
        name,
        companies,
        editingId,
        shouldShowRequired,
      }),
    [companies, editingId, name, shouldShowRequired]
  );
  const displayError = liveNameError || serverNameError;

  const resetForm = () => {
    setName("");
    setDirectorEmployeeIds([]);
    setLegacyDirectorNames([]);
    setEditingId("");
    setServerNameError("");
    setNameTouched(false);
    setSubmitAttempted(false);
  };

  const saveCompany = async () => {
    setSubmitAttempted(true);
    if (!name.trim() || liveNameError) return;

    setLoading(true);
    setServerNameError("");
    try {
      const payload = {
        name: name.trim(),
        directorEmployeeIds,
        directorNames: legacyDirectorNames,
      };

      if (editingId) {
        await updateCompany(editingId, payload);
        showToast(setToast, "Company updated successfully!");
      } else {
        await createCompany(payload);
        showToast(setToast, "Company added successfully!");
      }

      resetForm();
      fetchCompanies();
    } catch (err) {
      setServerNameError(getBackendError(err));
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
    setServerNameError("");
    setNameTouched(false);
    setSubmitAttempted(false);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteCompanyById(deleteTarget.id);
      if (editingId === deleteTarget.id) resetForm();
      setServerNameError("");
      setCompanies((prev) =>
        prev.filter((company) => String(company._id) !== String(deleteTarget.id))
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

  return {
    confirmDialog: {
      deleteTarget,
      deleteLoading,
      setDeleteTarget,
      confirmDelete,
    },
    toastState: {
      toast,
      closeToast: () => setToast((current) => ({ ...current, show: false })),
    },
    header: {
      companyCount: companies.length,
      selectedDirectorCount: directorEmployeeIds.length,
    },
    form: {
      formRef,
      name,
      setName: (value) => {
        setName(value);
        setServerNameError("");
        setNameTouched(true);
      },
      displayError,
      employeeOptions,
      directorEmployeeIds,
      setDirectorEmployeeIds,
      legacyDirectorNames,
      setLegacyDirectorNames,
      editingId,
      loading,
      saveCompany,
      resetForm,
      hasBlockingNameError: Boolean(liveNameError),
    },
    table: {
      companies,
      editRow,
      setDeleteTarget,
    },
  };
};
