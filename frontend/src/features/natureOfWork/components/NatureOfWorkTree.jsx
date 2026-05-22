import NatureOfWorkTreeNode from "./NatureOfWorkTreeNode";
import { getNodeId } from "../helpers/natureOfWork.helpers";

export default function NatureOfWorkTree(props) {
  const { loading, tree } = props;

  return (
    <div className="soft-card nature-work-tree mb-3">
      <div className="list-toolbar mb-3">
        <div>
          <h5 className="mb-1">Work Tree</h5>
          <div className="small text-muted">Expand a work category and add child levels as deep as needed.</div>
        </div>
      </div>
      {loading ? (
        <div className="text-muted">Loading nature of work tree...</div>
      ) : tree.length ? (
        <div className="d-flex flex-column gap-2">
          {tree.map((node) => <NatureOfWorkTreeNode key={getNodeId(node)} node={node} {...props} />)}
        </div>
      ) : (
        <div className="text-muted">No nature of work records found.</div>
      )}
    </div>
  );
}
