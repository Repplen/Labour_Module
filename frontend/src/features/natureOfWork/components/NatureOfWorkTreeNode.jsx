import NatureOfWorkStatusBadge from "./NatureOfWorkStatusBadge";
import { getNodeId, nodeHasChildren } from "../helpers/natureOfWork.helpers";

export default function NatureOfWorkTreeNode({
  collapsedIds,
  depth = 0,
  node,
  onAddChild,
  onDelete,
  onEdit,
  onStatus,
  onToggle,
  onView,
  permissions,
}) {
  const nodeId = getNodeId(node);
  const hasChildren = nodeHasChildren(node);
  const isCollapsed = collapsedIds.has(nodeId);

  return (
    <div className="nature-work-tree-node">
      <div className="nature-work-tree-row" style={{ "--depth": depth }}>
        <button type="button" className="nature-work-tree-toggle" onClick={() => onToggle(nodeId)} disabled={!hasChildren} aria-label={isCollapsed ? "Expand work" : "Collapse work"}>
          {hasChildren ? (isCollapsed ? "+" : "-") : ""}
        </button>
        <div className="nature-work-tree-content" title={node.path}>
          <div className="fw-semibold text-dark">{node.workName}</div>
          <div className="small text-muted">{node.path}</div>
        </div>
        <span className="badge text-bg-light border text-dark">Level {node.level}</span>
        <span className={`badge ${node.isWorkOutturnRequired ? "text-bg-info" : "text-bg-light border text-dark"}`}>{node.isWorkOutturnRequired ? "Outturn" : "No Outturn"}</span>
        {node.uomName ? <span className="badge text-bg-light border text-dark">{node.uomName} {node.uomSymbol ? `(${node.uomSymbol})` : ""}</span> : null}
        {node.totalQuantity || node.totalQuantity === 0 ? <span className="badge text-bg-primary">{node.totalQuantity} {node.uomSymbol}</span> : null}
        <NatureOfWorkStatusBadge isActive={node.isActive} />
        <div className="nature-work-tree-actions">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onView(node)}>View</button>
          {permissions.canAdd ? <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onAddChild(node)}>Add Child</button> : null}
          {permissions.canEdit ? <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => onEdit(node)}>Edit</button> : null}
          {permissions.canStatusUpdate ? <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => onStatus(node)}>{node.isActive ? "Inactive" : "Active"}</button> : null}
          {permissions.canDelete ? <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDelete(node)}>Delete</button> : null}
        </div>
      </div>
      {!isCollapsed && hasChildren ? (
        <div>
          {node.children.map((child) => (
            <NatureOfWorkTreeNode
              key={getNodeId(child)}
              collapsedIds={collapsedIds}
              depth={depth + 1}
              node={child}
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
