import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { getApiUserFieldErrors, validateUserFields } from "../utils/userFieldValidation";

const defaultCreateForm = {
  name: "",
  email: "",
  password: "",
  siteId: "",
};

const defaultEditForm = {
  id: "",
  name: "",
  email: "",
  password: "",
  role: "user",
  siteId: "",
};

const DEFAULT_ADMIN_EMAIL = "admin@test.com";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const formatSiteDisplayName = (site) => {
  if (!site) return "-";

  const companyName = String(site.companyName || "").trim();
  const name = String(site.name || "").trim();

  if (companyName && name) return `${companyName} - ${name}`;
  return name || companyName || "-";
};

const getUserSite = (user) => {
  if (user?.site && typeof user.site === "object") {
    return user.site;
  }

  if (user?.siteName || user?.siteCompanyName || user?.siteId) {
    return {
      _id: user.siteId || "",
      name: user.siteName || "",
      companyName: user.siteCompanyName || "",
    };
  }

  return null;
};

const getAccessLabel = (user) => {
  if (user?.role === "admin") return "Full Admin";
  if (user?.role === "user" || user?.checklistMasterAccess) return "Checklist Master";
  return "Workspace User";
};

const getAccessBadgeClass = (user) => {
  if (user?.role === "admin") return "bg-danger";
  if (user?.role === "user" || user?.checklistMasterAccess) return "bg-primary";
  return "bg-secondary";
};

