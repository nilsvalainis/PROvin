"use client";

export function PrintButton() {
  return (
    <button type="button" className="ap2-btn dark sm ap2-noprint" onClick={() => window.print()}>
      Drukāt
    </button>
  );
}
