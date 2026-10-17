/**
 * Publiskā /p/ piedāvājuma lauku formatēšana (LV, bez angļu enum atstāšanas).
 */

const FUEL_LV: Record<string, string> = {
  petrol: "Benzīns",
  gasoline: "Benzīns",
  benzin: "Benzīns",
  diesel: "Dīzelis",
  hybrid: "Hibrīds",
  electric: "Elektro",
  ev: "Elektro",
  gas: "Gāze",
  lpg: "LPG",
  cng: "CNG",
  hydrogen: "Ūdeņradis",
  phev: "PHEV",
  mhev: "MHEV",
  bev: "BEV",
};

const TRANSMISSION_LV: Record<string, string> = {
  automatic: "Automātiskā",
  auto: "Automātiskā",
  automatik: "Automātiskā",
  manual: "Manuālā",
  manuell: "Manuālā",
  mehaniska: "Manuālā",
  mehāniskā: "Manuālā",
  semiautomatic: "Pusautomātiskā",
  "semi-automatic": "Pusautomātiskā",
  semi: "Pusautomātiskā",
  cvt: "CVT",
  dsg: "DSG",
  dct: "DCT",
};

const BODY_LV: Record<string, string> = {
  sedan: "Sedans",
  saloon: "Sedans",
  wagon: "Universālis",
  estate: "Universālis",
  avant: "Universālis",
  kombi: "Universālis",
  combi: "Universālis",
  touring: "Universālis",
  variant: "Universālis",
  break: "Universālis",
  hatchback: "Hečbeks",
  suv: "SUV",
  coupe: "Kupeja",
  cabrio: "Kabriolets",
  convertible: "Kabriolets",
  roadster: "Kabriolets",
  mpv: "MPV",
  van: "Mikroautobuss",
  minibus: "Mikroautobuss",
  pickup: "Pikaps",
};

function normKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ").replace(/_/g, " ");
}

function mapEnum(raw: string, table: Record<string, string>): string {
  const t = raw.trim();
  if (!t) return "";
  const key = normKey(t);
  if (table[key]) return table[key];
  const slug = key.replace(/[^a-z0-9]+/g, "");
  for (const [k, label] of Object.entries(table)) {
    if (slug === k.replace(/[^a-z0-9]+/g, "")) return label;
  }
  return "";
}

export function formatIrissOfferPublicOdometer(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const digits = t.replace(/[^\d]/g, "");
  if (!digits) return t.slice(0, 40);
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n) || n <= 0) return t.slice(0, 40);
  return `${new Intl.NumberFormat("lv-LV", { maximumFractionDigits: 0 }).format(n)} km`;
}

export function formatIrissOfferPublicTransmission(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const mapped = mapEnum(t, TRANSMISSION_LV);
  if (mapped) return mapped;
  const key = normKey(t);
  if (/\bautomatic\b|\bautomatik\b|\btiptronic\b|\bdsg\b|\bdct\b|\bcvt\b|\bs[\s-]?tronic\b|\b4matic\b|\bquattro\b/.test(key)) {
    return "Automātiskā";
  }
  if (/\bmanual\b|\bmanuell\b|\bmehān|\bmehan|\bschalt/.test(key)) return "Manuālā";
  if (/\bsemi\b|\bhalbauto/.test(key)) return "Pusautomātiskā";
  if (/automātisk|manuāl|pusautomātisk/i.test(t)) return t.slice(0, 40);
  return t.slice(0, 40);
}

export function formatIrissOfferPublicFuel(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const mapped = mapEnum(t, FUEL_LV);
  if (mapped) return mapped;
  const key = normKey(t);
  if (/\bdiesel\b|\bdīzel|\bdizel/.test(key)) return "Dīzelis";
  if (/\bpetrol\b|\bgasoline\b|\bbenzin|\bbenzīn/.test(key)) return "Benzīns";
  if (/\belectric\b|\belektro\b|\bbev\b/.test(key)) return "Elektro";
  if (/\bhybrid\b|\bhibrīd/.test(key)) return "Hibrīds";
  if (/dīzel|benzīn|elektro|hibrīd|gāze/i.test(t)) return t.slice(0, 40);
  return t.slice(0, 40);
}

export function formatIrissOfferPublicBodyType(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const mapped = mapEnum(t, BODY_LV);
  if (mapped) return mapped;
  const key = normKey(t);
  for (const [en, lv] of Object.entries(BODY_LV)) {
    if (key.includes(en)) return lv;
  }
  if (/universāl|hečbek|sedan|kupej|kabriol|mikroautobus|pikap/i.test(t)) return t.slice(0, 40);
  return t.slice(0, 40);
}
