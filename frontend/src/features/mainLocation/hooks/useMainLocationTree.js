import { useMemo, useState } from "react";
import { getNodeId } from "../helpers/mainLocation.helpers";

const buildTreeFromList = (rows = []) => {
  const byId = new Map();
  const roots = [];

  rows.forEach((row) => {
    byId.set(getNodeId(row), { ...row, children: [] });
  });

  byId.forEach((row) => {
    const parentId = row.parentLocationId?._id || row.parentLocationId || "";
    const parent = parentId ? byId.get(String(parentId)) : null;
    if (parent) parent.children.push(row);
    else roots.push(row);
  });

  const sortTree = (nodes) => {
    nodes.sort((left, right) => left.path.localeCompare(right.path));
    nodes.forEach((node) => sortTree(node.children));
  };

  sortTree(roots);
  return roots;
};

export function useMainLocationTree(locations = []) {
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());

  const tree = useMemo(() => buildTreeFromList(locations), [locations]);

  const toggleNode = (nodeId) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  return {
    collapsedIds,
    tree,
    toggleNode,
  };
}
