/**
 * LTAB / OCTA izziņa — „Transportlīdzekļa zaudējumu dati”.
 * Deterministisks teksta slāņa parseris: galvene, apdrošināšanas periods, CSNg tabula.
 */

import type { LtabIncidentRow } from "@/lib/admin-source-blocks";
import { formatAutoRecordsDateForOutput } from "@/lib/auto-records-paste-parse";

export const LTAB_CERTIFICATE_TITLE = "Transportlīdzekļa zaudējumu dati";
export const LTAB_CERTIFICATE_SECTION_LABEL = "LTAB izziņa";
export const LTAB_CERTIFICATE_FOOTER_DEFAULT =
  "Izziņa ir sagatavota automātiski no OCTA informācijas sistēmas.";
export const LTAB_DEFAULT_COUNTRY = "Latvija";

export type LtabCertificateClaim = {
  date: string;
  time: string;
  status: string;
  /** Summa kā izziņā (ar centiem), bez valūtas zīmes. */
  amount: string;
};

export type LtabCertificate = {
  issuedAt: string;
  vehicleLine: string;
  makeModel: string;
  year: string;
  plate: string;
  accidentCount: string;
  insuredFrom: string;
  insuredTo: string;
  insuredDays: string;
  claims: LtabCertificateClaim[];
  footerNote: string;
};

export function emptyLtabCertificate(): LtabCertificate {
  return {
    issuedAt: "",
    vehicleLine: "",
    makeModel: "",
    year: "",
    plate: "",
    accidentCount: "",
    insuredFrom: "",
    insuredTo: "",
    insuredDays: "",
    claims: [],
    footerNote: "",
  };
}

export function emptyLtabCertificateClaim(): LtabCertificateClaim {
  return { date: "", time: "", status: "", amount: "" };
}

export function ltabCertificateClaimHasData(c: LtabCertificateClaim): boolean {
  return Boolean(c.date.trim() || c.time.trim() || c.status.trim() || c.amount.trim());
}

export function ltabCertificateHasContent(c: LtabCertificate | null | undefined): boolean {
  if (!c) return false;
  return Boolean(
    c.issuedAt.trim() ||
      c.vehicleLine.trim() ||
      c.makeModel.trim() ||
      c.plate.trim() ||
      c.accidentCount.trim() ||
      c.insuredFrom.trim() ||
      c.claims.some(ltabCertificateClaimHasData),
  );
}

export function looksLikeLtabCertificate(text: string): boolean {
  const t = text.slice(0, 20_000);
  if (/Transportlīdzekļa\s+zaudējumu\s+dati/i.test(t)) return true;
  if (/Izziņa\s+ir\s+sagatavota\s+automātiski\s+no\s+OCTA/i.test(t)) return true;
  if (/Negadījumu\s+skaits\s*:/i.test(t) && /Zaudējumu\s+dati/i.test(t)) return true;
  return false;
}

