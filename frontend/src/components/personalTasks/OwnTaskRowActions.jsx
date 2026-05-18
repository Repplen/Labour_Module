const canEdit = (row) =>
  (row.viewerRelationship === "own" || row.viewerRelationship === "creator") &&
  row.status !== "completed";

const canDelete = (row) =>
  row.viewerRelationship === "own" || row.viewerRelationship === "creator";

export default function OwnTaskRowActions({
  row,
  onViewTask,
  onOpenShareModal,
  onCompleteTask,
  onEditTask,
  onDeleteTask,
  completingTaskId,
  sharingTaskId,
}) {
  const isCompleting = String(completingTaskId) === String(row._id);
  const isSharing = String(sharingTaskId) === String(row._id);

  return (
    <div className="d-flex flex-nowrap gap-1">
      <button
        type="button"
        className="btn btn-sm btn-soft-primary btn-icon-sq"
        onClick={() => onViewTask(row._id)}
        title="View"
      >
        <i className="bi bi-eye" />
      </button>

      {canEdit(row) ? (
        <button
          type="button"
          className="btn btn-sm btn-soft-warning btn-icon-sq"
          onClick={() => onEditTask(row)}
          title="Edit"
        >
          <i className="bi bi-pencil" />
        </button>
      ) : null}

      {row.canShare && row.status !== "completed" ? (
        <button
          type="button"
          className="btn btn-sm btn-soft-secondary btn-icon-sq"
          onClick={() => { void onOpenShareModal(row); }}
          disabled={isSharing}
          title={isSharing ? "Sharing..." : "Share"}
        >
          <i className={`bi ${isSharing ? "bi-arrow-clockwise" : "bi-share"}`} />
        </button>
      ) : null}

      {row.canComplete || row.status === "completed" ? (
        <button
          type="button"
          className="btn btn-sm btn-soft-success btn-icon-sq"
          onClick={() => onCompleteTask(row._id)}
          disabled={row.status === "completed" || !row.canComplete || isCompleting}
          title={row.status === "completed" ? "Completed" : isCompleting ? "Updating..." : "Mark Complete"}
        >
          <i className={`bi ${row.status === "completed" ? "bi-check-circle-fill" : isCompleting ? "bi-arrow-clockwise" : "bi-check-circle"}`} />
        </button>
      ) : null}

      {canDelete(row) ? (
        <button
          type="button"
          className="btn btn-sm btn-soft-danger btn-icon-sq"
          onClick={() => onDeleteTask(row._id)}
          title="Delete"
        >
          <i className="bi bi-trash" />
        </button>
      ) : null}
    </div>
  );
}
