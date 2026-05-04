import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axios";
import { usePermissions } from "../context/usePermissions";

const actionFieldMap = {
  view: "canView",
  add: "canAdd",
  edit: "canEdit",
  delete: "canDelete",
  approve: "canApprove",
  reject: "canReject",
  status_update: "canStatusUpdate",
  transfer: "canTransfer",
  export: "canExport",
  report_view: "canReportView",
};

const defaultRoleForm = {
  name: "",
  key: "",
  description: "",
  dashboardType: "generic",
  scopeStrategy: "mapped",
  homeModuleKey: "dashboard",
};

const defaultAccessForm = {
  roleId: "",
  accessScopeStrategy: "inherit",
  accessCompanyIds: [],
  accessSiteIds: [],
  accessDepartmentIds: [],
  accessSubDepartmentIds: [],
  accessEmployeeIds: [],
};

const normalizeId = (value) => String(value?._id || value || "").trim();

const rowArrayToMap = (rows = []) =>
  rows.reduce((result, row) => {
    result[String(row.moduleKey || "").trim().toLowerCase()] = row;
    return result;
  }, {});

const buildMatrixRows = (modules = [], rowMap = {}) =>
  (Array.isArray(modules) ? modules : []).map((moduleItem, index) => ({
    srNo: index + 1,
    moduleKey: moduleItem.key,
    moduleName: moduleItem.name,
    ...Object.values(actionFieldMap).reduce((result, fieldKey) => {
      result[fieldKey] = Boolean(rowMap[moduleItem.key]?.[fieldKey]);
      return result;
    }, {}),
  }));

const updateMatrixRows = (rows = [], moduleKey, fieldKey, checked) =>
  rows.map((row) =>
    row.moduleKey === moduleKey
      ? {
          ...row,
          [fieldKey]: checked,
        }
      : row
  );

const getActionFieldKeys = (actions = []) =>
  actions.map((action) => actionFieldMap[action.key]).filter(Boolean);

const buildActionPatch = (fieldKeys = [], checked) =>
  fieldKeys.reduce((result, fieldKey) => {
    result[fieldKey] = checked;
    return result;
  }, {});

const updateAllMatrixRows = (rows = [], fieldKeys = [], checked) =>
  rows.map((row) => ({
    ...row,
    ...buildActionPatch(fieldKeys, checked),
  }));

const updateMatrixColumnRows = (rows = [], fieldKey, checked) =>
  rows.map((row) => ({
    ...row,
    [fieldKey]: checked,
  }));

const getMatrixSelectionState = (rows = [], fieldKeys = []) => {
  const totalCount = rows.length * fieldKeys.length;
  const selectedCount = rows.reduce(
    (count, row) => count + fieldKeys.filter((fieldKey) => Boolean(row[fieldKey])).length,
    0
  );

  return {
    all: totalCount > 0 && selectedCount === totalCount,
    some: selectedCount > 0 && selectedCount < totalCount,
  };
};

const getMatrixColumnSelectionState = (rows = [], fieldKey) => {
  const selectedCount = rows.filter((row) => Boolean(row[fieldKey])).length;

  return {
    all: rows.length > 0 && selectedCount === rows.length,
    some: selectedCount > 0 && selectedCount < rows.length,
  };
};

const flattenSubDepartments = (rows = [], trail = [], department = null) =>
  rows.flatMap((item) => {
    const nextTrail = [...trail, item.name];

    return [
      {
        _id: item._id,
        name: item.name,
        departmentId: department?._id || "",
        departmentName: department?.name || "",
        label: department?.name
          ? `${department.name} > ${nextTrail.join(" > ")}`
          : nextTrail.join(" > "),
      },
      ...flattenSubDepartments(item.children || [], nextTrail, department),
    ];
  });

