/**
 * Pavadzīmes forma telefonā: tīra loģika (bez React), lai uzvedību var testēt.
 * Serveris visu pārbauda vēlreiz (`parseCreateWaybillInput`); šeit tikai ērtības un skaidras kļūdas.
 */

import {
  NOTE_UNTRUSTED_MAX,
  WAYBILL_ROUTE_MAX,
  WAYBILL_VALID_MAX_HOURS,
  waybillHintsFromComment,
  waybillHoursBetween,
  defaultWaybillRepresentative,
} from "@/lib/iriss-waybill-create";
import type { AutoparksOwner } from "@/lib/iriss-autoparks";
import { compactDealerPlate, displayDealerPlate, formatRigaDateTimeComma, type WaybillPlateState } from "@/lib/iriss-waybill-plates";
import { waybillErrorNeedsCheck } from "@/lib/iriss-waybill-push";
import { waybillDropboxFileName, waybillPdfDownloadHref } from "@/lib/iriss-waybill-pdf";
import {
  WAYBILL_STALE_LABEL,
  WAYBILL_WORKER_STAGE_TEXT,
  isStaleWaybillRequest,
  waybillPendingExpired,
  waybillWrittenOffAtMs,
  type WaybillWrittenOffRequest as WrittenOffRequest,
  waybillQueuedText,
  waybillQueuedWaitedMs,
  waybillRequestCancellable,
  waybillRequestDismissable,
  waybillStuckStageText,
  type WaybillAivarsReply,
  type WaybillAutoMode,
  type WaybillRequest,
  type WaybillRequestStatus,
  type WaybillWorkerStage,
} from "@/lib/iriss-waybill-requests";

/**
 * Derīguma izvēles pavadzīmes formā (Nils 23.10, CSDD max 48h): TIEŠI "1 h", "12 h", "48 h" un "Cits" (brīvs stundu skaits 1-48).
 * Tās pašas izvēles telefonā, datorā un kolēģa skatā. Serveris pieņem jebkuru veselu 1..48 (CSDD maksimums).
 */
export const WAYBILL_MOBILE_HOUR_PRESETS = [1, 12, 48] as const;
/** Formas noklusējums. (Servera noklusējums bez laika, piem. tikai komentārs Aivaram, paliek DEFAULT_WAYBILL_VALID_HOURS.) */
export const WAYBILL_FORM_DEFAULT_HOURS = 12;

/** "Cits" lauks: vesels stundu skaits 1..48, citādi null (0, 49, 1.5, teksts). */
export function parseWaybillCustomHours(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d{1,4}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= WAYBILL_VALID_MAX_HOURS ? n : null;
}

export type WaybillRoutePlace = "tukums" | "other";

/** Sākuma adrese pēc noklusējuma (Tukums); serverī tā ir DEFAULT_WAYBILL_ROUTE_FROM. */
export const WAYBILL_TUKUMS_STREET = "Rīgas iela 75";

/** accepted: auto ir CSDD tirdzniecībā pieņemto sarakstā (pavadzīme no akta, bez maršruta). */
export type WaybillMobileCar = { brandModel: string; vin: string; id: string; accepted?: boolean; owner?: AutoparksOwner };

/** Auto ievades ceļš. Noklusējums "none": nepiespiež sarakstu; abi ceļi vienādi pieejami. */
export type WaybillAutoChoice = "none" | "list" | "manual";

export type WaybillMobileFormState = {
  plate: string;
  /** Lietotājs pats pieskārās numuram. Ja nē, numuru var ņemt no komentāra ("193 uz ..."). */
  plateTouched: boolean;
  /** Auto no saraksta (vai iepriekšējās pavadzīmes). */
  car: WaybillMobileCar | null;
  /** "Ar roku" ceļš (vienmēr kopā ar autoChoice === "manual"). */
  manual: boolean;
  /** "none" | "list" (No saraksta) | "manual" (Ar roku). */
  autoChoice: WaybillAutoChoice;
  manualBrandModel: string;
  /** Atstāts stāvoklī, bet «Ar roku» VIN vairs neievada un nesūta. */
  manualVin: string;
  /** null = "cits". */
  hoursPreset: number | null;
  hoursOther: string;
  comment: string;
  /** Sākuma adrese (tikai auto, kas nav tirdzniecībā pieņemts). Galamērķa lauka nav: CSDD Tukums. */
  from: WaybillRoutePlace;
  fromAddress: string;
  /** Komersanta pārstāvis (tikai pieņemtam auto); tukšs = auto firmas pārstāvis (ĪRISS - Nils Valainis, DZA - Taivo Batins). */
  representative: string;
};

