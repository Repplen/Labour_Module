import { useMemo, useState } from "react";
import { getNodeId } from "../helpers/natureOfWork.helpers";

const buildTreeFromList = (rows = []) => {
  const byId = new Map();
  const roots = [];

  rows.forEach((row) => byId.set(getNodeId(row), { ...row, children: [] }));
  byId.forEach((row) => {
    const parentId = row.parentWorkId?._id || row.parentWorkId || "";
    const parent = parentId ? byId.get(String(parentId)) : null;
    if (parent) parent.children.push(row);
    else roots.push(row);
  });

  const sortTree = (nodes) => {
    nodes.sort((left, right) => String(left.path || "").localeCompare(String(right.path || "")));
    nodes.forEach((node) => sortTree(node.children));
  };
  sortTree(roots);
  return roots;
};

export function useNatureOfWorkTree(works = []) {
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const tree = useMemo(() => buildTreeFromList(works), [works]);

  const toggleNode = (nodeId) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  return { collapsedIds, tree, toggleNode };
}
