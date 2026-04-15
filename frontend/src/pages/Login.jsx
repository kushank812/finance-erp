import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiPost } from "../api/client";

function getErrorMessage(error) {
  if (!error) return "Login failed.";

  if (typeof error === "string") return error;

  if (typeof error?.message === "string") return error.message;

  if (typeof error?.detail === "string") return error.detail;

  if (typeof error?.error === "string") return error.error;

  if (typeof error?.message === "object" && error?.message !== null) {
    if (typeof error.message.detail === "string") return error.message.detail;
    if (typeof error.message.message === "string") return error.message.message;
    try {
      return JSON.stringify(error.message);
    } catch {
      return "Login failed.";
    }
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Login failed.";
  }
}

export default function Login({ refreshAuth }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);

  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const redirectTo = location.state?.from || "/entry";

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    const loginValue = loginId.trim();

    if (!loginValue) {
      setErr("User ID or Email is required.");
      return;
    }

    if (!password) {
      setErr("Password is required.");
      return;
    }

    try {
      setLoading(true);

      await apiPost("/auth/login", {
        login_id: loginValue,
        password,
        remember_session: remember,
      });

      await refreshAuth();
      navigate(redirectTo, { replace: true });
    } catch (e2) {
      setErr(getErrorMessage(e2));
      console.error("Login failed:", e2);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={page}>
      <div style={leftPanel}>
        <div style={brandWrap}>
          <div style={logoBox}>F</div>
          <div>
            <h1 style={brandTitle}>FINANCE ERP</h1>
            <p style={brandSub}>Accounts Receivable / Accounts Payable Management</p>
          </div>
        </div>

        <div style={{ height: 24 }} />

        <h2 style={heroTitle}>Secure access to your finance workspace</h2>
        <p style={heroText}>
          Manage customers, vendors, invoices, purchase bills, receipts, payments,
          statements, aging, and dashboard insights from one place.
        </p>

        <div style={{ height: 22 }} />

        <div style={featureList}>
          <Feature text="Secure sign-in flow" />
          <Feature text="Backend session-based access" />
          <Feature text="Responsive laptop + phone layout" />
          <Feature text="Professional ERP-style interface" />
        </div>
      </div>

      <div style={rightPanel}>
        <div style={card}>
          <div style={cardTop}>
            <h2 style={title}>Sign in</h2>
            <p style={subtitle}>Enter your user ID or email and password to continue.</p>
          </div>

          {err ? <div style={msgErr}>{err}</div> : null}

          <form onSubmit={onSubmit}>
            <div style={fieldWrap}>
              <label style={label}>User ID / Email</label>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Enter user ID or email"
                autoComplete="username"
                style={input}
              />
            </div>

            <div style={fieldWrap}>
              <label style={label}>Password</label>

              <div style={pwdWrap}>
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  style={pwdInput}
                />

                <button
                  type="button"
                  onClick={() => setShowPwd((p) => !p)}
                  style={toggleBtn}
                >
                  {showPwd ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div style={metaRow}>
              <label style={rememberWrap}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Remember session</span>
              </label>

              <button
                type="button"
                style={linkBtn}
                onClick={() =>
                  setErr(
                    "For password reset, contact the system administrator. Self-service reset is not enabled."
                  )
                }
              >
                Forgot password?
              </button>
            </div>

            <button type="submit" style={submitBtn} disabled={loading}>
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <div style={bottomNote}>
            Authorized access only. All actions may be logged for security.
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ text }) {
  return (
    <div style={featureItem}>
      <div style={featureDot} />
      <span>{text}</span>
    </div>
  );
}

const page = {
  minHeight: "100vh",
  display: "grid",
  gridTemplateColumns: "1.1fr 0.9fr",
  background: "linear-gradient(135deg, #0b1220 0%, #0f172a 45%, #111827 100%)",
};

const leftPanel = {
  padding: "48px 56px",
  color: "#e5e7eb",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const rightPanel = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "rgba(255,255,255,0.03)",
};

const brandWrap = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const logoBox = {
  width: 54,
  height: 54,
  borderRadius: 16,
  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
  fontWeight: 900,
  boxShadow: "0 12px 30px rgba(37,99,235,0.35)",
};

const brandTitle = {
  margin: 0,
  fontSize: 28,
  fontWeight: 900,
  letterSpacing: 0.6,
};

const brandSub = {
  margin: "6px 0 0 0",
  color: "#9ca3af",
  fontSize: 14,
};

const heroTitle = {
  margin: 0,
  fontSize: 42,
  lineHeight: 1.1,
  fontWeight: 900,
  maxWidth: 520,
};

const heroText = {
  marginTop: 16,
  maxWidth: 560,
  color: "#cbd5e1",
  fontSize: 16,
  lineHeight: 1.7,
};

const featureList = {
  display: "grid",
  gap: 12,
};

const featureItem = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#dbeafe",
  fontSize: 15,
};

const featureDot = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "#60a5fa",
  boxShadow: "0 0 0 4px rgba(96,165,250,0.15)",
};

const card = {
  width: "100%",
  maxWidth: 430,
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 24,
  padding: 28,
  boxShadow: "0 30px 80px rgba(0,0,0,0.22)",
};

const cardTop = {
  marginBottom: 18,
};

const title = {
  margin: 0,
  fontSize: 28,
  color: "#111827",
  fontWeight: 900,
};

const subtitle = {
  margin: "8px 0 0 0",
  color: "#6b7280",
  fontSize: 14,
};

const fieldWrap = {
  marginBottom: 16,
};

const label = {
  display: "block",
  marginBottom: 7,
  fontSize: 13,
  fontWeight: 800,
  color: "#111827",
};

const input = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #d1d5db",
  outline: "none",
  background: "#fff",
  color: "#111827",
  boxSizing: "border-box",
  fontSize: 14,
};

const pwdWrap = {
  display: "flex",
  alignItems: "center",
  border: "1px solid #d1d5db",
  borderRadius: 14,
  overflow: "hidden",
  background: "#fff",
};

const pwdInput = {
  flex: 1,
  padding: "12px 14px",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#111827",
  fontSize: 14,
  minWidth: 0,
};

const toggleBtn = {
  border: "none",
  borderLeft: "1px solid #e5e7eb",
  background: "#f9fafb",
  color: "#1d4ed8",
  fontWeight: 800,
  cursor: "pointer",
  padding: "12px 16px",
  whiteSpace: "nowrap",
};

const metaRow = {
  marginTop: 2,
  marginBottom: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const rememberWrap = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#374151",
  fontSize: 13,
};

const linkBtn = {
  border: "none",
  background: "transparent",
  color: "#1d4ed8",
  fontWeight: 800,
  cursor: "pointer",
  padding: 0,
};

const submitBtn = {
  width: "100%",
  padding: "13px 16px",
  borderRadius: 14,
  border: "1px solid #1d4ed8",
  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  color: "#fff",
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 14px 30px rgba(37,99,235,0.28)",
};

const msgErr = {
  background: "#ffecec",
  border: "1px solid #ffb3b3",
  color: "#a40000",
  padding: 10,
  borderRadius: 12,
  marginBottom: 14,
  fontSize: 14,
};

const bottomNote = {
  marginTop: 18,
  color: "#6b7280",
  fontSize: 12,
  textAlign: "center",
  lineHeight: 1.6,
};