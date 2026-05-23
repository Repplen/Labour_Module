import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios";
import SearchableCheckboxSelector from "../components/SearchableCheckboxSelector";
import EmployeeWorkFields from "../features/employeeWork/EmployeeWorkFields";
import {
  defaultEmployeeWorkFields,
  getRateTypesForEmployeeWorkType,
  validateEmployeeWorkFields,
} from "../features/employeeWork/employeeWork.helpers";
import {
  IMAGE_FILE_ACCEPT,
  IMAGE_FILE_OPTIONS,
  validateFile,
} from "../utils/fileValidation";
import {
  getApiEmployeeFieldErrors,
  getApiDuplicateEmployeeErrors,
  getEmployeeDuplicateErrors,
} from "../utils/employeeDuplicateValidation";
import { validateEmployeeFields } from "../utils/employeeFieldValidation";
import { formatApiErrorMessage } from "../utils/apiErrors";
import { formatSiteLabel } from "../utils/siteDisplay";

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

const SUB_SITE_SEPARATOR = "::";

const flattenSubSiteRows = (rows = [], trail = []) =>
  rows.flatMap((item) => {
    const nextTrail = [...trail, item.name];
    return [
      {
        subSiteId: String(item._id),
        label: nextTrail.join(" > "),
      },
      ...flattenSubSiteRows(item.children || [], nextTrail),
    ];
  });

const buildSubSiteOptions = (siteRows = [], selectedSiteIds = []) => {
  const selectedSet = new Set((selectedSiteIds || []).map((siteId) => String(siteId)));

  return (siteRows || [])
    .filter((site) => selectedSet.has(String(site._id)))
    .flatMap((site) =>
      flattenSubSiteRows(site.subSites || []).map((subSite) => ({
        value: `${site._id}${SUB_SITE_SEPARATOR}${subSite.subSiteId}`,
        label: `${formatSiteLabel(site)} > ${subSite.label}`,
      }))
    );
};

const buildSubDepartmentOptions = (departmentRows = [], selectedDepartmentIds = []) => {
  const selectedSet = new Set(
    (selectedDepartmentIds || []).map((departmentId) => String(departmentId))
  );

  return (departmentRows || [])
    .filter((department) => selectedSet.has(String(department._id)))
    .flatMap((department) =>
      flattenSubDepartments(department.subDepartments || [], [], department)
    );
};

const toSubSiteSelectionValues = (rows = []) =>
  (rows || [])
    .map((row) => {
      const siteId = row.site?._id || row.site || row.siteId;
      const subSiteId = row.subSite?._id || row.subSite || row.subSiteId;
      if (!siteId || !subSiteId) return "";
      return `${siteId}${SUB_SITE_SEPARATOR}${subSiteId}`;
    })
    .filter(Boolean);

const toSubSitePayload = (values = []) =>
  values
    .map((value) => {
      const [site, subSite] = String(value || "").split(SUB_SITE_SEPARATOR);
      if (!site || !subSite) return null;
      return { site, subSite };
    })
    .filter(Boolean);

const normalizeSelectionValues = (value) =>
  Array.isArray(value)
    ? value.map((item) => String(item))
    : value
    ? [String(value)]
    : [];

