import "server-only";

import { randomUUID } from "node:crypto";
import { imagesToPdf } from "@/lib/iriss-autoparks-pdf";
import { addAutoparksFile, readAutoparksFileBytes, readAutoparksState } from "@/lib/iriss-autoparks-store";
import { carV2Of } from "@/lib/iriss-autoparks-v2";
import { parseEurInput } from "@/lib/iriss-autoparks-v2-format";
import type { AutoparksV2Perms } from "@/lib/iriss-autoparks-v2-perms";
import {
  applyProblemPatch,
  emptyInvoice,
  SERVISS_SCAN_TITLE,
  servissFileIds,
  servissView,
  type ProblemPatch,
  type ServissScanTarget,
  type V2ServissView,
} from "@/lib/iriss-autoparks-v2-serviss";
import { sniffContentType } from "@/lib/iriss-autoparks-v2-sniff";
import { readAutoparksV2State, updateCarV2, type AutoparksV2Actor } from "@/lib/iriss-autoparks-v2-store";

/** Nils 27.10: Servisa rēķinu summas redz un ievada visi, kam ir Servisa piekļuve. */
export function servissSums(perms: AutoparksV2Perms): boolean {
  return perms.summas || perms.serviss;
}

/** "Mēs apstiprinām" - līdz Nila lēmumam (IETEIKUMI 7.3) tikai administrators. */
export function servissCanConfirm(perms: AutoparksV2Perms): boolean {
  return perms.admin;
}

export async function getAutoparksV2Serviss(carId: string, perms: AutoparksV2Perms): Promise<V2ServissView | null> {
  const [v1, v2] = await Promise.all([readAutoparksState(), readAutoparksV2State()]);
  if (!v1.cars.some((c) => c.id === carId)) return null;
  return servissView(carV2Of(v2, carId), v1.files.filter((f) => f.carId === carId), { canSums: servissSums(perms), canConfirm: servissCanConfirm(perms), canDelete: perms.admin });
}

export type ServissPatchBody = {
  notes?: unknown;
  problem?: unknown;
  invoice?: unknown;
  /** «+ Ar roku» (Nils 27.10): rēķins bez skenējuma, tikai summa bez PVN. */
  addInvoice?: unknown;
};

/** Atgriež `forbidden`, ja kāds mēģina mainīt summu bez Summu tiesības (servisa kolēģis summu neievada). */
export async function patchAutoparksV2Serviss(
  carId: string,
  body: ServissPatchBody,
  perms: AutoparksV2Perms,
  actor: AutoparksV2Actor,
): Promise<"ok" | "forbidden" | "not_found"> {
  const inv = body.invoice && typeof body.invoice === "object" ? (body.invoice as Record<string, unknown>) : null;
  if (inv && ("amountEur" in inv || "acceptAi" in inv) && !servissSums(perms)) return "forbidden";
  const add = body.addInvoice && typeof body.addInvoice === "object" ? (body.addInvoice as Record<string, unknown>) : null;
  const addAmount = add ? parseEurInput(String(add.amountEur ?? "")) : null;
  if (add && !servissSums(perms)) return "forbidden";
  const v1 = await readAutoparksState();
  if (!v1.cars.some((c) => c.id === carId)) return "not_found";
  const now = new Date().toISOString();
  return updateCarV2(
    carId,
    (c) => {
      const hist: Array<{ field: string; from: unknown; to: unknown }> = [];
      if (typeof body.notes === "string") {
        const notes = body.notes.replace(/\r\n/g, "\n").slice(0, 8000).trim();
        hist.push({ field: "service.notes", from: c.service.notes, to: notes });
        c.service.notes = notes;
      }
      if (body.problem && typeof body.problem === "object") {
        const res = applyProblemPatch(c.service.problems, body.problem as ProblemPatch, {
          canConfirm: servissCanConfirm(perms),
          canRemove: perms.admin,
          actorName: actor.name,
          now,
          newId: () => `apr-${randomUUID()}`,
        });
        c.service.problems = res.problems;
        hist.push(...res.history);
      }
      if (inv && typeof inv.id === "string") {
        const target = c.service.invoices.find((i) => i.id === inv.id);
        if (target) {
          let amount: number | null | undefined;
          if (inv.acceptAi === true && target.ai?.amountEur != null) amount = target.ai.amountEur;
          else if ("amountEur" in inv) {
            const parsed = inv.amountEur === null || inv.amountEur === "" ? null : parseEurInput(String(inv.amountEur));
            // Nenolasāma summa netiek saglabāta kā tukša (Nils 28.10).
            if (parsed !== null || inv.amountEur === null || inv.amountEur === "") amount = parsed;
          }
          if (amount !== undefined) {
            hist.push({ field: "service.invoice.amount", from: target.amountEur, to: amount });
            target.amountEur = amount;
            target.amountBy = actor.name;
            target.amountAt = now;
          }
        }
      }
      if (add && addAmount != null) {
        const day = now.slice(0, 10);
        const manual = emptyInvoice(`ainv-${randomUUID()}`, "", 0, day);
        manual.amountEur = addAmount;
        manual.amountBy = actor.name;
        manual.amountAt = now;
        c.service.invoices.push(manual);
        hist.push({ field: "service.invoice", from: "", to: `Ar roku ${addAmount} €` });
      }
      return { result: "ok" as const, history: hist };
    },
    actor,
  );
}

/**
 * Skenējums (T4): bildes -> viens A4 PDF -> Autoparka fails posmā Serviss (Dropbox/Blob kā v1) -> v2 ieraksts.
 * `invoice_page` pievieno lapas esošam rēķinam kā atsevišķu PDF (vecais fails netiek pārrakstīts).
 */
