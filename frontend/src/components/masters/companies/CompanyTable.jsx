export default function CompanyTable({ companies, editRow, setDeleteTarget }) {
  return (
    <div className="table-shell">
      <div className="table-responsive">
        <table className="table table-bordered table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>Sl.No</th>
              <th>Company</th>
              <th>Company Directors</th>
              <th style={{ width: "1%", whiteSpace: "nowrap" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center py-4">
                  No companies found
                </td>
              </tr>
            ) : (
              companies.map((company, index) => (
                <tr key={company._id}>
                  <td>{index + 1}</td>
                  <td>{company.name}</td>
                  <td>
                    {company.directorNames?.length
                      ? company.directorNames.join(", ")
                      : "-"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-soft-warning btn-icon-responsive"
                        onClick={() => editRow(company)}
                        title="Edit"
                      >
                        <i className="bi bi-pencil btn-icon" />
                        <span className="btn-label">Edit</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-soft-danger btn-icon-responsive"
                        onClick={() => setDeleteTarget({ id: company._id, name: company.name })}
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
