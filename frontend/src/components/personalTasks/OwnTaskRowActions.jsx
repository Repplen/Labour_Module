export default function OwnTaskRowActions({
  row,
  onViewTask,
  onOpenShareModal,
  onCompleteTask,
  completingTaskId,
  sharingTaskId,
}) {
  const isCompleting = String(completingTaskId) === String(row._id);
  const isSharing = String(sharingTaskId) === String(row._id);

  return (
    <div className="d-flex flex-wrap gap-2">
      <button
        type="button"
        className="btn btn-sm btn-outline-primary"
        onClick={() => onViewTask(row._id)}
      >
        View
      </button>

      {row.canShare && row.status !== "completed" ? (
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => { void onOpenShareModal(row); }}
          disabled={isSharing}
        >
          {isSharing ? "Sharing..." : "Share"}
        </button>
      ) : null}

      {row.canComplete || row.status === "completed" ? (
        <button
          type="button"
          className="btn btn-sm btn-outline-success"
          onClick={() => onCompleteTask(row._id)}
          disabled={row.status === "completed" || !row.canComplete || isCompleting}
        >
          {isCompleting ? "Updating..." : row.status === "completed" ? "Completed" : "Complete"}
        </button>
      ) : null}
    </div>
  );
}
