// src/components/ui/FormErrorAlert.jsx
import { forwardRef } from "react";

const FormErrorAlert = forwardRef(function FormErrorAlert(
  { message, style = {} },
  ref
) {
  if (!message) return null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      aria-live="assertive"
      style={{
        marginBottom: 18,
        padding: "16px 18px",
        borderRadius: 18,
        border: "1px solid rgba(220, 38, 38, 0.18)",
        background: "linear-gradient(180deg, #fff1f2 0%, #ffe4e6 100%)",
        color: "#b42318",
        fontWeight: 800,
        fontSize: 15,
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
        ...style,
      }}
    >
      {message}
    </div>
  );
});

export default FormErrorAlert;