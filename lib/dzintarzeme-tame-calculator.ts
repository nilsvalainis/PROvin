/**
 * Dzintarzeme Auto pasūtījuma tāmes aprēķins (admin UI + PDF).
 * Neatkarīgs no publiskās vietnes maksājumu loģikas.
 * Komisijas likmes nāk no IRISS iestatījumiem; bez tām paliek 1190 / 990 + 3,5 %.
 */

import {
  DEFAULT_IRISS_TAME_COMMISSION,
  formatIrissTamePercent,
  type IrissTameCommissionRates,
} from "@/lib/iriss-tame-commission";

export type DzintarzemeTameCommissionVariant = "A" | "B" | "C";

export type DzintarzemeTameExtraLine = { label: string; net: number };

export type DzintarzemeTameInput = {
  brandModel: string;
  vin: string;
  /** Auto_Cena (EUR) */
  autoPrice: number;
  applyVatToAutoPrice: boolean;
  commissionVariant: DzintarzemeTameCommissionVariant;
  /** B / C variants: iemaksa % */
  depositPercent: number;
  /** C variants: fiksēta komisija EUR (neto). */
  commissionManualNet: number;
  /** C variants: % no atlikuma pēc iemaksas. */
  commissionManualPercent: number;
  transportNet: number;
  chemicalCleaningNet: number;
  polishingNet: number;
  paintingNet: number;
  leasingValuationNet: number;
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

function commissionRates(rates?: IrissTameCommissionRates): IrissTameCommissionRates {
  const variantANet = clampMoney(rates?.variantANet ?? DEFAULT_IRISS_TAME_COMMISSION.variantANet);
  const variantBBaseNet = clampMoney(rates?.variantBBaseNet ?? DEFAULT_IRISS_TAME_COMMISSION.variantBBaseNet);
  const rawPct = rates?.variantBLoanPercent ?? DEFAULT_IRISS_TAME_COMMISSION.variantBLoanPercent;
  const variantBLoanPercent = Number.isFinite(rawPct) ? Math.min(100, Math.max(0, rawPct)) : DEFAULT_IRISS_TAME_COMMISSION.variantBLoanPercent;
  return { variantANet, variantBBaseNet, variantBLoanPercent };
}

export function computeDzintarzemeTame(
  raw: DzintarzemeTameInput,
  rates?: IrissTameCommissionRates,
): DzintarzemeTameComputed {
  const commission = commissionRates(rates);
  const autoCena = clampMoney(raw.autoPrice);
  const applyVat = Boolean(raw.applyVatToAutoPrice);
  const autoGala = roundMoney(applyVat ? autoCena * (1 + SERVICE_VAT) : autoCena);

  const dep = clampMoney(raw.depositPercent);
  const depositFactor = Math.min(100, dep) / 100;
  const atlikums = roundMoney(autoCena * (1 - depositFactor));

  let commissionNet = 0;
  let loanCommissionNetB = 0;
  let loanCommissionNetC = 0;
  if (raw.commissionVariant === "A") {
    commissionNet = roundMoney(commission.variantANet);
  } else if (raw.commissionVariant === "C") {
    const manualBase = clampMoney(raw.commissionManualNet);
    loanCommissionNetC = roundMoney(atlikums * (clampMoney(raw.commissionManualPercent) / 100));
    commissionNet = roundMoney(manualBase + loanCommissionNetC);
  } else {
    loanCommissionNetB = roundMoney(atlikums * (commission.variantBLoanPercent / 100));
    commissionNet = roundMoney(commission.variantBBaseNet + loanCommissionNetB);
  }

  const transportNet = clampMoney(raw.transportNet);
  const chemicalNet = clampMoney(raw.chemicalCleaningNet);
  const polishingNet = clampMoney(raw.polishingNet);
  const paintingNet = clampMoney(raw.paintingNet);
  const leasingValuationNet = clampMoney(raw.leasingValuationNet);
  const extrasNet = (raw.extraServices ?? []).reduce((s, x) => s + clampMoney(x.net), 0);

  const servicesNetTotal = roundMoney(
    transportNet + chemicalNet + polishingNet + paintingNet + leasingValuationNet + extrasNet,
  );

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
  } else if (raw.commissionVariant === "C") {
    const manualBase = clampMoney(raw.commissionManualNet);
    const manualPct = clampMoney(raw.commissionManualPercent);
    if (manualBase > 0 && loanCommissionNetC > 0) {
      tableRows.push({ label: "Komisijas maksa", net: roundMoney(manualBase) });
      tableRows.push({
        label: "Aizdevuma komisija",
        subtitle: `${formatIrissTamePercent(manualPct)} % no summas pēc priekšapmaksas`,
        net: loanCommissionNetC,
      });
    } else {
      tableRows.push({ label: "Komisijas maksa", net: roundMoney(commissionNet) });
    }
  } else {
    const partialPrepay = raw.depositPercent < 100;
    if (partialPrepay && loanCommissionNetB > 0) {
      tableRows.push({ label: "Komisijas maksa", net: roundMoney(commission.variantBBaseNet) });
      tableRows.push({
        label: "Aizdevuma komisija",
        subtitle: `${formatIrissTamePercent(commission.variantBLoanPercent)} % no summas pēc priekšapmaksas`,
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

  pushIf("Transporta pakalpojumi", transportNet);
  pushIf("Ķīmiskā tīrīšana", chemicalNet);
  pushIf("Pulēšana", polishingNet);
  pushIf("Krāsošana", paintingNet);
  pushIf("Vērtējums līzingam", leasingValuationNet);

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
  const variantRaw = o.commissionVariant;
  const variant: DzintarzemeTameCommissionVariant =
    variantRaw === "B" || variantRaw === "C" ? variantRaw : "A";
  const commissionManualNet =
    typeof o.commissionManualNet === "number" && Number.isFinite(o.commissionManualNet)
      ? o.commissionManualNet
      : 0;
  const commissionManualPercent =
    typeof o.commissionManualPercent === "number" && Number.isFinite(o.commissionManualPercent)
      ? o.commissionManualPercent
      : 0;

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
  const leasingValuationNet =
    o.leasingValuationNet === undefined
      ? 0
      : typeof o.leasingValuationNet === "number" && Number.isFinite(o.leasingValuationNet)
        ? o.leasingValuationNet
        : Number.NaN;
  for (const [k, v] of [
    ["transportNet", transportNet],
    ["chemicalCleaningNet", chemicalCleaningNet],
    ["polishingNet", polishingNet],
    ["paintingNet", paintingNet],
    ["leasingValuationNet", leasingValuationNet],
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
      commissionManualNet: Math.max(0, commissionManualNet),
      commissionManualPercent: Math.min(100, Math.max(0, commissionManualPercent)),
      transportNet,
      chemicalCleaningNet,
      polishingNet,
      paintingNet,
      leasingValuationNet,
      extraServices,
    },
  };
}
