import type { VinDecodeResult } from "@/lib/vin-decode";

/**
 * Modelis no Eiropas VIN bez ārējiem pieprasījumiem (bezmaksas VIN pārbaude).
 *
 * Rādām tikai ražotāju pašu stabilās shēmas:
 * - VW grupa (VW, Audi, Škoda, SEAT/Cupra): modeļa kods 7.-8. zīmē, modeļa gads 10. zīmē. VW, Audi un
 *   SEAT Eiropas VIN 4.-6. zīmē ir "ZZZ" (citādi tas ir ASV formāts ar citu shēmu); Škoda tur kodē
 *   virsbūvi, motoru un drošības spilvenus. Modeli rādām tikai tad, ja gada kods iekrīt paaudzes ražošanas gados -
 *   ja nesakrīt, VIN ir neparasts un neko nerādām.
 * - Mercedes-Benz: Eiropas VIN 4.-9. zīme ir Baumuster (6 cipari), pirmie 3 = Baureihe. Gads VIN nav.
 * BMW nav: publiskas un pilnīgas 4.-7. zīmes tabulas nav, minēt negribam.
 * Nezināms kods -> `null` (lapa rāda tikai ražotāju un valsti).
 * VW grupas kods ir platformas kods: vienam kodam var būt vairāki modeļi (5F = Leon III un Ateca), tos rādām visus.
 * Pārbaudīts 29.10.2026 pret 54 īstiem VW grupas un Mercedes auto (CSDD un izsoļu modelis) - kodi laboti pēc tiem.
 */

export type VinModelInfo = {
  make: string;
  model: string;
  /** Paaudze vai šasija, piem. "III", "B8", "W213". */
  generation: string;
  /** Paaudzes ražošanas gadi; `to: null` = ražo joprojām. */
  produced: { from: number; to: number | null };
  /** Tikai VW grupai, ja gada kods viennozīmīgs paaudzes robežās. */
  modelYear: number | null;
  scheme: "vag" | "mercedes";
};

type Gen = { model: string; generation: string; from: number; to: number | null; make?: string };

const VW: Record<string, Gen> = {
  "1J": { model: "Golf / Bora", generation: "IV", from: 1997, to: 2006 },
  "1K": { model: "Golf / Golf Plus / Jetta", generation: "V-VI", from: 2003, to: 2014 },
  "5K": { model: "Golf", generation: "VI", from: 2008, to: 2013 },
  AU: { model: "Golf", generation: "VII", from: 2012, to: 2020 },
  CD: { model: "Golf", generation: "VIII", from: 2019, to: null },
  "1T": { model: "Touran", generation: "I-II", from: 2003, to: null },
  "3B": { model: "Passat", generation: "B5", from: 1996, to: 2005 },
  "3C": { model: "Passat / CC", generation: "B6-B8", from: 2005, to: 2024 },
  "3H": { model: "Arteon", generation: "", from: 2017, to: null },
  "3D": { model: "Phaeton", generation: "", from: 2002, to: 2016 },
  "5N": { model: "Tiguan", generation: "I-II", from: 2007, to: 2024 },
  "9N": { model: "Polo", generation: "IV", from: 2001, to: 2009 },
  "6R": { model: "Polo", generation: "V", from: 2009, to: 2017 },
  AW: { model: "Polo", generation: "VI", from: 2017, to: null },
  "7L": { model: "Touareg", generation: "I", from: 2002, to: 2010 },
  "7P": { model: "Touareg", generation: "II", from: 2010, to: 2018 },
  "7M": { model: "Sharan", generation: "I", from: 1995, to: 2010 },
  "7N": { model: "Sharan", generation: "II", from: 2010, to: 2022 },
  "7H": { model: "Transporter / Multivan", generation: "T5-T6", from: 2003, to: 2024 },
  ST: { model: "Multivan", generation: "T7", from: 2021, to: null },
  "2K": { model: "Caddy", generation: "III-IV", from: 2003, to: 2020 },
  "2E": { model: "Crafter", generation: "I", from: 2006, to: 2016 },
  SY: { model: "Crafter", generation: "II", from: 2016, to: null },
  "2H": { model: "Amarok", generation: "I", from: 2010, to: 2022 },
  A1: { model: "T-Roc", generation: "", from: 2017, to: null },
  C1: { model: "T-Cross", generation: "", from: 2018, to: null },
  AA: { model: "up!", generation: "", from: 2011, to: 2023 },
  "1F": { model: "Eos", generation: "", from: 2006, to: 2015 },
  E1: { model: "ID.3", generation: "", from: 2019, to: null },
  E2: { model: "ID.4", generation: "", from: 2020, to: null },
};

