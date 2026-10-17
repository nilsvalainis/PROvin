/**
 * SIA ĪRISS / Dzintarzeme Auto rekvizīti līgumam, piedāvājumam un tāmei.
 * Īsā defise, bez garajām svītrām.
 */

import {
  irissAdvanceHasContent,
  irissAdvanceMethodLabel,
  irissAdvanceTowardCommission,
  parseIrissAdvanceAmount,
  formatIrissAdvanceDateLv,
} from "@/lib/iriss-advance";
import { parsePriceLike } from "@/lib/iriss-price-format";
import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";
import { applyProvinHumanDashes } from "@/lib/source-summary-comment-format";

export const IRISS_CONTRACT_SELLER = {
  legalName: "SIA ĪRISS",
  brand: "Dzintarzeme Auto",
  regNo: "59202001191",
  vatNo: "LV59202001191",
  street: "Smilšu iela 19",
  city: "Tukums",
  postal: "LV-3101",
  bankName: "AS SEB banka",
  bankSwift: "UNLALV2X",
  iban: "LV75UNLA0050005241769",
  signerName: "Nils Valainis",
} as const;

export function irissContractSellerAddressLine(): string {
  return applyProvinHumanDashes(
    `${IRISS_CONTRACT_SELLER.street}, ${IRISS_CONTRACT_SELLER.city}, ${IRISS_CONTRACT_SELLER.postal}`,
  );
}

export function irissContractSellerPartyLines(): string[] {
  const s = IRISS_CONTRACT_SELLER;
  return [
    `${s.legalName} - zīmols ${s.brand}`,
    `Reģ. nr. ${s.regNo}`,
    `PVN nr. ${s.vatNo}`,
    `Jurid. adrese: ${irissContractSellerAddressLine()}`,
    `Banka / IBAN: ${s.bankName} ${s.bankSwift}`,
    s.iban,
  ].map((line) => applyProvinHumanDashes(line));
}

export function irissContractFooterLines(): string[] {
  const s = IRISS_CONTRACT_SELLER;
  return [
    `${s.legalName} (${s.brand})`,
    `Reģ. nr. ${s.regNo} · PVN ${s.vatNo}`,
    irissContractSellerAddressLine(),
    `${s.bankName} · ${s.iban}`,
  ].map((line) => applyProvinHumanDashes(line));
}

export function irissContractSignerName(): string {
  return IRISS_CONTRACT_SELLER.signerName;
}

function firstKnownCommission(record: IrissPasutijumsRecord): number {
  const fromOffers = record.offers
    .map((offer) => parsePriceLike(offer.commissionFee))
    .find((n) => n > 0);
  if (fromOffers && fromOffers > 0) return fromOffers;
  const manual = parsePriceLike(record.dzintarzemeTameDraft?.tameCommissionManualEurStr ?? "");
  return manual > 0 ? manual : 0;
}

export function irissContractAdvanceLines(record: IrissPasutijumsRecord): string[] {
  const advance = record.advance;
  if (!advance || !irissAdvanceHasContent(advance)) return [];
  const lines: string[] = [];
  const amount = parseIrissAdvanceAmount(advance.amount);
  if (amount > 0) lines.push(`Avanss: ${Math.round(amount)} €`);
  if (advance.paidAt) lines.push(`Avanss saņemts: ${formatIrissAdvanceDateLv(advance.paidAt)}`);
  if (advance.method.trim()) lines.push(`Avansa metode: ${irissAdvanceMethodLabel(advance.method)}`);
  if (advance.invoiceNo.trim()) lines.push(`Avansa rēķins: ${advance.invoiceNo.trim()}`);
  lines.push("Avanss ieskaitāms komisijas maksā.");
  const commission = firstKnownCommission(record);
  if (commission > 0 && amount > 0) {
    const rem = irissAdvanceTowardCommission(commission, amount);
    lines.push(`Komisijas atlikums pēc avansa: ${Math.round(rem.remainingCommission)} €`);
  }
  return lines.map((line) => applyProvinHumanDashes(line));
}
