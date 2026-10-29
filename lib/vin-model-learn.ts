/**
 * Pašmācīga VIN kodu tabula: no mūsu pašu datiem (pasūtījumi, sludinājumi, izsoles) ar VIN un zināmu
 * modeli iemācās "WMI + VIN kods -> modelis" markām, kam nav publiskas shēmas (Ford, Opel, Renault, PSA...).
 *
 * Drošības noteikumi (bez tiem labāk nerādīt neko):
 * - kodu pieņem tikai, ja to apstiprina vismaz MIN_SAMPLES dažādi VIN;
 * - visi paraugi vienam kodam norāda vienu un to pašu modeli - konflikts kodu izslēdz;
 * - vispirms mēģina precīzāko kodu (4.-8. zīme), tad īsāko (4.-6. zīme).
 * Tabula ir ģenerēts fails `data/vin-model-learned.json`; skripts `scripts/vin-model-learn.mjs`.
 */

export const MIN_SAMPLES = 2;

export type LearnedEntry = { make: string; model: string; samples: number };
/** `{"WF0": {"MXXGB": {...}, "MXX": {...}}}` - atslēga = koda garums 5 vai 3 zīmes. */
export type LearnedTable = Record<string, Record<string, LearnedEntry>>;

export type LearnPair = { vin: string; label: string };

const MAKE_ALIASES: Record<string, string> = {
  vw: "Volkswagen",
  volkswagen: "Volkswagen",
  "mercedes-benz": "Mercedes-Benz",
  mercedes: "Mercedes-Benz",
  "mercedes benz": "Mercedes-Benz",
  skoda: "Škoda",
  škoda: "Škoda",
  citroen: "Citroën",
  citroën: "Citroën",
  "land rover": "Land Rover",
  "alfa romeo": "Alfa Romeo",
};

const KNOWN_MAKES = [
  "Ford", "Opel", "Vauxhall", "Renault", "Dacia", "Peugeot", "Citroën", "DS", "Fiat", "Alfa Romeo", "Jeep",
  "Toyota", "Lexus", "Honda", "Nissan", "Mazda", "Mitsubishi", "Subaru", "Suzuki", "Hyundai", "Kia",
  "Volvo", "Saab", "BMW", "MINI", "Audi", "Volkswagen", "Škoda", "SEAT", "Cupra", "Porsche", "Mercedes-Benz",
  "Land Rover", "Jaguar", "Tesla", "Smart",
];

/** "FORD GALAXY 2.0 TDCi Titanium" -> { make: "Ford", model: "Galaxy" }. `null`, ja marku vai modeli nevar izdalīt. */
export function splitMakeModel(label: string): { make: string; model: string } | null {
  const clean = label.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const lower = clean.toLowerCase();
  let make: string | null = null;
  let rest = "";
  for (const [alias, canon] of Object.entries(MAKE_ALIASES)) {
    if (lower.startsWith(alias + " ")) {
      make = canon;
      rest = clean.slice(alias.length).trim();
      break;
    }
  }
  if (!make) {
    for (const m of KNOWN_MAKES) {
      if (lower.startsWith(m.toLowerCase() + " ")) {
        make = m;
        rest = clean.slice(m.length).trim();
        break;
      }
    }
  }
  if (!make) return null;
  // Modelis = pirmais vārds; tam seko motors, versija, komplektācija (tos neņemam).
  const first = rest.split(" ")[0] ?? "";
  const model = first.replace(/[(),;:]/g, "");
  if (!model || /^\d{1,2}[.,]\d$/.test(model) || /^(d|td|tdi|tdci|cdi|hdi|dci)$/i.test(model)) return null;
  // "XC60", "S-MAX", "CLA" paliek lielie; "GALAXY" -> "Galaxy".
  const pretty = /\d/.test(model) || model.length <= 3 ? model.toUpperCase() : model[0].toUpperCase() + model.slice(1).toLowerCase();
  return { make, model: pretty };
}

function normModel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Tīra funkcija: pāri -> tabula. Tikai Eiropas/Āzijas WMI ar burtu sākumā; VIN bez ZZZ 4.-6. zīmē lieto 3 zīmju kodu. */
export function learnVinModelCodes(pairs: LearnPair[], minSamples = MIN_SAMPLES): LearnedTable {
  type Bucket = { make: string; models: Map<string, { label: string; vins: Set<string> }> };
  const buckets = new Map<string, Bucket>();
  for (const { vin, label } of pairs) {
    const v = vin.replace(/\s+/g, "").toUpperCase();
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v) || !/^[A-Z]/.test(v)) continue;
    const mm = splitMakeModel(label);
    if (!mm) continue;
    const wmi = v.slice(0, 3);
    for (const code of [v.slice(3, 8), v.slice(3, 6)]) {
      const key = `${wmi}|${code}`;
      const b = buckets.get(key) ?? { make: mm.make, models: new Map() };
      if (b.make !== mm.make) {
        // Divas markas vienam WMI kodam (piem. SEAT/Cupra, Opel/Vauxhall) - saglabājam pirmo, modelis izšķir.
      }
      const mk = normModel(mm.model);
      const m = b.models.get(mk) ?? { label: mm.model, vins: new Set<string>() };
      m.vins.add(v);
      b.models.set(mk, m);
      buckets.set(key, b);
    }
  }
  const out: LearnedTable = {};
  for (const [key, b] of buckets) {
    if (b.models.size !== 1) continue; // konflikts
    const [m] = b.models.values();
    if (m.vins.size < minSamples) continue;
    const [wmi, code] = key.split("|");
    (out[wmi] ??= {})[code] = { make: b.make, model: m.label, samples: m.vins.size };
  }
  // Ja 5 zīmju kods pierādīts, 3 zīmju kods tam pašam modelim ir lieks tikai tad, ja viss 3 zīmju kodā ir viens modelis - to jau nodrošina konfliktu izslēgšana.
  return out;
}

/** Meklē iemācīto modeli: vispirms precīzais 5 zīmju kods, tad 3 zīmju. */
export function lookupLearned(table: LearnedTable, vin: string): (LearnedEntry & { code: string }) | null {
  const wmi = table[vin.slice(0, 3)];
  if (!wmi) return null;
  for (const code of [vin.slice(3, 8), vin.slice(3, 6)]) {
    const hit = wmi[code];
    if (hit) return { ...hit, code };
  }
  return null;
}