export type WaybillMobilePayload = {
  plate: string;
  brandModel: string;
  vin: string;
  validHours: number;
  comment_untrusted: string;
  routeFromAddress: string;
  tradeAct: boolean;
  representative: string;
};

export function initialWaybillMobileForm(plate: string): WaybillMobileFormState {
  return {
    plate,
    plateTouched: false,
    car: null,
    manual: false,
    autoChoice: "none",
    manualBrandModel: "",
    manualVin: "",
    hoursPreset: WAYBILL_FORM_DEFAULT_HOURS,
    hoursOther: "",
    comment: "",
    from: "tukums",
    fromAddress: "",
    representative: "",
  };
}

/** Pārslēdz "No saraksta" / "Ar roku" / nav izvēles. Notīra otra ceļa laukus. */
export function applyWaybillAutoChoice(state: WaybillMobileFormState, choice: WaybillAutoChoice): WaybillMobileFormState {
  if (choice === "manual") {
    return { ...state, autoChoice: "manual", manual: true, car: null, representative: "" };
  }
  if (choice === "list") {
    return { ...state, autoChoice: "list", manual: false, manualBrandModel: "", manualVin: "" };
  }
  return {
    ...state,
    autoChoice: "none",
    manual: false,
    car: null,
    manualBrandModel: "",
    manualVin: "",
    representative: "",
  };
}

/** Manuālie lauki (marka, modelis) redzami tikai pēc "Ar roku". */
export function waybillShowsManualFields(state: Pick<WaybillMobileFormState, "autoChoice" | "manual">): boolean {
  return state.autoChoice === "manual" || state.manual;
}

/** Tirdzniecības saraksts / "Izvēlies auto" redzams tikai pēc "No saraksta". */
export function waybillShowsTradeList(state: Pick<WaybillMobileFormState, "autoChoice" | "manual">): boolean {
  return state.autoChoice === "list" && !state.manual;
}

/** Marka no izvēlētā ceļa; VIN tikai no saraksta auto. «Ar roku» VIN vienmēr tukšs. */
export function waybillAutoEntryValues(
  state: Pick<WaybillMobileFormState, "manual" | "manualBrandModel" | "manualVin" | "car">,
): { brandModel: string; vin: string } {
  if (state.manual) {
    return { brandModel: state.manualBrandModel.trim(), vin: "" };
  }
  return { brandModel: (state.car?.brandModel ?? "").trim(), vin: (state.car?.vin ?? "").trim() };
}

/** Derīgums stundās vai null, ja "cits" lauks nav derīgs. */
export function waybillMobileHours(state: Pick<WaybillMobileFormState, "hoursPreset" | "hoursOther">): number | null {
  if (state.hoursPreset != null) return state.hoursPreset;
  return parseWaybillCustomHours(state.hoursOther);
}

/** Numurs, kas tiks sūtīts: izvēlētais vai (ja nav pieskarts) no komentāra. */
export function waybillMobilePlate(state: Pick<WaybillMobileFormState, "plate" | "plateTouched" | "comment">): string {
  if (!state.plateTouched) {
    const hint = waybillHintsFromComment(state.comment).plate;
    if (hint) return hint;
  }
  return state.plate;
}

export type WaybillMobileBuildResult = { ok: true; payload: WaybillMobilePayload } | { ok: false; error: string };

