export default function ChecklistTransferHeader({
  checklistsCount,
  historyCount,
  selectedCount,
  transferIntroText,
}) {
  return (
    <div className="page-intro-card mb-4">
      <div className="list-toolbar">
        <div>
          <div className="page-kicker">Masters</div>
          <h3 className="mb-1">Checklist Transfer</h3>
          <p className="page-subtitle mb-0">{transferIntroText}</p>
        </div>

        <div className="list-summary">
          <span className="summary-chip">{checklistsCount} loaded checklists</span>
          <span className="summary-chip summary-chip--neutral">
            {selectedCount} selected
          </span>
          <span className="summary-chip summary-chip--neutral">
            {historyCount} recent transfers
          </span>
        </div>
      </div>
    </div>
  );
}
