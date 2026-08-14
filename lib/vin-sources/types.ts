/**
 * Publiskie valsts reģistru avoti, ko admin panelis ielasa pēc VIN.
 * Kopīgs rezultāta formāts visiem avotiem, lai UI un AI konteksts būtu vienāds.
 */

export const VIN_SOURCE_IDS = ["tjekbil", "mnt_ee", "lkf_ee", "carinfo"] as const;
export type VinSourceId = (typeof VIN_SOURCE_IDS)[number];

export function isVinSourceId(v: string): v is VinSourceId {
  return (VIN_SOURCE_IDS as readonly string[]).includes(v);
}

/** Nobraukuma rinda: datums + odometrs + valsts (kā pārējos avotu blokos). */
export type VinSourceMileageRow = {
  date: string;
  odometer: string;
  country: string;
  /** Ieraksta izcelsme avotā (reģistrs / apskate) — nonāk piezīmēs un AI kontekstā. */
  origin?: string;
};

/** Negadījuma rinda: datums + summa (ja pieejama) + valsts. */
export type VinSourceIncidentRow = {
  date: string;
  amount: string;
  country: string;
  note?: string;
};

export type VinSourceFetchResult = {
  source: VinSourceId;
  vin: string;
  /** Vai avots atgrieza datus par šo VIN. */
  found: boolean;
  /** Statusa ziņojums latviski (arī tad, ja dati nav atrasti). */
  message: string;
  mileage: VinSourceMileageRow[];
  incidents: VinSourceIncidentRow[];
  /** Īpašnieku skaits un reģistrācijas darbību apkopojums (latviski). */
  ownersSummary: string;
  /** TAXI, īre bez vadītāja, autoskola, operatīvais transports, līzings u.tml. */
  statusRecords: string;
  /** Anomālijas / brīdinājumi / sarkanie karogi. */
  notes: string[];
  /** Neapstrādātie dati avota valodā (JSON vai lapas teksts) — RAW laukam. */
  raw: string;
  fetchedAt: string;
};

export function emptyVinSourceResult(source: VinSourceId, vin: string, message: string): VinSourceFetchResult {
  return {
    source,
    vin,
    found: false,
    message,
    mileage: [],
    incidents: [],
    ownersSummary: "",
    statusRecords: "",
    notes: [],
    raw: "",
    fetchedAt: new Date().toISOString(),
  };
}
