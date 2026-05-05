import { getComplaintProcessState } from "../../utils/complaintLifecycle";

export default function ComplaintProcessTracker({ complaint, clockNow, compact = false }) {
  const processState = getComplaintProcessState(complaint, clockNow);

  return (
    <div
      className={`complaint-process-tracker complaint-process-tracker--${processState.tone}${
        compact ? " complaint-process-tracker--compact" : ""
      }`}
    >
      <div className="complaint-process-tracker__summary">
        <div>
          <div className="complaint-process-tracker__label">Complaint Process</div>
          <div className="complaint-process-tracker__helper">{processState.helperLabel}</div>
        </div>
        <span className="complaint-process-tracker__status">{processState.statusLabel}</span>
      </div>

      <div className="complaint-process-tracker__bar" aria-hidden="true">
        <div
          className="complaint-process-tracker__fill"
          style={{ width: `${processState.progressPercent}%` }}
        />
      </div>

      <div className="complaint-process-tracker__steps">
        {processState.steps.map((step) => (
          <div
            key={step.key}
            className={`complaint-process-tracker__step complaint-process-tracker__step--${step.state}`}
          >
            <span className="complaint-process-tracker__dot" />
            <span>{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
