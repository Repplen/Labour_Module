export default function ChecklistTransferAlerts({ canTransferChecklist, error, success }) {
  return (
    <>
      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="alert alert-success" role="alert">
          {success}
        </div>
      ) : null}

      {!canTransferChecklist ? (
        <div className="alert alert-info" role="alert">
          Transfer submission is disabled for your account. You can still review mapped employees,
          checklist availability, and transfer history from this screen.
        </div>
      ) : null}
    </>
  );
}
