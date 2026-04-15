import { useRef } from "react";
import {
  formatDateForApi,
  formatDateForCalendarText,
  parseDisplayDateToISO,
} from "../../utils/date";

export default function AppDateInput({
  value,
  onChange,
  style = {},
  placeholder = "dd/mm/yyyy",
  disabled = false,
  min,
  max,
  name,
  id,
}) {
  const hiddenDateRef = useRef(null);

  function openPicker() {
    if (disabled) return;

    const el = hiddenDateRef.current;
    if (!el) return;

    if (typeof el.showPicker === "function") {
      el.showPicker();
      return;
    }

    el.click();
  }

  function handleTextChange(e) {
    const next = e.target.value;
    const iso = parseDisplayDateToISO(next);

    if (next === "") {
      onChange?.("");
      return;
    }

    if (iso) {
      onChange?.(formatDateForApi(iso));
    }
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
      }}
    >
      <input
        type="text"
        id={id}
        name={name ? `${name}_display` : undefined}
        value={formatDateForCalendarText(value)}
        onChange={handleTextChange}
        onClick={openPicker}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: "100%",
          padding: "10px 42px 10px 12px",
          borderRadius: 10,
          border: "1px solid #cbd5e1",
          outline: "none",
          boxSizing: "border-box",
          background: disabled ? "#f3f4f6" : "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
          ...style,
        }}
      />

      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-label="Open calendar"
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          border: "none",
          background: "transparent",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        📅
      </button>

      <input
        ref={hiddenDateRef}
        type="date"
        value={formatDateForApi(value)}
        onChange={(e) => onChange?.(e.target.value)}
        min={min}
        max={max}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        style={{
          position: "absolute",
          opacity: 0,
          pointerEvents: "none",
          width: 1,
          height: 1,
          left: 0,
          bottom: 0,
        }}
      />
    </div>
  );
}