import { useState } from "react";
import { apiPost } from "../../api/client";

export default function SendEmailButton({
  endpoint,
  label = "Send Email",
  successMessage = "Email sent successfully.",
  compact = false,
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function handleSend() {
    if (!endpoint || loading) return;

    try {
      setLoading(true);
      setMsg("");
      setErr("");

      const res = await apiPost(endpoint, {});
      setMsg(res?.message || successMessage);
    } catch (e) {
      setErr(e?.message || "Failed to send email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={compact ? compactWrap : normalWrap}>
      <button
        type="button"
        onClick={handleSend}
        disabled={loading || !endpoint}
        style={compact ? compactButton(loading) : normalButton(loading)}
        title={!endpoint ? "Email endpoint missing" : label}
      >
        {loading ? "Sending..." : label}
      </button>

      {!compact && msg ? <div style={successText}>{msg}</div> : null}
      {!compact && err ? <div style={errorText}>{err}</div> : null}

      {compact && msg ? <span style={compactSuccess}>Sent</span> : null}
      {compact && err ? <span style={compactError}>Failed</span> : null}
    </div>
  );
}

const normalWrap = {
  display: "grid",
  gap: 8,
};

const compactWrap = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};

function normalButton(loading) {
  return {
    border: "1px solid #bfdbfe",
    background: loading ? "#dbeafe" : "#eff6ff",
    color: "#1d4ed8",
    padding: "9px 14px",
    borderRadius: 12,
    fontWeight: 900,
    cursor: loading ? "not-allowed" : "pointer",
    whiteSpace: "nowrap",
  };
}

function compactButton(loading) {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid #16a34a",
    background: loading ? "#dcfce7" : "#ecfdf5",
    color: "#047857",
    cursor: loading ? "not-allowed" : "pointer",
    fontWeight: 900,
    fontSize: 13,
    whiteSpace: "nowrap",
  };
}

const successText = {
  color: "#047857",
  fontSize: 13,
  fontWeight: 800,
};

const errorText = {
  color: "#b91c1c",
  fontSize: 13,
  fontWeight: 800,
};

const compactSuccess = {
  color: "#047857",
  fontSize: 11,
  fontWeight: 900,
};

const compactError = {
  color: "#b91c1c",
  fontSize: 11,
  fontWeight: 900,
};