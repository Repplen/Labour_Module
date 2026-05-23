export default function LabourPieceWorkerConfirmModal({ confirmState, onCancel, onConfirm, saving }) {
  if (!confirmState) return null;

  return (
    <div className="labour-piece-worker-modal-backdrop" role="dialog" aria-modal="true">
      <div className="labour-piece-worker-modal labour-piece-worker-modal--sm">
        <h5>{confirmState.title}</h5>
        <p className="mb-4">{confirmState.message}</p>
        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className={`btn ${confirmState.variant || "btn-primary"}`} onClick={onConfirm} disabled={saving}>
            {saving ? "Working..." : confirmState.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