/** Summa ar centiem: „2778.22” → „2 778.22 €”. */
export function formatLtabCertificateAmountEur(raw: string): string {
  const t = raw.replace(/EUR|€/gi, "").trim();
  if (!t) return "";
  const m = t.match(/^([\d\s\u00a0\u202f]+)[.,](\d{1,2})$/);
  if (m) {
    const whole = Number.parseInt(m[1]!.replace(/[^\d]/g, ""), 10);
    if (Number.isNaN(whole)) return `${t} €`;
    const cents = m[2]!.padEnd(2, "0").slice(0, 2);
    const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${grouped}.${cents} €`;
  }
  const digits = t.replace(/[^\d]/g, "");
  if (!digits) return t;
  const n = Number.parseInt(digits, 10);
  if (Number.isNaN(n)) return t;
  return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} €`;
}

export function ltabCertificateToIncidentRows(c: LtabCertificate): LtabIncidentRow[] {
  return c.claims.filter(ltabCertificateClaimHasData).map((row) => ({
    csngDate: formatAutoRecordsDateForOutput(row.date) || row.date.trim(),
    lossAmount: formatLtabCertificateAmountEur(row.amount) || row.amount.trim(),
    incidentNo: LTAB_DEFAULT_COUNTRY,
  }));
}

export function ltabCertificateToPlainText(c: LtabCertificate): string {
  if (!ltabCertificateHasContent(c)) return "";
  const lines: string[] = [];
  const title = c.issuedAt.trim()
    ? `${LTAB_CERTIFICATE_TITLE} uz ${c.issuedAt.trim()}`
    : LTAB_CERTIFICATE_TITLE;
  lines.push(title);
  if (c.vehicleLine.trim()) lines.push(c.vehicleLine.trim());
  else {
    const bits = [
      c.makeModel.trim() ? `Transportlīdzeklis ${c.makeModel.trim()}` : "",
      c.year.trim() ? `izlaiduma gads ${c.year.trim()}` : "",
      c.plate.trim() ? `Valsts numura zīme ${c.plate.trim()}` : "",
    ].filter(Boolean);
    if (bits.length) lines.push(bits.join(". ").replace(/^Transportlīdzeklis /, "Transportlīdzeklis ") + ".");
  }
  if (c.accidentCount.trim()) lines.push(`Negadījumu skaits: ${c.accidentCount.trim()}`);
  if (c.insuredFrom.trim() || c.insuredTo.trim() || c.insuredDays.trim()) {
    const from = c.insuredFrom.trim() || "—";
    const to = c.insuredTo.trim() || "—";
    const days = c.insuredDays.trim();
    lines.push(
      days
        ? `Laikā no ${from} līdz ${to} apdrošināts ${days} dienas.`
        : `Laikā no ${from} līdz ${to}.`,
    );
  }
  if (c.claims.some(ltabCertificateClaimHasData)) {
    lines.push("Zaudējumu dati:");
    for (const row of c.claims.filter(ltabCertificateClaimHasData)) {
      lines.push(
        [row.date, row.time, row.status, formatLtabCertificateAmountEur(row.amount) || row.amount]
          .filter(Boolean)
          .join(" · "),
      );
    }
  }
  if (c.footerNote.trim()) lines.push(c.footerNote.trim());
  return lines.join("\n");
}

function normalizePdfText(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const CLAIM_RE =
  /(\d{1,2}\.\d{1,2}\.\d{4})\s+(\d{1,2}:\d{2})\s+([A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŠšŪūŽž]+)(?:\s+|$)(\d+(?:[.,]\d{1,2})?)/g;

export function extractLtabCertificate(rawText: string): LtabCertificate | null {
  const text = normalizePdfText(rawText);
  if (!text || !looksLikeLtabCertificate(text)) return null;

  const cert = emptyLtabCertificate();

  const issued = text.match(
    /Transportlīdzekļa\s+zaudējumu\s+dati\s+uz\s+(\d{1,2}\.\d{1,2}\.\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?)/i,
  );
  if (issued?.[1]) cert.issuedAt = issued[1].trim();

  const vehicle = text.match(
    /Transportlīdzeklis\s+([^.\n]+?),\s+izlaiduma\s+gads\s+(\d{4})\.\s+Valsts\s+numura\s+z[īi]me\s+([A-Z0-9]+)/i,
  );
  if (vehicle) {
    cert.makeModel = (vehicle[1] ?? "").replace(/\s+/g, " ").trim();
    cert.year = (vehicle[2] ?? "").trim();
    cert.plate = (vehicle[3] ?? "").trim().toUpperCase();
    cert.vehicleLine =
      `Transportlīdzeklis ${cert.makeModel}, izlaiduma gads ${cert.year}. Valsts numura zīme ${cert.plate}.`;
  } else {
    const loose = text.match(/Transportlīdzeklis\s+([^\n]+)/i);
    if (loose?.[1]) cert.vehicleLine = `Transportlīdzeklis ${loose[1].replace(/\s+/g, " ").trim()}`;
  }

  const count = text.match(/Negadījumu\s+skaits\s*:\s*(\d+)/i);
  if (count?.[1]) cert.accidentCount = count[1];

  const period = text.match(
    /Laikā\s+no\s+(\d{1,2}\.\d{1,2}\.\d{4})\s+līdz\s+(\d{1,2}\.\d{1,2}\.\d{4})\s+apdrošināts\s+(\d+)\s+dienas/i,
  );
  if (period) {
    cert.insuredFrom = formatAutoRecordsDateForOutput(period[1] ?? "") || (period[1] ?? "").trim();
    cert.insuredTo = formatAutoRecordsDateForOutput(period[2] ?? "") || (period[2] ?? "").trim();
    cert.insuredDays = (period[3] ?? "").trim();
  }

  const tableSlice = text.split(/Zaudējumu\s+dati\s*:/i)[1] ?? text;
  const tableHead = tableSlice.split(/Izziņa\s+ir\s+sagatavota/i)[0] ?? tableSlice;
  CLAIM_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = CLAIM_RE.exec(tableHead)) !== null) {
    const date = formatAutoRecordsDateForOutput(m[1] ?? "") || (m[1] ?? "").trim();
    const time = (m[2] ?? "").trim();
    const status = (m[3] ?? "").trim();
    const amount = (m[4] ?? "").replace(",", ".").trim();
    const key = `${date}|${time}|${amount}`;
    if (!date || seen.has(key)) continue;
    seen.add(key);
    cert.claims.push({ date, time, status, amount });
  }

  if (/Izziņa\s+ir\s+sagatavota\s+automātiski\s+no\s+OCTA/i.test(text)) {
    cert.footerNote = LTAB_CERTIFICATE_FOOTER_DEFAULT;
  }

  return ltabCertificateHasContent(cert) ? cert : null;
}

export function parseLtabCertificateRaw(raw: unknown): LtabCertificate | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const clip = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const claimsIn = Array.isArray(o.claims) ? o.claims : [];
  const claims: LtabCertificateClaim[] = claimsIn.map((row) => {
    if (!row || typeof row !== "object") return emptyLtabCertificateClaim();
    const x = row as Record<string, unknown>;
    return {
      date: clip(x.date, 40),
      time: clip(x.time, 16),
      status: clip(x.status, 80),
      amount: clip(x.amount, 40),
    };
  });
  const cert: LtabCertificate = {
    issuedAt: clip(o.issuedAt, 40),
    vehicleLine: clip(o.vehicleLine, 400),
    makeModel: clip(o.makeModel, 120),
    year: clip(o.year, 8),
    plate: clip(o.plate, 16),
    accidentCount: clip(o.accidentCount, 8),
    insuredFrom: clip(o.insuredFrom, 20),
    insuredTo: clip(o.insuredTo, 20),
    insuredDays: clip(o.insuredDays, 12),
    claims,
    footerNote: clip(o.footerNote, 240),
  };
  return ltabCertificateHasContent(cert) ? cert : undefined;
}
