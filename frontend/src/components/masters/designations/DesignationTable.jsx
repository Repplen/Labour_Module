export default function DesignationTable({ designations, editDesignation, setDeleteTarget }) {
  return (
    <div className="table-shell">
      <div className="table-responsive">
        <table className="table table-bordered table-hover align-middle mb-0">
          <thead>
            <tr>
              <th>Sl.No</th>
              <th>Designation</th>
              <th style={{ width: "1%", whiteSpace: "nowrap" }}>Actions</th>
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
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-soft-warning btn-icon-responsive"
                        onClick={() => editDesignation(designation)}
                        title="Edit"
                      >
                        <i className="bi bi-pencil btn-icon" />
                        <span className="btn-label">Edit</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-soft-danger btn-icon-responsive"
                        onClick={() => setDeleteTarget({ id: designation._id, name: designation.name })}
                        title="Delete"
                      >
                        <i className="bi bi-trash btn-icon" />
                        <span className="btn-label">Delete</span>
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
