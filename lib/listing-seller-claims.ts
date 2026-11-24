/**
 * Pārdevēja apgalvojumi no laukā «Sludinājuma apraksts (iekopēšanai)» ielasītā teksta.
 * Tie NAV pārbaudīti fakti - tikai tas, ko pārdevējs raksta. AI tos salīdzina ar avotu datiem,
 * pretrunu pārbaude (`source-consistency`) tos lieto brīdinājumiem.
 */

export type ListingSellerClaims = {
  /** Nobraukums, ko norāda pārdevējs (km). */
  km: number | null;
  /** Teksts apgalvo, ka auto nav sists / bez avārijām. */
  noAccidents: string | null;
  /** Apgalvojums par servisa vēsturi (citāts). */
  service: string | null;
  /** Apgalvojums par īpašnieku skaitu (citāts). */
  owners: string | null;
  /** Krāsa no parametriem vai teksta. */
  color: string | null;
  /** Aprīkojuma rinda (saīsināta). */
  equipment: string | null;
};

const NO_ACCIDENT_RE =
  /(?<!\p{L})(?:nav\s+(?:bijis\s+)?(?:sists|avarēj\p{L}*|cietis\s+avārij\p{L}*|bijis\s+avārij\p{L}*)|nesists|nav\s+bijis\s+avārijās|bez\s+(?:avārij\p{L}*|negadījum\p{L}*|sitieniem)|nav\s+(?:bijis\s+)?negadījum\p{L}*|nekad\s+nav\s+(?:sists|avarējis)|accident[-\s]?free|no\s+accidents|never\s+(?:been\s+)?crashed|не\s*бит\p{L}*|без\s+дтп|небит\p{L}*|nedaužt\p{L}*|nebuvo\s+daužt\p{L}*|be\s+avarij\p{L}*|unfallfrei)(?!\p{L})/iu;

const SERVICE_RE =
  /[^.,;\n]{0,60}(?:servisa\s+vēstur\p{L}*|servisa\s+grāmatiņ\p{L}*|servisēts|apkopts|dīlera\s+serviss\p{L}*|pilna\s+vēsture|service\s+history|serviso\s+istorij\p{L}*|сервисн\p{L}+\s+истори\p{L}*|scheckheft)[^.,;\n]{0,60}/iu;

const OWNERS_RE =
  /[^.,;\n]{0,30}(?:(?:viens|1|pirmais|otrais|divi|2)\s+īpašniek\p{L}*|īpašniek\p{L}*\s*:\s*\d|один\s+владел\p{L}*|vienas\s+savinink\p{L}*|one\s+owner|1\.\s*hand|erste\s+hand)[^.,;\n]{0,30}/iu;

function clipText(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function parseKmNumber(raw: string, thousands: boolean): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  let n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n)) return null;
  if (thousands && n < 10_000) n *= 1000;
  return n >= 100 && n < 2_000_000 ? n : null;
}

/** Nobraukums no parametriem („Nobraukums, km: 77 400”) vai teksta („150 000 km”, „150 tūkst. km”). */
export function extractListingClaimedKm(text: string): number | null {
  const param = text.match(/(?:^|\n)\s*Nobraukums(,\s*tūkst\.?)?(?:,?\s*km)?\s*:[ \t]*([\d \u00a0.,]{3,12})/iu);
  if (param) {
    const n = parseKmNumber(param[2], Boolean(param[1]));
    if (n != null) return n;
  }
  const labeled = text.match(
    /(?:nobraukum\p{L}*|odometr\p{L}*|probeg\p{L}*|пробег\p{L}*|rida|kilometerstand|mileage)\D{0,20}(\d{1,3}(?:[ \u00a0.,]\d{3})+|\d{3,7})\s*(tūkst\.?|tūkstoš\p{L}*|k\b|тыс\.?)?\s*(?:km|км)?/iu,
  );
  if (labeled) {
    const n = parseKmNumber(labeled[1], Boolean(labeled[2]));
    if (n != null) return n;
  }
  return null;
}

function extractColor(text: string): string | null {
  const m = text.match(/(?:^|\n)\s*(?:Krāsa|Spalva|Цвет|Colou?r|Farbe)\s*:\s*([^\n]{2,60})/iu);
  return m ? clipText(m[1], 60) : null;
}

function extractEquipment(text: string): string | null {
  const m = text.match(/(?:^|\n)\s*Aprīkojums\s*:\s*([^\n]{3,})/iu);
  return m ? clipText(m[1], 220) : null;
}

export function extractListingSellerClaims(raw: string | null | undefined): ListingSellerClaims {
  const text = String(raw ?? "");
  const noAcc = text.match(NO_ACCIDENT_RE);
  const service = text.match(SERVICE_RE);
  const owners = text.match(OWNERS_RE);
  return {
    km: extractListingClaimedKm(text),
    noAccidents: noAcc ? clipText(noAcc[0], 80) : null,
    service: service ? clipText(service[0], 140) : null,
    owners: owners ? clipText(owners[0], 100) : null,
    color: extractColor(text),
    equipment: extractEquipment(text),
  };
}

function groupKm(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export const LISTING_SELLER_CLAIMS_TITLE =
  "Pārdevēja apgalvojumi sludinājumā (NAV pārbaudīti; salīdzini ar datiem - nobraukums, negadījumi, serviss, īpašnieki, krāsa, aprīkojums; pretrunu nosauc vienā faktiskā teikumā ar avotu; dīlera/Business variantā tikai fakts, bez padoma):";

/** Īsas rindas faktu lapai; tukšs masīvs, ja apgalvojumu nav. */
export function formatListingSellerClaimLines(claims: ListingSellerClaims): string[] {
  const out: string[] = [];
  if (claims.km != null) out.push(`- Nobraukums pēc pārdevēja: ${groupKm(claims.km)} km`);
  if (claims.noAccidents) out.push(`- Negadījumi: pārdevējs raksta „${claims.noAccidents}”`);
  if (claims.service) out.push(`- Serviss: „${claims.service}”`);
  if (claims.owners) out.push(`- Īpašnieki: „${claims.owners}”`);
  if (claims.color) out.push(`- Krāsa: ${claims.color}`);
  if (claims.equipment) out.push(`- Aprīkojums: ${claims.equipment}`);
  return out;
}
