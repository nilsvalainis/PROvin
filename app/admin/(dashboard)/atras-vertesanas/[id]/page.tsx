import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminListingPeekCommentComposer } from "@/components/admin/AdminListingPeekCommentComposer";
import { AdminListingPeekPhoneField } from "@/components/admin/AdminListingPeekPhoneField";
import { AdminListingPeekPhotos } from "@/components/admin/AdminListingPeekPhotos";
import { AdminListingPeekSla } from "@/components/admin/AdminListingPeekSla";
import {
  AdminCopyVinButton,
  AdminQuickEvalExportMenu,
  AdminQuickEvalRefreshAll,
  AdminQuickEvalSourceGrid,
  AdminQuickEvalVinBar,
} from "@/components/admin/AdminQuickEvalDetail";
import { AdminWhatsAppOpenButton } from "@/components/admin/AdminWhatsAppOpenButton";
import { isSmtpConfigured } from "@/lib/email/send-transactional";
import { parseListingPeekCustomerComment } from "@/lib/listing-peek-comment-presets";
import { getListingPeekById, listListingPeeks, updateListingPeekStatus } from "@/lib/listing-peek-store";
import { canonicalizeListingUrl } from "@/lib/order-field-validation";
import { buildLetterFacts, buildSourceCards, csddCardFacts, fmtLv, type QuickEvalCardInput } from "@/lib/quick-eval-cards";
import { listQuickEvalExportCandidates } from "@/lib/quick-eval-service";
import { readQuickEval } from "@/lib/quick-eval-store";
import { heardAboutDisplayLabel } from "@/lib/stripe-session";
import { findVinHistory } from "@/lib/vin-history";
import { saveQuickEvalContact, setQuickEvalStatus } from "../actions";

export const dynamic = "force-dynamic";

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  new: { label: "Jauns", cls: "bg-sky-50 text-sky-800 ring-sky-200" },
  in_progress: { label: "Procesā", cls: "bg-amber-50 text-amber-900 ring-amber-200" },
  completed: { label: "Pabeigts", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  rejected: { label: "Noraidīts", cls: "bg-slate-100 text-slate-600 ring-slate-300" },
};

const hdrBtn =
  "inline-flex items-center justify-center rounded-[9px] border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-[var(--color-apple-text)] hover:bg-slate-50";