export function buildWaybillMobilePayload(state: WaybillMobileFormState): WaybillMobileBuildResult {
  const plate = displayDealerPlate(waybillMobilePlate(state));
  if (!plate) return { ok: false, error: "Izvēlies numuru." };
  const comment = state.comment.trim().slice(0, NOTE_UNTRUSTED_MAX);
  const brandModel = state.manual ? state.manualBrandModel.trim() : (state.car?.brandModel ?? "").trim();
  if (!brandModel && !comment) return { ok: false, error: "Izvēlies auto vai ieraksti komentārā." };
  if (!brandModel && !waybillHintsFromComment(comment).brandModel) {
    return { ok: false, error: 'Komentārā nav atrasts auto. Raksti, piem., "193 uz BMW 330".' };
  }
  const validHours = waybillMobileHours(state);
  if (validHours == null) return { ok: false, error: `Ieraksti derīgumu: no 1 līdz ${WAYBILL_VALID_MAX_HOURS} h.` };
  const tradeAct = waybillMobileTradeAct(state);
  if (tradeAct) {
    const representative = waybillMobileRepresentative({ ...state, plate });
    if (!representative) return { ok: false, error: "Izvēlies komersanta pārstāvi." };
    return {
      ok: true,
      payload: {
        plate,
        brandModel,
        vin: state.car?.vin ?? "",
        validHours,
        comment_untrusted: comment,
        routeFromAddress: "",
        tradeAct: true,
        representative,
      },
    };
  }
  const fromAddress = state.from === "other" ? state.fromAddress.trim().slice(0, WAYBILL_ROUTE_MAX) : "";
  if (state.from === "other" && !fromAddress) return { ok: false, error: "Ieraksti sākuma adresi." };
  return {
    ok: true,
    payload: {
      plate,
      brandModel,
      vin: state.manual ? "" : (state.car?.vin ?? ""),
      validHours,
      comment_untrusted: comment,
      routeFromAddress: fromAddress,
      tradeAct: false,
      representative: "",
    },
  };
}

/** Pieņemts tirdzniecībā (no saraksta): tikai laiks + komersanta pārstāvis, maršruta nav. */
export function waybillMobileTradeAct(state: Pick<WaybillMobileFormState, "manual" | "car">): boolean {
  return !state.manual && state.car?.accepted === true;
}

/** Izvēlētais pārstāvis vai noklusējums pēc auto firmas (ja nav zināma - pēc numura firmas). */
export function waybillMobileRepresentative(
  state: Pick<WaybillMobileFormState, "representative" | "plate"> & Partial<Pick<WaybillMobileFormState, "car">>,
): string {
  const own = state.representative.trim();
  if (own) return own;
  return defaultWaybillRepresentative({ owner: state.car?.owner, plate: state.plate });
}

export type WaybillMobileChipTone = "wait" | "wip" | "ok" | "bad";

export const WAYBILL_MOBILE_STATUS: Record<WaybillRequestStatus, { label: string; tone: WaybillMobileChipTone }> = {
  queued: { label: "Gaida", tone: "wait" },
  in_progress: { label: "Izveido", tone: "wip" },
  issued: { label: "Izdota", tone: "ok" },
  error: { label: "Kļūda", tone: "bad" },
  cancelled: { label: "Atcelts", tone: "wait" },
};

export type WaybillMobileRequestRow = {
  id: string;
  title: string;
  sub: string;
  label: string;
  tone: WaybillMobileChipTone;
  pdfUrl: string;
  canRetry: boolean;
  /** "Atcelt": tikai Gaida un vēl neviens nav paņēmis. */
  canCancel: boolean;
  /** "Dzēst" (tikai paslēpj no saraksta): vecs ieraksts - izrakstīta, kļūda, atcelts, novecojis. */
  canDismiss: boolean;
  errorText: string;
  /** Novecojis: 24 h bez virzības - tikai Arhīvā. */
  stale: boolean;
  /** Izrakstīta: izdota pavadzīme vairs nav derīga (beigusies vai aizstāta ar jaunāku tam pašam numuram). */
  writtenOff: boolean;
  progress: WaybillMobileProgress;
  /** Teksts zem joslas: progress + "solis N no 3" (vai Izrakstītas paskaidrojums). */
  line: string;
  /** Īsa piezīme (piem. "Saglabāta Arhīvā", kad PDF ir pavadzīmju sarakstā). */
  note: string;
  /** "Saglabāt PDF" (tikai Izdota + serveris atļāva `canSavePdf`); tukšs = pogu nerāda. */
  savePdfHref: string;
  pdfFileName: string;
  /** Dropbox saglabāšanas kļūda (tikai adminam; kolēģim serveris to nesūta). */
  dropboxError: string;
};

export { waybillWrittenOffAtMs };

