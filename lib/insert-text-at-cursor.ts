/**
 * Ielīmē tekstu fokusētajā input/textarea un izsauc `input`, lai React uztvertu izmaiņu.
 */
export function insertTextAtFocusedField(text: string): boolean {
  const el = document.activeElement;
  if (!el || (el.tagName !== "TEXTAREA" && el.tagName !== "INPUT")) return false;
  const input = el as HTMLInputElement | HTMLTextAreaElement;
  if (input.readOnly || input.disabled) return false;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  const next = input.value.slice(0, start) + text + input.value.slice(end);
  const proto = Object.getPrototypeOf(input);
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc?.set?.call(input, next);
  const pos = start + text.length;
  try {
    input.setSelectionRange(pos, pos);
  } catch {
    /* ignore */
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}
