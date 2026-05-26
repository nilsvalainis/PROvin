import "server-only";

const DEMO_IDS = {
  /** Eksperimentu veidne 1 — tukša, ar reset. */
  exp1: "demo_order_exp_1",
  /** Eksperimentu veidne 2 — tukša, ar reset. */
  exp2: "demo_order_exp_2",
  /** Eksperimentu veidne 3 — tukša, ar reset. */
  exp3: "demo_order_exp_3",
  /** PROVIN SELECT stratēģiskā konsultācija (apmaksāts paraugs). */
  consultation: "demo_consultation_select",
} as const;

const created = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

/** Demo rindas sarakstam (augšā — jaunākie). */
export function getDemoOrderRows() {
  const blankDemo = (id: string, iso: string) => ({
    id,
    created: created(iso),
    amountTotal: 7999,
    currency: "EUR",
    paymentStatus: "paid" as const,
    customerEmail: null,
    vin: null,
    isDemo: true,
  });
  return [
    blankDemo(DEMO_IDS.exp1, "2026-05-21T09:00:00+03:00"),
    blankDemo(DEMO_IDS.exp2, "2026-05-21T08:30:00+03:00"),
    blankDemo(DEMO_IDS.exp3, "2026-05-21T08:00:00+03:00"),
  ].sort((a, b) => b.created - a.created);
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
  const blankDetail = (id: string, iso: string) => ({
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
  });
  if (sessionId === DEMO_IDS.exp1) return blankDetail(DEMO_IDS.exp1, "2026-05-21T09:00:00+03:00");
  if (sessionId === DEMO_IDS.exp2) return blankDetail(DEMO_IDS.exp2, "2026-05-21T08:30:00+03:00");
  if (sessionId === DEMO_IDS.exp3) return blankDetail(DEMO_IDS.exp3, "2026-05-21T08:00:00+03:00");
  return null;
}
