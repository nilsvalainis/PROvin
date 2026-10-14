"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> & {
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
};

/** Tekstareas augstums pielāgojas saturam (admin avotu tabulas). */
export function AdminAutoGrowTextarea({
  value,
  disabled,
  className = "",
  rows = 1,
  onChange,
  onBlur,
  ...rest
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const syncHeight = useCallback(
    (el: HTMLTextAreaElement | null) => {
      if (!el) return;
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 16;
      const minRows = typeof rows === "number" ? rows : 1;
      el.style.height = "auto";
      el.style.height = `${Math.max(el.scrollHeight, lh * minRows) + 2}px`;
    },
    [rows],
  );

  useLayoutEffect(() => {
    if (disabled) return;
    syncHeight(ref.current);
  }, [disabled, syncHeight, value]);

  return (
    <textarea
      {...rest}
      ref={ref}
      rows={rows}
      value={value}
      disabled={disabled}
      className={`resize-none overflow-hidden leading-snug ${className}`}
      onChange={(e) => {
        onChange(e);
        syncHeight(e.currentTarget);
      }}
      onBlur={onBlur}
    />
  );
}
