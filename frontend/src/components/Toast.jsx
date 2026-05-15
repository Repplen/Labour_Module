import { useEffect } from "react";

/**
 * Toast — fixed bottom-right notification.
 * Uses Bootstrap alert classes — no custom CSS needed.
 *
 * Variants: "success" | "error" | "warning" | "info"
 */

const VARIANTS = {
  success: { alertClass: "alert-success", icon: "✓" },
  error:   { alertClass: "alert-danger",  icon: "✕" },
  warning: { alertClass: "alert-warning", icon: "⚠" },
  info:    { alertClass: "alert-info",    icon: "ℹ" },
};

export default function Toast({ toast, onClose, duration = 3000 }) {
  const { show, message, variant = "success" } = toast || {};
  const config = VARIANTS[variant] || VARIANTS.success;

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [show, message, duration, onClose]);

  if (!show) return null;

  return (
    <div
      style={{
        position:  "fixed",
        bottom:    "24px",
        left:      "50%",
transform: "translateX(-50%)",
        zIndex:    9999,
        minWidth:  "260px",
        maxWidth:  "380px",
      }}
    >
      <div
        className={`alert ${config.alertClass} d-flex align-items-center gap-2 mb-0 shadow`}
        style={{ borderRadius: "10px", fontSize: "0.875rem", fontWeight: 500 }}
      >
        <span style={{
          width: "22px", height: "22px", borderRadius: "50%",
          background: "rgba(0,0,0,0.1)", display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: "0.7rem", fontWeight: 700, flexShrink: 0,
        }}>
          {config.icon}
        </span>
        <span style={{ flex: 1 }}>{message}</span>
        <button
          onClick={onClose}
          className="btn-close"
          style={{ fontSize: "0.7rem" }}
          aria-label="Close"
        />
      </div>
    </div>
  );
}
