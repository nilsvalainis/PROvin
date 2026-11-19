"use client";

import {
  FLASH_MAX_REVIEW_KIND_LABEL,
  type FlashMaxReviewFinding,
  type FlashMaxReviewState,
} from "@/lib/flash-max-final-review";

/**
 * FLASH MAX noslēguma pārbaudes ieteikumi pa laukiem: kas (bija / būs), kāpēc, «Pieņemt» / «Noraidīt».
 * Nekas netiek pārrakstīts bez operatora klikšķa. Viens saturs datoram un telefonam (AdminResponsiveModal).
 */
export function AdminFlashMaxReviewPanel({
  state,
  handled,
  unappliable,
  onAccept,
  onReject,
}: {
  state: FlashMaxReviewState;
  /** Jau pieņemtie / noraidītie ieteikumi (id -> lēmums). */
  handled: Readonly<Record<string, "accepted" | "rejected">>;
  /** Ieteikumi, kurus vairs nevar piemērot (fragments laukā mainīts). */
  unappliable: ReadonlySet<string>;
  onAccept: (finding: FlashMaxReviewFinding) => void;
  onReject: (finding: FlashMaxReviewFinding) => void;
}) {
  if (state.status === "running") {
    return <p className="text-[14px] text-slate-600 md:text-[12px]">Noslēguma pārbaude notiek…</p>;
  }
  if (state.status === "error") {
    return (
      <p className="text-[14px] text-[#b42318] md:text-[12px]" role="alert">
        Noslēguma pārbaude neizdevās. FLASH MAX teksti ir saglabāti, kā bija.
      </p>
    );
  }
  if (state.status !== "done") return null;
  if (state.findings.length === 0) {
    return (
      <p className="text-[14px] font-medium text-emerald-800 md:text-[12px]" data-flash-review-clean="">
        Pārbaudīts, iebildumu nav.
      </p>
    );
  }

  const btn =
    "min-h-11 rounded-full px-4 text-[15px] font-semibold disabled:opacity-40 md:min-h-0 md:rounded-lg md:px-2.5 md:py-1 md:text-[11px]";
  return (
    <ul className="space-y-3">
      {state.findings.map((f) => {
        const decision = handled[f.id];
        const stale = unappliable.has(f.id);
        return (
          <li
            key={f.id}
            data-flash-review-finding={f.fieldId}
            data-decision={decision ?? undefined}
            className={`rounded-xl border border-slate-200 p-3 ${decision ? "opacity-55" : ""}`}
          >
            <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500 md:text-[10px]">
              {state.fieldLabels[f.fieldId] ?? f.fieldId} · {FLASH_MAX_REVIEW_KIND_LABEL[f.kind]}
            </p>
            <p className="mt-1 text-[14px] leading-snug text-[var(--color-apple-text)] md:text-[12px]">{f.reason}</p>
            {f.find ? (
              <p className="mt-2 whitespace-pre-line rounded-lg bg-red-50 px-2 py-1.5 text-[14px] leading-snug text-red-900 line-through decoration-red-400/60 md:text-[12px]">
                {f.find}
              </p>
            ) : null}
            <p className="mt-1.5 whitespace-pre-line rounded-lg bg-emerald-50 px-2 py-1.5 text-[14px] leading-snug text-emerald-950 md:text-[12px]">
              {f.find ? "" : "Pievienot: "}
              {f.replace}
            </p>
            {decision ? (
              <p className="mt-2 text-[13px] font-medium text-slate-600 md:text-[11px]">
                {decision === "accepted" ? "Pieņemts" : "Noraidīts"}
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={`${btn} bg-teal-600 text-white hover:bg-teal-700`}
                  disabled={stale}
                  onClick={() => onAccept(f)}
                >
                  Pieņemt
                </button>
                <button type="button" className={`${btn} bg-slate-100 text-slate-700 hover:bg-slate-200`} onClick={() => onReject(f)}>
                  Noraidīt
                </button>
                {stale ? (
                  <span className="text-[13px] text-[#b42318] md:text-[11px]">Lauka teksts jau mainīts - piemērot nevar.</span>
                ) : null}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
