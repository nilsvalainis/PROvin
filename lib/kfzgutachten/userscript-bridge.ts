/**
 * kfzgutachten.at saraksts -> PROVIN pasūtījums caur Tampermonkey skriptu (bez ielīmēšanas).
 *
 * Plūsma:
 * 1. Pasūtījumā «Atvērt sarakstu» saitē ir `&provin=<sessionId>` (kfzgutachtenSearchUrl).
 * 2. Skripts kfzgutachten.at lapā šo pasūtījumu atceras (GM krātuvē, 2 h), pēc «Suchen» (spiež Nils)
 *    nolasa rezultātu tabulu un ieliek GM krātuvē tikai šī VIN rindas teksta formā, ko pieņem
 *    `parseKfzSearchListText` (tā pati forma kā ielīmēšanas laukam).
 * 3. Skripts admin lapā notikumu `provin-kfz-at-list` sūta uz lapu; panelis pieņem tikai savu
 *    pasūtījumu (sessionId + VIN), ielasa un atbild ar `provin-kfz-at-list-ack`.
 * Tīkla pieprasījumu nav: dati iet tikai caur Nila pārlūka GM krātuvi, admin sesija paliek tā pati.
 */

/** Skripta versija, kurā ir kfzgutachten.at tilts. */
export const KFZ_AT_USERSCRIPT_MIN = "1.27.0";

export const KFZ_AT_LIST_EVENT = "provin-kfz-at-list";
export const KFZ_AT_LIST_ACK_EVENT = "provin-kfz-at-list-ack";

/** Pasūtījuma identifikatora parametrs saitē (tas pats skriptā). */
export const KFZ_AT_ORDER_PARAM = "provin";

const ORDER_ID_RE = /^[A-Za-z0-9_.-]{6,200}$/;
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export function kfzAtOrderIdValid(raw: string | null | undefined): boolean {
  return ORDER_ID_RE.test(String(raw ?? "").trim());
}

export type KfzAtUserscriptList = {
  sessionId: string;
  vin: string;
  /** Rindas `Modelis\tDatums\tNumurzīme\tVIN` - forma, ko pieņem parseKfzSearchListText. */
  text: string;
  count: number;
  at: number;
};

/** Notikuma `provin-kfz-at-list` detail -> droša struktūra (vai null). */
export function parseKfzAtUserscriptDetail(raw: unknown): KfzAtUserscriptList | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const sessionId = String(d.sessionId ?? "").trim();
  const vin = String(d.vin ?? "")
    .replace(/[\s-]/g, "")
    .toUpperCase();
  const text = String(d.text ?? "").slice(0, 20_000);
  const at = Number(d.at ?? 0);
  if (!kfzAtOrderIdValid(sessionId) || !VIN_RE.test(vin) || !text.trim() || !Number.isFinite(at) || at <= 0) return null;
  const count = Math.max(0, Math.floor(Number(d.count ?? 0)) || 0);
  return { sessionId, vin, text, count, at };
}