const AUDI: Record<string, Gen> = {
  "8L": { model: "A3", generation: "8L", from: 1996, to: 2003 },
  "8P": { model: "A3", generation: "8P", from: 2003, to: 2013 },
  "8V": { model: "A3", generation: "8V", from: 2012, to: 2020 },
  GY: { model: "A3", generation: "8Y", from: 2020, to: null },
  "8E": { model: "A4", generation: "B6-B7", from: 2000, to: 2008 },
  "8K": { model: "A4", generation: "B8", from: 2007, to: 2016 },
  F4: { model: "A4", generation: "B9", from: 2015, to: 2024 },
  "8T": { model: "A5", generation: "I", from: 2007, to: 2016 },
  F5: { model: "A5", generation: "II", from: 2016, to: 2024 },
  "4F": { model: "A6", generation: "C6", from: 2004, to: 2011 },
  "4G": { model: "A6 / A7", generation: "C7", from: 2010, to: 2018 },
  F2: { model: "A6 / A7", generation: "C8", from: 2018, to: null },
  "4E": { model: "A8", generation: "D3", from: 2002, to: 2010 },
  "4H": { model: "A8", generation: "D4", from: 2009, to: 2017 },
  "8X": { model: "A1", generation: "I", from: 2010, to: 2018 },
  GB: { model: "A1", generation: "II", from: 2018, to: null },
  GA: { model: "Q2", generation: "", from: 2016, to: null },
  "8U": { model: "Q3", generation: "I", from: 2011, to: 2018 },
  F3: { model: "Q3", generation: "II", from: 2018, to: null },
  "8R": { model: "Q5", generation: "I", from: 2008, to: 2017 },
  FY: { model: "Q5", generation: "II", from: 2016, to: 2024 },
  "4L": { model: "Q7", generation: "I", from: 2005, to: 2015 },
  "4M": { model: "Q7", generation: "II", from: 2015, to: null },
  F1: { model: "Q8", generation: "", from: 2018, to: null },
  GE: { model: "e-tron / Q8 e-tron", generation: "", from: 2018, to: 2025 },
  FZ: { model: "Q4 e-tron", generation: "", from: 2021, to: null },
  "8J": { model: "TT", generation: "II", from: 2006, to: 2014 },
  FV: { model: "TT", generation: "III", from: 2014, to: 2023 },
};

const SKODA: Record<string, Gen> = {
  "1U": { model: "Octavia", generation: "I", from: 1996, to: 2010 },
  "1Z": { model: "Octavia", generation: "II", from: 2004, to: 2013 },
  NE: { model: "Octavia", generation: "III", from: 2012, to: 2020 },
  NX: { model: "Octavia", generation: "IV", from: 2019, to: null },
  "3U": { model: "Superb", generation: "I", from: 2001, to: 2008 },
  "3T": { model: "Superb", generation: "II", from: 2008, to: 2015 },
  NP: { model: "Superb", generation: "III", from: 2015, to: 2024 },
  NS: { model: "Kodiaq", generation: "I", from: 2016, to: 2024 },
  NU: { model: "Karoq", generation: "", from: 2017, to: null },
  NW: { model: "Scala / Kamiq", generation: "", from: 2019, to: null },
  "5J": { model: "Fabia / Roomster", generation: "II", from: 2006, to: 2015 },
  NJ: { model: "Fabia", generation: "III", from: 2014, to: 2021 },
  PJ: { model: "Fabia", generation: "IV", from: 2021, to: null },
  NH: { model: "Rapid", generation: "", from: 2012, to: 2019 },
  "5L": { model: "Yeti", generation: "", from: 2009, to: 2017 },
};

