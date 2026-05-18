import { useEffect, useMemo, useRef, useState } from "react";
import {
  createDepartment,
  createSubDepartment,
  deleteDepartmentById,
  deleteSubDepartmentById,
  getDepartments,
  getSubDepartments,
  updateDepartment,
  updateSubDepartment,
} from "../../services/department.service";
import { getEmployees } from "../../services/employee.service";
import { showToast } from "../../utils/toastUtils";
import {
  getApiNameDuplicateError,
  getDepartmentApiFieldError,
  getDepartmentNameError,
  getSubDepartmentNameError,
  parseNames,
} from "../../validators/department.validator";

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

export const useDepartmentMaster = () => {
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
  const [nameTouched, setNameTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", variant: "success" });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const formRef = useRef(null);
  const subManagerRef = useRef(null);
  const fetchVersionRef = useRef(0);

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

  const fetchDepartments = async () => {
    const version = ++fetchVersionRef.current;
    try {
      const res = await getDepartments();
      if (version !== fetchVersionRef.current) return;
      setDepartments(res.data || []);
    } catch (err) {
      if (version !== fetchVersionRef.current) return;
      console.error("Load departments failed:", err);
      setDepartments([]);
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
    fetchDepartments();
    fetchEmployees();
  }, []);

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

  const shouldShowNameRequired = nameTouched || submitAttempted;
  const clientNameError = useMemo(
    () =>
      getDepartmentNameError({
        name,
        departments,
        editingId,
        shouldShowRequired: shouldShowNameRequired,
      }),
    [departments, editingId, name, shouldShowNameRequired]
  );
  const nameError = clientNameError || serverNameError;
  const hasNameError = Boolean(nameError);

  const subNameError = useMemo(
    () => getSubDepartmentNameError(subName),
    [subName]
  );

  const resetDepartmentForm = () => {
    setName("");
    setHeadEmployeeIds([]);
    setLegacyHeadNames([]);
    setDepartmentLeadEmployeeIds([]);
    setLegacyDepartmentLeadNames([]);
    setEditingId("");
    setServerNameError("");
    setNameTouched(false);
    setSubmitAttempted(false);
  };

  const resetSubDepartmentForm = () => {
    setSubName("");
    setSubHeadEmployeeIds([]);
    setLegacySubHeadNames([]);
    setSubEditingId("");
  };

  const clearSubDepartmentContext = () => {
    setSelectedDepartmentId("");
    setSelectedDepartmentName("");
    setSubPath([]);
    setSubDepartments([]);
    resetSubDepartmentForm();
  };

  const saveDepartment = async () => {
    const trimmedName = name.trim();

    setSubmitAttempted(true);

    if (!trimmedName || clientNameError) return;

    setLoading(true);
    setServerNameError("");
    try {
      const payload = {
        name: trimmedName,
        headEmployeeIds,
        headNames: legacyHeadNames,
        departmentLeadEmployeeIds,
        departmentLeadNames: legacyDepartmentLeadNames,
      };

      if (editingId) {
        await updateDepartment(editingId, payload);
        showToast(setToast, "Department updated successfully!");
      } else {
        await createDepartment(payload);
        showToast(setToast, "Department added successfully!");
      }

      resetDepartmentForm();
      fetchDepartments();
    } catch (err) {
      const duplicateError = getApiNameDuplicateError(err);
      if (duplicateError) {
        setServerNameError(duplicateError);
        return;
      }

      const fieldError = getDepartmentApiFieldError(err);
      if (fieldError) {
        setServerNameError(fieldError);
        return;
      }

      showToast(setToast, err.response?.data?.message || "Save failed", "error");
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
    setNameTouched(false);
    setSubmitAttempted(false);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const deleteDepartment = (id, name) => {
    setDeleteTarget({ id, name, type: "department" });
  };

  const deleteSubDepartment = (subId, subName) => {
    setDeleteTarget({ id: subId, name: subName, type: "sub" });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (deleteTarget.type === "department") {
        await deleteDepartmentById(deleteTarget.id);
        if (editingId === deleteTarget.id) resetDepartmentForm();
        if (selectedDepartmentId === deleteTarget.id) clearSubDepartmentContext();
        setDepartments((prev) => prev.filter((d) => String(d._id) !== String(deleteTarget.id)));
        setServerNameError("");
        fetchDepartments();
      } else {
        await deleteSubDepartmentById(selectedDepartmentId, deleteTarget.id);
        if (subEditingId === deleteTarget.id) resetSubDepartmentForm();
        await fetchSubDepartments(selectedDepartmentId, currentParentId);
        fetchDepartments();
      }
      showToast(setToast, `"${deleteTarget.name}" deleted successfully!`);
    } catch (err) {
      showToast(setToast, err.response?.data?.message || "Delete failed.", "error");
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  const fetchSubDepartments = async (departmentId, parentId = "") => {
    try {
      const res = await getSubDepartments(departmentId, parentId);
      setSubDepartments(res.data || []);
    } catch (err) {
      console.error("Load sub departments failed:", err);
      setSubDepartments([]);
      showToast(setToast, err.response?.data?.message || "Failed to load sub departments", "error");
    }
  };

  const openSubDepartmentManager = async (department) => {
    setSelectedDepartmentId(department._id);
    setSelectedDepartmentName(department.name);
    setSubPath([]);
    resetSubDepartmentForm();
    await fetchSubDepartments(department._id, "");
    setTimeout(() => {
      subManagerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const saveSubDepartment = async () => {
    if (!selectedDepartmentId) return;

    const names = parseNames(subName);
    if (!names.length || subNameError) return;
    if (subEditingId && names.length !== 1) {
      showToast(setToast, "While editing, enter only one sub department name", "warning");
      return;
    }

    setSubLoading(true);
    try {
      if (subEditingId) {
        await updateSubDepartment(selectedDepartmentId, subEditingId, {
          name: names[0],
          headEmployeeIds: subHeadEmployeeIds,
          headNames: legacySubHeadNames,
        });
        showToast(setToast, "Sub department updated successfully!");
      } else {
        await createSubDepartment(selectedDepartmentId, {
          parentId: currentParentId || undefined,
          names: names.length > 1 ? names : undefined,
          name: names[0],
          headEmployeeIds: subHeadEmployeeIds,
          headNames: legacySubHeadNames,
        });
        showToast(setToast, "Sub department added successfully!");
      }

      resetSubDepartmentForm();
      await fetchSubDepartments(selectedDepartmentId, currentParentId);
      fetchDepartments();
    } catch (err) {
      showToast(setToast, err.response?.data?.message || "Save failed", "error");
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

  return {
    toastState: {
      toast,
      closeToast: () => setToast((t) => ({ ...t, show: false })),
    },
    confirmDialog: {
      deleteTarget,
      deleteLoading,
      setDeleteTarget,
      confirmDelete,
    },
    departmentForm: {
      formRef,
      name,
      setName: (value) => {
        setName(value);
        setServerNameError("");
        setNameTouched(true);
      },
      nameError,
      hasNameError,
      loading,
      editingId,
      headEmployeeIds,
      setHeadEmployeeIds,
      legacyHeadNames,
      setLegacyHeadNames,
      departmentLeadEmployeeIds,
      setDepartmentLeadEmployeeIds,
      legacyDepartmentLeadNames,
      setLegacyDepartmentLeadNames,
      employeeSelectionOptions,
      saveDepartment,
      resetDepartmentForm,
      clearServerNameError: () => setServerNameError(""),
    },
    departmentsTable: {
      departments,
      editDepartment,
      deleteDepartment,
      openSubDepartmentManager,
    },
    summary: {
      departmentCount: departments.length,
      selectedHeadCount: headEmployeeIds.length,
    },
    subDepartmentManager: {
      subManagerRef,
      selectedDepartmentId,
      selectedDepartmentName,
      subPath,
      subDepartments,
      subName,
      setSubName,
      subNameError,
      subHeadEmployeeIds,
      setSubHeadEmployeeIds,
      legacySubHeadNames,
      setLegacySubHeadNames,
      subEditingId,
      subLoading,
      currentSubLevel,
      employeeSelectionOptions,
      clearSubDepartmentContext,
      saveSubDepartment,
      resetSubDepartmentForm,
      editSubDepartment,
      deleteSubDepartment,
      openNextSubLevel,
      jumpToSubLevel,
    },
  };
};
