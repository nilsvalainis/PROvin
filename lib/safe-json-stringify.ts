/** Drošs JSON.stringify — nekad nemest izņēmumu (piem., cikliskie objekti). */
export function safeJsonStringify(value: unknown): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}
