import learned from "@/data/vin-model-learned.json";
import type { VinDecodeResult } from "@/lib/vin-decode";
import { lookupLearned, type LearnedTable } from "@/lib/vin-model-learn";

/**
 * Modelis no Eiropas VIN bez ārējiem pieprasījumiem (bezmaksas VIN pārbaude).
 *
 * Rādām tikai ražotāju pašu stabilās shēmas:
 * - VW grupa (VW, Audi, Škoda, SEAT/Cupra): modeļa kods 7.-8. zīmē, modeļa gads 10. zīmē. VW, Audi un
 *   SEAT Eiropas VIN 4.-6. zīmē ir "ZZZ" (citādi tas ir ASV formāts ar citu shēmu); Škoda tur kodē
 *   virsbūvi, motoru un drošības spilvenus. Modeli rādām tikai tad, ja gada kods iekrīt paaudzes ražošanas gados -
 *   ja nesakrīt, VIN ir neparasts un neko nerādām.
 * - Mercedes-Benz: Eiropas VIN 4.-9. zīme ir Baumuster (6 cipari), pirmie 3 = Baureihe. Gads VIN nav.
 * - Volvo: 4.-5. zīme ir modeļa kods (publiska shēma), 10. zīme modeļa gads.
 * - BMW: 4.-5. zīme ir modeļa/paaudzes kods bez publiskas pilnas tabulas - tikai kodi, kas sakrīt ar
 *   mūsu pasūtījumu auto (29.10.2026). Eiropas BMW 10. zīme bieži ir "0" (bez gada), tad gadu nerādām.
 * - Iemācītā tabula (`data/vin-model-learned.json`, sk. `lib/vin-model-learn.ts`): pārējām markām no mūsu
 *   pašu datiem, tikai kodi ar 2+ sakritībām un bez konfliktiem. Bez paaudzes un gada.
 * Nezināms kods -> `null` (lapa rāda tikai ražotāju un valsti).
 * VW grupas kods ir platformas kods: vienam kodam var būt vairāki modeļi (5F = Leon III un Ateca), tos rādām visus.
 * Pārbaudīts 29.10.2026 pret 54 īstiem VW grupas un Mercedes auto (CSDD un izsoļu modelis) - kodi laboti pēc tiem.
 */

