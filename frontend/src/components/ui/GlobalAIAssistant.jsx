import { useState } from "react";
import AIAssistantPanel from "./AIAssistantPanel";

export default function GlobalAIAssistant() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close AI Assistant" : "Open AI Assistant"}
        title={open ? "Close AI Assistant" : "Open AI Assistant"}
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          width: 74,
          height: 74,
          borderRadius: "999px",
          border: "1px solid rgba(80, 140, 255, 0.45)",
          background:
            "linear-gradient(135deg, rgba(40,102,255,1) 0%, rgba(22,67,196,1) 100%)",
          color: "#ffffff",
          fontSize: 30,
          fontWeight: 900,
          cursor: "pointer",
          zIndex: 9999,
          boxShadow:
            "0 18px 40px rgba(11, 92, 255, 0.38), 0 0 0 6px rgba(45, 104, 255, 0.10)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
          e.currentTarget.style.boxShadow =
            "0 24px 46px rgba(11, 92, 255, 0.45), 0 0 0 8px rgba(45, 104, 255, 0.14)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0) scale(1)";
          e.currentTarget.style.boxShadow =
            "0 18px 40px rgba(11, 92, 255, 0.38), 0 0 0 6px rgba(45, 104, 255, 0.10)";
        }}
      >
        AI
      </button>

      <div
        style={{
          position: "fixed",
          right: 24,
          bottom: 112,
          width: "min(440px, calc(100vw - 24px))",
          maxHeight: "calc(100vh - 140px)",
          zIndex: 9998,
          display: open ? "block" : "none",
        }}
      >
        <AIAssistantPanel open={open} onClose={() => setOpen(false)} />
      </div>
    </>
  );
}