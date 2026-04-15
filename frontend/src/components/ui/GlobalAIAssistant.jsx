<button
  type="button"
  onClick={() => setOpen((v) => !v)}
  aria-label={open ? "Close AI Assistant" : "Open AI Assistant"}
  title={open ? "Close AI Assistant" : "Open AI Assistant"}
  style={{
    position: "fixed",
    right: 20,
    bottom: 20,
    width: 52,
    height: 52,
    borderRadius: "999px",
    border: "1px solid rgba(80, 140, 255, 0.35)",
    background:
      "linear-gradient(135deg, rgba(40,102,255,1) 0%, rgba(22,67,196,1) 100%)",
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    zIndex: 9999,
    boxShadow:
      "0 10px 24px rgba(11, 92, 255, 0.28), 0 0 0 4px rgba(45, 104, 255, 0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = "scale(1.05)";
    e.currentTarget.style.boxShadow =
      "0 14px 28px rgba(11, 92, 255, 0.35), 0 0 0 6px rgba(45, 104, 255, 0.12)";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)";
    e.currentTarget.style.boxShadow =
      "0 10px 24px rgba(11, 92, 255, 0.28), 0 0 0 4px rgba(45, 104, 255, 0.08)";
  }}
>
  AI
</button>