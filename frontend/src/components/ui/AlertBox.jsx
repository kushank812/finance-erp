import { useEffect, useRef } from "react";

export default function AlertBox({
  kind = "info",
  message,
  autoScroll,
}) {
  const ref = useRef(null);

  const styleMap = {
    error: {
      background: "#fff1f2",
      border: "1px solid #fecdd3",
      color: "#b42318",
    },
    success: {
      background: "#ecfdf3",
      border: "1px solid #b7ebc6",
      color: "#027a48",
    },
    warning: {
      background: "#fffaeb",
      border: "1px solid #fedf89",
      color: "#b54708",
    },
    info: {
      background: "#eff8ff",
      border: "1px solid #b2ddff",
      color: "#175cd3",
    },
  };

  const shouldAutoScroll =
    typeof autoScroll === "boolean" ? autoScroll : kind === "error";

  useEffect(() => {
    if (!message || !shouldAutoScroll) return;

    const timer = setTimeout(() => {
      if (!ref.current) return;

      ref.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      setTimeout(() => {
        const extraOffset = 220; // bigger offset for your sticky top area
        window.scrollBy({
          top: -extraOffset,
          behavior: "smooth",
        });
      }, 120);

      if (typeof ref.current.focus === "function") {
        try {
          ref.current.focus({ preventScroll: true });
        } catch {
          ref.current.focus();
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [message, shouldAutoScroll]);

  if (!message) return null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      style={{
        ...styleMap[kind],
        padding: "12px 14px",
        borderRadius: 14,
        fontWeight: 700,
        marginBottom: 12,
      }}
    >
      {message}
    </div>
  );
}