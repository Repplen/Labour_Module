import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login } from "../api/authApi";
import { usePermissions } from "../context/usePermissions";
import { startPostLoginWelcomeSession } from "../utils/postLoginWelcome";
import webLogo from "../assets/Web-logo.png";

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function PasswordVisibilityIcon({ visible }) {
  return (
    <svg className="login-password-toggle__icon" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false">
      {visible ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.58 10.58A2 2 0 0 0 13.42 13.42" />
          <path d="M9.88 4.24A10.94 10.94 0 0 1 12 4c4.2 0 7.79 2.36 10 8a18.45 18.45 0 0 1-3.17 4.73" />
          <path d="M6.61 6.61A17.85 17.85 0 0 0 2 12c2.21 5.64 5.8 8 10 8a10.8 10.8 0 0 0 5.39-1.61" />
        </>
      ) : (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

export default function Login() {
  const { refresh } = usePermissions();
  const [loginId, setLoginId]       = useState("");
  const [password, setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get("reason") === "session-expired";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await login({ loginId: loginId.trim(), password: password.trim() });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      startPostLoginWelcomeSession(res.data.token || `login-${Date.now()}`);
      await refresh();
      navigate("/welcome", { replace: true });
    } catch (err) {
      const responseData = err.response?.data || {};
      const retryAfterMinutes = Number(responseData.retryAfterMinutes || 0);
      if (err.response?.status === 429) {
        setError(responseData.message ||
          `Too many login attempts. Please try again${retryAfterMinutes ? ` after ${retryAfterMinutes} minutes` : " later"}.`);
      } else {
        setError(responseData.message || "Invalid login ID or password");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-split">

        {/* ── Left: Brand Panel ── */}
        <div className="login-brand-panel">
          <div className="login-brand-deco" aria-hidden="true">
            <span className="login-brand-deco__ring login-brand-deco__ring--one" />
            <span className="login-brand-deco__ring login-brand-deco__ring--two" />
            <span className="login-brand-deco__ring login-brand-deco__ring--three" />
          </div>
          <div className="login-brand-content">
            <img src={webLogo} alt="Repplen" className="login-brand-logo" />
            <h1 className="login-brand-name">Repplen</h1>
            <p className="login-brand-tagline">
              Streamline your operations.<br />Track what matters.
            </p>
            <div className="login-brand-rule" aria-hidden="true" />
            <p className="login-brand-sub">
              Your all-in-one platform for smart checklists, real-time tracking,
              and seamless team collaboration.
            </p>
            <ul className="login-brand-chips" aria-label="Key features">
              <li className="login-brand-chip"><CheckIcon />Smart Checklists</li>
              <li className="login-brand-chip"><CheckIcon />Team Collaboration</li>
              <li className="login-brand-chip"><CheckIcon />Real-time Tracking</li>
            </ul>
          </div>
        </div>

        {/* ── Right: Form Panel ── */}
        <div className="login-form-panel">
          <div className="login-form-content">
            <div className="login-form-header">
              <h2 className="login-form-title">Welcome</h2>
              <p className="login-form-subtitle">Sign in to access your workspace</p>
            </div>

            {sessionExpired && !error ? (
              <div className="alert alert-warning py-2" role="alert">
                Session expired. Please log in again.
              </div>
            ) : null}

            {error ? (
              <div className="alert alert-danger" role="alert" data-testid="login-error">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit}>
              <div className="login-field mb-3">
                <label className="form-label">Login ID</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon"><UserIcon /></span>
                  <input
                    data-testid="login-email"
                    type="text"
                    className="form-control login-input"
                    placeholder="Employee code, name, or email"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="login-field mb-4">
                <label className="form-label">Password</label>
                <div className="login-input-wrap login-password-control">
                  <span className="login-input-icon"><LockIcon /></span>
                  <input
                    data-testid="login-password"
                    type={showPassword ? "text" : "password"}
                    className="form-control login-input login-password-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((c) => !c)}
                  >
                    <PasswordVisibilityIcon visible={showPassword} />
                  </button>
                </div>
              </div>

              <button
                className="btn w-100 login-submit"
                disabled={loading}
                data-testid="login-submit"
              >
                {loading ? (
                  <>
                    <span className="login-spinner" aria-hidden="true" />
                    Signing in…
                  </>
                ) : "Sign In"}
              </button>

              <div className="form-help text-center mt-3" aria-live="polite">
                {loading
                  ? "Checking your credentials…"
                  : "Use your employee code, name, or email to sign in."}
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
