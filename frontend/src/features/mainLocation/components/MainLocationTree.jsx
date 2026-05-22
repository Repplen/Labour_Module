import MainLocationTreeNode from "./MainLocationTreeNode";
import { getNodeId } from "../helpers/mainLocation.helpers";

export default function MainLocationTree({
  collapsedIds,
  loading,
  permissions,
  tree,
  onAddChild,
  onDelete,
  onEdit,
  onStatus,
  onToggle,
  onView,
}) {
  return (
    <div className="soft-card main-location-tree mb-3">
      <div className="list-toolbar mb-3">
        <div>
          <h5 className="mb-1">Location Tree</h5>
          <div className="small text-muted">Expand a site location and add children at any level.</div>
        </div>
      </div>

      {loading ? (
        <div className="text-muted">Loading location tree...</div>
      ) : tree.length ? (
        <div className="d-flex flex-column gap-2">
          {tree.map((node) => (
            <MainLocationTreeNode
              key={getNodeId(node)}
              node={node}
              collapsedIds={collapsedIds}
              permissions={permissions}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onEdit={onEdit}
              onStatus={onStatus}
              onToggle={onToggle}
              onView={onView}
            />
          ))}
        </div>
      ) : (
        <div className="text-muted">No locations found for the selected filters.</div>
      )}
    </div>
  );
}
