import MainLocationStatusBadge from "./MainLocationStatusBadge";
import { getSiteLabel, nodeHasChildren } from "../helpers/mainLocation.helpers";

export default function MainLocationTable({
  locations,
  permissions,
  onAddChild,
  onDelete,
  onEdit,
  onStatus,
  onView,
}) {
  return (
    <div className="table-shell mb-4">
      <div className="table-responsive">
        <table className="table table-hover align-middle">
          <thead>
            <tr>
              <th>S.No</th>
              <th>Site Name</th>
              <th>Location Name</th>
              <th>Parent Location</th>
              <th>Level</th>
              <th>Full Path</th>
              <th>Has Children</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((location, index) => (
              <tr key={location._id}>
                <td>{index + 1}</td>
                <td>{getSiteLabel(location.siteId)}</td>
                <td className="fw-semibold">{location.locationName}</td>
                <td>{location.parentLocationId?.locationName || "-"}</td>
                <td>Level {location.level}</td>
                <td>{location.path}</td>
                <td>{nodeHasChildren(location) ? "Yes" : "No"}</td>
                <td><MainLocationStatusBadge isActive={location.isActive} /></td>
                <td>
                  <div className="d-flex flex-wrap gap-1">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onView(location)}>
                      View
                    </button>
                    {permissions.canAdd ? (
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onAddChild(location)}>
                        Add Child
                      </button>
                    ) : null}
                    {permissions.canEdit ? (
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onEdit(location)}>
                        Edit
                      </button>
                    ) : null}
                    {permissions.canStatusUpdate ? (
                      <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => onStatus(location)}>
                        {location.isActive ? "Inactive" : "Active"}
                      </button>
                    ) : null}
                    {permissions.canDelete ? (
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDelete(location)}>
                        Delete
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!locations.length ? (
              <tr>
                <td colSpan="9" className="text-center text-muted py-4">
                  No locations found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
