import { Link } from "@/i18n/navigation";

const itemClass =
  "group flex flex-col rounded-xl border border-white/[0.1] bg-white/[0.03] px-3.5 py-3 transition hover:border-[#0066ff]/35 hover:bg-white/[0.05]";

const EXAMPLES = [
  {
    href: "/concept-demos/concept-29/",
    title: "Scandinavian clean",
    subtitle: "concept-29",
    hint: "Mierīgs ritms, skaidra hierarhija",
  },
  {
    href: "/concept-demos/concept-04/",
    title: "Apple-style Ultra Clean",
    subtitle: "concept-04",
    hint: "Tīra tipogrāfija, premium sajūta",
  },
  {
    href: "/concept-demos/concept-25/",
    title: "Marketplace comparison",
    subtitle: "concept-25",
    hint: "Salīdzinājuma bloks, sarakstu loģika",
  },
] as const;

/** Trīs ieteiktie statiskie landing piemēri — `/concept-demos` (bez locale prefiksa). */
export function DemoStaticLandingExamples() {
  return (
    <div className="mt-8 border-t border-white/[0.07] pt-8">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Statiskie landing · 3 piemēri</p>
      <p className="mt-2 max-w-[40rem] text-[13px] leading-relaxed text-white/50">
        Īsi no sadaļas{" "}
        <Link
          href="/demo/static-concepts"
          className="text-[#7eb6ff]/90 underline decoration-[#0066ff]/30 underline-offset-2 transition hover:text-[#a8ccff]"
        >
          Statiskie landing koncepti
        </Link>
        — atveras jaunā cilnē.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {EXAMPLES.map((ex) => (
          <li key={ex.href}>
            <a
              href={ex.href}
              target="_blank"
              rel="noopener noreferrer"
              className={itemClass}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">{ex.subtitle}</span>
              <span className="mt-1 text-[13px] font-medium leading-snug text-white/88">{ex.title}</span>
              <span className="mt-1.5 text-[11px] leading-snug text-white/45">{ex.hint}</span>
              <span className="mt-3 text-[10px] font-medium text-[#7eb6ff]/90 transition group-hover:text-[#a8ccff]">
                Atvērt →
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
