export function formatPrvInvoiceNumber(year: number, seq: number): string {
  return `PRV-${year}-${String(seq).padStart(4, "0")}`;
}

export function parsePrvInvoiceSequence(invoiceNumber: string, year: number): number | null {
  const m = /^PRV-(\d{4})-(\d{4})$/.exec(invoiceNumber.trim());
  if (!m) return null;
  if (Number.parseInt(m[1]!, 10) !== year) return null;
  const seq = Number.parseInt(m[2]!, 10);
  return Number.isFinite(seq) && seq > 0 ? seq : null;
}
