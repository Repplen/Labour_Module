import { useEffect, useMemo, useState } from "react";
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
    try {
      const res = await getDepartments();
      setDepartments(res.data || []);
    } catch (err) {
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

  const clientNameError = useMemo(
    () => getDepartmentNameError({ name, departments, editingId }),
    [departments, editingId, name]
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
    if (!trimmedName || hasNameError) return;

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
      } else {
        await createDepartment(payload);
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
      await deleteDepartmentById(id);
      if (editingId === id) resetDepartmentForm();
      if (selectedDepartmentId === id) clearSubDepartmentContext();
      fetchDepartments();
    } catch (err) {
      alert(err.response?.data?.message || "Delete failed");
    }
  };

  const fetchSubDepartments = async (departmentId, parentId = "") => {
    try {
      const res = await getSubDepartments(departmentId, parentId);
      setSubDepartments(res.data || []);
    } catch (err) {
      console.error("Load sub departments failed:", err);
      setSubDepartments([]);
      alert(err.response?.data?.message || "Failed to load sub departments");
    }
  };

  const openSubDepartmentManager = async (department) => {
    setSelectedDepartmentId(department._id);
    setSelectedDepartmentName(department.name);
    setSubPath([]);
    resetSubDepartmentForm();
    await fetchSubDepartments(department._id, "");
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
        await updateSubDepartment(selectedDepartmentId, subEditingId, {
          name: names[0],
          headEmployeeIds: subHeadEmployeeIds,
          headNames: legacySubHeadNames,
        });
      } else {
        await createSubDepartment(selectedDepartmentId, {
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
      await deleteSubDepartmentById(selectedDepartmentId, subId);
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

  return {
    departmentForm: {
      name,
      setName,
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