const buildPrincipalOptions = (users = [], employees = [], roles = []) => {
  const roleById = new Map((roles || []).map((role) => [normalizeId(role._id), role]));

  return [
    ...(Array.isArray(users) ? users : []).map((user) => ({
      principalType: "user",
      principalId: normalizeId(user._id),
      label: `${user.name || "User"} (${user.email || "No email"})`,
      roleId:
        normalizeId(user.roleId?._id || user.roleId) ||
        (String(user.role || "").toLowerCase() === "admin"
          ? normalizeId((roles || []).find((role) => role.key === "main_admin")?._id)
          : normalizeId((roles || []).find((role) => role.key === "checklist_master_user")?._id)),
      roleName:
        user.roleId?.name ||
        roleById.get(normalizeId(user.roleId))?.name ||
        (String(user.role || "").toLowerCase() === "admin" ? "Main Admin" : "Checklist Master User"),
      accessScopeStrategy: user.accessScopeStrategy || "inherit",
      accessCompanyIds: (user.accessCompanyIds || []).map((item) => normalizeId(item)),
      accessSiteIds: [
        ...(user.accessSiteIds || []).map((item) => normalizeId(item)),
        ...(user.site ? [normalizeId(user.site)] : []),
      ].filter(Boolean),
      accessDepartmentIds: (user.accessDepartmentIds || []).map((item) => normalizeId(item)),
      accessSubDepartmentIds: (user.accessSubDepartmentIds || []).map((item) => normalizeId(item)),
      accessEmployeeIds: (user.accessEmployeeIds || []).map((item) => normalizeId(item)),
    })),
    ...(Array.isArray(employees) ? employees : []).map((employee) => ({
      principalType: "employee",
      principalId: normalizeId(employee._id),
      label: `${employee.employeeCode || "EMP"} - ${employee.employeeName || "Employee"}`,
      roleId:
        normalizeId(employee.roleId?._id || employee.roleId) ||
        normalizeId((roles || []).find((role) => role.key === "employee")?._id),
      roleName:
        employee.roleId?.name ||
        roleById.get(normalizeId(employee.roleId))?.name ||
        "Employee",
      accessScopeStrategy: employee.accessScopeStrategy || "inherit",
      accessCompanyIds: (employee.accessCompanyIds || []).map((item) => normalizeId(item)),
      accessSiteIds: [
        ...(employee.accessSiteIds || []).map((item) => normalizeId(item)),
        ...(employee.sites || []).map((item) => normalizeId(item)),
      ].filter(Boolean),
      accessDepartmentIds: [
        ...(employee.accessDepartmentIds || []).map((item) => normalizeId(item)),
        ...(employee.department || []).map((item) => normalizeId(item)),
      ].filter(Boolean),
      accessSubDepartmentIds: [
        ...(employee.accessSubDepartmentIds || []).map((item) => normalizeId(item)),
      ].filter(Boolean),
      accessEmployeeIds: (employee.accessEmployeeIds || []).map((item) => normalizeId(item)),
    })),
  ].sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
};

const getSelectedValues = (event) =>
  Array.from(event.target.selectedOptions || []).map((option) => option.value);

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.message || error?.message || fallbackMessage;

const normalizeIdList = (value = []) =>
  [...new Set((Array.isArray(value) ? value : []).map((item) => normalizeId(item)).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));

const areIdListsEqual = (left = [], right = []) => {
  const normalizedLeft = normalizeIdList(left);
  const normalizedRight = normalizeIdList(right);

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((item, index) => item === normalizedRight[index]);
};

const scopeLabelMap = {
  inherit: "Inherit Role Scope",
  mapped: "Mapped Data",
  all: "All Data",
  own: "Own Data",
  managed: "Managed Team Data",
};

const hasAnyAccessMappings = (accessForm = {}) =>
  [
    accessForm.accessCompanyIds,
    accessForm.accessSiteIds,
    accessForm.accessDepartmentIds,
    accessForm.accessSubDepartmentIds,
    accessForm.accessEmployeeIds,
  ].some((rows) => Array.isArray(rows) && rows.length);

