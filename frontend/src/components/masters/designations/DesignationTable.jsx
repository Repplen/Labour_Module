export default function DesignationTable({ designations, editDesignation, setDeleteTarget }) {
  return (
    <div className="table-shell">
      <div className="table-responsive">
        <table className="table table-bordered table-hover align-middle mb-0">
          <thead>
            <tr>
              <th>#</th>
              <th>Designation</th>
              <th width="170">Actions</th>
            </tr>
          </thead>
          <tbody>
            {designations.length === 0 ? (
              <tr>
                <td colSpan="3" className="text-center py-4 text-muted">
                  No designations found
                </td>
              </tr>
            ) : (
              designations.map((designation, index) => (
                <tr key={designation._id}>
                  <td>{index + 1}</td>
                  <td>{designation.name}</td>
                  <td>
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-sm btn-warning"
                        onClick={() => editDesignation(designation)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() =>
                          setDeleteTarget({
                            id: designation._id,
                            name: designation.name,
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
