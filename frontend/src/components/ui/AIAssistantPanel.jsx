import { useState } from "react";

export default function AIAssistantPanel({
  title = "AI Finance Assistant",
  height = "420px",
}) {
  const [input, setInput] = useState("");

  return (
    <div
      style={{
        width: "100%",
        minHeight: height,
        background: "#0f172a",
        color: "#ffffff",
        border: "4px solid red",
        borderRadius: 20,
        padding: 16,
        boxSizing: "border-box",
        boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 900,
          marginBottom: 10,
        }}
      >
        {title}
      </div>

      <div
        style={{
          background: "rgba(255,255,255,0.08)",
          borderRadius: 14,
          padding: 12,
          marginBottom: 12,
          lineHeight: 1.5,
        }}
      >
        AI PANEL IS VISIBLE
      </div>

      <div
        style={{
          background: "rgba(255,255,255,0.05)",
          borderRadius: 14,
          padding: 12,
          marginBottom: 12,
          minHeight: 180,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Quick actions</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" style={chipBtn}>
            Show overdue customers
          </button>
          <button type="button" style={chipBtn}>
            Open aging report
          </button>
          <button type="button" style={chipBtn}>
            Show vendor dues
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type here..."
          style={inputStyle}
        />
        <button type="button" style={sendBtn}>
          Send
        </button>
      </div>
    </div>
  );
}

const chipBtn = {
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  padding: "8px 10px",
  borderRadius: 999,
  cursor: "pointer",
  fontWeight: 700,
};

const inputStyle = {
  flex: 1,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  padding: "12px 14px",
  outline: "none",
};

const sendBtn = {
  border: "none",
  borderRadius: 12,
  padding: "12px 16px",
  fontWeight: 900,
  cursor: "pointer",
  background: "#67f0d5",
  color: "#06111f",
};