function MatrixBulkCheckbox({ checked, indeterminate, label, onChange }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = Boolean(indeterminate) && !checked;
    }
  }, [checked, indeterminate]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      className="form-check-input"
      checked={Boolean(checked)}
      onChange={onChange}
      aria-label={label}
      title={label}
    />
  );
}

function PermissionMatrixTable({ actions, rows, onToggle, onToggleAction, onToggleAll }) {
  const actionFieldKeys = useMemo(() => getActionFieldKeys(actions), [actions]);
  const matrixSelection = useMemo(
    () => getMatrixSelectionState(rows, actionFieldKeys),
    [actionFieldKeys, rows]
  );
  const columnSelections = useMemo(
    () =>
      actionFieldKeys.reduce((result, fieldKey) => {
        result[fieldKey] = getMatrixColumnSelectionState(rows, fieldKey);
        return result;
      }, {}),
    [actionFieldKeys, rows]
  );

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <label className="form-check d-inline-flex align-items-center gap-2 mb-0">
          <MatrixBulkCheckbox
            checked={matrixSelection.all}
            indeterminate={matrixSelection.some}
            label="Select all permissions"
            onChange={(event) => onToggleAll(event.target.checked)}
          />
          <span className="form-check-label fw-semibold">Select all</span>
        </label>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => onToggleAll(false)}
          disabled={!rows.length || !actionFieldKeys.length}
        >
          Clear all
        </button>
      </div>

      <div className="table-responsive">
        <table className="table table-bordered align-middle" data-testid="permission-table">
          <thead className="table-dark">
            <tr>
              <th style={{ width: "72px" }}>S.No</th>
              <th>Module / Screen Name</th>
              {actions.map((action) => {
                const fieldKey = actionFieldMap[action.key];
                const columnSelection = columnSelections[fieldKey] || { all: false, some: false };

                return (
                  <th key={action.key} className="text-center">
                    <div className="d-flex flex-column align-items-center gap-1">
                      <span>{action.label}</span>
                      <MatrixBulkCheckbox
                        checked={columnSelection.all}
                        indeterminate={columnSelection.some}
                        label={`Select all ${action.label} permissions`}
                        onChange={(event) => onToggleAction(fieldKey, event.target.checked)}
                      />
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.moduleKey}>
                <td>{row.srNo}</td>
                <td>{row.moduleName}</td>
                {actions.map((action) => (
                  <td key={action.key} className="text-center">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={Boolean(row[actionFieldMap[action.key]])}
                      onChange={(event) =>
                        onToggle(row.moduleKey, actionFieldMap[action.key], event.target.checked)
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function RolePermissionSetup() {
  const { refresh } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [savingRoleMatrix, setSavingRoleMatrix] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [savingOverrides, setSavingOverrides] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);
  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [actions, setActions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [sites, setSites] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roleForm, setRoleForm] = useState(defaultRoleForm);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedPrincipalKey, setSelectedPrincipalKey] = useState("");
  const [roleMatrixRows, setRoleMatrixRows] = useState([]);
  const [overrideRows, setOverrideRows] = useState([]);
  const [accessForm, setAccessForm] = useState(defaultAccessForm);

  const refreshCurrentPermissions = async (savedLabel) => {
    try {
      await refresh();
      return true;
    } catch (error) {
      console.error(`${savedLabel.toUpperCase()} REFRESH ERROR:`, error);
      alert(
        `${savedLabel} saved successfully, but the current session permissions could not refresh automatically. Please reload the page once.`
      );
      return false;
    }
  };

  const loadSetup = async () => {
    setLoading(true);

    try {
      const response = await api.get("/permissions/setup");

      setModules(Array.isArray(response.data?.modules) ? response.data.modules : []);
      setActions(Array.isArray(response.data?.actions) ? response.data.actions : []);
      setRoles(Array.isArray(response.data?.roles) ? response.data.roles : []);
      setRolePermissions(Array.isArray(response.data?.rolePermissions) ? response.data.rolePermissions : []);
      setOverrides(Array.isArray(response.data?.overrides) ? response.data.overrides : []);
      setUsers(Array.isArray(response.data?.users) ? response.data.users : []);
      setEmployees(Array.isArray(response.data?.employees) ? response.data.employees : []);
      setCompanies(Array.isArray(response.data?.companies) ? response.data.companies : []);
      setSites(Array.isArray(response.data?.sites) ? response.data.sites : []);
      setDepartments(Array.isArray(response.data?.departments) ? response.data.departments : []);
    } catch (error) {
      alert(error.response?.data?.message || "Failed to load permission setup");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSetup();
  }, []);

  useEffect(() => {
    if (!roles.length) return;

    if (!selectedRoleId) {
      const defaultRole = roles.find((role) => role.key === "main_admin") || roles[0];
      setSelectedRoleId(normalizeId(defaultRole?._id));
    }
  }, [roles, selectedRoleId]);

  const principalOptions = useMemo(
    () => buildPrincipalOptions(users, employees, roles),
    [users, employees, roles]
  );
  const roleById = useMemo(
    () => new Map((roles || []).map((role) => [normalizeId(role._id), role])),
    [roles]
  );

  useEffect(() => {
    if (!principalOptions.length) return;

    if (!selectedPrincipalKey) {
      const firstPrincipal = principalOptions[0];
      setSelectedPrincipalKey(`${firstPrincipal.principalType}:${firstPrincipal.principalId}`);
    }
  }, [principalOptions, selectedPrincipalKey]);

  const rolePermissionMap = useMemo(() => {
    const rows = (rolePermissions || []).filter(
      (row) => normalizeId(row.roleId) === String(selectedRoleId || "")
    );
    return rowArrayToMap(rows);
  }, [rolePermissions, selectedRoleId]);

  useEffect(() => {
    setRoleMatrixRows(buildMatrixRows(modules, rolePermissionMap));
  }, [modules, rolePermissionMap]);

  const selectedPrincipal = useMemo(() => {
    const [principalType = "", principalId = ""] = String(selectedPrincipalKey || "").split(":");
    return (
      principalOptions.find(
        (principal) =>
          principal.principalType === principalType && principal.principalId === principalId
      ) || null
    );
  }, [principalOptions, selectedPrincipalKey]);
  const savedPrincipalRoleId = selectedPrincipal?.roleId || "";
  const effectivePrincipalRoleId = accessForm.roleId || savedPrincipalRoleId;
  const savedPrincipalRole = roleById.get(savedPrincipalRoleId) || null;
  const effectivePrincipalRole = roleById.get(effectivePrincipalRoleId) || null;
  const effectiveScopeStrategy =
    accessForm.accessScopeStrategy === "inherit"
      ? effectivePrincipalRole?.scopeStrategy || "mapped"
      : accessForm.accessScopeStrategy;

  const selectedPrincipalOverrideMap = useMemo(() => {
    if (!selectedPrincipal) return {};

    const rows = (overrides || []).filter(
      (row) =>
        String(row.principalType || "") === selectedPrincipal.principalType &&
        normalizeId(row.principalId) === selectedPrincipal.principalId
    );

    return rowArrayToMap(rows);
  }, [overrides, selectedPrincipal]);

  const selectedPrincipalRolePermissionMap = useMemo(() => {
    if (!effectivePrincipalRoleId) return {};

    const rows = (rolePermissions || []).filter(
      (row) => normalizeId(row.roleId) === effectivePrincipalRoleId
    );
    return rowArrayToMap(rows);
  }, [effectivePrincipalRoleId, rolePermissions]);

  const hasUnsavedAccessChanges = useMemo(() => {
    if (!selectedPrincipal) return false;

    return (
      normalizeId(accessForm.roleId) !== normalizeId(selectedPrincipal.roleId) ||
      String(accessForm.accessScopeStrategy || "inherit") !==
        String(selectedPrincipal.accessScopeStrategy || "inherit") ||
      !areIdListsEqual(accessForm.accessCompanyIds, selectedPrincipal.accessCompanyIds) ||
      !areIdListsEqual(accessForm.accessSiteIds, selectedPrincipal.accessSiteIds) ||
      !areIdListsEqual(accessForm.accessDepartmentIds, selectedPrincipal.accessDepartmentIds) ||
      !areIdListsEqual(
        accessForm.accessSubDepartmentIds,
        selectedPrincipal.accessSubDepartmentIds
      ) ||
      !areIdListsEqual(accessForm.accessEmployeeIds, selectedPrincipal.accessEmployeeIds)
    );
  }, [accessForm, selectedPrincipal]);

  const mappingSelectionsWillBeIgnored =
    hasAnyAccessMappings(accessForm) && effectiveScopeStrategy === "own";

  useEffect(() => {
    if (!selectedPrincipal) {
      setOverrideRows([]);
      setAccessForm(defaultAccessForm);
      return;
    }

    const mergedMap = modules.reduce((result, moduleItem) => {
      result[moduleItem.key] =
        selectedPrincipalOverrideMap[moduleItem.key] ||
        selectedPrincipalRolePermissionMap[moduleItem.key] ||
        {};
      return result;
    }, {});

    setOverrideRows(buildMatrixRows(modules, mergedMap));
    setAccessForm({
      roleId: selectedPrincipal.roleId || "",
      accessScopeStrategy: selectedPrincipal.accessScopeStrategy || "inherit",
      accessCompanyIds: selectedPrincipal.accessCompanyIds || [],
      accessSiteIds: selectedPrincipal.accessSiteIds || [],
      accessDepartmentIds: selectedPrincipal.accessDepartmentIds || [],
      accessSubDepartmentIds: selectedPrincipal.accessSubDepartmentIds || [],
      accessEmployeeIds: selectedPrincipal.accessEmployeeIds || [],
    });
  }, [modules, selectedPrincipal, selectedPrincipalOverrideMap, selectedPrincipalRolePermissionMap]);

  const updateAccessSelections = (fieldKey, values) => {
    setAccessForm((currentValue) => {
      const nextValue = {
        ...currentValue,
        [fieldKey]: values,
      };

      const nextRoleId = normalizeId(nextValue.roleId) || savedPrincipalRoleId;
      const nextRole = roleById.get(nextRoleId) || savedPrincipalRole || null;
      const inheritedScopeStrategy = nextRole?.scopeStrategy || "mapped";

      if (
        values.length &&
        String(currentValue.accessScopeStrategy || "inherit") === "inherit" &&
        inheritedScopeStrategy === "own"
      ) {
        nextValue.accessScopeStrategy = "mapped";
      }

      return nextValue;
    });
  };

  const subDepartmentOptions = useMemo(
    () =>
      (departments || []).flatMap((department) =>
        flattenSubDepartments(department.subDepartments || [], [], department)
      ),
    [departments]
  );

  const saveRole = async (event) => {
    event.preventDefault();
    setCreatingRole(true);

    try {
      await api.post("/permissions/roles", roleForm);
      setRoleForm(defaultRoleForm);
      await loadSetup();
      alert("Role created successfully");
    } catch (error) {
      alert(getErrorMessage(error, "Failed to create role"));
    } finally {
      setCreatingRole(false);
    }
  };

  const saveRoleMatrix = async () => {
    if (!selectedRoleId) return;

    setSavingRoleMatrix(true);

    try {
      await api.put(`/permissions/roles/${selectedRoleId}/permissions`, {
        rows: roleMatrixRows,
      });
      await loadSetup();
      const refreshed = await refreshCurrentPermissions("Role permissions");
      if (refreshed) {
        alert("Role permissions saved successfully");
      }
    } catch (error) {
      alert(getErrorMessage(error, "Failed to save role permissions"));
    } finally {
      setSavingRoleMatrix(false);
    }
  };

  const savePrincipalAccess = async () => {
    if (!selectedPrincipal) return;

    setSavingAccess(true);

    try {
      await api.put(
        `/permissions/principals/${selectedPrincipal.principalType}/${selectedPrincipal.principalId}/access`,
        accessForm
      );
      await loadSetup();
      const refreshed = await refreshCurrentPermissions("Person access mapping");
      if (refreshed) {
        alert("Person access mapping saved successfully");
      }
    } catch (error) {
      alert(getErrorMessage(error, "Failed to save person access mapping"));
    } finally {
      setSavingAccess(false);
    }
  };

  const saveOverrideMatrix = async () => {
    if (!selectedPrincipal) return;
    if (hasUnsavedAccessChanges) {
      alert("Save Person Mapping first after changing role or scope, then save user overrides.");
      return;
    }

    setSavingOverrides(true);

    try {
      await api.put(
        `/permissions/principals/${selectedPrincipal.principalType}/${selectedPrincipal.principalId}/overrides`,
        {
          rows: overrideRows,
        }
      );
      await loadSetup();
      const refreshed = await refreshCurrentPermissions("User overrides");
      if (refreshed) {
        alert("User overrides saved successfully");
      }
    } catch (error) {
      alert(getErrorMessage(error, "Failed to save person-specific overrides"));
    } finally {
      setSavingOverrides(false);
    }
  };

  if (loading) {
    return <div className="container py-5">Loading role permission setup...</div>;
  }

  return (
    <div className="container-fluid mt-4 mb-5" data-testid="role-permission-page">
      <div className="page-intro-card mb-4">
        <div className="page-kicker">Administration</div>
        <h3 className="mb-1">Role Permission Setup</h3>
        <div className="page-subtitle">
          Control module visibility, action-level permission, particular-user overrides, and data
          scope mappings from one screen.
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-4">
          <div className="soft-card h-100">
            <h5 className="mb-3">Create Role</h5>
            <form className="d-flex flex-column gap-3" onSubmit={saveRole}>
              <input
                className="form-control"
                placeholder="Role Name"
                value={roleForm.name}
                onChange={(event) =>
                  setRoleForm((currentValue) => ({ ...currentValue, name: event.target.value }))
                }
                required
              />
              <input
                className="form-control"
                placeholder="role_key"
                value={roleForm.key}
                onChange={(event) =>
                  setRoleForm((currentValue) => ({ ...currentValue, key: event.target.value }))
                }
                required
              />
              <textarea
                className="form-control"
                placeholder="Description"
                rows="3"
                value={roleForm.description}
                onChange={(event) =>
                  setRoleForm((currentValue) => ({
                    ...currentValue,
                    description: event.target.value,
                  }))
                }
              />
              <select
                className="form-select"
                value={roleForm.dashboardType}
                onChange={(event) =>
                  setRoleForm((currentValue) => ({
                    ...currentValue,
                    dashboardType: event.target.value,
                  }))
                }
              >
                <option value="generic">Generic Dashboard</option>
                <option value="admin">Admin Dashboard</option>
                <option value="employee">Employee Dashboard</option>
                <option value="superior">Superior Dashboard</option>
                <option value="site">Site User Dashboard</option>
                <option value="department">Department User Dashboard</option>
              </select>
              <select
                className="form-select"
                value={roleForm.scopeStrategy}
                onChange={(event) =>
                  setRoleForm((currentValue) => ({
                    ...currentValue,
                    scopeStrategy: event.target.value,
                  }))
                }
              >
                <option value="mapped">Mapped Data</option>
                <option value="all">All Data</option>
                <option value="own">Own Data</option>
                <option value="managed">Managed Team Data</option>
              </select>
              <select
                className="form-select"
                value={roleForm.homeModuleKey}
                onChange={(event) =>
                  setRoleForm((currentValue) => ({
                    ...currentValue,
                    homeModuleKey: event.target.value,
                  }))
                }
              >
                {(modules || []).map((moduleItem) => (
                  <option key={moduleItem.key} value={moduleItem.key}>
                    {moduleItem.name}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" disabled={creatingRole}>
                {creatingRole ? "Creating..." : "Create Role"}
              </button>
            </form>

            <hr className="my-4" />

            <h5 className="mb-3">Roles</h5>
            <select
              className="form-select mb-3"
              value={selectedRoleId}
              onChange={(event) => setSelectedRoleId(event.target.value)}
            >
              {(roles || []).map((role) => (
                <option key={role._id} value={role._id}>
                  {role.name}
                </option>
              ))}
            </select>

            <div className="small text-muted">
              Select a role to manage the default permission matrix for that role.
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-8">
          <div className="soft-card h-100">
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
              <div>
                <h5 className="mb-1">Role Permission Matrix</h5>
                <div className="form-help">
                  Screen access is controlled by `View`. All other actions control operations inside
                  the selected module.
                </div>
              </div>
              <button className="btn btn-primary" onClick={saveRoleMatrix} disabled={savingRoleMatrix}>
                {savingRoleMatrix ? "Saving..." : "Save Role Permissions"}
              </button>
            </div>

            <PermissionMatrixTable
              actions={actions}
              rows={roleMatrixRows}
              onToggleAll={(checked) =>
                setRoleMatrixRows((currentValue) =>
                  updateAllMatrixRows(currentValue, getActionFieldKeys(actions), checked)
                )
              }
              onToggleAction={(fieldKey, checked) =>
                setRoleMatrixRows((currentValue) =>
                  updateMatrixColumnRows(currentValue, fieldKey, checked)
                )
              }
              onToggle={(moduleKey, fieldKey, checked) =>
                setRoleMatrixRows((currentValue) =>
                  updateMatrixRows(currentValue, moduleKey, fieldKey, checked)
                )
              }
            />
          </div>
        </div>
      </div>

      <div className="row g-4 mt-1">
        <div className="col-12 col-xl-4">
          <div className="soft-card h-100">
            <h5 className="mb-3">Particular User / Employee</h5>
            <select
              className="form-select mb-3"
              value={selectedPrincipalKey}
              onChange={(event) => setSelectedPrincipalKey(event.target.value)}
            >
              {principalOptions.map((principal) => (
                <option
                  key={`${principal.principalType}:${principal.principalId}`}
                  value={`${principal.principalType}:${principal.principalId}`}
                >
                  {principal.label}
                </option>
              ))}
            </select>

            {selectedPrincipal ? (
              <>
                <div className="form-help mb-3">
                  Saved role: <strong>{selectedPrincipal.roleName || "Unassigned"}</strong>
                </div>

                {effectivePrincipalRoleId !== savedPrincipalRoleId ? (
                  <div className="form-help mb-3 text-primary">
                    Pending role selection:{" "}
                    <strong>{effectivePrincipalRole?.name || "Unassigned"}</strong>. Save Person
                    Mapping before saving overrides.
                  </div>
                ) : null}

                <div className="form-help mb-3">
                  Effective scope: <strong>{scopeLabelMap[effectiveScopeStrategy] || "Mapped Data"}</strong>
                </div>

                {mappingSelectionsWillBeIgnored ? (
                  <div className="alert alert-warning py-2">
                    The selected company, site, department, or employee mappings will not apply
                    while the effective scope is <strong>Own Data</strong>. Change the scope to
                    <strong> Mapped Data</strong> to make those selections work.
                  </div>
                ) : null}

                <div className="d-flex flex-column gap-3">
                  <div>
                    <label className="form-label fw-semibold">Assigned Role</label>
                    <select
                      className="form-select"
                      value={accessForm.roleId}
                      onChange={(event) =>
                        setAccessForm((currentValue) => ({
                          ...currentValue,
                          roleId: event.target.value,
                        }))
                      }
                    >
                      <option value="">No Role</option>
                      {roles.map((role) => (
                        <option key={role._id} value={role._id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label fw-semibold">Scope Strategy</label>
                    <select
                      className="form-select"
                      value={accessForm.accessScopeStrategy}
                      onChange={(event) =>
                        setAccessForm((currentValue) => ({
                          ...currentValue,
                          accessScopeStrategy: event.target.value,
                        }))
                      }
                    >
                      <option value="inherit">Inherit Role Scope</option>
                      <option value="mapped">Mapped Data</option>
                      <option value="all">All Data</option>
                      <option value="own">Own Data</option>
                      <option value="managed">Managed Team Data</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label fw-semibold">Companies</label>
                    <select
                      className="form-select"
                      multiple
                      value={accessForm.accessCompanyIds}
                      onChange={(event) =>
                        updateAccessSelections("accessCompanyIds", getSelectedValues(event))
                      }
                    >
                      {companies.map((company) => (
                        <option key={company._id} value={company._id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label fw-semibold">Sites</label>
                    <select
                      className="form-select"
                      multiple
                      value={accessForm.accessSiteIds}
                      onChange={(event) =>
                        updateAccessSelections("accessSiteIds", getSelectedValues(event))
                      }
                    >
                      {sites.map((site) => (
                        <option key={site._id} value={site._id}>
                          {[site.companyName, site.name].filter(Boolean).join(" - ")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label fw-semibold">Departments</label>
                    <select
                      className="form-select"
                      multiple
                      value={accessForm.accessDepartmentIds}
                      onChange={(event) =>
                        updateAccessSelections("accessDepartmentIds", getSelectedValues(event))
                      }
                    >
                      {departments.map((department) => (
                        <option key={department._id} value={department._id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label fw-semibold">Sub Departments</label>
                    <select
                      className="form-select"
                      multiple
                      value={accessForm.accessSubDepartmentIds}
                      onChange={(event) =>
                        updateAccessSelections(
                          "accessSubDepartmentIds",
                          getSelectedValues(event)
                        )
                      }
                    >
                      {subDepartmentOptions.map((subDepartment) => (
                        <option key={subDepartment._id} value={subDepartment._id}>
                          {subDepartment.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label fw-semibold">Employees</label>
                    <select
                      className="form-select"
                      multiple
                      value={accessForm.accessEmployeeIds}
                      onChange={(event) =>
                        updateAccessSelections("accessEmployeeIds", getSelectedValues(event))
                      }
                    >
                      {employees.map((employee) => (
                        <option key={employee._id} value={employee._id}>
                          {`${employee.employeeCode || "EMP"} - ${employee.employeeName || "Employee"}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button className="btn btn-primary" onClick={savePrincipalAccess} disabled={savingAccess}>
                    {savingAccess ? "Saving..." : "Save Person Mapping"}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-muted">No user or employee available for override setup.</div>
            )}
          </div>
        </div>

        <div className="col-12 col-xl-8">
          <div className="soft-card h-100">
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
              <div>
                <h5 className="mb-1">User Specific Override Matrix</h5>
                <div className="form-help">
                  Start from the assigned role and tick only the screens/actions this particular
                  person should gain or lose.
                </div>
                {hasUnsavedAccessChanges ? (
                  <div className="form-help text-primary mt-2">
                    Save Person Mapping first to apply the selected role/scope before saving
                    overrides.
                  </div>
                ) : null}
              </div>
              <button
                className="btn btn-primary"
                onClick={saveOverrideMatrix}
                disabled={savingOverrides || !selectedPrincipal || hasUnsavedAccessChanges}
              >
                {savingOverrides ? "Saving..." : "Save User Overrides"}
              </button>
            </div>

            <PermissionMatrixTable
              actions={actions}
              rows={overrideRows}
              onToggleAll={(checked) =>
                setOverrideRows((currentValue) =>
                  updateAllMatrixRows(currentValue, getActionFieldKeys(actions), checked)
                )
              }
              onToggleAction={(fieldKey, checked) =>
                setOverrideRows((currentValue) =>
                  updateMatrixColumnRows(currentValue, fieldKey, checked)
                )
              }
              onToggle={(moduleKey, fieldKey, checked) =>
                setOverrideRows((currentValue) =>
                  updateMatrixRows(currentValue, moduleKey, fieldKey, checked)
                )
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

