export default function ChecklistTransferConfirmation({
  canTransferChecklist,
  form,
  handlePermanentTransfer,
  handleTemporaryTransfer,
  hasInvalidTemporaryDateRange,
  isTemporaryTransfer,
  selectedChecklistIds,
  submitting,
  usesApprovalRequestFlow,
}) {
  return (
    <div className="soft-card mb-4">
      <div className="list-toolbar">
        <div>
          <h5 className="mb-1">
            {isTemporaryTransfer
              ? "Temporary Transfer Confirmation"
              : "Permanent Transfer Confirmation"}
          </h5>
          <div className="form-help">
            {isTemporaryTransfer
              ? usesApprovalRequestFlow
                ? "The selected checklist masters will stay unchanged until admin approval. After approval, the temporary transfer window will be saved and applied in the normal transfer flow."
                : "The selected checklist masters will move only for the selected date range. During that period the new employee will handle the transferred checklist masters and related checklist tasks, then the assignment will automatically revert."
              : usesApprovalRequestFlow
              ? "The selected checklist masters will stay unchanged until admin approval. After approval, the permanent transfer will update the checklist owner and related checklist tasks."
              : "The selected checklist masters will be moved permanently. The new employee will own the transferred checklist masters and the related checklist tasks."}
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={isTemporaryTransfer ? handleTemporaryTransfer : handlePermanentTransfer}
          disabled={
            submitting ||
            !canTransferChecklist ||
            !form.fromEmployeeId ||
            !form.toEmployeeId ||
            (isTemporaryTransfer &&
              (!form.fromDate || !form.toDate || hasInvalidTemporaryDateRange)) ||
            !selectedChecklistIds.length
          }
        >
          {submitting
            ? usesApprovalRequestFlow
              ? "Submitting..."
              : "Transferring..."
            : isTemporaryTransfer
            ? usesApprovalRequestFlow
              ? "Submit Temporary Transfer Request"
              : "Temporary Transfer"
            : usesApprovalRequestFlow
            ? "Submit Permanent Transfer Request"
            : "Permanent Transfer"}
        </button>
      </div>
    </div>
  );
}
