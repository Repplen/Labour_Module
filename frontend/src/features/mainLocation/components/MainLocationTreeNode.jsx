import MainLocationStatusBadge from "./MainLocationStatusBadge";
import { getNodeId, nodeHasChildren } from "../helpers/mainLocation.helpers";

export default function MainLocationTreeNode({
  node,
  collapsedIds,
  depth = 0,
  permissions,
  onAddChild,
  onDelete,
  onEdit,
  onStatus,
  onToggle,
  onView,
}) {
  const nodeId = getNodeId(node);
  const hasChildren = nodeHasChildren(node);
  const isCollapsed = collapsedIds.has(nodeId);

  return (
    <div className="main-location-tree-node">
      <div className="main-location-tree-row" style={{ "--depth": depth }}>
        <button
          type="button"
          className="main-location-tree-toggle"
          onClick={() => onToggle(nodeId)}
          disabled={!hasChildren}
          aria-label={isCollapsed ? "Expand location" : "Collapse location"}
        >
          {hasChildren ? (isCollapsed ? "+" : "-") : ""}
        </button>

        <div className="main-location-tree-content">
          <div className="fw-semibold text-dark">{node.locationName}</div>
          <div className="small text-muted">{node.path}</div>
        </div>

        <span className="badge text-bg-light border text-dark">Level {node.level}</span>
        <MainLocationStatusBadge isActive={node.isActive} />

        <div className="main-location-tree-actions">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onView(node)}>
            View
          </button>
          {permissions.canAdd ? (
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onAddChild(node)}>
              Add Child
            </button>
          ) : null}
          {permissions.canEdit ? (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onEdit(node)}>
              Edit
            </button>
          ) : null}
          {permissions.canStatusUpdate ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-warning"
              onClick={() => onStatus(node)}
            >
              {node.isActive ? "Inactive" : "Active"}
            </button>
          ) : null}
          {permissions.canDelete ? (
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDelete(node)}>
              Delete
            </button>
          ) : null}
        </div>
      </div>

      {!isCollapsed && hasChildren ? (
        <div>
          {node.children.map((child) => (
            <MainLocationTreeNode
              key={getNodeId(child)}
              node={child}
              collapsedIds={collapsedIds}
              depth={depth + 1}
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
      ) : null}
    </div>
  );
}