export default function EmployeeEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [currentPhoto, setCurrentPhoto] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");

  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [sitesList, setSitesList] = useState([]);
  const [employeeRows, setEmployeeRows] = useState([]);
  const [superiorEmployees, setSuperiorEmployees] = useState([]);
  const [natureOfWorks, setNatureOfWorks] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [subSiteOptions, setSubSiteOptions] = useState([]);
  const [serverDuplicateErrors, setServerDuplicateErrors] = useState({});
  const [serverFieldErrors, setServerFieldErrors] = useState({});

  const uploadBaseUrl = useMemo(
    () => (api.defaults.baseURL || "http://localhost:5000/api").replace(/\/api\/?$/, ""),
    []
  );

  const [form, setForm] = useState({
    employeeCode: "",
    employeeName: "",
    mobile: "",
    email: "",
    password: "",
    dateOfJoining: "",
    department: [],
    subDepartment: [],
    designation: "",
    superiorEmployee: "",
    sites: [],
    subSites: [],
    isActive: true,
    ...defaultEmployeeWorkFields,
  });

  const departmentOptions = useMemo(
    () =>
      departments.map((department) => ({
        value: department._id,
        label: department.name,
      })),
    [departments]
  );
  const subDepartmentOptions = useMemo(
    () =>
      subDepartments.map((subDepartment) => ({
        value: subDepartment._id,
        label: subDepartment.label,
        description: subDepartment.departmentName
          ? `Department: ${subDepartment.departmentName}`
          : "",
      })),
    [subDepartments]
  );
  const siteSelectionOptions = useMemo(
    () =>
      sitesList.map((site) => ({
        value: site._id,
        label: formatSiteLabel(site),
        description: site.companyName ? `Company: ${site.companyName}` : "",
      })),
    [sitesList]
  );
  const subSiteSelectionOptions = useMemo(
    () =>
      subSiteOptions.map((subSite) => ({
        value: subSite.value,
        label: subSite.label,
      })),
    [subSiteOptions]
  );
  const clientValidationErrors = useMemo(() => validateEmployeeFields(form), [form]);
  const workFieldErrors = useMemo(() => validateEmployeeWorkFields(form), [form]);
  const clientDuplicateErrors = useMemo(
    () =>
      getEmployeeDuplicateErrors(
        employeeRows,
        {
          employeeCode: form.employeeCode,
          email: form.email,
          mobile: form.mobile,
        },
        id,
        { skipFields: clientValidationErrors }
      ),
    [clientValidationErrors, employeeRows, form.employeeCode, form.email, form.mobile, id]
  );
  const duplicateErrors = useMemo(
    () => ({
      employeeCode:
        clientDuplicateErrors.employeeCode || serverDuplicateErrors.employeeCode || "",
      email: clientDuplicateErrors.email || serverDuplicateErrors.email || "",
      mobile: clientDuplicateErrors.mobile || serverDuplicateErrors.mobile || "",
    }),
    [clientDuplicateErrors, serverDuplicateErrors]
  );
  const hasDuplicateErrors = Boolean(
    duplicateErrors.employeeCode || duplicateErrors.email || duplicateErrors.mobile
  );
  const fieldErrors = useMemo(
    () => ({
      employeeCode:
        clientValidationErrors.employeeCode ||
        duplicateErrors.employeeCode ||
        serverFieldErrors.employeeCode ||
        "",
      employeeName:
        clientValidationErrors.employeeName || serverFieldErrors.employeeName || "",
      email:
        clientValidationErrors.email ||
        duplicateErrors.email ||
        serverFieldErrors.email ||
        "",
      mobile:
        clientValidationErrors.mobile ||
        duplicateErrors.mobile ||
        serverFieldErrors.mobile ||
        "",
    }),
    [clientValidationErrors, duplicateErrors, serverFieldErrors]
  );
  const hasFieldErrors = Boolean(
    fieldErrors.employeeCode ||
      fieldErrors.employeeName ||
      fieldErrors.email ||
      fieldErrors.mobile
  );
  const hasWorkFieldErrors = Boolean(Object.keys(workFieldErrors).length);
  const isSaveDisabled =
    saving ||
    hasFieldErrors ||
    hasWorkFieldErrors ||
    !form.employeeCode.trim() ||
    !form.employeeName.trim();

  const loadAll = useCallback(async () => {
    try {
      const [emp, dep, des, sites, employeeRes, natureRes, uomRes] = await Promise.all([
        api.get(`/employees/${id}`),
        api.get("/departments"),
        api.get("/designations"),
        api.get("/sites"),
        api.get("/employees"),
        api.get("/nature-of-work/active"),
        api.get("/uom/active"),
      ]);

      const employee = emp.data;
      const selectedDepartmentIds = normalizeSelectionValues(
        employee.departmentIds?.length ? employee.departmentIds : employee.department
      );
      const selectedSiteIds = employee.sites?.map((site) => site._id) || [];
      const initialSubSiteValues = toSubSiteSelectionValues(
        employee.subSiteDetails?.length ? employee.subSiteDetails : employee.subSites
      );

      setForm({
        employeeCode: employee.employeeCode || "",
        employeeName: employee.employeeName || "",
        mobile: employee.mobile || "",
        email: employee.email || "",
        password: "",
        dateOfJoining: employee.dateOfJoining ? employee.dateOfJoining.slice(0, 10) : "",
        department: selectedDepartmentIds,
        subDepartment: normalizeSelectionValues(employee.subDepartment),
        designation: employee.designation?._id || "",
        superiorEmployee: employee.superiorEmployee?._id || employee.superiorEmployee || "",
        sites: selectedSiteIds,
        subSites: initialSubSiteValues,
        isActive: employee.isActive ?? true,
        employeeWorkType: employee.employeeWorkType || "General Employee",
        skillType: employee.skillType || "",
        natureOfWorkId: employee.natureOfWorkId?._id || employee.natureOfWorkId || "",
        subNatureOfWorkId:
          employee.subNatureOfWorkId?._id || employee.subNatureOfWorkId || "",
        uomId: employee.uomId?._id || employee.uomId || "",
        rateType: employee.rateType || "",
        standardRate:
          employee.standardRate === null || typeof employee.standardRate === "undefined"
            ? ""
            : String(employee.standardRate),
        overtimeRate:
          employee.overtimeRate === null || typeof employee.overtimeRate === "undefined"
            ? ""
            : String(employee.overtimeRate),
        pieceRate:
          employee.pieceRate === null || typeof employee.pieceRate === "undefined"
            ? ""
            : String(employee.pieceRate),
        gstApplicable: Boolean(employee.gstApplicable),
        gstPercent:
          employee.gstPercent === null || typeof employee.gstPercent === "undefined"
            ? ""
            : String(employee.gstPercent),
        gstAmount:
          employee.gstAmount === null || typeof employee.gstAmount === "undefined"
            ? ""
            : String(employee.gstAmount),
        grossRate:
          employee.grossRate === null || typeof employee.grossRate === "undefined"
            ? ""
            : String(employee.grossRate),
        netRate:
          employee.netRate === null || typeof employee.netRate === "undefined"
            ? ""
            : String(employee.netRate),
        rateEffectiveFrom: employee.rateEffectiveFrom
          ? employee.rateEffectiveFrom.slice(0, 10)
          : "",
        rateEffectiveTo: employee.rateEffectiveTo ? employee.rateEffectiveTo.slice(0, 10) : "",
        rateRemarks: employee.rateRemarks || "",
      });

      setCurrentPhoto(employee.photo || "");
      const departmentRows = dep.data || [];
      setDepartments(departmentRows);
      setDesignations(des.data || []);
      const siteRows = sites.data || [];
      const employeeList = employeeRes.data || [];
      setSitesList(siteRows);
      setEmployeeRows(employeeList);
      setSuperiorEmployees(
        employeeList.filter((row) => String(row._id) !== String(id))
      );
      setNatureOfWorks(natureRes.data || []);
      setUoms(uomRes.data || []);
      setSubSiteOptions(buildSubSiteOptions(siteRows, selectedSiteIds));
      setSubDepartments(buildSubDepartmentOptions(departmentRows, selectedDepartmentIds));
    } catch (err) {
      console.error("Edit load failed", err);
      alert("Failed to load employee");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => {
      if (name === "employeeWorkType") {
        const rateTypes = getRateTypesForEmployeeWorkType(value);
        return {
          ...prev,
          employeeWorkType: value,
          skillType: value === "Labour" ? prev.skillType : "",
          natureOfWorkId: "",
          subNatureOfWorkId: "",
          uomId: value === "General Employee" ? "" : prev.uomId,
          rateType: rateTypes.includes(prev.rateType) ? prev.rateType : "",
          standardRate: value === "General Employee" ? "" : prev.standardRate,
          overtimeRate: value === "Labour" ? prev.overtimeRate : "",
          pieceRate: value === "Piece Worker" ? prev.pieceRate : "",
          gstApplicable: value === "General Employee" ? false : prev.gstApplicable,
          gstPercent: value === "General Employee" ? "" : prev.gstPercent,
          rateEffectiveFrom: value === "General Employee" ? "" : prev.rateEffectiveFrom,
          rateEffectiveTo: value === "General Employee" ? "" : prev.rateEffectiveTo,
          rateRemarks: value === "General Employee" ? "" : prev.rateRemarks,
        };
      }
      if (name === "natureOfWorkId") {
        return { ...prev, natureOfWorkId: value, subNatureOfWorkId: "" };
      }
      if (name === "gstApplicable") {
        return {
          ...prev,
          gstApplicable: Boolean(value),
          gstPercent: value ? prev.gstPercent : "",
        };
      }
      return { ...prev, [name]: value };
    });
    setServerFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const nextErrors = { ...prev };
      delete nextErrors[name];
      return nextErrors;
    });

    if (name === "employeeCode" || name === "email" || name === "mobile") {
      setServerDuplicateErrors((prev) => {
        if (!prev[name]) return prev;
        const nextErrors = { ...prev };
        delete nextErrors[name];
        return nextErrors;
      });
    }
  };

  const handleDepartmentsChange = (selectedDepartmentIds) => {
    const normalizedValues = normalizeSelectionValues(selectedDepartmentIds);
    const nextOptions = buildSubDepartmentOptions(departments, normalizedValues);
    const allowedValues = new Set(nextOptions.map((item) => String(item._id)));

    setSubDepartments(nextOptions);
    setForm((prev) => ({
      ...prev,
      department: normalizedValues,
      subDepartment: (prev.subDepartment || []).filter((value) =>
        allowedValues.has(String(value))
      ),
    }));
  };

  const handleSubDepartmentsChange = (selectedValues) => {
    setForm((prev) => ({
      ...prev,
      subDepartment: normalizeSelectionValues(selectedValues),
    }));
  };

  const handleSitesChange = (selectedSiteIds) => {
    const normalizedValues = normalizeSelectionValues(selectedSiteIds);
    const nextOptions = buildSubSiteOptions(sitesList, normalizedValues);
    const allowedValues = new Set(nextOptions.map((item) => item.value));

    setSubSiteOptions(nextOptions);
    setForm((prev) => ({
      ...prev,
      sites: normalizedValues,
      subSites: (prev.subSites || []).filter((value) => allowedValues.has(value)),
    }));
  };

  const handleSubSitesChange = (selectedValues) => {
    setForm((prev) => ({
      ...prev,
      subSites: normalizeSelectionValues(selectedValues),
    }));
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0] || null;
    const validationMessage = validateFile(file, IMAGE_FILE_OPTIONS);

    if (validationMessage) {
      alert(validationMessage);
      event.target.value = "";
      setPhoto(null);
      setPhotoPreview("");
      return;
    }

    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : "");
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!form.department.length) {
      alert("Select at least one department.");
      return;
    }

    if (hasFieldErrors || hasDuplicateErrors || hasWorkFieldErrors) {
      return;
    }

    setSaving(true);
    setServerDuplicateErrors({});
    setServerFieldErrors({});

    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (key === "department") {
        value.forEach((departmentId) => data.append("department", departmentId));
      } else if (key === "sites") {
        value.forEach((siteId) => data.append("sites", siteId));
      } else if (key === "subDepartment") {
        value.forEach((subDepartmentId) => data.append("subDepartment", subDepartmentId));
      } else if (key === "subSites") {
        data.append("subSites", JSON.stringify(toSubSitePayload(value)));
      } else if (key === "password") {
        if (String(value || "").trim()) {
          data.append(key, value);
        }
      } else {
        data.append(key, value);
      }
    });

    if (photo instanceof File) {
      data.append("photo", photo);
    }

    try {
      await api.put(`/employees/${id}`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Employee updated successfully");
      navigate("/employees");
    } catch (err) {
      console.error(err);
      const apiDuplicateErrors = getApiDuplicateEmployeeErrors(err);
      const apiFieldErrors = getApiEmployeeFieldErrors(err);

      if (
        apiDuplicateErrors.employeeCode ||
        apiDuplicateErrors.email ||
        apiDuplicateErrors.mobile
      ) {
        setServerDuplicateErrors(apiDuplicateErrors);
        return;
      }

      if (
        apiFieldErrors.employeeCode ||
        apiFieldErrors.employeeName ||
        apiFieldErrors.email ||
        apiFieldErrors.mobile
      ) {
        setServerFieldErrors(apiFieldErrors);
        return;
      }

      alert(formatApiErrorMessage(err, "Update failed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="container mt-4">Loading...</div>;
  }

  return (
    <div className="container py-4">
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Employees</div>
            <h4 className="mb-1">Edit Employee</h4>
            <p className="page-subtitle mb-0">
              Update profile details, then adjust departments, sites, and status with the
              simplified selectors below.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate("/employees")}
          >
            Back to Employees
          </button>
        </div>
      </div>

      <form onSubmit={submit}>
        <div className="row g-3">
          <div className="col-12 col-xl-5">
            <div className="soft-card h-100">
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h5 className="mb-1">Basic Information</h5>
                  <div className="form-help">Use this area to maintain login and profile data.</div>
                </div>
                <span className="summary-chip summary-chip--neutral">
                  {form.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <label className="form-label">Employee Code</label>
              <input
                className={`form-control${
                  fieldErrors.employeeCode ? " is-invalid" : " mb-3"
                }`}
                name="employeeCode"
                value={form.employeeCode}
                onChange={handleChange}
                placeholder="Employee Code"
                readOnly
                aria-readonly="true"
                aria-invalid={fieldErrors.employeeCode ? "true" : "false"}
                aria-describedby={
                  fieldErrors.employeeCode
                    ? "employee-code-error"
                    : undefined
                }
              />
              {fieldErrors.employeeCode ? (
                <div
                  className="invalid-feedback d-block mb-3"
                  id="employee-code-error"
                >
                  {fieldErrors.employeeCode}
                </div>
              ) : null}

              <label className="form-label">Employee Name *</label>
              <input
                className={`form-control${fieldErrors.employeeName ? " is-invalid" : " mb-3"}`}
                name="employeeName"
                value={form.employeeName}
                onChange={handleChange}
                placeholder="Employee Name"
                aria-invalid={fieldErrors.employeeName ? "true" : "false"}
                aria-describedby={fieldErrors.employeeName ? "employee-name-error" : undefined}
              />
              {fieldErrors.employeeName ? (
                <div className="invalid-feedback d-block mb-3" id="employee-name-error">
                  {fieldErrors.employeeName}
                </div>
              ) : null}

              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Mobile</label>
                  <input
                    className={`form-control${fieldErrors.mobile ? " is-invalid" : ""}`}
                    name="mobile"
                    value={form.mobile}
                    onChange={handleChange}
                    placeholder="Mobile"
                    aria-invalid={fieldErrors.mobile ? "true" : "false"}
                    aria-describedby={
                      fieldErrors.mobile ? "employee-mobile-error" : undefined
                    }
                  />
                  {fieldErrors.mobile ? (
                    <div
                      className="invalid-feedback d-block"
                      id="employee-mobile-error"
                    >
                      {fieldErrors.mobile}
                    </div>
                  ) : null}
                </div>

                <div className="col-md-6">
                  <label className="form-label">Date Of Joining</label>
                  <input
                    type="date"
                    className="form-control"
                    name="dateOfJoining"
                    value={form.dateOfJoining}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label mt-3">Email</label>
                <input
                  className={`form-control${fieldErrors.email ? " is-invalid" : ""}`}
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="Email"
                  aria-invalid={fieldErrors.email ? "true" : "false"}
                  aria-describedby={
                    fieldErrors.email ? "employee-email-error" : undefined
                  }
                />
                {fieldErrors.email ? (
                  <div
                    className="invalid-feedback d-block"
                    id="employee-email-error"
                  >
                    {fieldErrors.email}
                  </div>
                ) : null}
              </div>

              <label className="form-label">New Login Password</label>
              <input
                className="form-control mb-2"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Leave blank to keep the current password"
              />
              <div className="form-help mb-3">
                Employees can continue using employee code or email to sign in.
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={form.isActive.toString()}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        isActive: event.target.value === "true",
                      }))
                    }
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <label className="form-label fw-semibold">Profile Photo</label>
              {(photoPreview || currentPhoto) && (
                <div className="mb-3 d-flex align-items-center gap-3">
                  <img
                    src={photoPreview || `${uploadBaseUrl}/uploads/${currentPhoto}`}
                    alt="profile"
                    width="72"
                    height="72"
                    className="app-avatar-preview"
                  />
                  <div className="form-help">
                    {photoPreview ? "New photo preview" : "Current profile photo"}
                  </div>
                </div>
              )}
              <input
                type="file"
                className="form-control"
                accept={IMAGE_FILE_ACCEPT}
                onChange={handlePhotoChange}
              />
            </div>
          </div>

          <div className="col-12 col-xl-7">
            <div className="soft-card h-100">
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h5 className="mb-1">Department And Site Mapping</h5>
                  <div className="form-help">
                    Use checkboxes instead of holding Ctrl or Cmd for multiple selections.
                  </div>
                </div>
                <span className="summary-chip">
                  {form.department.length + form.sites.length + form.subSites.length} mappings
                </span>
              </div>

              <div className="mb-3">
                <SearchableCheckboxSelector
                  label="Departments"
                  helperText="Pick one or more departments for this employee."
                  options={departmentOptions}
                  selectedValues={form.department}
                  onChange={handleDepartmentsChange}
                  searchPlaceholder="Search departments"
                  emptyMessage="No departments available yet."
                />
              </div>

              <div className="mb-3">
                <SearchableCheckboxSelector
                  label="Sub Departments"
                  helperText={
                    form.department.length
                      ? "Optional. Choose matching sub departments from the selected departments."
                      : "Select one or more departments first."
                  }
                  options={subDepartmentOptions}
                  selectedValues={form.subDepartment}
                  onChange={handleSubDepartmentsChange}
                  searchPlaceholder="Search sub departments"
                  emptyMessage={
                    form.department.length
                      ? "No sub departments are available for the selected departments."
                      : "Select a department to load sub departments."
                  }
                  disabled={!form.department.length}
                />
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label">Designation *</label>
                  <select
                    className="form-select"
                    name="designation"
                    value={form.designation}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Designation</option>
                    {designations.map((designation) => (
                      <option key={designation._id} value={designation._id}>
                        {designation.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6">
                  <label className="form-label">Superior Employee</label>
                  <select
                    className="form-select"
                    name="superiorEmployee"
                    value={form.superiorEmployee}
                    onChange={handleChange}
                  >
                    <option value="">No superior</option>
                    {superiorEmployees.map((employee) => (
                      <option key={employee._id} value={employee._id}>
                        {employee.employeeCode} - {employee.employeeName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <SearchableCheckboxSelector
                  label="Sites"
                  helperText="Select every site where this employee works."
                  options={siteSelectionOptions}
                  selectedValues={form.sites}
                  onChange={handleSitesChange}
                  searchPlaceholder="Search sites"
                  emptyMessage="No sites are available yet."
                />
              </div>

              <div>
                <SearchableCheckboxSelector
                  label="Sub Sites"
                  helperText={
                    form.sites.length
                      ? "Optional. Choose the sub sites under the selected sites."
                      : "Select one or more sites first."
                  }
                  options={subSiteSelectionOptions}
                  selectedValues={form.subSites}
                  onChange={handleSubSitesChange}
                  searchPlaceholder="Search sub sites"
                  emptyMessage={
                    form.sites.length
                      ? "No sub sites are available for the selected sites."
                      : "Select a site to load sub sites."
                  }
                  disabled={!form.sites.length}
                />
              </div>
            </div>
          </div>

          <div className="col-12">
            <EmployeeWorkFields
              errors={workFieldErrors}
              form={form}
              natureOfWorks={natureOfWorks}
              uoms={uoms}
              onChange={handleChange}
            />
          </div>

          <div className="col-12 d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => navigate("/employees")}
            >
              Cancel
            </button>
            <button className="btn btn-success" disabled={isSaveDisabled}>
              {saving ? "Updating..." : "Update Employee"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
