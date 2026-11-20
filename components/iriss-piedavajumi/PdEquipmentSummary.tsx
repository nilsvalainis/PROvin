import { IrissOfferPublicSectionTitle, irissOfferPublicCardClass } from "@/components/iriss-offer-public/IrissOfferPublicChrome";
import { IRISS_PD_EQ_SUMMARY_TITLE, type IrissPdEqSummaryStructured } from "@/lib/iriss-pd-equipment-summary";

/** «Sēdekļi: ...» -> treknraksts apakšvirsrakstam (līdz 40 rakstzīmēm pirms kola). */
function Item({ text }: { text: string }) {
  const m = /^([^:]{2,40}):\s+(.+)$/.exec(text);
  if (!m) return <>{text}</>;
  return (
    <>
      <b className="font-semibold">{m[1]}:</b> {m[2]}
    </>
  );
}

/** Nils 20.11: klienta PD - «Automašīnas komplektācijas kopsavilkums (pēc VIN)». Nav datu - nerāda. */
export function PdEquipmentSummary({ summary }: { summary: IrissPdEqSummaryStructured | null | undefined }) {
  if (!summary || !summary.groups.length) return null;
  return (
    <section className={irissOfferPublicCardClass()} data-block="komplektacija">
      <IrissOfferPublicSectionTitle>{IRISS_PD_EQ_SUMMARY_TITLE}</IrissOfferPublicSectionTitle>
      {summary.intro ? <p className="text-[15px] leading-relaxed text-[#111827]">{summary.intro}</p> : null}
      <div className="mt-1 sm:columns-2 sm:gap-8">
        {summary.groups.map((g) => (
          <div key={g.title} className="mt-3 break-inside-avoid">
            <h3 className="text-[13.5px] font-semibold text-[#111827]">{g.title}</h3>
            <ul className="mt-1.5 space-y-1">
              {g.items.map((it, i) => (
                <li key={`${i}-${it}`} className="relative pl-4 text-[13.5px] leading-snug text-[#27272a]">
                  <span className="absolute left-0 top-[0.5em] h-[5px] w-[5px] rounded-full bg-[#3b82c4]" aria-hidden />
                  <Item text={it} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
