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
              <th>#</th>
              <th>Department</th>
              <th>Department Heads</th>
              <th>Department Leads</th>
              <th>Sub Departments</th>
              <th width="290">Actions</th>
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
                <td>
                  <div className="d-flex flex-wrap gap-2">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => openSubDepartmentManager(department)}
                    >
                      Manage Sub
                    </button>
                    <button
                      className="btn btn-sm btn-warning"
                      onClick={() => editDepartment(department)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => deleteDepartment(department._id)}
                    >
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
  );
}