const SEAT: Record<string, Gen> = {
  "6J": { model: "Ibiza", generation: "IV", from: 2008, to: 2017 },
  KJ: { model: "Ibiza / Arona", generation: "", from: 2017, to: null },
  "1P": { model: "Leon", generation: "II", from: 2005, to: 2012 },
  "5F": { model: "Leon / Ateca", generation: "Leon III, Ateca", from: 2012, to: null },
  KL: { model: "Leon", generation: "IV", from: 2020, to: null },
  KM: { model: "Formentor", generation: "", from: 2020, to: null, make: "Cupra" },
  K1: { model: "Born", generation: "", from: 2021, to: null, make: "Cupra" },
};

const VAG_TABLES: Record<string, { make: string; table: Record<string, Gen>; zzz?: false }> = {
  WVW: { make: "Volkswagen", table: VW },
  WVG: { make: "Volkswagen", table: VW },
  WV1: { make: "Volkswagen", table: VW },
  WV2: { make: "Volkswagen", table: VW },
  WAU: { make: "Audi", table: AUDI },
  WUA: { make: "Audi", table: AUDI },
  TRU: { make: "Audi", table: AUDI },
  TMB: { make: "Škoda", table: SKODA, zzz: false },
  VSS: { make: "SEAT", table: SEAT },
};

/** Baureihe -> modelis. `suv` izmanto, ja WMI ir apvidus auto (WDC/W1N) un numurs dalīts (204 C / GLK). */
type MbGen = { model: string; generation: string; from: number; to: number | null };
const MB: Record<string, { car?: MbGen; suv?: MbGen }> = {
  "168": { car: { model: "A-klase", generation: "W168", from: 1997, to: 2004 } },
  "169": { car: { model: "A-klase", generation: "W169", from: 2004, to: 2012 } },
  "176": { car: { model: "A-klase", generation: "W176", from: 2012, to: 2018 } },
  "177": { car: { model: "A-klase", generation: "W177", from: 2018, to: null } },
  "245": { car: { model: "B-klase", generation: "W245", from: 2005, to: 2011 } },
  "246": { car: { model: "B-klase", generation: "W246", from: 2011, to: 2018 } },
  "247": {
    car: { model: "B-klase", generation: "W247", from: 2018, to: null },
    suv: { model: "GLB", generation: "X247", from: 2019, to: null },
  },
  "117": { car: { model: "CLA", generation: "C117", from: 2013, to: 2019 } },
  "118": { car: { model: "CLA", generation: "C118", from: 2019, to: null } },
  "202": { car: { model: "C-klase", generation: "W202", from: 1993, to: 2000 } },
  "203": { car: { model: "C-klase", generation: "W203", from: 2000, to: 2007 } },
  "204": {
    car: { model: "C-klase", generation: "W204", from: 2007, to: 2014 },
    suv: { model: "GLK", generation: "X204", from: 2008, to: 2015 },
  },
  "205": { car: { model: "C-klase", generation: "W205", from: 2014, to: 2021 } },
  "206": { car: { model: "C-klase", generation: "W206", from: 2021, to: null } },
  "210": { car: { model: "E-klase", generation: "W210", from: 1995, to: 2002 } },
  "211": { car: { model: "E-klase", generation: "W211", from: 2002, to: 2009 } },
  "212": { car: { model: "E-klase", generation: "W212", from: 2009, to: 2016 } },
  "213": { car: { model: "E-klase", generation: "W213", from: 2016, to: 2023 } },
  "214": { car: { model: "E-klase", generation: "W214", from: 2023, to: null } },
  "207": { car: { model: "E-klase kupeja / kabriolets", generation: "C207", from: 2009, to: 2017 } },
  "238": { car: { model: "E-klase kupeja / kabriolets", generation: "C238", from: 2017, to: 2023 } },
  "219": { car: { model: "CLS", generation: "C219", from: 2004, to: 2010 } },
  "218": { car: { model: "CLS", generation: "C218", from: 2010, to: 2018 } },
  "257": { car: { model: "CLS", generation: "C257", from: 2018, to: 2023 } },
  "140": { car: { model: "S-klase", generation: "W140", from: 1991, to: 1998 } },
  "220": { car: { model: "S-klase", generation: "W220", from: 1998, to: 2005 } },
  "221": { car: { model: "S-klase", generation: "W221", from: 2005, to: 2013 } },
  "222": { car: { model: "S-klase", generation: "W222", from: 2013, to: 2020 } },
  "223": { car: { model: "S-klase", generation: "W223", from: 2020, to: null } },
  "209": { car: { model: "CLK", generation: "C209", from: 2002, to: 2010 } },
  "171": { car: { model: "SLK", generation: "R171", from: 2004, to: 2011 } },
  "172": { car: { model: "SLK / SLC", generation: "R172", from: 2011, to: 2020 } },
  "230": { car: { model: "SL", generation: "R230", from: 2001, to: 2012 } },
  "231": { car: { model: "SL", generation: "R231", from: 2012, to: 2020 } },
  "295": { car: { model: "EQE", generation: "V295", from: 2022, to: null } },
  "297": { car: { model: "EQS", generation: "V297", from: 2021, to: null } },
  "156": { suv: { model: "GLA", generation: "X156", from: 2013, to: 2020 } },
  "253": { suv: { model: "GLC", generation: "X253", from: 2015, to: 2022 } },
  "254": { suv: { model: "GLC", generation: "X254", from: 2022, to: null } },
  "293": { suv: { model: "EQC", generation: "N293", from: 2019, to: 2024 } },
  "163": { suv: { model: "M-klase", generation: "W163", from: 1997, to: 2005 } },
  "164": { suv: { model: "M-klase / GL", generation: "W164 / X164", from: 2005, to: 2012 } },
  "166": { suv: { model: "M-klase / GLE / GL / GLS", generation: "W166 / X166", from: 2011, to: 2019 } },
  "167": { suv: { model: "GLE / GLS", generation: "V167 / X167", from: 2019, to: null } },
  "292": { suv: { model: "GLE kupeja", generation: "C292", from: 2015, to: 2019 } },
  "463": { suv: { model: "G-klase", generation: "W463", from: 1990, to: null } },
  "251": { suv: { model: "R-klase", generation: "W251", from: 2005, to: 2013 } },
  "639": { car: { model: "Vito / Viano", generation: "W639", from: 2003, to: 2014 } },
  "447": { car: { model: "Vito / V-klase", generation: "W447", from: 2014, to: null } },
  "906": { car: { model: "Sprinter", generation: "906", from: 2006, to: 2018 } },
  "907": { car: { model: "Sprinter", generation: "907", from: 2018, to: null } },
  "910": { car: { model: "Sprinter", generation: "910", from: 2018, to: null } },
  "415": { car: { model: "Citan", generation: "W415", from: 2012, to: 2021 } },
  "470": { car: { model: "X-klase", generation: "470", from: 2017, to: 2020 } },
};

