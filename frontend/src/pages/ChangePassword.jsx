import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../api/client";

export default function ChangePassword() {
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setOk("");

    if (!currentPassword) return setErr("Current password is required.");
    if (!newPassword) return setErr("New password is required.");
    if (newPassword.length < 8) return setErr("New password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return setErr("Confirm password does not match.");

    try {
      setLoading(true);

      const res = await apiPost("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      setOk(res?.message || "Password changed successfully. Please sign in again.");

      setTimeout(() => {
        window.location.href = "/login";
      }, 1200);
    } catch (e2) {
      setErr(String(e2.message || e2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 18 }}>
      <div style={card}>
        <h2 style={{ marginTop: 0, color: "#111" }}>Change Password</h2>
        <p style={{ color: "#666", marginTop: 6 }}>
          Use a strong password with at least 8 characters.
        </p>

        {err ? <div style={msgErr}>{err}</div> : null}
        {ok ? <div style={msgOk}>{ok}</div> : null}

        <form onSubmit={onSubmit}>
          <PasswordField
            label="Current Password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggle={() => setShowCurrent((p) => !p)}
          />

          <PasswordField
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
            show={showNew}
            onToggle={() => setShowNew((p) => !p)}
          />

          <PasswordField
            label="Confirm New Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirm}
            onToggle={() => setShowConfirm((p) => !p)}
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

function PasswordField({ label, value, onChange, show, onToggle }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>{label}</label>
      <div style={pwdWrap}>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={pwdInput}
        />
        <button type="button" onClick={onToggle} style={toggleBtn}>
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

const card = {
  background: "white",
  border: "1px solid #e6e6e6",
  borderRadius: 16,
  padding: 20,
};

const lbl = {
  display: "block",
  marginBottom: 6,
  fontSize: 13,
  color: "#111",
  fontWeight: 800,
};

const pwdWrap = {
  display: "flex",
  alignItems: "center",
  border: "1px solid #d1d5db",
  borderRadius: 12,
  overflow: "hidden",
  background: "#fff",
};

const pwdInput = {
  flex: 1,
  padding: "12px 14px",
  border: "none",
  outline: "none",
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
};

const btnRow = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 10,
};

const btnPrimary = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #0b5cff",
  background: "#0b5cff",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const btnGhost = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #ccc",
  background: "white",
  color: "#111",
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