export default async function QuickEvalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ contact?: string }>;
}) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : undefined;
  let peek = await getListingPeekById(decodeURIComponent(id));
  if (!peek) notFound();
  // Atverot jaunu vērtējumu, tas automātiski kļūst „Procesā” (manuālās pogas vairs nav).
  if (peek.status === "new") {
    peek = (await updateListingPeekStatus(peek.id, "in_progress").catch(() => null)) ?? { ...peek, status: "in_progress" };
  }
  const [doc, all] = await Promise.all([readQuickEval(peek.id).catch(() => null), listListingPeeks(200).catch(() => [])]);
  const [candidates, vinHistory] = await Promise.all([
    listQuickEvalExportCandidates(peek.id).catch(() => []),
    findVinHistory([peek.vin, doc?.vin, doc?.sourceBlocks.csdd.registrationNumber, doc?.sourceBlocks.csdd.vin], {
      peekId: peek.id,
    }).catch(() => []),
  ]);

  const listingUrl = canonicalizeListingUrl(peek.listingUrl);
  const blocks = doc?.sourceBlocks;
  const input: QuickEvalCardInput | null = blocks
    ? {
        blocks,
        parts: (doc?.seed?.parts ?? {}) as Record<string, string | undefined>,
        sourceAt: doc?.sourceAt ?? {},
        seedAt: doc?.seed?.at ?? null,
        peekVin: peek.vin ?? "",
        listingUrl,
        ltab: doc?.ltab ?? null,
        ccVinCount: doc?.ccVin?.count ?? null,
      }
    : null;
  const cards = input ? buildSourceCards(input) : [];
  const facts = input ? buildLetterFacts(input) : {};
  const csdd = blocks ? csddCardFacts(blocks.csdd, peek.vin ?? "") : [];
  const title = csdd.find((f) => f.label === "Marka, modelis")?.value || "Auto";
  const plateVin = csdd.find((f) => f.label === "Reģ. nr. · VIN")?.value.replace(/ \(VIN.*$/, "");
  const year = csdd.find((f) => f.label === "Izlaiduma gads")?.value;
  const vin = doc?.vin || peek.vin || "";

  const queue = all.filter((e) => e.status === "new" || e.status === "in_progress" || e.id === peek!.id);
  const idx = queue.findIndex((e) => e.id === peek!.id);
  const prev = idx > 0 ? queue[idx - 1] : null;
  const next = idx >= 0 && idx < queue.length - 1 ? queue[idx + 1] : null;
  const smtpOk = isSmtpConfigured();
  const isDone = peek.status === "completed";
  const isRejected = peek.status === "rejected";
  const parsed = peek.comment ? parseListingPeekCustomerComment(peek.comment) : null;
  const back = `/admin/atras-vertesanas/${encodeURIComponent(peek.id)}`;
  const pill = STATUS_PILL[peek.status] ?? STATUS_PILL.new!;

  return (
    <div className="w-full max-w-none pb-24 md:pb-6">
      <AdminDashboardHeaderWithMenu>
        <p className="text-[11px] text-[var(--color-provin-muted)]">
          <Link href="/admin/atras-vertesanas" className="text-[var(--color-provin-accent)] hover:underline">
            ← Ātrie vērtējumi
          </Link>
          {queue.length > 1 && idx >= 0 ? (
            <span className="ml-3">
              {prev ? (
                <Link href={`/admin/atras-vertesanas/${encodeURIComponent(prev.id)}`} className="hover:underline">
                  ‹ iepriekšējais
                </Link>
              ) : null}
              <span className="mx-1.5">
                {idx + 1}/{queue.length}
              </span>
              {next ? (
                <Link href={`/admin/atras-vertesanas/${encodeURIComponent(next.id)}`} className="hover:underline">
                  nākamais ›
                </Link>
              ) : null}
            </span>
          ) : null}
        </p>
        <h1 className="mt-1 flex flex-wrap items-center gap-2 text-[1.3rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)]">
          {title}
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${pill.cls}`}>{pill.label}</span>
        </h1>
      </AdminDashboardHeaderWithMenu>

      {sp?.contact === "saved" ? (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">Kontakti saglabāti.</p>
      ) : sp?.contact ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          Kontaktus neizdevās saglabāt{sp.contact === "invalid" ? " (adrese/tālrunis nav derīgs)" : ""}.
        </p>
      ) : null}

      {/* Galvene: auto + klients + darbības */}
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 text-[12.5px]">
            <p className="font-mono text-[12.5px] text-[var(--color-apple-text)]">
              {[plateVin || vin, year].filter(Boolean).join(" · ") || "VIN nav norādīts"}
            </p>
            <p className="mt-1 text-[var(--color-provin-muted)]">
              <b className="text-[var(--color-apple-text)]">{peek.email}</b>
              {peek.phone ? ` · ${peek.phone}` : ""}
              {peek.heardAbout ? ` · uzzināja: ${heardAboutDisplayLabel(peek.heardAbout, "lv")}` : ""}
            </p>
            <a href={listingUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 block truncate text-[var(--color-provin-accent)] hover:underline">
              {listingUrl} ↗
            </a>
            <div className="mt-1.5">
              <AdminListingPeekSla createdAt={peek.createdAt} complete={isDone} rejected={isRejected} />
            </div>
          </div>
          <div className="hidden flex-wrap items-center gap-1.5 md:flex">
            {peek.phone ? <AdminWhatsAppOpenButton phone={peek.phone} variant="pill" /> : null}
            <AdminCopyVinButton vin={vin} />
            <AdminQuickEvalExportMenu peekId={peek.id} candidates={candidates} exports={doc?.exports ?? []} />
            <form action={setQuickEvalStatus} className="flex gap-1.5">
              <input type="hidden" name="id" value={peek.id} />
              <input type="hidden" name="back" value={back} />
              <button type="submit" name="status" value="rejected" disabled={isRejected} className={`${hdrBtn} text-rose-700 disabled:opacity-40`}>
                Noraidīt
              </button>
              <button
                type="submit"
                name="status"
                value="completed"
                disabled={isDone}
                className="inline-flex items-center rounded-[9px] bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                Pabeigts
              </button>
            </form>
          </div>
        </div>
        <details className="mt-2 text-[12px]">
          <summary className="cursor-pointer text-[11px] font-semibold text-[var(--color-provin-muted)]">✎ Labot kontaktus</summary>
          <form action={saveQuickEvalContact} className="mt-2 grid gap-1.5 sm:max-w-xl sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <input type="hidden" name="id" value={peek.id} />
            <input type="hidden" name="back" value={back} />
            <label className="min-w-0">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">E-pasts</span>
              <input
                type="email"
                name="email"
                required
                defaultValue={peek.email}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm outline-none focus:border-[var(--color-provin-accent)]"
              />
            </label>
            <AdminListingPeekPhoneField defaultValue={peek.phone} />
            <button type="submit" className={hdrBtn}>
              Saglabāt
            </button>
          </form>
        </details>
      </section>

      <AdminQuickEvalVinBar peekId={peek.id} entries={vinHistory} />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
          Avoti {doc?.seed?.at ? <span className="font-normal normal-case tracking-normal">· ielasīts {fmtLv(doc.seed.at)}</span> : null}
        </h2>
        <AdminQuickEvalRefreshAll peekId={peek.id} />
      </div>
      {input ? (
        <AdminQuickEvalSourceGrid
          peekId={peek.id}
          vin={vin}
          cards={cards}
          vinScan={doc?.vinScan ?? null}
          ccVin={doc?.ccVin ?? null}
        />
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-[13px] text-[var(--color-provin-muted)]">
          Bezmaksas avoti vēl nav ielasīti. Spied „Atjaunot visus avotus”.
        </p>
      )}

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.45fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-apple-text)]">
            {isDone ? "Vēstule klientam · nosūtīta" : "Vēstule klientam"}
            {peek.commentSentAt ? (
              <span className="ml-2 font-normal normal-case tracking-normal text-[var(--color-provin-muted)]">{fmtLv(peek.commentSentAt)}</span>
            ) : null}
          </h3>
          <AdminListingPeekCommentComposer
            fieldId={`peek-${peek.id}`}
            peekId={peek.id}
            listingUrl={listingUrl}
            smtpOk={smtpOk}
            facts={facts}
            {...(isDone && peek.comment
              ? {
                  initialLines: parsed?.lines,
                  initialCloser: parsed?.closer,
                  initialLetter: peek.comment,
                  submitLabel: "Nosūtīt vēlreiz",
                }
              : {})}
          />
        </section>
        <div className="space-y-3">
          <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-apple-text)]">Foto</h3>
            <AdminListingPeekPhotos peekId={peek.id} photos={peek.photos ?? []} />
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[12px]">
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-apple-text)]">Vēsture</h3>
            <ul className="space-y-1 text-[var(--color-provin-muted)]">
              <li>{fmtLv(peek.createdAt)} · pieprasījums saņemts</li>
              {doc?.seed?.at ? <li>{fmtLv(doc.seed.at)} · bezmaksas avoti ielasīti</li> : null}
              {(doc?.reusedFrom ?? []).map((r) => (
                <li key={`${r.fromId}-${r.at}`}>
                  {fmtLv(r.at)} · pārnesti nopirktie dati ({r.keys.join(", ")})
                </li>
              ))}
              {doc?.ltab ? <li>{fmtLv(doc.ltab.at)} · LTAB atzīme: {doc.ltab.mark === "clean" ? "nav zaudējumu" : "ir zaudējumi"}</li> : null}
              {peek.commentSentAt ? <li>{fmtLv(peek.commentSentAt)} · vēstule nosūtīta</li> : null}
              {(doc?.exports ?? []).map((x) => (
                <li key={`${x.sessionId}-${x.at}`}>
                  {fmtLv(x.at)} · {x.mode === "auto" ? "automātiski importēts" : "eksportēts"} uz{" "}
                  <Link href={`/admin/orders/${x.sessionId}`} className="text-[var(--color-provin-accent)] hover:underline">
                    pasūtījumu
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* Telefonā: lēmums īkšķa zonā. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-[1fr_1fr_1.3fr] gap-2">
          <form action={setQuickEvalStatus} className="contents">
            <input type="hidden" name="id" value={peek.id} />
            <input type="hidden" name="back" value={back} />
            <button type="submit" name="status" value="rejected" disabled={isRejected} className="rounded-xl border border-rose-200 bg-rose-50 py-3 text-[13px] font-semibold text-rose-700 disabled:opacity-40">
              Noraidīt
            </button>
            {peek.phone ? (
              <span className="flex items-center justify-center rounded-xl border border-slate-200">
                <AdminWhatsAppOpenButton phone={peek.phone} variant="pill" />
              </span>
            ) : (
              <span />
            )}
            <button type="submit" name="status" value="completed" disabled={isDone} className="rounded-xl bg-emerald-600 py-3 text-[13px] font-semibold text-white disabled:opacity-40">
              Pabeigts
            </button>
          </form>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <AdminCopyVinButton vin={vin} />
          <AdminQuickEvalExportMenu peekId={peek.id} candidates={candidates} exports={doc?.exports ?? []} dropUp />
        </div>
      </div>
    </div>
  );
}
