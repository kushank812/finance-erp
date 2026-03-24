import React from "react";
import { displayToISODate, isoToDisplayDate } from "../utils/date";

export default function DateInput({
  name,
  id,
  value,
  onChange,
  onBlur,
  placeholder = "dd/mm/yyyy",
  style,
  className,
  disabled = false,
  required = false,
  ...props
}) {
  function handleChange(e) {
    const raw = e.target.value;

    let nextValue = raw;

    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
      nextValue = displayToISODate(raw);
    }

    onChange?.({
      ...e,
      target: {
        ...e.target,
        name,
        id,
        value: nextValue,
      },
    });
  }

  return (
    <input
      type="text"
      name={name}
      id={id}
      value={isoToDisplayDate(value)}
      onChange={handleChange}
      onBlur={onBlur}
      placeholder={placeholder}
      style={style}
      className={className}
      disabled={disabled}
      required={required}
      inputMode="numeric"
      {...props}
    />
  );
}