/**
 * Dzintarzeme Auto pasūtījuma tāmes aprēķins (admin UI + PDF).
 * Neatkarīgs no publiskās vietnes maksājumu loģikas.
 */

export type DzintarzemeTameCommissionVariant = "A" | "B";

export type DzintarzemeTameExtraLine = { label: string; net: number };

export type DzintarzemeTameInput = {
  brandModel: string;
  vin: string;
  /** Auto_Cena (EUR) */
  autoPrice: number;
  applyVatToAutoPrice: boolean;
  commissionVariant: DzintarzemeTameCommissionVariant;
  /** B variants: iemaksa % */
  depositPercent: number;
  transportNet: number;
  chemicalCleaningNet: number;
  polishingNet: number;
  paintingNet: number;
  extraServices: DzintarzemeTameExtraLine[];
};

export type DzintarzemeTameLineRow = {
  /** Galvenais nosaukums (PDF „Pozīcijas” kolonna). */
  label: string;
  /** Piem., „neto cena” pie auto, ja piemēro PVN — tikai PDF, mazi burti. */
  subtitle?: string;
  /** Pozīcijas summa PDF tabulā — vienmēr neto (bez PVN). */
  net: number;
};

export type DzintarzemeTameComputed = {
  input: DzintarzemeTameInput;
  autoCena: number;
  autoGala: number;
  commissionNet: number;
  servicesNetTotal: number;
  /** Neto bāzes kopsumma (auto neto + komisija neto + pakalpojumi neto) */
  summaBezPVN: number;
  /** PVN 21 %: auto daļa (ja piemēro) + komisija un pakalpojumi */
  pvnKopa: number;
  galaSumma: number;
  /** Rindas PDF „Pozīcijas” tabulā — neto summas. */
  tableRows: DzintarzemeTameLineRow[];
};

const SERVICE_VAT = 0.21;

function clampMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeDzintarzemeTame(raw: DzintarzemeTameInput): DzintarzemeTameComputed {
  const autoCena = clampMoney(raw.autoPrice);
  const applyVat = Boolean(raw.applyVatToAutoPrice);
  const autoGala = roundMoney(applyVat ? autoCena * (1 + SERVICE_VAT) : autoCena);

  const dep = clampMoney(raw.depositPercent);
  const depositFactor = Math.min(100, dep) / 100;
  const atlikums = roundMoney(autoCena * (1 - depositFactor));

  let commissionNet = 0;
  let loanCommissionNetB = 0;
  if (raw.commissionVariant === "A") {
    commissionNet = 1190;
  } else {
    loanCommissionNetB = roundMoney(atlikums * 0.035);
    commissionNet = roundMoney(990 + loanCommissionNetB);
  }

  const transportNet = clampMoney(raw.transportNet);
  const chemicalNet = clampMoney(raw.chemicalCleaningNet);
  const polishingNet = clampMoney(raw.polishingNet);
  const paintingNet = clampMoney(raw.paintingNet);
  const extrasNet = (raw.extraServices ?? []).reduce((s, x) => s + clampMoney(x.net), 0);

  const servicesNetTotal = roundMoney(transportNet + chemicalNet + polishingNet + paintingNet + extrasNet);

  const summaBezPVN = roundMoney(autoCena + commissionNet + servicesNetTotal);

  const pvnAuto = applyVat ? roundMoney(autoCena * SERVICE_VAT) : 0;
  const pvnPakalpojumi = roundMoney((commissionNet + servicesNetTotal) * SERVICE_VAT);
  const pvnKopa = roundMoney(pvnAuto + pvnPakalpojumi);

  const galaSumma = roundMoney(summaBezPVN + pvnKopa);

  const tableRows: DzintarzemeTameLineRow[] = [];
  if (autoCena > 0) {
    tableRows.push({
      label: "Automašīnas cena",
      subtitle: applyVat ? "neto cena" : undefined,
      net: roundMoney(autoCena),
    });
  }
  if (raw.commissionVariant === "A") {
    tableRows.push({ label: "Komisijas maksa", net: roundMoney(commissionNet) });
  } else {
    const partialPrepay = raw.depositPercent < 100;
    if (partialPrepay && loanCommissionNetB > 0) {
      tableRows.push({ label: "Komisijas maksa", net: 990 });
      tableRows.push({
        label: "Aizdevuma komisija",
        subtitle: "3,5 % no summas pēc priekšapmaksas",
        net: loanCommissionNetB,
      });
    } else {
      tableRows.push({ label: "Komisijas maksa", net: roundMoney(commissionNet) });
    }
  }

  const pushIf = (label: string, net: number) => {
    const n = clampMoney(net);
    if (n <= 0) return;
    tableRows.push({ label, net: roundMoney(n) });
  };

  pushIf("Transportēšana", transportNet);
  pushIf("Ķīmiskā tīrīšana", chemicalNet);
  pushIf("Pulēšana", polishingNet);
  pushIf("Krāsošana", paintingNet);

  for (const ex of raw.extraServices ?? []) {
    const label = (ex.label ?? "").trim();
    const n = clampMoney(ex.net);
    if (n <= 0 || !label) continue;
    tableRows.push({ label, net: roundMoney(n) });
  }

  return {
    input: raw,
    autoCena,
    autoGala,
    commissionNet,
    servicesNetTotal,
    summaBezPVN,
    pvnKopa,
    galaSumma,
    tableRows,
  };
}

