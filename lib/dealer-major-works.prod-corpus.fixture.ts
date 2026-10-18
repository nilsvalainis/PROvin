/**
 * Anonimizēti produkcijas dīlera žurnāla paraugi no 109 pasūtījumu korpusa
 * (BMW / Audi / Volvo / Jeep u.c.). Nav reālu VIN, klientu vai pasūtījumu ID.
 * Tikai testi; pasūtījumus nemaina.
 */

/** 1. BMW: REMAN kārba tajā pašā vizītē ar kārbas eļļas līniju. */
export const BMW_REMAN_GEARBOX_WITH_OIL_LINE =
  "RP REMAN 6 Gang Getriebe (24007581234). OIL LINE (16137651234) Gearbox oil line. Getriebeölleitung.";

/** 2. BMW: sajūga komplekts + Twin Mass Flywheel detaļu sarakstā, bez replace verba. */
export const BMW_CLUTCH_KIT_TWIN_MASS_PART_LIST =
  "CLUTCH KIT (21207584707) Clutch kit. TWIN MASS FLYWHEEL (21207595512) Twin Mass Flywheel.";

/** 3. BMW: RP REMAN Transfer box. */
export const BMW_RP_REMAN_TRANSFER_BOX = "RP REMAN Transfer box (27107654321)";

/**
 * 4. Volvo D4 24.08.2022 128360 km, garantija: turbo damaged, engine damage,
 * dzinējs un turbo nomainīti. VIN anonimizēts.
 */
export const VOLVO_D4_ENGINE_TURBO_WARRANTY = {
  date: "24.08.2022",
  odometer: "128360",
  works:
    "Garantiearbeiten. Symptom: Turbo damaged. Diagnose: Engine damage. Aktion: Engine replaced. Turbocharger replaced.",
} as const;

/** 5. Jeep: detaļu saraksts ar propshaft un transfer case. */
export const JEEP_PROPSHAFT_TRANSFER_CASE_PART_LIST =
  "PROPSHAFT (5212345678) Propshaft. TRANSFER CASE (5211987654) Transfer case.";

/**
 * 6. BMW V99966 D15 04.03.2024 77924 km: TwinPower Turbo eļļa + Repair kit (bremzes).
 * Eļļas produkta nosaukums ar Turbo nav turbo darbs.
 */
export const BMW_V99966_D15_TWINPOWER_OIL_REPAIR_KIT = {
  date: "04.03.2024",
  odometer: "77924",
  works:
    "BMW TwinPower Turbo LL-19FE 0W-30 (83215A65BF8). REPAIR KIT (34116789012) Repair kit.",
} as const;

/** 7. Volvo D14: charge air cooler hose, ne turbo. */
export const VOLVO_D14_CHARGE_AIR_COOLER_HOSE =
  "CHARGE AIR HOSE (32222271) Charge air cooler hose replace. Inlet hose charge air cooler replace.";

/** 8. Audi LV: AdBlue reduktora sistēma, ne diferenciālis. */
export const AUDI_LV_ADBLUE_REDUKTORS =
  "AdBlue reduktora sistēmas pārbaude un AdBlue uzpilde.";

/**
 * 9. Jeep LV: durvju apdare nav virsbūve/stikls;
 * transmisija uz aizmugurējo asi = kardāns, ne ātrumkārba.
 */
export const JEEP_LV_DOOR_TRIM_AND_PROPSHAFT =
  "Durvju apdares paneļa nomaiņa. Transmisijas uz aizmugurējo asi nomaiņa.";

export const JEEP_LV_DOOR_TRIM_PANEL = "Durvju apdares paneļa nomaiņa";

export const JEEP_LV_PROPSHAFT_TO_REAR_AXLE = "Transmisijas uz aizmugurējo asi nomaiņa";

/** Stiklu mazgājamais Scheibenklar nekad nav virsbūve/stikls. */
export const BMW_SCHEIBENKLAR_WASHER = "Scheibenklar nachfüllen. Windscreen washer fluid.";

/** Vējstikla / loga stikla nomaiņa paliek Lielie darbi. */
export const BMW_WINDSCREEN_REPLACED = "WINDSCREEN (51317401234) Windscreen replace.";
export const DE_WINDSCREEN_ERNEUERT = "Windschutzscheibe erneuert";
export const LV_WINDSCREEN_REPLACED = "Vējstikla maiņa";
export const LV_SIDE_WINDOW_REPLACED = "Durvju stikla maiņa";
export const DE_SIDE_WINDOW_ERNEUERT = "Seitenscheibe links ersetzt";
export const EN_WINDOW_GLASS_REPLACED = "Side window glass replaced";
export const RU_WINDSCREEN_REPLACED = "Замена лобового стекла";

/** Čipa pārbaude / skaidas remonts nav stikla nomaiņa. */
export const BMW_WINDSCREEN_CHIP_CHECK = "Windscreen chip check. Steinschlagprüfung.";
export const DE_STONE_CHIP_REPAIR = "Windschutzscheibe Steinschlagreparatur";
export const EN_STONE_CHIP_REPAIR = "Stone chip repair windscreen";
export const DE_WIPER_BLADES = "Scheibenwischer erneuert";
