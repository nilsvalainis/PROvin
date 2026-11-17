/**
 * Pasūtījuma Pārskats pa soļiem (Nils 28.10): soļi, kādos iet sarunā ar klientu.
 * Tīra loģika - lauki glabājas tajās pašās vērtībās (teksts), vecie dati nemainās.
 */

export const IRISS_ORDER_STEPS = [
  // Nils 30.10 (makets «Meklēšanas filtri»): viss, kas veido izsoļu un mobile.de filtrus, vienā solī.
  { id: "filters", title: "Meklēšanas filtri", question: "Kādu auto meklējam - filtri izsolēm un mobile.de." },
  { id: "budget", title: "Budžets un PVN", question: "Kas iekļauts budžetā un vai vajag PVN?" },
  { id: "equipment", title: "Prasības", question: "Kas noteikti jābūt un kas būtu labi?" },
  { id: "colors", title: "Krāsas un salons", question: "Kādas krāsas der un kādas noteikti nē?" },
  { id: "notes", title: "Piezīmes", question: "Viss pārējais no sarunas." },
  { id: "client", title: "Klienta kontakti", question: "Pēc konsultācijas - kā sazināties?" },
] as const;

/** Biežākās prasības izvēles pogām; teksta laukā var rakstīt arī citas. */
export const IRISS_EQUIPMENT_CHIPS = [
  "Āķis",
  "Ādas salons",
  "Navigācija",
  "ACC",
  "360° kamera",
  "Sēdekļu apsilde",
  "Stūres apsilde",
  "Panorāmas jumts",
  "El. bagāžnieks",
  "LED / Matrix lukturi",
  "Pneimopiekare",
  "Head-up",
  "Webasto",
  "7 sēdvietas",
] as const;

const norm = (s: string) => s.toLocaleLowerCase("lv").replace(/\s+/g, " ").trim();

function splitItems(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function equipmentHas(text: string, item: string): boolean {
  return splitItems(text).some((x) => norm(x) === norm(item));
}

/** Pievieno vai noņem ierakstu; pārējais teksts paliek kā bija. */
export function toggleEquipment(text: string, item: string): string {
  if (equipmentHas(text, item)) {
    return splitItems(text)
      .filter((x) => norm(x) !== norm(item))
      .join(", ");
  }
  const t = text.trim();
  return t ? `${t.replace(/[,;\s]+$/, "")}, ${item}` : item;
}

/** Sēdvietas "5" / "5-7" -> {from, to}; nesaprotams teksts paliek "from" laukā. */
export function seatsRange(raw: string): { from: string; to: string } {
  const t = raw.trim();
  const m = t.match(/^(\d*)\s*-\s*(\d*)$/);
  if (m) return { from: m[1] ?? "", to: m[2] ?? "" };
  return { from: t, to: "" };
}

export function seatsValue(from: string, to: string): string {
  const f = from.trim();
  const t = to.trim();
  if (f && t) return `${f}-${t}`;
  if (t) return `-${t}`;
  return f;
}
