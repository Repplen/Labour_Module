export default function CompanyTable({ companies, editRow, setDeleteTarget }) {
  return (
    <div className="table-shell">
      <div className="table-responsive">
        <table className="table table-bordered table-hover align-middle">
          <thead className="table-light">
            <tr>
              <th>#</th>
              <th>Company</th>
              <th>Company Directors</th>
              <th width="170">Actions</th>
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
                  <td>
                    <button
                      className="btn btn-sm btn-warning me-2"
                      onClick={() => editRow(company)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() =>
                        setDeleteTarget({ id: company._id, name: company.name })
                      }
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
  );
}
