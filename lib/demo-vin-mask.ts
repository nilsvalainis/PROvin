/** Demo PDF: pēdējās 6 VIN zīmes aizsedz ar X (WDD2130041A179362 → WDD2130041AXXXXXX). */
export function maskVinForDemo(raw: string): string {
  const compact = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (compact.length !== 17) return raw.trim();
  return `${compact.slice(0, 11)}XXXXXX`;
}
