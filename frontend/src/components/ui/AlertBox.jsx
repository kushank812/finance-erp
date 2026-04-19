import { useEffect, useRef } from "react";

export default function AlertBox({
  kind = "info",
  message,
  autoScroll = true,
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

  // 🔥 AUTO SCROLL LOGIC (GLOBAL)
  useEffect(() => {
    if (!message || !autoScroll) return;

    const timer = setTimeout(() => {
      if (!ref.current) return;

      const rect = ref.current.getBoundingClientRect();
      const top = window.pageYOffset + rect.top - 120;

      window.scrollTo({
        top: Math.max(top, 0),
        behavior: "smooth",
      });

      // optional: focus for accessibility
      ref.current.focus?.();
    }, 80);

    return () => clearTimeout(timer);
  }, [message, autoScroll]);

  if (!message) return null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
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