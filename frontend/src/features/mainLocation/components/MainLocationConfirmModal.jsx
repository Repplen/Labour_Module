export default function MainLocationConfirmModal({
  confirmState,
  onCancel,
  onConfirm,
  saving,
}) {
  if (!confirmState) return null;

  return (
    <div className="main-location-modal-backdrop" role="dialog" aria-modal="true">
      <div className="main-location-modal main-location-modal--sm">
        <h5 className="mb-2">{confirmState.title}</h5>
        <p className="text-muted">{confirmState.message}</p>
        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${confirmState.variant || "btn-primary"}`}
            onClick={onConfirm}
            disabled={saving}
          >
            {saving ? "Working..." : confirmState.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
