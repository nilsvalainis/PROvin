import "server-only";

const DEMO_IDS = {
  /** Eksperimentu veidne 1 — tukša, ar reset. */
  exp1: "demo_order_exp_1",
  /** Eksperimentu veidne 2 — tukša, ar reset. */
  exp2: "demo_order_exp_2",
  /** Eksperimentu veidne 3 — tukša, ar reset. */
  exp3: "demo_order_exp_3",
  /** Eksperimentu veidne 4 — tukša, ar reset. */
  exp4: "demo_order_exp_4",
  /** Eksperimentu veidne 5 — tukša, ar reset. */
  exp5: "demo_order_exp_5",
  /** Eksperimentu veidne 6 — tukša, ar reset. */
  exp6: "demo_order_exp_6",
  /** PROVIN SELECT stratēģiskā konsultācija (apmaksāts paraugs). */
  consultation: "demo_consultation_select",
} as const;

/** Tukšās audit parauga veidnes (id + created ISO). */
const BLANK_AUDIT_DEMOS: { id: string; iso: string }[] = [
  { id: DEMO_IDS.exp1, iso: "2026-05-21T09:00:00+03:00" },
  { id: DEMO_IDS.exp2, iso: "2026-05-21T08:30:00+03:00" },
  { id: DEMO_IDS.exp3, iso: "2026-05-21T08:00:00+03:00" },
  { id: DEMO_IDS.exp4, iso: "2026-05-21T07:30:00+03:00" },
  { id: DEMO_IDS.exp5, iso: "2026-05-21T07:00:00+03:00" },
  { id: DEMO_IDS.exp6, iso: "2026-05-21T06:30:00+03:00" },
];

const created = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

function blankDemoRow(id: string, iso: string) {
  return {
    id,
    created: created(iso),
    amountTotal: 7999,
    currency: "EUR",
    paymentStatus: "paid" as const,
    customerEmail: null,
    vin: null,
    isDemo: true,
  };
}

function blankDemoDetail(id: string, iso: string) {
  return {
    id,
    created: created(iso),
    amountTotal: 7999,
    currency: "EUR",
    paymentStatus: "paid" as const,
    customerEmail: null,
    vin: null,
    listingUrl: null,
    customerName: null,
    contactMethod: null,
    phone: null,
    notes: null,
    customerDetailsEmail: null,
    customerDetailsPhone: null,
    isDemo: true,
    checkoutLine: "audit" as const,
    internalComment: null,
    attachments: [] as { label: string; fileName: string }[],
  };
}

/** Demo rindas sarakstam (augšā — jaunākie). */
export function getDemoOrderRows() {
  return BLANK_AUDIT_DEMOS.map((d) => blankDemoRow(d.id, d.iso)).sort(
    (a, b) => b.created - a.created,
  );
}

/** Demo rindas sarakstam „Konsultācijas” (PROVIN SELECT). */
export function getDemoConsultationRows() {
  return [
    {
      id: DEMO_IDS.consultation,
      created: created("2026-04-10T10:00:00+03:00"),
      amountTotal: 4999,
      currency: "EUR",
      paymentStatus: "paid" as const,
      customerEmail: "select.demo@example.com",
      vin: null as string | null,
      checkoutLine: "provin_select" as const,
      isDemo: true,
    },
  ];
}

export function getDemoConsultationDetail(sessionId: string) {
  if (sessionId !== DEMO_IDS.consultation) return null;
  return {
    id: DEMO_IDS.consultation,
    created: created("2026-04-10T10:00:00+03:00"),
    amountTotal: 4999,
    currency: "EUR",
    paymentStatus: "paid" as const,
    customerEmail: "select.demo@example.com",
    vin: null as string | null,
    checkoutLine: "provin_select" as const,
    listingUrl: null as string | null,
    customerName: "Laura Demo",
    contactMethod: "E-pasts" as string | null,
    phone: "+371 21234567",
    notes:
      "Meklēju pirmo auto ģimenei līdz 18 000 €, vēlos saprast tirgu un riskus pirms sarunām ar pārdevējiem. Gaidu stratēģisko konsultāciju.",
    selectBrandModel: "VW Golf / Octavia",
    selectProductionYearsDpf: "2018–2022",
    selectPlannedBudget: "18 000",
    selectEngineType: "Dīzelis 2.0 TDI",
    selectTransmission: "Manuālā",
    selectMaxMileage: "līdz 150 000 km",
    selectExteriorColor: "Pelēka / sudraba",
    selectInteriorMaterial: "Audums, tumšs",
    selectRequiredEquipment: "Apsilde, kruīzs",
    selectDesiredEquipment: "LED, kamera",
    customerDetailsEmail: "select.demo@example.com",
    customerDetailsPhone: null as string | null,
    isDemo: true,
    internalComment: null as string | null,
    attachments: [] as { label: string; fileName: string }[],
  };
}

export function getDemoOrderDetail(sessionId: string) {
  const match = BLANK_AUDIT_DEMOS.find((d) => d.id === sessionId);
  if (!match) return null;
  return blankDemoDetail(match.id, match.iso);
}
