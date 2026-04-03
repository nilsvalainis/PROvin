import "server-only";

const DEMO_IDS = {
  full: "demo_order_full",
  simple: "demo_order_simple",
} as const;

const created = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

/** Demo rindas sarakstam (augšā — jaunākie). */
export function getDemoOrderRows() {
  return [
    {
      id: DEMO_IDS.full,
      created: created("2026-04-02T14:30:00+03:00"),
      amountTotal: 4999,
      currency: "EUR",
      paymentStatus: "paid" as const,
      customerEmail: "janis.berzins@inbox.lv",
      vin: "WVWZZZ3CZWE123456",
      isDemo: true,
    },
    {
      id: DEMO_IDS.simple,
      created: created("2026-03-28T10:15:00+03:00"),
      amountTotal: 4999,
      currency: "EUR",
      paymentStatus: "paid" as const,
      customerEmail: "anna.k@example.com",
      vin: "YV1DZ8256C1234567",
      isDemo: true,
    },
  ].sort((a, b) => b.created - a.created);
}

export function getDemoOrderDetail(sessionId: string) {
  if (sessionId === DEMO_IDS.full) {
    return {
      id: DEMO_IDS.full,
      created: created("2026-04-02T14:30:00+03:00"),
      amountTotal: 4999,
      currency: "EUR",
      paymentStatus: "paid" as const,
      customerEmail: "janis.berzins@inbox.lv",
      vin: "WVWZZZ3CZWE123456",
      listingUrl: "https://www.ss.lv/msg/lv/transport/cars/bmw/.../abcd.html",
      customerName: "Jānis Bērziņš",
      phone: "+371 29123456",
      notes:
        "Lūdzu pēc iespējas ātrāk. Interesē galvenokārt vai ir bijušas smagas avārijas un īsts noskrējiens.",
      customerDetailsEmail: "janis.berzins@inbox.lv",
      customerDetailsPhone: null,
      isDemo: true,
      internalComment:
        "Salīdzināju VIN ar starptautisko vēstures avotu — noskrējiens atbilst pēdējam apkopei. Sludinājumā minētais „viena īpašnieka” neatbilst CSDD datiem (2 īpašnieki). Pirms zvana klientam — pārbaudīt SS.LV sludinājuma screenshot.",
      attachments: [
        { label: "Vēstures datu avots (īss izraksts)", fileName: "history_excerpt_WVWZZZ3CZWE123456.pdf" },
        { label: "Bojājumu kopsavilkums", fileName: "damage_summary_2026-04-02.pdf" },
        { label: "Sludinājuma saglabātais PDF", fileName: "sslv_sludinajums_20260402.pdf" },
      ],
    };
  }
  if (sessionId === DEMO_IDS.simple) {
    return {
      id: DEMO_IDS.simple,
      created: created("2026-03-28T10:15:00+03:00"),
      amountTotal: 4999,
      currency: "EUR",
      paymentStatus: "paid" as const,
      customerEmail: "anna.k@example.com",
      vin: "YV1DZ8256C1234567",
      listingUrl: "https://www.mobile.de/...",
      customerName: "Anna K.",
      phone: "+371 29876543",
      notes: null,
      customerDetailsEmail: "anna.k@example.com",
      customerDetailsPhone: null,
      isDemo: true,
      internalComment: null,
      attachments: [],
    };
  }
  return null;
}
