import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import SearchableCheckboxSelector from "../components/SearchableCheckboxSelector";
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
  const selectedSet = new Set((selectedSiteIds || []).map((id) => String(id)));

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
  const selectedSet = new Set((selectedDepartmentIds || []).map((id) => String(id)));

  return (departmentRows || [])
    .filter((department) => selectedSet.has(String(department._id)))
    .flatMap((department) =>
      flattenSubDepartments(department.subDepartments || [], [], department)
    );
};

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

export default function EmployeeForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [sitesList, setSitesList] = useState([]);
  const [employeeRows, setEmployeeRows] = useState([]);
  const [superiorEmployees, setSuperiorEmployees] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [subSiteOptions, setSubSiteOptions] = useState([]);
  const [serverDuplicateErrors, setServerDuplicateErrors] = useState({});
  const [serverFieldErrors, setServerFieldErrors] = useState({});

  const [form, setForm] = useState({
    employeeCode: "",
    employeeName: "",
    mobile: "",
    password: "",
    department: [],
    subDepartment: [],
    designation: "",
    superiorEmployee: "",
    email: "",
    dateOfJoining: "",
    sites: [],
    subSites: [],
  });

  useEffect(() => {
    loadMasters();
  }, []);

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
  const clientDuplicateErrors = useMemo(
    () =>
      getEmployeeDuplicateErrors(employeeRows, {
        employeeCode: form.employeeCode,
        email: form.email,
        mobile: form.mobile,
      }, null, { skipFields: clientValidationErrors }),
    [clientValidationErrors, employeeRows, form.employeeCode, form.email, form.mobile]
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
  const isSaveDisabled =
    loading ||
    hasFieldErrors ||
    !form.employeeCode.trim() ||
    !form.employeeName.trim() ||
    !form.password.trim();

  const loadMasters = async () => {
    try {
      const [deptRes, desigRes, siteRes, employeeRes] = await Promise.all([
        api.get("/departments"),
        api.get("/designations"),
        api.get("/sites"),
        api.get("/employees"),
      ]);

      setDepartments(deptRes.data || []);
      setDesignations(desigRes.data || []);
      setSitesList(siteRes.data || []);
      setEmployeeRows(employeeRes.data || []);
      setSuperiorEmployees(employeeRes.data || []);
    } catch (err) {
      console.error("Failed to load masters", err);
      alert("Failed to load masters");
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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

  const handleSubSitesChange = (selectedSubSiteValues) => {
    setForm((prev) => ({
      ...prev,
      subSites: normalizeSelectionValues(selectedSubSiteValues),
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

    if (hasFieldErrors || hasDuplicateErrors) {
      return;
    }

    setLoading(true);
    setServerDuplicateErrors({});
    setServerFieldErrors({});

    try {
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
        } else if (value !== "" && value !== null) {
          data.append(key, value);
        }
      });

      if (photo) {
        data.append("photo", photo);
      }

      await api.post("/employees", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Employee saved successfully");
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

      alert(formatApiErrorMessage(err, "Save failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4">
      <div className="page-intro-card mb-4">
        <div className="list-toolbar">
          <div>
            <div className="page-kicker">Employees</div>
            <h4 className="mb-1">Add Employee</h4>
            <p className="page-subtitle mb-0">
              Complete the basic details first, then use the searchable selectors to map
              departments, sites, and optional sub levels.
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

      <form onSubmit={submit} encType="multipart/form-data">
        <div className="row g-3">
          <div className="col-12 col-xl-5">
            <div className="soft-card h-100">
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h5 className="mb-1">Basic Information</h5>
                  <div className="form-help">
                    Required fields are marked by the form controls below.
                  </div>
                </div>
                <span className="summary-chip summary-chip--neutral">Login ready</span>
              </div>

              <label className="form-label">Employee Code *</label>
              <input
                className={`form-control${
                  fieldErrors.employeeCode ? " is-invalid" : " mb-3"
                }`}
                name="employeeCode"
                placeholder="Employee Code"
                value={form.employeeCode}
                onChange={handleChange}
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
                placeholder="Employee Name"
                value={form.employeeName}
                onChange={handleChange}
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
                    placeholder="Mobile"
                    value={form.mobile}
                    onChange={handleChange}
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
                    className="form-control"
                    type="date"
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
                  placeholder="Email"
                  value={form.email}
                  onChange={handleChange}
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

              <label className="form-label">Login Password *</label>
              <input
                className="form-control mb-2"
                name="password"
                type="password"
                placeholder="Employee login password"
                value={form.password}
                onChange={handleChange}
                required
              />
              <div className="form-help mb-3">
                Employees can sign in using employee code or email with this password.
              </div>

              <label className="form-label fw-semibold">Profile Photo</label>
              <input
                className="form-control mb-2"
                type="file"
                accept={IMAGE_FILE_ACCEPT}
                onChange={handlePhotoChange}
              />
              {photoPreview ? (
                <div className="mt-3 d-flex align-items-center gap-3">
                  <img
                    src={photoPreview}
                    alt="preview"
                    width="72"
                    height="72"
                    className="app-avatar-preview"
                  />
                  <div className="form-help">Photo preview</div>
                </div>
              ) : null}
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
                  label="Employee Sites"
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
                  label="Employee Sub Sites"
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

          <div className="col-12 d-flex justify-content-end gap-2 mt-1">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => navigate("/employees")}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-success"
              disabled={isSaveDisabled}
            >
              {loading ? "Saving..." : "Save Employee"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