export async function scanAutoparksV2Serviss(input: {
  carId: string;
  target: ServissScanTarget;
  invoiceId?: string;
  /** `problem_photo`: problēma, kurai pievieno foto. */
  problemId?: string;
  images: Buffer[];
  actor: AutoparksV2Actor;
}): Promise<{ ok: true; invoiceId?: string } | { ok: false; reason: "not_found" | "no_invoice" | "duplicate" }> {
  const v2state = await readAutoparksV2State();
  const v2 = carV2Of(v2state, input.carId);
  if (input.target === "invoice_page" && !v2.service.invoices.some((i) => i.id === input.invoiceId)) return { ok: false, reason: "no_invoice" };
  if (input.target === "problem_photo") return addProblemPhotos({ ...input, v2 });
  const pdf = await imagesToPdf(input.images);
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Riga" });
  const title = input.target === "invoice_page" ? SERVISS_SCAN_TITLE.invoice : SERVISS_SCAN_TITLE[input.target];
  const added = await addAutoparksFile({
    carId: input.carId,
    stage: "service",
    kind: input.target === "invoice" || input.target === "invoice_page" ? "invoice" : "other",
    title: `${title} ${day.split("-").reverse().join(".")}`,
    fileName: "skenets.pdf",
    contentType: "application/pdf",
    bytes: pdf,
    scanned: true,
    actor: input.actor,
  });
  if (!added) return { ok: false, reason: "not_found" };
  const fileId = added.file.id;
  // Tas pats skenējums otrreiz (tie paši baiti) - jau saglabāts, otrs ieraksts netiek veidots.
  if (added.duplicate && servissFileIds(v2).has(fileId)) return { ok: false, reason: "duplicate" };
  const pages = input.images.length;
  const newInvoiceId = `ainv-${randomUUID()}`;
  await updateCarV2(
    input.carId,
    (c) => {
      const all = servissFileIds(c);
      if (all.has(fileId)) return { result: null };
      if (input.target === "number_check") {
        if (!c.numberCheck.fileId) c.numberCheck = { ...c.numberCheck, fileId, scannedAt: new Date().toISOString() };
        else c.numberCheck.extraFileIds.push(fileId);
        return { result: null, history: [{ field: "service.numberCheck", from: "", to: title }] };
      }
      if (input.target === "diag") {
        c.service.diagFileIds.push(fileId);
        return { result: null, history: [{ field: "service.diag", from: "", to: title }] };
      }
      if (input.target === "invoice_page") {
        const inv = c.service.invoices.find((i) => i.id === input.invoiceId);
        if (!inv) return { result: null };
        inv.extraFileIds.push(fileId);
        inv.pages += pages;
        // Jaunas lapas var mainīt kopsummu - AI ieteikums jāpārlasa (F10).
        inv.ai = null;
        return { result: null, history: [{ field: "service.invoice.pages", from: inv.pages - pages, to: inv.pages }] };
      }
      c.service.invoices.push(emptyInvoice(newInvoiceId, fileId, pages, day));
      return { result: null, history: [{ field: "service.invoice", from: "", to: title }] };
    },
    input.actor,
  );
  return { ok: true, invoiceId: input.target === "invoice" ? newInvoiceId : input.invoiceId };
}

/** Servisa fails tikai, ja tas pieder ŠĪ auto Servisam (cits fails -> null -> 404). */
export async function readAutoparksV2ServissFile(carId: string, fileId: string): Promise<{ bytes: Buffer; contentType: string; name: string } | null> {
  const v2 = carV2Of(await readAutoparksV2State(), carId);
  if (!servissFileIds(v2).has(fileId)) return null;
  const got = await readAutoparksFileBytes(fileId);
  if (!got || got.car.id !== carId) return null;
  return { bytes: got.bytes, contentType: sniffContentType(got.bytes, got.contentType), name: got.file.title };
}

/** Problēmas foto (Nils 27.10): katra bilde - atsevišķs Autoparka fails posmā Serviss, piesaistīts problēmai. */
async function addProblemPhotos(input: {
  carId: string;
  problemId?: string;
  images: Buffer[];
  actor: AutoparksV2Actor;
  v2: ReturnType<typeof carV2Of>;
}): Promise<{ ok: true } | { ok: false; reason: "not_found" | "no_invoice" | "duplicate" }> {
  if (!input.problemId || !input.v2.service.problems.some((p) => p.id === input.problemId)) return { ok: false, reason: "not_found" };
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Riga" });
  const ids: string[] = [];
  for (const img of input.images) {
    const added = await addAutoparksFile({
      carId: input.carId,
      stage: "service",
      kind: "other",
      title: `${SERVISS_SCAN_TITLE.problem_photo} ${day.split("-").reverse().join(".")}`,
      fileName: "foto.jpg",
      contentType: "image/jpeg",
      bytes: img,
      scanned: true,
      actor: input.actor,
    });
    if (added) ids.push(added.file.id);
  }
  if (ids.length === 0) return { ok: false, reason: "not_found" };
  await updateCarV2(
    input.carId,
    (c) => {
      const p = c.service.problems.find((x) => x.id === input.problemId);
      if (!p) return { result: null };
      for (const id of ids) if (!p.photoIds.includes(id)) p.photoIds.push(id);
      return { result: null, history: [{ field: "service.problem.photo", from: "", to: `${ids.length} foto` }] };
    },
    input.actor,
  );
  return { ok: true };
}
