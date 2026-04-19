// src/utils/scrollToError.js

export function scrollToError(target, options = {}) {
  const {
    offset = 110,
    behavior = "smooth",
    focus = false,
  } = options;

  let element = null;

  if (!target) return;

  if (typeof target === "string") {
    element = document.querySelector(target);
  } else {
    element = target;
  }

  if (!element) return;

  const rect = element.getBoundingClientRect();
  const absoluteTop = window.pageYOffset + rect.top;
  const top = Math.max(absoluteTop - offset, 0);

  window.scrollTo({
    top,
    behavior,
  });

  if (focus && typeof element.focus === "function") {
    try {
      element.focus({ preventScroll: true });
    } catch {
      element.focus();
    }
  }
}

export function scrollToFirstFieldError(options = {}) {
  const selectors = [
    "[data-field-error='true']",
    ".field-error",
    "[aria-invalid='true']",
    ".error-field",
    ".input-error",
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      scrollToError(el, options);
      return true;
    }
  }

  return false;
}