export const WAYBILL_WRITTEN_OFF_LABEL = "Izrakstīta";
export const WAYBILL_WRITTEN_OFF_HINT = "Pavadzīme vairs nav derīga. Atrodama Arhīvā.";
export const WAYBILL_SAVED_IN_ARCHIVE_TEXT = "Saglabāta Arhīvā";
/** Cik ilgi izrakstīta pavadzīme vēl redzama pirmajā lapā (pēc tam tikai Arhīvā). */
export const WAYBILL_WRITTEN_OFF_VISIBLE_MS = 24 * 60 * 60 * 1000;
/** Pirmajā lapā "CSDD pavadzīme" sarakstā ne vairāk par tik ierakstiem (Nils 23.10, j22). */
export const WAYBILL_MOBILE_CURRENT_LIMIT = 3;

/** Numuram šobrīd nav citas derīgas izdotas pavadzīmes (no šīs rindas zināmajiem pieprasījumiem). */
function plateFreeNow(request: WrittenOffRequest, requests: ReadonlyArray<WrittenOffRequest>, nowMs: number): boolean {
  return !requests.some(
    (o) =>
      o.id !== request.id &&
      o.status === "issued" &&
      compactDealerPlate(o.vehicle.plate) === compactDealerPlate(request.vehicle.plate) &&
      waybillWrittenOffAtMs(o, requests, nowMs) == null,
  );
}

/** "solis N no 3" zem statusa (Gaida, Izveido, Izdota); kļūdai, atceltam un beigušam gaidošam - bez soļa. */
export function waybillMobileProgressLine(
  progress: WaybillMobileProgress,
  request: Pick<WaybillRequest, "status" | "validUntil">,
  nowMs = Date.now(),
): string {
  const withStep =
    (request.status === "queued" && !waybillPendingExpired(request, nowMs)) ||
    request.status === "in_progress" ||
    request.status === "issued";
  return withStep ? `${progress.text} · solis ${progress.step} no 3` : progress.text;
}

/**
 * Dzīvais progress: 3 soļi (Gaida - Izveido - Izdota). Joslas platums atbilst TIKAI reālam solim
 * (worker notikumi: paņemts, VPN, forma, Saglabāt, PDF), nevis laikam - nekādu izdomātu procentu.
 */
export type WaybillMobileProgress = {
  step: 1 | 2 | 3;
  pct: number;
  text: string;
};

/** Joslas platums pēc reālā soļa. */
const STAGE_PCT: Record<WaybillWorkerStage, number> = { claimed: 40, vpn: 50, checking: 54, annulling: 58, filling: 62, saving: 78, pdf: 90 };

/** Pēc cik ilga gaidīšanas rāda "Gaida ilgāk nekā parasti" un ļauj atkārtot. */
export const WAYBILL_MOBILE_LONG_WAIT_MS = 15 * 60 * 1000;

function hm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function sinceMs(iso: string, nowMs: number): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, nowMs - t) : 0;
}

export function waybillMobileProgress(
  request: Pick<WaybillRequest, "status" | "createdAt" | "updatedAt" | "pickedAt" | "errorReason" | "validUntil" | "waybillNo"> &
    Partial<Pick<WaybillRequest, "stage" | "stageAt">>,
  nowMs = Date.now(),
  auto: { autoMode?: WaybillAutoMode; autoStandard?: boolean; autoReason?: string } = {},
): WaybillMobileProgress {
  if (request.status === "issued") {
    const until = formatRigaDateTimeComma(request.validUntil);
    const text = [request.waybillNo ? `Nr. ${request.waybillNo}` : "", until ? `derīga līdz ${until}` : ""].filter(Boolean).join(" · ");
    return { step: 3, pct: 100, text: text || "Pavadzīme izdota." };
  }
  if (request.status === "error") {
    const reason = request.errorReason.trim();
    const text = waybillErrorNeedsCheck(reason)
      ? "Iespējams, pavadzīme CSDD jau ir izveidota. Pārbaudi, pirms atkārto."
      : `Neizdevās${reason ? `: ${reason.replace(/[.\s]+$/, "")}` : ""}. Spied "Atkārtot".`;
    return { step: request.pickedAt ? 2 : 1, pct: request.pickedAt ? 66 : 33, text };
  }
  if (request.status === "cancelled") return { step: 1, pct: 0, text: "Atcelts." };
  if (request.status === "in_progress") {
    if (request.stage) {
      const stuck = waybillStuckStageText(request.stage, request.stageAt ?? "", nowMs);
      return { step: 2, pct: STAGE_PCT[request.stage], text: stuck || WAYBILL_WORKER_STAGE_TEXT[request.stage] };
    }
    return { step: 2, pct: 40, text: "Aivars veido pavadzīmi CSDD..." };
  }
  const honest = waybillQueuedText({
    expired: waybillPendingExpired(request, nowMs),
    ...auto,
    waitedMs: waybillQueuedWaitedMs(request, nowMs),
  });
  if (honest) return { step: 1, pct: 10, text: honest };
  const waited = sinceMs(request.updatedAt || request.createdAt, nowMs);
  if (waited > WAYBILL_MOBILE_LONG_WAIT_MS) {
    return { step: 1, pct: 10, text: 'Gaida ilgāk nekā parasti. Ja steidzami, spied "Atkārtot" vai raksti Aivaram.' };
  }
  return { step: 1, pct: 10, text: "Rindā. Aivars sāks pēc brīža." };
}

