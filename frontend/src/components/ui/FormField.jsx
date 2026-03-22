import {
  field,
  labelStyle,
  input,
  disabledInput,
  autoBox,
  hintText,
} from "./uiStyles";

export function FormField({
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
  readOnly = false,
  placeholder = "",
  hint = "",
}) {
  return (
    <div style={field}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        style={disabled || readOnly ? disabledInput : input}
      />
      {hint ? <div style={hintText}>{hint}</div> : null}
    </div>
  );
}

export function FormSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = "-- Select --",
  disabled = false,
  hint = "",
}) {
  return (
    <div style={field}>
      <label style={labelStyle}>{label}</label>
      <select
        value={value ?? ""}
        onChange={onChange}
        disabled={disabled}
        style={disabled ? disabledInput : input}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={String(opt)} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {hint ? <div style={hintText}>{hint}</div> : null}
    </div>
  );
}

export function AutoField({ label, text, hint = "" }) {
  return (
    <div style={field}>
      <label style={labelStyle}>{label}</label>
      <div style={autoBox}>{text}</div>
      {hint ? <div style={hintText}>{hint}</div> : null}
    </div>
  );
}