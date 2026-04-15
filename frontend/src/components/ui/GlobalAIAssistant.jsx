import { useState } from "react";
import AIAssistantPanel from "./AIAssistantPanel";

function SparkIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <path
        d="M12 3L13.9 8.1L19 10L13.9 11.9L12 17L10.1 11.9L5 10L10.1 8.1L12 3Z"
        fill="currentColor"
      />
      <path
        d="M18.5 15L19.3 17.2L21.5 18L19.3 18.8L18.5 21L17.7 18.8L15.5 18L17.7 17.2L18.5 15Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}

export default function GlobalAIAssistant() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close AI Assistant" : "Open AI Assistant"}
        title={open ? "Close AI Assistant" : "Open AI Assistant"}
        style={open ? floatingBtnOpen : floatingBtn}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = open
            ? "translateY(-1px) scale(1.02)"
            : "translateY(-2px) scale(1.04)";
          e.currentTarget.style.boxShadow = open
            ? "0 16px 34px rgba(37,99,235,0.28), 0 0 0 5px rgba(59,130,246,0.10)"
            : "0 18px 38px rgba(37,99,235,0.34), 0 0 0 6px rgba(59,130,246,0.12)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0) scale(1)";
          e.currentTarget.style.boxShadow = open
            ? "0 12px 28px rgba(37,99,235,0.22), 0 0 0 4px rgba(59,130,246,0.08)"
            : "0 14px 30px rgba(37,99,235,0.26), 0 0 0 4px rgba(59,130,246,0.08)";
        }}
      >
        <span style={glowRing} />
        <span style={iconWrap}>
          <SparkIcon />
        </span>
      </button>

      <div
        style={{
          position: "fixed",
          right: 18,
          bottom: 88,
          width: "min(440px, calc(100vw - 24px))",
          maxWidth: "calc(100vw - 24px)",
          height: "min(780px, calc(100vh - 110px))",
          maxHeight: "calc(100vh - 110px)",
          zIndex: 9998,
          display: open ? "block" : "none",
        }}
      >
        <AIAssistantPanel
          onClose={() => setOpen(false)}
          height="min(780px, calc(100vh - 110px))"
        />
      </div>
    </>
  );
}

const floatingBtn = {
  position: "fixed",
  right: 18,
  bottom: 18,
  width: 54,
  height: 54,
  borderRadius: "999px",
  border: "1px solid rgba(96,165,250,0.34)",
  background:
    "linear-gradient(180deg, rgba(37,99,235,0.98) 0%, rgba(29,78,216,0.98) 100%)",
  color: "#ffffff",
  cursor: "pointer",
  zIndex: 9999,
  boxShadow:
    "0 14px 30px rgba(37,99,235,0.26), 0 0 0 4px rgba(59,130,246,0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease",
  padding: 0,
  overflow: "hidden",
  backdropFilter: "blur(10px)",
};

const floatingBtnOpen = {
  ...floatingBtn,
  background:
    "linear-gradient(180deg, rgba(30,41,59,0.98) 0%, rgba(15,23,42,0.98) 100%)",
  border: "1px solid rgba(148,163,184,0.28)",
  boxShadow:
    "0 12px 28px rgba(37,99,235,0.22), 0 0 0 4px rgba(59,130,246,0.08)",
};

const glowRing = {
  position: "absolute",
  inset: 0,
  borderRadius: "999px",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.20)",
  pointerEvents: "none",
};

const iconWrap = {
  position: "relative",
  zIndex: 1,
  width: 30,
  height: 30,
  borderRadius: "999px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255,255,255,0.10)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)",
};