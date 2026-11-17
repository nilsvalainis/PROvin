/**
 * Content-Disposition ar latviešu burtiem: `filename` tikai ASCII (HTTP galvene citādi krīt ar
 * "Cannot convert argument to a ByteString"), pilnais nosaukums - `filename*` (RFC 5987).
 */
export function contentDispositionHeader(fileName: string, mode: "inline" | "attachment", fallback: string): string {
  const ascii =
    fileName.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_") || fallback;
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName || ascii)}`;
}