const MB_WMI = new Set(["WDD", "WDB", "WDC", "WDF", "W1K", "W1N", "W1V"]);
const MB_SUV_WMI = new Set(["WDC", "W1N"]);

function decodeVag(vin: string, years: number[], now: Date): VinModelInfo | null {
  const brand = VAG_TABLES[vin.slice(0, 3)];
  if (!brand || (brand.zzz !== false && vin.slice(3, 6) !== "ZZZ")) return null;
  const gen = brand.table[vin.slice(6, 8)];
  if (!gen) return null;
  // Modeļa gads var apsteigt ražošanu par gadu (rudens izlaidums).
  const last = (gen.to ?? now.getUTCFullYear()) + 1;
  const fits = years.filter((y) => y >= gen.from - 1 && y <= last);
  if (fits.length !== 1) return null;
  return {
    make: gen.make ?? brand.make,
    model: gen.model,
    generation: gen.generation,
    produced: { from: gen.from, to: gen.to },
    modelYear: fits[0],
    scheme: "vag",
  };
}

function decodeMercedes(vin: string): VinModelInfo | null {
  const wmi = vin.slice(0, 3);
  if (!MB_WMI.has(wmi) || !/^\d{6}$/.test(vin.slice(3, 9))) return null;
  const row = MB[vin.slice(3, 6)];
  if (!row) return null;
  const gen = MB_SUV_WMI.has(wmi) ? (row.suv ?? row.car) : (row.car ?? row.suv);
  if (!gen) return null;
  return {
    make: "Mercedes-Benz",
    model: gen.model,
    generation: gen.generation,
    produced: { from: gen.from, to: gen.to },
    modelYear: null,
    scheme: "mercedes",
  };
}

export function decodeVinModel(local: Extract<VinDecodeResult, { ok: true }>, now: Date = new Date()): VinModelInfo | null {
  if (local.region !== "europe") return null;
  return decodeVag(local.vin, local.modelYears, now) ?? decodeMercedes(local.vin);
}
