import { useEffect } from "react";

/**
 * ConfirmDialog — Clean modern style.

 * Variants: "danger" | "warning" | "info"
 */

const VARIANTS = {
  danger: {
    emoji:        "🗑️",
    iconBg:       "#FEF2F2",
    iconBorder:   "#FECACA",
    accentColor:  "#DC2626",
    accentBg:     "#FEF2F2",
    btnClass:     "btn-danger",
    // tagLabel:     "Delete Action",
  },
  warning: {
    emoji:        "⚠️",
    iconBg:       "#FFFBEB",
    iconBorder:   "#FDE68A",
    accentColor:  "#D97706",
    accentBg:     "#FFFBEB",
    btnClass:     "btn-warning",
    // tagLabel:     "Warning",
  },
  info: {
    emoji:        "ℹ️",
    iconBg:       "#EFF6FF",
    iconBorder:   "#BFDBFE",
    accentColor:  "#2563EB",
    accentBg:     "#EFF6FF",
    btnClass:     "btn-primary",
    // tagLabel:     "Confirm Action",
  },
};

export default function ConfirmDialog({
  open,
  variant      = "danger",
  title        = "Are you sure?",
  message      = "This action cannot be undone.",
  confirmLabel = "Confirm",
  cancelLabel  = "Cancel",
  onConfirm,
  onCancel,
  loading      = false,
}) {
  const config = VARIANTS[variant] || VARIANTS.danger;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape" && !loading) onCancel?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => { if (!loading) onCancel?.(); }}
        style={{
          position:       "fixed",
          inset:          0,
          background:     "rgba(15, 23, 42, 0.40)",
          backdropFilter: "blur(8px)",
          zIndex:         1055,
        }}
      />

      {/* Dialog */}
      <div style={{
        position:       "fixed",
        inset:          0,
        zIndex:         1056,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        padding:        "1rem",
        pointerEvents:  "none",
      }}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          style={{
            pointerEvents:  "auto",
            background:     "#ffffff",
            borderRadius:   "24px",
            maxWidth:       "360px",
            width:          "100%",
            overflow:       "hidden",
            boxShadow:      "0 32px 80px rgba(15,23,42,0.18), 0 8px 24px rgba(15,23,42,0.08)",
            border:         "1px solid #F1F5F9",
          }}
        >
          {/* Top accent bar */}
          <div style={{
            height:     "4px",
            background: `linear-gradient(90deg, ${config.accentColor}, ${config.accentColor}88)`,
          }} />

          {/* Content */}
          <div style={{
            padding:       "2rem",
            textAlign:     "center",
            display:       "flex",
            flexDirection: "column",
            alignItems:    "center",
            gap:           "0",
          }}>
            {/* Icon */}
            <div style={{
              width:          "72px",
              height:         "72px",
              borderRadius:   "50%",
              background:     config.iconBg,
              border:         `2px solid ${config.iconBorder}`,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              fontSize:       "2rem",
              marginBottom:   "1.25rem",
            }}>
              {config.emoji}
            </div>

            {/* Title */}
            <h5
              id="confirm-title"
              style={{
                margin:      0,
                marginBottom:"0.5rem",
                fontFamily:  "var(--font-base)",
                fontWeight:  700,
                fontSize:    "1.15rem",
                color:       "#0F172A",
                lineHeight:  1.3,
              }}
            >
              {title}
            </h5>

            {/* Message */}
            <p style={{
              margin:        0,
              marginBottom:  "2rem",
              fontFamily:    "var(--font-base)",
              fontSize:      "0.875rem",
              color:         "#64748B",
              lineHeight:    1.7,
              maxWidth:      "280px",
            }}>
              {message}
            </p>

            {/* Buttons */}
            <div style={{
              display: "flex",
              gap:     "0.75rem",
              width:   "100%",
            }}>
              <button
                className="btn btn-outline-secondary"
                onClick={() => { if (!loading) onCancel?.(); }}
                disabled={loading}
                style={{
                  flex:         1,
                  borderRadius: "12px",
                  fontWeight:   500,
                  padding:      "0.6rem",
                }}
              >
                {cancelLabel}
              </button>

              <button
                className={`btn ${config.btnClass}`}
                onClick={onConfirm}
                disabled={loading}
                style={{
                  flex:         1,
                  borderRadius: "12px",
                  fontWeight:   600,
                  padding:      "0.6rem",
                }}
              >
                {loading ? (
                  <span style={{
                    display:        "flex",
                    alignItems:     "center",
                    gap:            "0.4rem",
                    justifyContent: "center",
                  }}>
                    <span style={{
                      width:        "13px",
                      height:       "13px",
                      border:       "2px solid rgba(255,255,255,0.35)",
                      borderTop:    "2px solid #fff",
                      borderRadius: "50%",
                      animation:    "spin 0.7s linear infinite",
                      display:      "inline-block",
                      flexShrink:   0,
                    }} />
                    {confirmLabel}...
                  </span>
                ) : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
