/**
 * Klientu PDF, kas ģenerēti kopš PR #277 (3b4c8e84, 18.10.2026 00:29 Rīga)
 * un var saturēt kļūdainu „Pilnīgs zaudējums” vai vidējotās negadījumu summas.
 */

/** 18.10.2026 00:29 Europe/Riga = 17.10.2026 21:29 UTC. */
export const PR277_CLIENT_REPORT_CUTOFF_ISO = "2026-10-17T21:29:00.000Z";

const BANNED_AVERAGED_AMOUNT_RE = /(?:^|[^\d])(?:3\s*950|3950|2\s*850|2850)(?:[^\d]|$)/;
const TILDE_EUR_RE = /~\s*\d/;
const INCIDENT_SECTION_RE = /NEGADĪJUMU VĒSTURE|Bojājumu ieraksts|Negadījums|Pilnīgs zaudējums/i;

export type ClientReportIncidentScan = {
  hasTildeApprox: boolean;
  hasPilnigsZaudejums: boolean;
  hasBannedAveragedAmounts: boolean;
  hasIncidentSection: boolean;
  hasAveragedIncidentDisplay: boolean;
};

export function isClientReportAtOrAfterPr277Cutoff(iso: string | null | undefined): boolean {
  if (!iso?.trim()) return false;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return false;
  return ms >= Date.parse(PR277_CLIENT_REPORT_CUTOFF_ISO);
}

export function scanClientReportText(text: string): ClientReportIncidentScan {
  const hay = text.replace(/\u00a0/g, " ");
  const hasTildeApprox = TILDE_EUR_RE.test(hay);
  const hasPilnigsZaudejums = /Pilnīgs zaudējums/i.test(hay);
  const hasBannedAveragedAmounts = BANNED_AVERAGED_AMOUNT_RE.test(hay);
  return {
    hasTildeApprox,
    hasPilnigsZaudejums,
    hasBannedAveragedAmounts,
    hasIncidentSection: INCIDENT_SECTION_RE.test(hay),
    hasAveragedIncidentDisplay: hasTildeApprox || hasBannedAveragedAmounts,
  };
}

export function clientReportScanIsAffected(scan: ClientReportIncidentScan): boolean {
  return scan.hasPilnigsZaudejums || scan.hasAveragedIncidentDisplay;
}
