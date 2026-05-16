export default function SiteTable({
  sites,
  openSubSiteManager,
  editRow,
  deleteRow,
}) {
  return (
    <div className="table-shell mb-4">
      <div className="table-responsive">
        <table className="table table-bordered mb-0">
          <thead>
            <tr>
              <th>#</th>
              <th>Company</th>
              <th>Site</th>
              <th>Site Heads</th>
              <th>Site Leads</th>
              <th>Sub Sites</th>
              <th width="290">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sites.map((site, index) => (
              <tr key={site._id}>
                <td>{index + 1}</td>
                <td>{site.companyName || "-"}</td>
                <td>{site.name}</td>
                <td>{site.headNames?.length ? site.headNames.join(", ") : "-"}</td>
                <td>{site.siteLeadNames?.length ? site.siteLeadNames.join(", ") : "-"}</td>
                <td>
                  {site.subSites?.length
                    ? site.subSites
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
                      onClick={() => openSubSiteManager(site)}
                    >
                      Manage Sub
                    </button>
                    <button className="btn btn-sm btn-warning" onClick={() => editRow(site)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => deleteRow(site._id)}
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
