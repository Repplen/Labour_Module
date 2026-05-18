export default function DepartmentTable({
  departments,
  openSubDepartmentManager,
  editDepartment,
  deleteDepartment,
}) {
  return (
    <div className="table-shell mb-4">
      <div className="table-responsive">
        <table className="table table-bordered mb-0">
          <thead>
            <tr>
              <th>Sl.No</th>
              <th>Department</th>
              <th>Department Heads</th>
              <th>Department Leads</th>
              <th>Sub Departments</th>
              <th style={{ width: "1%", whiteSpace: "nowrap" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((department, index) => (
              <tr key={department._id}>
                <td>{index + 1}</td>
                <td>{department.name}</td>
                <td>{department.headNames?.length ? department.headNames.join(", ") : "-"}</td>
                <td>
                  {department.departmentLeadNames?.length
                    ? department.departmentLeadNames.join(", ")
                    : "-"}
                </td>
                <td>
                  {department.subDepartments?.length
                    ? department.subDepartments
                        .map((sub) =>
                          sub.headNames?.length
                            ? `${sub.name} (${sub.headNames.join(", ")})`
                            : sub.name
                        )
                        .join(", ")
                    : "-"}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-soft-primary btn-icon-responsive"
                      onClick={() => openSubDepartmentManager(department)}
                      title="Manage Sub Departments"
                    >
                      <i className="bi bi-diagram-3 btn-icon" />
                      <span className="btn-label">Manage Sub</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-soft-warning btn-icon-responsive"
                      onClick={() => editDepartment(department)}
                      title="Edit"
                    >
                      <i className="bi bi-pencil btn-icon" />
                      <span className="btn-label">Edit</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-soft-danger btn-icon-responsive"
                      onClick={() => deleteDepartment(department._id, department.name)}
                      title="Delete"
                    >
                      <i className="bi bi-trash btn-icon" />
                      <span className="btn-label">Delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
