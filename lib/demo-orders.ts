import "server-only";

const DEMO_IDS = {
  /** Tukšs veidne — manuālai aizpildīšanai un testiem. */
  blank: "demo_order_blank",
  /** Pilns paraugs (kā pēc apmaksas). */
  full: "demo_order_full",
  simple: "demo_order_simple",
  /** Kā reāls klienta pieprasījums pirms maksājuma — nav Stripe apmaksas. */
  unpaid: "demo_order_unpaid",
} as const;

const created = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

/** Demo rindas sarakstam (augšā — jaunākie). */
export function getDemoOrderRows() {
  return [
    {
      id: DEMO_IDS.blank,
      created: created("2026-04-08T12:00:00+03:00"),
      amountTotal: 7999,
      currency: "EUR",
      paymentStatus: "paid" as const,
      customerEmail: null,
      vin: null,
      isDemo: true,
    },
    {
      id: DEMO_IDS.unpaid,
      created: created("2026-04-03T19:45:00+03:00"),
      amountTotal: null,
      currency: "EUR",
      paymentStatus: "unpaid" as const,
      customerEmail: "info+demo@provin.lv",
      vin: "VF7SA9HZ8KW123456",
      isDemo: true,
    },
    {
      id: DEMO_IDS.full,
      created: created("2026-04-02T14:30:00+03:00"),
      amountTotal: 7999,
      currency: "EUR",
      paymentStatus: "paid" as const,
      customerEmail: "janis.berzins@inbox.lv",
      vin: "WVWZZZ3CZWE123456",
      isDemo: true,
    },
    {
      id: DEMO_IDS.simple,
      created: created("2026-03-28T10:15:00+03:00"),
      amountTotal: 7999,
      currency: "EUR",
      paymentStatus: "paid" as const,
      customerEmail: "anna.k@example.com",
      vin: "YV1DZ8256C1234567",
      isDemo: true,
    },
  ].sort((a, b) => b.created - a.created);
}

export function getDemoOrderDetail(sessionId: string) {
  if (sessionId === DEMO_IDS.blank) {
    return {
      id: DEMO_IDS.blank,
      created: created("2026-04-08T12:00:00+03:00"),
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
      internalComment: null,
      attachments: [],
    };
  }
  if (sessionId === DEMO_IDS.unpaid) {
    return {
      id: DEMO_IDS.unpaid,
      created: created("2026-04-03T19:45:00+03:00"),
      amountTotal: null,
      currency: "EUR",
      paymentStatus: "unpaid" as const,
      customerEmail: "info+demo@provin.lv",
      vin: "VF7SA9HZ8KW123456",
      listingUrl: "https://www.ss.lv/msg/lv/transport/cars/mid-size/abcd123.html",
      customerName: "Kristaps Ozols",
      contactMethod: "E-pasts",
      phone: "+371 22334455",
      notes:
        "Sveiki! Gribu pirms došanās pie pārdevēja saprast, vai VIN sakrīt ar sludinājumu un vai nav „sarkanās karogus”. Maksājumu pabeigšu, tiklīdz būšu drošs par sludinājuma īstumu — šobrīd tikai gribu sagatavoties.",
      customerDetailsEmail: "info+demo@provin.lv",
      customerDetailsPhone: "+371 22334455",
      isDemo: true,
      internalComment:
        "Klients vēl nav apmaksājis — demo imitē reālu e-pastu / formu pirms Checkout. Kad būs Live, šādi „unfinished” session var parādīties Stripe kā unpaid. Pirms zvana: pārbaudīt VIN formātu (Citroën/Peugeot).",
      attachments: [
        { label: "Ekrānuzņēmums no sludinājuma (planšete)", fileName: "sslv_screenshot_20260403.png" },
        { label: "Īss VIN atgādinājums (no klienta)", fileName: "vin_note_kristaps.txt" },
      ],
    };
  }
  if (sessionId === DEMO_IDS.full) {
    return {
      id: DEMO_IDS.full,
      created: created("2026-04-02T14:30:00+03:00"),
      amountTotal: 7999,
      currency: "EUR",
      paymentStatus: "paid" as const,
      customerEmail: "janis.berzins@inbox.lv",
      vin: "WVWZZZ3CZWE123456",
      listingUrl: "https://example.com/lv/auto-sludinajums/abcd",
      customerName: "Jānis Bērziņš",
      contactMethod: "WhatsApp",
      phone: "+371 29123456",
      notes:
        "Lūdzu pēc iespējas ātrāk. Interesē galvenokārt vai ir bijušas smagas avārijas un īsts noskrējiens.",
      customerDetailsEmail: "janis.berzins@inbox.lv",
      customerDetailsPhone: null,
      isDemo: true,
      internalComment:
        "Salīdzināju VIN ar starptautisko vēstures avotu — noskrējiens atbilst pēdējam apkopei. Sludinājumā minētais „viena īpašnieka” neatbilst valsts reģistra datiem (2 īpašnieki). Pirms zvana klientam — pārbaudīt sludinājuma ekrānuzņēmumu.",
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
      amountTotal: 7999,
      currency: "EUR",
      paymentStatus: "paid" as const,
      customerEmail: "anna.k@example.com",
      vin: "YV1DZ8256C1234567",
      listingUrl: "https://example.com/auto/...",
      customerName: "Anna K.",
      contactMethod: null,
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
