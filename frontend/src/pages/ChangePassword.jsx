// src/pages/ChangePassword.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../api/client";

export default function ChangePassword() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    current: "",
    newPwd: "",
    confirm: "",
  });

  const [show, setShow] = useState({
    current: false,
    newPwd: false,
    confirm: false,
  });

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggle(key) {
    setShow((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setOk("");

    if (!form.current) return setErr("Current password is required.");
    if (!form.newPwd) return setErr("New password is required.");
    if (form.newPwd.length < 8)
      return setErr("New password must be at least 8 characters.");
    if (form.newPwd !== form.confirm)
      return setErr("Confirm password does not match.");

    try {
      setLoading(true);

      const res = await apiPost("/auth/change-password", {
        current_password: form.current,
        new_password: form.newPwd,
      });

      setOk(res?.message || "Password changed successfully.");

      // force logout
      setTimeout(() => {
        window.location.href = "/login";
      }, 1200);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={page}>
      <div style={card}>
        <div style={header}>
          <h2 style={title}>Change Password</h2>
          <p style={subtitle}>
            Update your login password. Minimum 8 characters recommended.
          </p>
        </div>

        {err && <div style={msgErr}>{err}</div>}
        {ok && <div style={msgOk}>{ok}</div>}

        <form onSubmit={onSubmit}>
          <PasswordField
            label="Current Password"
            value={form.current}
            onChange={(v) => update("current", v)}
            show={show.current}
            onToggle={() => toggle("current")}
          />

          <PasswordField
            label="New Password"
            value={form.newPwd}
            onChange={(v) => update("newPwd", v)}
            show={show.newPwd}
            onToggle={() => toggle("newPwd")}
          />

          <PasswordField
            label="Confirm Password"
            value={form.confirm}
            onChange={(v) => update("confirm", v)}
            show={show.confirm}
            onToggle={() => toggle("confirm")}
          />

          <div style={btnRow}>
            <button type="submit" style={btnPrimary} disabled={loading}>
              {loading ? "Updating..." : "Update Password"}
            </button>

            <button
              type="button"
              style={btnGhost}
              onClick={() => navigate("/dashboard")}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- COMPONENT ---------- */

function PasswordField({ label, value, onChange, show, onToggle }) {
  return (
    <div style={field}>
      <label style={lbl}>{label}</label>

      <div style={inputWrap}>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={input}
        />

        <button type="button" onClick={onToggle} style={toggleBtn}>
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

/* ---------- STYLES ---------- */

const page = {
  maxWidth: 520,
  margin: "0 auto",
  padding: 18,
};

const card = {
  background: "#fff",
  border: "1px solid #e6e6e6",
  borderRadius: 18,
  padding: 20,
  boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
};

const header = {
  marginBottom: 16,
};

const title = {
  margin: 0,
  color: "#111",
  fontSize: 22,
  fontWeight: 900,
};

const subtitle = {
  marginTop: 6,
  color: "#666",
  fontSize: 13,
};

const field = {
  marginBottom: 16,
};

const lbl = {
  fontSize: 13,
  fontWeight: 800,
  color: "#111",
  marginBottom: 6,
  display: "block",
};

const inputWrap = {
  display: "flex",
  border: "1px solid #d1d5db",
  borderRadius: 12,
  overflow: "hidden",
};

const input = {
  flex: 1,
  padding: "12px",
  border: "none",
  outline: "none",
  fontSize: 14,
};

const toggleBtn = {
  padding: "0 14px",
  border: "none",
  borderLeft: "1px solid #e5e7eb",
  background: "#f9fafb",
  color: "#1d4ed8",
  fontWeight: 800,
  cursor: "pointer",
};

const btnRow = {
  display: "flex",
  gap: 10,
  marginTop: 10,
};

const btnPrimary = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #0b5cff",
  background: "#0b5cff",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const btnGhost = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #ccc",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 900,
};

const msgErr = {
  background: "#ffecec",
  border: "1px solid #ffb3b3",
  padding: 10,
  borderRadius: 12,
  color: "#a40000",
  marginBottom: 12,
};

const msgOk = {
  background: "#eaffea",
  border: "1px solid #bde7bd",
  padding: 10,
  borderRadius: 12,
  color: "#0a6a0a",
  marginBottom: 12,
};