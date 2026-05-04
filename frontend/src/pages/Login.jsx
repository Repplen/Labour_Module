import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login } from "../api/authApi";
import AnimatedBorderCard from "../components/AnimatedBorderCard";
import { usePermissions } from "../context/usePermissions";
import { startPostLoginWelcomeSession } from "../utils/postLoginWelcome";
import loginBackground from "../images/login.jpg";

function PasswordVisibilityIcon({ visible }) {
  return (
    <svg
      className="login-password-toggle__icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
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
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionExpired = searchParams.get("reason") === "session-expired";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const res = await login({
        loginId: loginId.trim(),
        password: password.trim(),
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      startPostLoginWelcomeSession(res.data.token || `login-${Date.now()}`);
      await refresh();

      navigate("/welcome", { replace: true });
    } catch (err) {
      const responseData = err.response?.data || {};
      const retryAfterMinutes = Number(responseData.retryAfterMinutes || 0);

      if (err.response?.status === 429) {
        setError(
          responseData.message ||
            `Too many login attempts. Please try again${
              retryAfterMinutes ? ` after ${retryAfterMinutes} minutes` : " later"
            }.`
        );
      } else {
        setError(responseData.message || "Invalid login ID or password");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-shell__ambient" aria-hidden="true">
        <span className="login-shell__ambient-light login-shell__ambient-light--one" />
        <span className="login-shell__ambient-light login-shell__ambient-light--two" />
        <span className="login-shell__ambient-light login-shell__ambient-light--three" />
      </div>
      <div className="login-shell__media" aria-hidden="true">
        <img className="login-shell__photo" src={loginBackground} alt="" />
      </div>
      <div className="login-shell__aurora" aria-hidden="true">
        <span className="login-shell__aurora-blur login-shell__aurora-blur--one" />
        <span className="login-shell__aurora-blur login-shell__aurora-blur--two" />
        <span className="login-shell__aurora-blur login-shell__aurora-blur--three" />
      </div>
      <div className="login-shell__glow login-shell__glow--one" aria-hidden="true" />
      <div className="login-shell__glow login-shell__glow--two" aria-hidden="true" />
      <div className="login-shell__grid" aria-hidden="true" />
      <div className="container py-5 login-shell__content">
        <div className="row justify-content-center w-100">
          <div className="col-12 col-md-9 col-lg-6 col-xl-5">
            <div className="login-stage">
              <div className="page-intro-card mb-4 text-center login-hero">
                <div className="login-hero__halo" aria-hidden="true">
                  <span className="login-hero__halo-ring login-hero__halo-ring--one" />
                  <span className="login-hero__halo-ring login-hero__halo-ring--two" />
                </div>
                <div className="page-kicker login-hero__kicker">Welcome</div>
                <h1 className="login-hero__title">
                  <span className="login-hero__title-accent">Repplen</span>
                </h1>
              </div>

              <AnimatedBorderCard
                className="login-card-frame"
                contentClassName={`soft-card login-card${loading ? " login-card--loading" : ""}`}
                variant="login"
              >
                <div className="login-card__signal" aria-hidden="true">
                  <span className="login-card__signal-ring login-card__signal-ring--one" />
                  <span className="login-card__signal-ring login-card__signal-ring--two" />
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
                    <input
                      data-testid="login-email"
                      type="text"
                      className="form-control login-input"
                      placeholder="Employee code, employee name, or email"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      required
                    />
                  </div>

                  <div className="login-field mb-4">
                    <label className="form-label">Password</label>
                    <div className="login-password-control">
                      <input
                        data-testid="login-password"
                        type={showPassword ? "text" : "password"}
                        className="form-control login-input login-password-input"
                        placeholder="Password"
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
                        onClick={() => setShowPassword((current) => !current)}
                      >
                        <PasswordVisibilityIcon visible={showPassword} />
                      </button>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary w-100 login-submit"
                    disabled={loading}
                    data-testid="login-submit"
                  >
                    {loading ? (
                      <>
                        <span className="login-spinner" aria-hidden="true" />
                        Signing in...
                      </>
                    ) : (
                      "Login"
                    )}
                  </button>

                  <div className="form-help text-center mt-3" aria-live="polite">
                    {loading
                      ? "Checking your credentials and preparing your workspace."
                      : "Use your employee code, employee name, or email to access the dashboard."}
                  </div>
                </form>
              </AnimatedBorderCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