export function parseDzintarzemeTameBody(body: unknown): { ok: true; value: DzintarzemeTameInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "invalid_body" };
  const o = body as Record<string, unknown>;

  const brandModel = typeof o.brandModel === "string" ? o.brandModel : "";
  const vin = typeof o.vin === "string" ? o.vin : "";

  const autoPrice = typeof o.autoPrice === "number" ? o.autoPrice : Number.NaN;
  if (!Number.isFinite(autoPrice) || autoPrice < 0) return { ok: false, error: "invalid_autoPrice" };

  const applyVatToAutoPrice = o.applyVatToAutoPrice === true;
  const variant = o.commissionVariant === "B" ? "B" : "A";

  const depositPercent = typeof o.depositPercent === "number" ? o.depositPercent : Number.NaN;
  if (!Number.isFinite(depositPercent) || depositPercent < 0 || depositPercent > 100) {
    return { ok: false, error: "invalid_depositPercent" };
  }

  const num = (k: string) => {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return Number.NaN;
  };

  const transportNet = num("transportNet");
  const chemicalCleaningNet = num("chemicalCleaningNet");
  const polishingNet = num("polishingNet");
  const paintingNet = num("paintingNet");
  for (const [k, v] of [
    ["transportNet", transportNet],
    ["chemicalCleaningNet", chemicalCleaningNet],
    ["polishingNet", polishingNet],
    ["paintingNet", paintingNet],
  ] as const) {
    if (!Number.isFinite(v) || v < 0) return { ok: false, error: `invalid_${k}` };
  }

  const extraRaw = o.extraServices;
  const extraServices: DzintarzemeTameExtraLine[] = [];
  if (extraRaw !== undefined) {
    if (!Array.isArray(extraRaw)) return { ok: false, error: "invalid_extraServices" };
    if (extraRaw.length > 24) return { ok: false, error: "extraServices_too_many" };
    for (const row of extraRaw) {
      if (typeof row !== "object" || row === null) return { ok: false, error: "invalid_extraServices_row" };
      const r = row as Record<string, unknown>;
      const label = typeof r.label === "string" ? r.label : "";
      const net = typeof r.net === "number" ? r.net : Number.NaN;
      if (!Number.isFinite(net) || net < 0) return { ok: false, error: "invalid_extraServices_net" };
      if (net === 0) continue;
      const t = label.trim();
      if (!t) return { ok: false, error: "invalid_extraServices_label" };
      extraServices.push({ label: t.slice(0, 120), net });
    }
  }

  return {
    ok: true,
    value: {
      brandModel,
      vin,
      autoPrice,
      applyVatToAutoPrice,
      commissionVariant: variant,
      depositPercent,
      transportNet,
      chemicalCleaningNet,
      polishingNet,
      paintingNet,
      extraServices,
    },
  };
}