/**
 * Vai pieprasījums ir "tagadējs" (pirmajā lapā): darbā, nesena kļūda vai izrakstīta un vēl derīga.
 * Beigušās, vecas kļūdas un novecojušie (24 h bez virzības) ir tikai Arhīvā.
 */
export function waybillMobileRequestIsCurrent(
  request: Pick<WaybillRequest, "status" | "createdAt" | "updatedAt" | "validUntil">,
  nowMs = Date.now(),
): boolean {
  if (isStaleWaybillRequest(request, nowMs)) return false;
  // Atceltie pazūd no rindas (redzami tikai Arhīvā).
  if (request.status === "cancelled") return false;
  if (request.status === "queued" || request.status === "in_progress") return true;
  if (request.status === "issued") {
    const until = Date.parse(request.validUntil);
    return Number.isFinite(until) && until > nowMs;
  }
  return sinceMs(request.updatedAt || request.createdAt, nowMs) <= 24 * 60 * 60 * 1000;
}

/** Kompakts Aivara pieprasījumu saraksts (jaunākie augšā). which: tagadējie vai arhīvs. */
export function waybillMobileRequestRows(
  requests: ReadonlyArray<WaybillRequest>,
  replies: ReadonlyArray<WaybillAivarsReply>,
  limit = 5,
  opts: {
    nowMs?: number;
    which?: "current" | "archive" | "all";
    /** "Dzēst" paslēptie ID - tikai pirmās lapas sarakstā (Arhīvā redzami vienmēr). */
    dismissed?: ReadonlyArray<string>;
    /**
     * Numuru stāvoklis (CSDD + indekss, tas pats, ko rāda apļi). FABLE v3: ja tā pati pavadzīme numuram vēl ir
     * aktīva (CSDD derīgums garāks par pieprasīto), kartīte nav «Izrakstīta … atkal brīvs».
     */
    plates?: ReadonlyArray<WaybillPlateState>;
  } = {},
): WaybillMobileRequestRow[] {
  const nowMs = opts.nowMs ?? Date.now();
  const plates = opts.plates ?? [];
  const plateState = (request: WaybillRequest) =>
    plates.find((p) => compactDealerPlate(p.plate) === compactDealerPlate(request.vehicle.plate));
  /** Tā pati pavadzīme numuram vēl aktīva pēc CSDD / indeksa. */
  const liveByPlates = (request: WaybillRequest, waybillNo: string): boolean => {
    const cur = plateState(request)?.current;
    const no = waybillNo.trim().toUpperCase();
    return Boolean(no && cur && cur.number.trim().toUpperCase() === no && Date.parse(cur.validUntil) > nowMs);
  };
  /** Izrakstīšanas brīdis, ja numuru stāvoklis to neatspēko. */
  const writtenOffAt = (request: WaybillRequest, waybillNo: string): number | null =>
    liveByPlates(request, waybillNo) ? null : waybillWrittenOffAtMs(request, requests, nowMs);
  const which = opts.which ?? "current";
  const dismissed = new Set(which === "current" ? (opts.dismissed ?? []) : []);
  return [...requests]
    .filter((request) => {
      if (which === "all") return true;
      // Paslēpts paliek tikai, kamēr ieraksts ir vecs (ja to kāds atkārtoja - atkal redzams).
      if (dismissed.has(request.id) && waybillRequestDismissable(request, requests, nowMs)) return false;
      const offAt = writtenOffAt(request, request.waybillNo);
      // Izrakstīta vēl 24 h redzama pirmajā lapā (ar norādi uz Arhīvu), tad tikai Arhīvā.
      const current =
        request.status === "issued" && liveByPlates(request, request.waybillNo)
          ? true
          : offAt != null
            ? nowMs - offAt <= WAYBILL_WRITTEN_OFF_VISIBLE_MS
            : waybillMobileRequestIsCurrent(request, nowMs);
      return which === "current" ? current : !current;
    })
    .sort((a, b) => {
      // Pirmajā lapā aktīvie (darbā, derīgi) vienmēr pirms vecajiem - limits tos neizspiež.
      if (which === "current") {
        const old = Number(waybillRequestDismissable(a, requests, nowMs)) - Number(waybillRequestDismissable(b, requests, nowMs));
        if (old) return old;
      }
      return b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, limit)
    .map((request) => {
      const reply = replies.find((r) => r.requestId === request.id);
      const status = reply?.status ?? request.status;
      const stale = isStaleWaybillRequest({ ...request, status }, nowMs);
      const hours =
        request.validHours && request.validHours >= 1
          ? request.validHours
          : (waybillHoursBetween(request.validFrom, request.validUntil) ?? 0);
      const waybillNo = reply?.waybillNo || request.waybillNo;
      const sub = [
        waybillNo,
        displayDealerPlate(request.vehicle.plate) || request.vehicle.plate,
        hours ? `${hours} h` : "",
        hm(request.createdAt),
      ]
        .filter(Boolean)
        .join(" · ");
      const progress = waybillMobileProgress({ ...request, status, waybillNo }, nowMs, {
        autoMode: reply?.autoMode,
        autoStandard: reply?.autoStandard,
        autoReason: reply?.autoReason,
      });
      const longWait = status === "queued" && sinceMs(request.updatedAt || request.createdAt, nowMs) > WAYBILL_MOBILE_LONG_WAIT_MS;
      const offAt = writtenOffAt({ ...request, status }, waybillNo);
      const writtenOff = offAt != null;
      const plate = displayDealerPlate(request.vehicle.plate) || request.vehicle.plate;
      const plateBusyNow = plateState(request)?.busy === true;
      const pdfUrl = reply?.pdfUrl || request.pdfUrl;
      const offSub = writtenOff
        ? [
            `Izrakstīta ${formatRigaDateTimeComma(new Date(offAt).toISOString())}`,
            plateFreeNow(request, requests, nowMs) && !plateBusyNow ? `numurs ${plate} atkal ir brīvs` : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : "";
      return {
        id: request.id,
        title: request.vehicle.brandModel || request.noteUntrusted || "Auto",
        sub: writtenOff ? offSub : sub,
        label: stale ? WAYBILL_STALE_LABEL : writtenOff ? WAYBILL_WRITTEN_OFF_LABEL : WAYBILL_MOBILE_STATUS[status].label,
        tone: stale || writtenOff ? "wait" : WAYBILL_MOBILE_STATUS[status].tone,
        pdfUrl,
        canRetry: status === "error" || (status === "queued" && (longWait || stale) && !waybillPendingExpired(request, nowMs)),
        canCancel: waybillRequestCancellable({ status, pickedBy: request.pickedBy }),
        canDismiss: waybillRequestDismissable({ ...request, status }, requests, nowMs),
        errorText: status === "error" ? request.errorReason || reply?.text || "" : "",
        stale,
        writtenOff,
        progress,
        line: writtenOff ? WAYBILL_WRITTEN_OFF_HINT : waybillMobileProgressLine(progress, { status, validUntil: request.validUntil }, nowMs),
        // PDF no Aivara/automātikas tiek ierakstīts pavadzīmju sarakstā (result -> uploadIrissPavadzime).
        note: status === "issued" && !writtenOff && pdfUrl.startsWith("/api/admin/iriss-pavadzimes/") ? WAYBILL_SAVED_IN_ARCHIVE_TEXT : "",
        savePdfHref: status === "issued" && reply?.canSavePdf ? waybillPdfDownloadHref(request.id) : "",
        pdfFileName:
          waybillDropboxFileName({ waybillNo, brandModel: request.vehicle.brandModel, plate: request.vehicle.plate }) ||
          `${waybillNo || "pavadzime"}.pdf`,
        dropboxError: status === "issued" ? (reply?.dropboxError ?? "") : "",
      };
    });
}

export function firstFreeWaybillPlate(plates: ReadonlyArray<WaybillPlateState>, fallback: string): string {
  return plates.find((row) => !row.busy)?.plate ?? fallback;
}
