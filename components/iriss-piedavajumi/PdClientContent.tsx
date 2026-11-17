import {
  IrissOfferPublicSectionTitle,
  irissOfferPublicCardClass,
} from "@/components/iriss-offer-public/IrissOfferPublicChrome";
import type { IrissPdPublicContent } from "@/lib/iriss-piedavajumi";

const CHIP = "inline-flex items-center rounded-full border border-[#e4e4e7] bg-[#fafafa] px-2.5 py-1 text-[12.5px] leading-snug text-[#111827]";

/** Aprīkojuma izcēlumi (čipi). Klienta skatā tie ir apakšējā «Aprīkojums» sadaļā. */
export function PdHighlightChips({ items }: { items: readonly string[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((h) => (
        <span key={h} className={CHIP}>
          {h}
        </span>
      ))}
    </div>
  );
}

/**
 * Klienta skatā: «Stāvoklis» (fakti + vizuālais/tehniskais teksts) un «Kopsavilkums» (cenā iekļauts / nav iekļauts),
 * katrs savā kartītē. Tikai `IrissPdPublicContent` (ieslēgtās sadaļas, ieķeksētās rindas).
 * Agrāk stili gaidīja ietverošu `.pdc` klasi, kuras klienta skatā nav, un čipi saplūda vienā rindā.
 */
export function PdClientContent({ content }: { content: IrissPdPublicContent | null }) {
  if (!content) return null;
  const { included, excluded, facts, visual, technical, note } = content;
  const condition = facts.length > 0 || visual || technical || note;
  return (
    <>
      {condition ? (
        <section className={irissOfferPublicCardClass()} data-block="stavoklis">
          <IrissOfferPublicSectionTitle>Stāvoklis</IrissOfferPublicSectionTitle>
          {facts.length ? (
            <div className="flex flex-wrap gap-1.5">
              {facts.map((f) => (
                <span key={f} className={CHIP}>
                  <span className="mr-1.5 text-[11px] font-bold text-[#3b82c4]" aria-hidden>
                    ✓
                  </span>
                  {f}
                </span>
              ))}
            </div>
          ) : null}
          {visual ? (
            <p className={`text-[14px] leading-relaxed text-[#111827] ${facts.length ? "mt-3" : ""}`}>
              <b>Vizuālais novērtējums. </b>
              {visual}
            </p>
          ) : null}
          {technical ? (
            <p className="mt-2 text-[14px] leading-relaxed text-[#111827]">
              <b>Tehniskais novērtējums. </b>
              {technical}
            </p>
          ) : null}
          {note ? <p className="mt-2 text-[14px] leading-relaxed text-[#111827]">{note}</p> : null}
        </section>
      ) : null}
      {included.length || excluded.length ? (
        <section className={irissOfferPublicCardClass()} data-block="kopsavilkums">
          <IrissOfferPublicSectionTitle>Kopsavilkums</IrissOfferPublicSectionTitle>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {included.length ? (
              <div>
                <p className="text-[13px] font-semibold text-[#047857]">Cenā iekļauts</p>
                <ul className="mt-1.5 space-y-1.5">
                  {included.map((t) => (
                    <li key={t} className="flex items-start gap-2 text-[14px] leading-snug text-[#111827]">
                      <span className="mt-0.5 shrink-0 text-[12px] font-bold text-[#047857]" aria-hidden>
                        ✓
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {excluded.length ? (
              <div>
                <p className="text-[13px] font-semibold text-[#52525b]">Cenā nav iekļauts</p>
                <ul className="mt-1.5 space-y-1.5">
                  {excluded.map((t) => (
                    <li key={t} className="flex items-start gap-2 text-[14px] leading-snug text-[#52525b]">
                      <span className="mt-0.5 shrink-0 text-[12px] font-bold" aria-hidden>
                        -
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
