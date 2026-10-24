/**
 * PROVIN agregātu faktu bāze (unit facts): strukturēti, avototi fakti par dzinējiem,
 * kārbām, apkopes intervāliem un atsaukumiem. Lieto pirms-publicēšanas faktu pārbaude
 * (`check.ts`), kas AI komentārus NEMAINA, tikai atzīmē aizdomīgus teikumus adminam.
 *
 * Noteikumi:
 * - Katram faktam ir vismaz viens avots ar datumu (`accessed`, YYYY-MM-DD).
 * - `verified` = ≥1 ražotāja/iestādes avots, ≥2 neatkarīgi avoti, vai Nila apstiprināta
 *   tipiska kaite (`kind: "nils"`, `topic: "known_issue"`, piem. N57 klaņa gultņi).
 *   Tikai verified fakti ģenerē pretrunu karodziņus (E).
 * - `disputed` = avoti savstarpēji nesakrīt vai IRISS labojums ir pretrunā ar ražotāja avotu.
 *   Pārbaude tikai brīdina (W) „strīdīgs fakts, pārbaudi manuāli”; nekad nesaka, kurš pareizs.
 * - `pending_nils` = skar B1-B8 vai citu jautājumu, kas jāizrunā ar Nilu. Pārbaude to ignorē.
 * - `draft` = vēl nav pietiekamu avotu. Pārbaude to ignorē.
 * - Bez EUR summām.
 */

export type UnitFactStatus = "verified" | "disputed" | "pending_nils" | "draft";

export type UnitFactSourceKind =
  | "oem_doc" // ražotāja SSP, servisa dokumentācija, īpašnieka literatūra
  | "oem_press" // ražotāja preses relīze / tehniskie dati
  | "authority" // NHTSA, EU Safety Gate, KBA, ražotāja oficiālā atsaukumu lapa
  | "supplier" // detaļu ražotāja tehniskais biļetens (Gates, ZF, …)
  | "specialist" // specializēts serviss / tehniskā wiki
  | "iriss" // IRISS eksperta labojums
  | "nils"; // Nila lēmums

export type UnitFactSource = {
  kind: UnitFactSourceKind;
  title: string;
  url?: string;
  /** YYYY-MM-DD, kad avots pārbaudīts. */
  accessed: string;
  note?: string;
};

export type UnitFactTopic =
  | "gearbox_supplier"
  | "timing_drive"
  | "power_output"
  | "service_interval"
  | "recall_scope"
  | "turbo_layout"
  | "known_issue";

export type UnitKind = "engine" | "gearbox" | "vehicle" | "recall";

/** Kad fakts attiecas uz pasūtījumu. Regex avoti (case-insensitive) pret auto kontekstu. */
export type UnitFactAppliesTo = {
  /** Vismaz viens jāatrod auto kontekstā (marka/modelis/kods/šasija). */
  anyOf: string[];
  /** Ja norādīts, arī vismaz viens no šiem jāatrod (piem. paaudze vai dzinēja kods). */
  andAnyOf?: string[];
  /** Ja kāds no šiem atrasts, fakts NEattiecas (piem. cita paaudze). */
  noneOf?: string[];
  /** Izlaiduma gads (ja zināms) jābūt šajā diapazonā. Ja gads nav zināms, šis nosacījums netiek prasīts. */
  years?: [number, number];
};

/**
 * Deterministiska pretrunas noteikšana vienā teikumā.
 * Teikums ir pretrunā, ja tas satur kādu `subject` UN kādu `contradicts` un nesatur `unless`.
 */
export type UnitFactContradiction = {
  subject: string[];
  contradicts: string[];
  unless?: string[];
  /** Īss LV paskaidrojums adminam. */
  message: string;
  /** Noklusējums E. W = tikai uzmanībai (piem. intervāli, tirgus atšķirības). */
  level?: "E" | "W";
};

export type UnitFact = {
  id: string;
  unitKind: UnitKind;
  /** Kodi/nosaukumi, uz kuriem fakts attiecas (dokumentācijai un AI meklēšanai). */
  codes: string[];
  topic: UnitFactTopic;
  /** Kanonisks LV formulējums (ko drīkst teikt klientam). */
  statementLv: string;
  status: UnitFactStatus;
  sources: UnitFactSource[];
  appliesTo: UnitFactAppliesTo;
  contradictions?: UnitFactContradiction[];
  /** Ja teksts piemin šo tēmu un fakts ir `disputed`, brīdinājuma trigeris. */
  touches?: string[];
  /** Iekšēja piezīme (nav klientam). */
  note?: string;
  addedAt: string;
};

export type FactCheckLevel = "E" | "W";

export type FactCheckFlag = {
  id: string;
  level: FactCheckLevel;
  kind:
    | "contradiction"
    | "unsourced"
    | "disputed"
    | "recall_denied"
    | "rollback_omitted"
    | "rollback_minimised"
    | "entry_error_as_rollback"
    | "csdd_foreign_mileage"
    | "owner_count"
    | "owner_changes"
    | "first_reg_country"
    | "no_accidents_claim"
    | "no_damage_claim"
    | "negated_fact"
    | "country_period_mismatch"
    | "no_recalls_claim"
    | "leak_phrase"
    | "atsavinasanai"
    | "unsourced_date"
    | "powertrain_fuel"
    | "powertrain_engine";
  message: string;
  sentence: string;
  factId?: string;
  sources?: UnitFactSource[];
};

export type FactCheckInput = {
  /** AI komentāra teksts (plain text). */
  text: string;
  /** Lauka nosaukums (technical_risks, summary, …) tikai žurnālam. */
  field?: string;
  /**
   * Viss pasūtījuma konteksts, ko redzēja AI (CSDD, dīleris, sludinājums, avotu bloki).
   * No tā nosaka auto un „avototus” skaitļus/kodus.
   */
  contextText: string;
  /** Neobligāti: marka + modelis + šasija, ja zināms strukturēti. */
  vehicleLabel?: string;
  /** Neobligāti: izlaiduma gads. */
  year?: number | null;
};

export type FactCheckResult = {
  flags: FactCheckFlag[];
  /** Faktu ID, kas attiecās uz šo auto. */
  appliedFactIds: string[];
  checkedAt: string;
};
