export const flattenMainLocationTree = (nodes = []) => {
  const rows = [];

  const visit = (node, depth = 0) => {
    rows.push({ ...node, depth });
    (node.children || []).forEach((child) => visit(child, depth + 1));
  };

  nodes.forEach((node) => visit(node, 0));
  return rows;
};

export const getSiteLabel = (site) => {
  if (!site) return "-";
  return [site.companyName, site.name].filter(Boolean).join(" - ") || site.name || "-";
};

export const getNodeId = (node) => String(node?._id || node?.id || "");

export const nodeHasChildren = (node) =>
  Boolean(node?.hasChildren || (Array.isArray(node?.children) && node.children.length));
