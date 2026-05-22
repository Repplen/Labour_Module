import NatureOfWorkStatusBadge from "./NatureOfWorkStatusBadge";

export default function NatureOfWorkTable({ onAddChild, onDelete, onEdit, onStatus, onView, permissions, works }) {
  return (
    <div className="table-shell mb-4">
      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead>
            <tr>
              <th>S.No</th>
              <th>Work Name</th>
              <th>Parent Work</th>
              <th>Level</th>
              <th>Full Path</th>
              <th>Work Outturn</th>
              <th>UOM</th>
              <th>Total Quantity</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {works.map((work, index) => (
              <tr key={work._id}>
                <td>{index + 1}</td>
                <td className="fw-semibold">{work.workName}</td>
                <td>{work.parentWorkId?.workName || "-"}</td>
                <td>Level {work.level}</td>
                <td>{work.path}</td>
                <td>{work.isWorkOutturnRequired ? "Yes" : "No"}</td>
                <td>{work.uomName ? `${work.uomName} ${work.uomSymbol ? `(${work.uomSymbol})` : ""}` : "-"}</td>
                <td>{work.totalQuantity || work.totalQuantity === 0 ? `${work.totalQuantity} ${work.uomSymbol || ""}` : "-"}</td>
                <td><NatureOfWorkStatusBadge isActive={work.isActive} /></td>
                <td>
                  <div className="d-flex flex-wrap gap-1">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onView(work)}>View</button>
                    {permissions.canAdd ? <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onAddChild(work)}>Add Child</button> : null}
                    {permissions.canEdit ? <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onEdit(work)}>Edit</button> : null}
                    {permissions.canStatusUpdate ? <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => onStatus(work)}>{work.isActive ? "Inactive" : "Active"}</button> : null}
                    {permissions.canDelete ? <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDelete(work)}>Delete</button> : null}
                  </div>
                </td>
              </tr>
            ))}
            {!works.length ? (
              <tr><td colSpan="10" className="text-center text-muted py-4">No nature of work records found.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
