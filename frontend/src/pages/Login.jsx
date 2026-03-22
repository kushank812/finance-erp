// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiPost } from "../api/client";

export default function Login({ refreshAuth }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    userId: "",
    password: "",
    remember: true,
  });

  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const redirectTo = location.state?.from || "/dashboard";

  function update(key, value) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    const uid = form.userId.trim().toUpperCase();

    if (!uid) return setErr("User ID is required.");
    if (!form.password) return setErr("Password is required.");

    try {
      setLoading(true);

      await apiPost("/auth/login", {
        user_id: uid,
        password: form.password,
        remember_session: form.remember,
      });

      await refreshAuth();
      navigate(redirectTo, { replace: true });
    } catch (e2) {
      setErr(String(e2.message || e2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={page}>
      {/* LEFT SIDE */}
      <div style={leftPanel}>
        <div style={brandWrap}>
          <div style={logoBox}>F</div>
          <div>
            <h1 style={brandTitle}>FINANCE ERP</h1>
            <p style={brandSub}>Accounts Receivable / Payable System</p>
          </div>
        </div>

        <h2 style={heroTitle}>Secure Finance Management</h2>
        <p style={heroText}>
          Manage invoices, payments, vendors, customers, aging, and reports in one unified system.
        </p>

        <div style={featureList}>
          <Feature text="Role-based access control" />
          <Feature text="Secure session authentication" />
          <Feature text="Responsive ERP interface" />
          <Feature text="Audit-ready system logs" />
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div style={rightPanel}>
        <div style={card}>
          <h2 style={title}>Sign in</h2>
          <p style={subtitle}>Enter your credentials to continue</p>

          {err && <div style={msgErr}>{err}</div>}

          <form onSubmit={onSubmit}>
            <div style={field}>
              <label style={label}>User ID</label>
              <input
                value={form.userId}
                onChange={(e) => update("userId", e.target.value)}
                placeholder="Enter user ID"
                style={input}
              />
            </div>

            <div style={field}>
              <label style={label}>Password</label>

              <div style={pwdWrap}>
                <input
                  type={showPwd ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="Enter password"
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
                  checked={form.remember}
                  onChange={(e) => update("remember", e.target.checked)}
                />
                Remember session
              </label>

              <button
                type="button"
                style={linkBtn}
                onClick={() =>
                  setErr(
                    "Contact admin to reset password. Self-reset not enabled."
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
            Authorized users only. Activity may be logged.
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ text }) {
  return (
    <div style={featureItem}>
      <div style={dot} />
      <span>{text}</span>
    </div>
  );
}

/* ---------- STYLES ---------- */

const page = {
  minHeight: "100vh",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  background: "linear-gradient(135deg, #0f172a, #111827)",
};

const leftPanel = {
  padding: 40,
  color: "#e5e7eb",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const rightPanel = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const brandWrap = {
  display: "flex",
  gap: 12,
  alignItems: "center",
};

const logoBox = {
  width: 50,
  height: 50,
  borderRadius: 14,
  background: "#2563eb",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
};

const brandTitle = { margin: 0, fontSize: 24 };
const brandSub = { margin: 0, color: "#9ca3af" };

const heroTitle = { marginTop: 30, fontSize: 32 };
const heroText = { marginTop: 10, color: "#cbd5e1" };

const featureList = { marginTop: 20, display: "grid", gap: 8 };
const featureItem = { display: "flex", gap: 8 };
const dot = { width: 8, height: 8, background: "#60a5fa", borderRadius: 999 };

const card = {
  width: 400,
  background: "#fff",
  padding: 24,
  borderRadius: 20,
};

const title = { margin: 0 };
const subtitle = { color: "#666", marginBottom: 16 };

const field = { marginBottom: 14 };

const label = { fontSize: 13, fontWeight: 800 };

const input = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #ccc",
};

const pwdWrap = {
  display: "flex",
  border: "1px solid #ccc",
  borderRadius: 10,
};

const pwdInput = { flex: 1, padding: 10, border: "none" };

const toggleBtn = {
  border: "none",
  padding: "0 10px",
  cursor: "pointer",
};

const metaRow = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 14,
};

const rememberWrap = { display: "flex", gap: 6 };

const linkBtn = {
  background: "none",
  border: "none",
  color: "#2563eb",
  cursor: "pointer",
};

const submitBtn = {
  width: "100%",
  padding: 12,
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  fontWeight: 900,
};

const msgErr = {
  background: "#ffecec",
  padding: 10,
  marginBottom: 10,
};

const bottomNote = {
  marginTop: 14,
  fontSize: 12,
  color: "#666",
  textAlign: "center",
};