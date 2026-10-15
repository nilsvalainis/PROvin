/** Stabilas rindas atslēgas (`key={idx}` vietā), lai dzēšot rindu ievade nepārlēktu. */

export function newStableRowKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `row-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export function nextStableRowKeys(prevKeys: readonly string[], nextCount: number, removedIndex?: number): string[] {
  const keys = [...prevKeys];
  if (removedIndex != null && removedIndex >= 0 && removedIndex < keys.length) {
    keys.splice(removedIndex, 1);
  }
  while (keys.length < nextCount) keys.push(newStableRowKey());
  if (keys.length > nextCount) keys.length = nextCount;
  return keys;
}