function UserModalShell({ title, subtitle, onClose, children }) {
  return (
    <div
      className="modal fade show d-block app-modal-overlay"
      tabIndex="-1"
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header">
            <div>
              <h5 className="modal-title mb-1">{title}</h5>
              {subtitle ? <div className="small text-muted">{subtitle}</div> : null}
            </div>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function UsersAdmin() {
  const [users, setUsers] = useState([]);
  const [sites, setSites] = useState([]);
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [editForm, setEditForm] = useState(defaultEditForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [viewUser, setViewUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [createTouched, setCreateTouched] = useState({});
  const [editTouched, setEditTouched] = useState({});
  const [createServerErrors, setCreateServerErrors] = useState({});
  const [editServerErrors, setEditServerErrors] = useState({});

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isDefaultAdmin =
    Boolean(currentUser?.isDefaultAdmin) ||
    normalizeEmail(currentUser?.email) === DEFAULT_ADMIN_EMAIL;

  const siteOptions = useMemo(
    () =>
      (Array.isArray(sites) ? sites : []).filter(
        (site) => String(site?._id || "").trim() && site?.isActive !== false
      ),
    [sites]
  );
  const createClientErrors = useMemo(
    () => validateUserFields(createForm, { requirePassword: true }),
    [createForm]
  );
  const editClientErrors = useMemo(() => validateUserFields(editForm), [editForm]);
  const createFieldErrors = useMemo(
    () => ({
      name: createClientErrors.name || createServerErrors.name || "",
      email: createClientErrors.email || createServerErrors.email || "",
      password: createClientErrors.password || createServerErrors.password || "",
      siteId: createServerErrors.siteId || "",
    }),
    [createClientErrors, createServerErrors]
  );
  const editFieldErrors = useMemo(
    () => ({
      name: editClientErrors.name || editServerErrors.name || "",
      email: editClientErrors.email || editServerErrors.email || "",
      password: editClientErrors.password || editServerErrors.password || "",
      siteId: editServerErrors.siteId || "",
    }),
    [editClientErrors, editServerErrors]
  );
  const shouldShowCreateError = (field) => Boolean(createTouched[field] && createFieldErrors[field]);
  const shouldShowEditError = (field) => Boolean(editTouched[field] && editFieldErrors[field]);
  const isCreateDisabled =
    saving ||
    !siteOptions.length ||
    !createForm.siteId ||
    Object.values(createFieldErrors).some(Boolean);
  const isEditDisabled =
    updating ||
    (editForm.role !== "admin" && !editForm.siteId) ||
    Object.values(editFieldErrors).some(Boolean);

  const loadPage = async () => {
    setLoading(true);
    setError("");

    try {
      const [usersResponse, sitesResponse] = await Promise.all([
        api.get("/auth/users"),
        api.get("/sites"),
      ]);

      setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
      setSites(Array.isArray(sitesResponse.data) ? sitesResponse.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load users");
      setUsers([]);
      setSites([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPage();
  }, []);

  const resetCreateForm = () => {
    setCreateForm(defaultCreateForm);
    setCreateTouched({});
    setCreateServerErrors({});
  };

  const handleCreateChange = (event) => {
    const { name, value } = event.target;
    setCreateForm((prev) => ({ ...prev, [name]: value }));
    setCreateTouched((prev) => ({ ...prev, [name]: true }));
    setCreateServerErrors((prev) => {
      if (!prev[name]) return prev;
      const nextErrors = { ...prev };
      delete nextErrors[name];
      return nextErrors;
    });
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
    setEditTouched((prev) => ({ ...prev, [name]: true }));
    setEditServerErrors((prev) => {
      if (!prev[name]) return prev;
      const nextErrors = { ...prev };
      delete nextErrors[name];
      return nextErrors;
    });
  };

  const openViewModal = (user) => {
    setViewUser(user);
  };

  const closeViewModal = () => {
    setViewUser(null);
  };

  const openEditModal = (user) => {
    const userSite = getUserSite(user);

    setEditingUser(user);
    setEditTouched({});
    setEditServerErrors({});
    setEditForm({
      id: String(user?._id || ""),
      name: user?.name || "",
      email: user?.email || "",
      password: "",
      role: user?.role === "admin" ? "admin" : "user",
      siteId: user?.role === "admin" ? "" : String(userSite?._id || ""),
    });
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditForm(defaultEditForm);
    setEditTouched({});
    setEditServerErrors({});
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user "${user.email}"?`)) return;

    setError("");
    setSuccess("");

    try {
      await api.delete(`/auth/users/${user._id}`);
      setSuccess("User deleted successfully");

      if (String(viewUser?._id || "") === String(user._id)) {
        closeViewModal();
      }

      if (String(editingUser?._id || "") === String(user._id)) {
        closeEditModal();
      }

      await loadPage();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete user");
    }
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    setCreateTouched({ name: true, email: true, password: true, siteId: true });

    try {
      if (Object.values(createClientErrors).some(Boolean)) {
        return;
      }

      if (!createForm.siteId) {
        throw new Error("Site is required");
      }

      await api.post("/auth/users", {
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        siteId: createForm.siteId,
        checklistMasterAccess: true,
      });

      setSuccess("Checklist Master user created successfully");
      resetCreateForm();
      await loadPage();
    } catch (err) {
      const fieldErrors = getApiUserFieldErrors(err);
      if (Object.values(fieldErrors).some(Boolean)) {
        setCreateServerErrors(fieldErrors);
        return;
      }
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to create Checklist Master user"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    setUpdating(true);
    setError("");
    setSuccess("");
    setEditTouched({ name: true, email: true, password: true, siteId: true });

    try {
      if (Object.values(editClientErrors).some(Boolean)) {
        return;
      }

      if (editForm.role !== "admin" && !editForm.siteId) {
        throw new Error("Site is required for Checklist Master users");
      }

      const payload = {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        role: editForm.role,
        checklistMasterAccess: editForm.role === "admin" ? false : true,
      };

      const nextPassword = editForm.password.trim();
      if (nextPassword) {
        payload.password = nextPassword;
      }

      if (editForm.role !== "admin") {
        payload.siteId = editForm.siteId;
      }

      const response = await api.put(`/auth/users/${editForm.id}`, payload);

      if (String(currentUser.id || "") === String(editForm.id) && response.data?.user) {
        localStorage.setItem("user", JSON.stringify(response.data.user));
      }

      setSuccess("User updated successfully");
      closeEditModal();
      await loadPage();
    } catch (err) {
      const fieldErrors = getApiUserFieldErrors(err);
      if (Object.values(fieldErrors).some(Boolean)) {
        setEditServerErrors(fieldErrors);
        return;
      }
      setError(err.response?.data?.message || err.message || "Failed to update user");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="container mt-4" data-testid="user-admin-page">
      <h4 className="mb-3">Admin User Panel</h4>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {success ? <div className="alert alert-success py-2">{success}</div> : null}

      <div className="card mb-4">
        <div className="card-body">
          <h6 className="card-title">Create Checklist Master User</h6>

          <form className="row g-2" onSubmit={handleCreateSubmit}>
            <div className="col-md-3">
              <input
                className={`form-control${shouldShowCreateError("name") ? " is-invalid" : ""}`}
                name="name"
                placeholder="Name"
                value={createForm.name}
                onChange={handleCreateChange}
                aria-invalid={shouldShowCreateError("name") ? "true" : "false"}
                aria-describedby={shouldShowCreateError("name") ? "create-user-name-error" : undefined}
              />
              {shouldShowCreateError("name") ? (
                <div className="invalid-feedback d-block" id="create-user-name-error">
                  {createFieldErrors.name}
                </div>
              ) : null}
            </div>

            <div className="col-md-3">
              <select
                className="form-select"
                name="siteId"
                value={createForm.siteId}
                onChange={handleCreateChange}
                required
                disabled={!siteOptions.length}
              >
                <option value="">Select Site</option>
                {siteOptions.map((site) => (
                  <option key={site._id} value={site._id}>
                    {formatSiteDisplayName(site)}
                  </option>
                ))}
              </select>
              <div className="form-text">Site list comes from Site Master.</div>
            </div>

            <div className="col-md-2">
              <input
                type="text"
                className={`form-control${shouldShowCreateError("email") ? " is-invalid" : ""}`}
                name="email"
                placeholder="Email"
                value={createForm.email}
                onChange={handleCreateChange}
                aria-invalid={shouldShowCreateError("email") ? "true" : "false"}
                aria-describedby={shouldShowCreateError("email") ? "create-user-email-error" : undefined}
              />
              {shouldShowCreateError("email") ? (
                <div className="invalid-feedback d-block" id="create-user-email-error">
                  {createFieldErrors.email}
                </div>
              ) : null}
            </div>

            <div className="col-md-2">
              <input
                type="password"
                className={`form-control${shouldShowCreateError("password") ? " is-invalid" : ""}`}
                name="password"
                placeholder="Password"
                value={createForm.password}
                onChange={handleCreateChange}
                required
                minLength={6}
                aria-invalid={shouldShowCreateError("password") ? "true" : "false"}
                aria-describedby={shouldShowCreateError("password") ? "create-user-password-error" : undefined}
              />
              {shouldShowCreateError("password") ? (
                <div className="invalid-feedback d-block" id="create-user-password-error">
                  {createFieldErrors.password}
                </div>
              ) : null}
            </div>

            <div className="col-md-2">
              <input
                className="form-control"
                value="Checklist Master"
                readOnly
                aria-label="Access module"
              />
              <div className="form-text">Site-based checklist access.</div>
            </div>

            <div className="col-12 d-flex justify-content-end">
              <button
                className="btn btn-primary px-4"
                disabled={isCreateDisabled}
                data-testid="add-user-button"
              >
                {saving ? "Saving..." : "Create User"}
              </button>
            </div>
          </form>

          {!siteOptions.length ? (
            <div className="form-text mt-2 text-danger">
              Create a site in Site Master before adding checklist users.
            </div>
          ) : null}

          {isDefaultAdmin ? (
            <div className="form-text mt-2">
              Default Admin can create site-based Checklist Master users only.
            </div>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h6 className="card-title">Multiple Users View</h6>

          <div className="table-responsive">
            <table
              className="table table-striped table-bordered align-middle"
              data-testid="user-table"
            >
              <thead className="table-dark">
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Site</th>
                  <th>Access</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user._id}>
                      <td>
                        {user.name}
                        {String(currentUser.id || "") === String(user._id) ? (
                          <span className="badge bg-info text-dark ms-2">You</span>
                        ) : null}
                      </td>
                      <td>{user.email}</td>
                      <td>{formatSiteDisplayName(getUserSite(user))}</td>
                      <td>
                        <span className={`badge ${getAccessBadgeClass(user)}`}>
                          {getAccessLabel(user)}
                        </span>
                      </td>
                      <td>
                        {user.createdAt ? new Date(user.createdAt).toLocaleString() : "-"}
                      </td>
                      <td className="text-nowrap">
                        <button
                          type="button"
                          className="btn btn-sm btn-info me-1"
                          onClick={() => openViewModal(user)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-warning me-1"
                          onClick={() => openEditModal(user)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(user)}
                          disabled={String(currentUser.id || "") === String(user._id)}
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

      {viewUser ? (
        <UserModalShell
          title="User Details"
          subtitle="Review the selected login user and site access."
          onClose={closeViewModal}
        >
          <div className="modal-body">
            <div className="table-responsive">
              <table className="table table-bordered mb-0">
                <tbody>
                  <tr>
                    <th style={{ width: "35%" }}>Name</th>
                    <td>{viewUser.name || "-"}</td>
                  </tr>
                  <tr>
                    <th>Email</th>
                    <td>{viewUser.email || "-"}</td>
                  </tr>
                  <tr>
                    <th>Site</th>
                    <td>{formatSiteDisplayName(getUserSite(viewUser))}</td>
                  </tr>
                  <tr>
                    <th>Access</th>
                    <td>{getAccessLabel(viewUser)}</td>
                  </tr>
                  <tr>
                    <th>Created</th>
                    <td>
                      {viewUser.createdAt
                        ? new Date(viewUser.createdAt).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                  <tr>
                    <th>Updated</th>
                    <td>
                      {viewUser.updatedAt
                        ? new Date(viewUser.updatedAt).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={closeViewModal}>
              Close
            </button>
          </div>
        </UserModalShell>
      ) : null}

      {editingUser ? (
        <UserModalShell
          title="Edit User"
          subtitle="Update login details and the mapped site for this user."
          onClose={closeEditModal}
        >
          <form onSubmit={handleEditSubmit}>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">Name</label>
                  <input
                    className={`form-control${shouldShowEditError("name") ? " is-invalid" : ""}`}
                    name="name"
                    value={editForm.name}
                    onChange={handleEditChange}
                    aria-invalid={shouldShowEditError("name") ? "true" : "false"}
                    aria-describedby={shouldShowEditError("name") ? "edit-user-name-error" : undefined}
                  />
                  {shouldShowEditError("name") ? (
                    <div className="invalid-feedback d-block" id="edit-user-name-error">
                      {editFieldErrors.name}
                    </div>
                  ) : null}
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Email</label>
                  <input
                    type="text"
                    className={`form-control${shouldShowEditError("email") ? " is-invalid" : ""}`}
                    name="email"
                    value={editForm.email}
                    onChange={handleEditChange}
                    aria-invalid={shouldShowEditError("email") ? "true" : "false"}
                    aria-describedby={shouldShowEditError("email") ? "edit-user-email-error" : undefined}
                  />
                  {shouldShowEditError("email") ? (
                    <div className="invalid-feedback d-block" id="edit-user-email-error">
                      {editFieldErrors.email}
                    </div>
                  ) : null}
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Site</label>
                  {editForm.role === "admin" ? (
                    <>
                      <input className="form-control" value="Not site-scoped" readOnly />
                      <div className="form-text">Admin users are not limited to one site.</div>
                    </>
                  ) : (
                    <>
                      <select
                        className="form-select"
                        name="siteId"
                        value={editForm.siteId}
                        onChange={handleEditChange}
                        required
                      >
                        <option value="">Select Site</option>
                        {siteOptions.map((site) => (
                          <option key={site._id} value={site._id}>
                            {formatSiteDisplayName(site)}
                          </option>
                        ))}
                      </select>
                      <div className="form-text">
                        This user will only manage employees from the selected site.
                      </div>
                    </>
                  )}
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">Access</label>
                  <input
                    className="form-control"
                    value={getAccessLabel(editingUser)}
                    readOnly
                  />
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold">New Password</label>
                  <input
                    type="password"
                    className={`form-control${shouldShowEditError("password") ? " is-invalid" : ""}`}
                    name="password"
                    value={editForm.password}
                    onChange={handleEditChange}
                    placeholder="Leave blank to keep current password"
                    minLength={6}
                    aria-invalid={shouldShowEditError("password") ? "true" : "false"}
                    aria-describedby={shouldShowEditError("password") ? "edit-user-password-error" : undefined}
                  />
                  {shouldShowEditError("password") ? (
                    <div className="invalid-feedback d-block" id="edit-user-password-error">
                      {editFieldErrors.password}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={closeEditModal}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isEditDisabled}>
                {updating ? "Updating..." : "Save Changes"}
              </button>
            </div>
          </form>
        </UserModalShell>
      ) : null}
    </div>
  );
}