export type VinModelInfo = {
  make: string;
  model: string;
  /** Paaudze vai šasija, piem. "III", "B8", "W213". */
  generation: string;
  /** Paaudzes ražošanas gadi; `to: null` = ražo joprojām; `null` = iemācītajai tabulai nav zināmi. */
  produced: { from: number; to: number | null } | null;
  /** Tikai VW grupai, ja gada kods viennozīmīgs paaudzes robežās. */
  modelYear: number | null;
  scheme: "vag" | "mercedes" | "volvo" | "bmw" | "learned";
  /** Ražotāja kods VIN (VW grupa 7.-8. zīme, Mercedes Baureihe 4.-6. zīme). */
  code: string;
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

/** Volvo 4.-5. zīme (YV1 vieglie, YV4 apvidus). Pārbaudīts ar 23 mūsu auto. */
const VOLVO: Record<string, Gen> = {
  LS: { model: "850 / S70", generation: "I", from: 1991, to: 2000 },
  LW: { model: "850 / V70", generation: "I", from: 1991, to: 2000 },
  TS: { model: "S80", generation: "I", from: 1998, to: 2006 },
  RS: { model: "S60", generation: "I", from: 2000, to: 2009 },
  SW: { model: "V70", generation: "II", from: 2000, to: 2007 },
  SZ: { model: "XC70", generation: "I", from: 2000, to: 2007 },
  MS: { model: "S40", generation: "II", from: 2004, to: 2012 },
  MW: { model: "V50", generation: "", from: 2004, to: 2012 },
  MK: { model: "C30", generation: "", from: 2006, to: 2013 },
  MC: { model: "C70", generation: "II", from: 2006, to: 2013 },
  MV: { model: "V40", generation: "II", from: 2012, to: 2019 },
  AS: { model: "S80", generation: "II", from: 2006, to: 2016 },
  BW: { model: "V70", generation: "III", from: 2007, to: 2016 },
  BZ: { model: "XC70", generation: "II", from: 2007, to: 2016 },
  CM: { model: "XC90", generation: "I", from: 2002, to: 2014 },
  CT: { model: "XC90", generation: "I", from: 2002, to: 2014 },
  CY: { model: "XC90", generation: "I", from: 2002, to: 2014 },
  CZ: { model: "XC90", generation: "I", from: 2002, to: 2014 },
  DZ: { model: "XC60", generation: "I", from: 2008, to: 2017 },
  FS: { model: "S60", generation: "II", from: 2010, to: 2018 },
  FW: { model: "V60", generation: "I", from: 2010, to: 2018 },
  LF: { model: "XC90", generation: "II", from: 2015, to: null },
  PS: { model: "S90", generation: "II", from: 2016, to: null },
  PW: { model: "V90", generation: "II", from: 2016, to: null },
  UZ: { model: "XC60", generation: "II", from: 2017, to: null },
  XZ: { model: "XC40", generation: "", from: 2017, to: null },
  ZS: { model: "S60", generation: "III", from: 2018, to: null },
  ZW: { model: "V60", generation: "II", from: 2018, to: null },
};

/** BMW 4.-5. zīme: tikai kodi, kas sakrīt ar mūsu auto. Vienam kodam var būt vairāki modeļi. */
const BMW: Record<string, Gen> = {
  "1B": { model: "1. sērija", generation: "F20 / F21", from: 2011, to: 2019 },
  "1J": { model: "2. sērija kupeja / kabriolets", generation: "F22 / F23", from: 2013, to: 2021 },
  "2E": { model: "2. sērija Active / Gran Tourer", generation: "F45 / F46", from: 2014, to: 2022 },
  "6X": { model: "2. sērija Active Tourer", generation: "U06", from: 2021, to: null },
  "3A": { model: "3. sērija", generation: "F30 / F31", from: 2012, to: 2019 },
  "5R": { model: "3. sērija", generation: "G20 / G21", from: 2018, to: null },
  PN: { model: "3. sērija", generation: "E90 / E91", from: 2005, to: 2012 },
  UT: { model: "3. sērija Touring", generation: "E91", from: 2005, to: 2012 },
  NC: { model: "5. sērija", generation: "E60 / E61", from: 2003, to: 2010 },
  NX: { model: "5. sērija", generation: "E60 / E61", from: 2003, to: 2010 },
  PX: { model: "5. sērija", generation: "E60 / E61", from: 2003, to: 2010 },
  "5K": { model: "5. sērija", generation: "F10 / F11", from: 2010, to: 2017 },
  "51": { model: "5. sērija", generation: "G30 / G31", from: 2016, to: 2023 },
  JD: { model: "5. sērija", generation: "G30 / G31", from: 2016, to: 2023 },
  JW: { model: "6. sērija Gran Turismo", generation: "G32", from: 2017, to: 2023 },
  LW: { model: "6. sērija kupeja / kabriolets", generation: "F12 / F13", from: 2011, to: 2018 },
  YM: { model: "6. sērija Gran Coupé", generation: "F06", from: 2012, to: 2018 },
  VN: { model: "X1", generation: "E84", from: 2009, to: 2015 },
  HS: { model: "X1", generation: "F48", from: 2015, to: 2022 },
  HT: { model: "X1", generation: "F48", from: 2015, to: 2022 },
  WY: { model: "X3", generation: "F25", from: 2010, to: 2017 },
  FF: { model: "X5", generation: "E70", from: 2006, to: 2013 },
  KS: { model: "X5", generation: "F15", from: 2013, to: 2018 },
  TA: { model: "X5", generation: "G05", from: 2018, to: null },
  GT: { model: "X6", generation: "G06", from: 2019, to: null },
  TC: { model: "X6", generation: "G06", from: 2019, to: null },
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

type CodeScheme = { make: string; table: Record<string, Gen>; start: number; len: number; zzz: boolean; year: "required" | "optional"; scheme: VinModelInfo["scheme"] };

const SCHEMES: Record<string, CodeScheme> = Object.fromEntries([
  ...Object.entries(VAG_TABLES).map(([wmi, v]) => [wmi, { make: v.make, table: v.table, start: 6, len: 2, zzz: v.zzz !== false, year: "required", scheme: "vag" } as CodeScheme]),
  ...["YV1", "YV4"].map((wmi) => [wmi, { make: "Volvo", table: VOLVO, start: 3, len: 2, zzz: false, year: "required", scheme: "volvo" } as CodeScheme]),
  ...["WBA", "WBS"].map((wmi) => [wmi, { make: "BMW", table: BMW, start: 3, len: 2, zzz: false, year: "optional", scheme: "bmw" } as CodeScheme]),
]);

function decodeByCode(vin: string, years: number[], now: Date): VinModelInfo | null {
  const sch = SCHEMES[vin.slice(0, 3)];
  if (!sch || (sch.zzz && vin.slice(3, 6) !== "ZZZ")) return null;
  const code = vin.slice(sch.start, sch.start + sch.len);
  const gen = sch.table[code];
  if (!gen) return null;
  // Modeļa gads var apsteigt ražošanu par gadu (rudens izlaidums).
  const last = (gen.to ?? now.getUTCFullYear()) + 1;
  const fits = years.filter((y) => y >= gen.from - 1 && y <= last);
  // Gada kods, kas neiekrīt paaudzes gados, nozīmē neparastu VIN: labāk neko nerādīt.
  if (years.length && fits.length !== 1) return null;
  if (!years.length && sch.year === "required") return null;
  return {
    make: gen.make ?? sch.make,
    model: gen.model,
    generation: gen.generation,
    produced: { from: gen.from, to: gen.to },
    modelYear: fits[0] ?? null,
    scheme: sch.scheme,
    code,
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
    code: vin.slice(3, 6),
  };
}

/** Vai šim WMI ir sava pārbaudīta shēma (tad iemācīto tabulu nelieto). */
export function hasCuratedScheme(vin: string): boolean {
  const wmi = vin.slice(0, 3);
  return Boolean(SCHEMES[wmi]) || MB_WMI.has(wmi);
}

/** Serverim: iemācītais modelis no dotas tabulas (Blob versija, kas atjaunojas reizi nedēļā). */
export function decodeLearnedFrom(table: LearnedTable, vin: string): VinModelInfo | null {
  if (hasCuratedScheme(vin)) return null;
  const hit = lookupLearned(table, vin);
  if (!hit) return null;
  return { make: hit.make, model: hit.model, generation: "", produced: null, modelYear: null, scheme: "learned", code: hit.code };
}

export function decodeVinModel(local: Extract<VinDecodeResult, { ok: true }>, now: Date = new Date()): VinModelInfo | null {
  if (local.region !== "europe") return null;
  const wmi = local.vin.slice(0, 3);
  // Markām ar savu shēmu iemācīto tabulu nelietojam: ja shēma apzināti dod `null` (gads neiekrīt), tā arī paliek.
  if (SCHEMES[wmi] || MB_WMI.has(wmi)) return decodeByCode(local.vin, local.modelYears, now) ?? decodeMercedes(local.vin);
  return decodeLearned(local.vin);
}

function decodeLearned(vin: string): VinModelInfo | null {
  const hit = lookupLearned((learned as { table: LearnedTable }).table, vin);
  if (!hit) return null;
  return { make: hit.make, model: hit.model, generation: "", produced: null, modelYear: null, scheme: "learned", code: hit.code };
}
