// src/hooks/useAutoScrollToError.js
import { useEffect } from "react";
import { scrollToError, scrollToFirstFieldError } from "../utils/scrollToError";

export default function useAutoScrollToError(error, errorRef, options = {}) {
  useEffect(() => {
    if (!error) return;

    const timer = window.setTimeout(() => {
      if (errorRef?.current) {
        scrollToError(errorRef.current, {
          offset: 120,
          behavior: "smooth",
          focus: true,
          ...options,
        });
        return;
      }

      scrollToFirstFieldError({
        offset: 120,
        behavior: "smooth",
        ...options,
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [error, errorRef, options]);
}