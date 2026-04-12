import {
  ArrowDown,
  ChevronRight,
  Database,
  GitMerge,
  Layers,
  LineChart,
  MessageCircle,
  Shield,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

const iconProps = { className: "h-[1.05rem] w-[1.05rem] shrink-0", strokeWidth: 1.5 } as const;

export type DesignDirectionLayoutDemoProps = {
  /** `true` — apvienotā `/demo` studija: pilns layout ievads + `id` prefikss pārējām sadaļām. */
  embedded?: boolean;
};

function DesignDirectionHeroIntro({ sectionId }: { sectionId: string }) {
  return (
    <section className="demo-design-dir__section demo-design-dir__section--band-a pb-20 pt-4 sm:pb-28 sm:pt-8" id={sectionId}>
      <div className="demo-design-dir__shell relative text-center">
        <div className="demo-design-dir__axis-line opacity-80" aria-hidden />
        <p className="demo-design-dir__kicker relative z-[1]">Stila demo · nav indeksēšanai</p>
        <h1 className="demo-design-dir__title relative z-[1] mx-auto mt-4 max-w-[40rem]">
          Vienota ass, secīgs ritms, atšķirīgas zīmes katrā solī
        </h1>
        <p className="demo-design-dir__body relative z-[1] mx-auto mt-4 max-w-[36rem]">
          Šī lapa parāda, kā viena horizontālā ass un vienādas kartiņu likmes samazina „smagumu”, bet dažādi motīvi
          (plūsma, slāņi, signāls) atkārto ideju: datu savienošana un pievienotā vērtība — bez īstā mājaslapas tekstu
          maiņas.
        </p>
        <div className="demo-design-dir__hero-scan relative z-[1]" aria-hidden />
        <div className="relative z-[1] mt-10 flex flex-wrap items-center justify-center gap-3 text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
          <Link href="/demo/hero-variants" className="rounded-full border border-white/12 px-4 py-2 transition hover:border-[#0066ff]/35 hover:text-white/80">
            Hero orbit demo
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#0066ff]/35 bg-[#0066ff]/12 px-4 py-2 text-[#7eb6ff] transition hover:bg-[#0066ff]/20 hover:text-white"
          >
            Uz sākumu
            <ChevronRight className="h-3.5 w-3.5 opacity-80" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * Statisks stila / layouta paraugs — teksti ir tikai demo skaidrojumi, nav produkcijas `messages`.
 */
export function DesignDirectionLayoutDemo({ embedded = false }: DesignDirectionLayoutDemoProps) {
  const sid = (key: string) => (embedded ? `demo-studio-layout-${key}` : `demo-design-${key}`);

  const body = (
    <>
      <section className="demo-design-dir__section demo-design-dir__section--band-b py-16 sm:py-20" id={sid("axis")}>
        <div className="demo-design-dir__shell">
          <p className="demo-design-dir__kicker">1. Vienā ass</p>
          <h2 className="demo-design-dir__title mt-2 max-w-[48rem]">Tas pats max-platums + tā pati ass</h2>
          <p className="demo-design-dir__body mt-3 max-w-[40rem]">
            {`Visi bloki zemāk ir iekš \`demo-design-dir__shell\` — tas ir vizuālais priekšstats par vienu satura kolonnu ar vienādu horizontālo nobīdi visā garumā.`}
          </p>
          <div className="relative mt-10 rounded-2xl border border-white/[0.07] bg-black/25 py-12">
            <div className="demo-design-dir__axis-line opacity-100" aria-hidden />
            <p className="relative z-[1] text-center text-[13px] text-white/50">Ass — šī vertikālā līnija paliek tajā pašā vietā</p>
          </div>
        </div>
      </section>

      <section className="demo-design-dir__section demo-design-dir__section--band-c py-16 sm:py-20" id={sid("signals")}>
        <div className="demo-design-dir__shell">
          <p className="demo-design-dir__kicker">2. Trīs dažādi signāli</p>
          <h2 className="demo-design-dir__title mt-2 max-w-[48rem]">Viens ikonu stils · trīs metafors</h2>
          <div className="mt-10 grid gap-8 lg:grid-cols-3">
            <div className="demo-design-dir__card p-6 text-center">
              <p className="demo-design-dir__kicker text-[9px]">Plūsma</p>
              <div className="mt-5">
                <div className="demo-design-dir__flow" aria-hidden>
                  <div className="demo-design-dir__flow-node">
                    <Database {...iconProps} />
                  </div>
                  <div className="demo-design-dir__flow-bar">
                    <div className="demo-design-dir__flow-pulse" />
                  </div>
                  <div className="demo-design-dir__flow-node">
                    <GitMerge {...iconProps} />
                  </div>
                </div>
              </div>
              <p className="demo-design-dir__body mt-5 text-center text-[13px]">
                Mezgli un līnija — „avoti savienojas”. Tas pats līnijas biezums un zilā akcenta mērens spīdums.
              </p>
            </div>
            <div className="demo-design-dir__card p-6 text-center">
              <p className="demo-design-dir__kicker text-[9px]">Slāņi</p>
              <div className="mt-6 flex justify-center" aria-hidden>
                <div className="demo-design-dir__layer-stack">
                  <div className="demo-design-dir__layer" />
                  <div className="demo-design-dir__layer" />
                  <div className="demo-design-dir__layer" />
                </div>
              </div>
              <p className="demo-design-dir__body mt-6 text-center text-[13px]">
                Trīs slāņi — „vairāki datu līmeņi kļūst par vienu secīgu secību”. Tīra ģeometrija, bez jaunām ikonām.
              </p>
            </div>
            <div className="demo-design-dir__card p-6 text-center">
              <p className="demo-design-dir__kicker text-[9px]">Signāls</p>
              <div className="mt-6 flex justify-center">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-[#0066ff]/30 bg-[#0066ff]/10 text-[#8ec0ff] shadow-[0_0_24px_rgba(0,102,255,0.15)]">
                  <Shield {...iconProps} className="h-5 w-5" aria-hidden />
                </div>
              </div>
              <p className="demo-design-dir__body mt-5 text-center text-[13px]">
                Apļa „statuss” — „kvalitāte / pārbaude / noslēgums”. Tā pati apmales valoda kā citām kartītēm.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="demo-design-dir__section demo-design-dir__section--band-a py-16 sm:py-20" id={sid("grid")}>
        <div className="demo-design-dir__shell">
          <p className="demo-design-dir__kicker">3. Vienots režģis</p>
          <h2 className="demo-design-dir__title mt-2 max-w-[48rem]">Moduļu režģis ar vienādu kartiņu hromu</h2>
          <p className="demo-design-dir__body mt-3 max-w-[40rem]">
            Blīvs, bet vienots: tās pašas malas, ēnas un iekšējās atstarpes — vieglāk skenēt nekā dažādu „kastīšu”
            jaukums.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { Icon: Database, label: "Avoti" },
              { Icon: LineChart, label: "Korelācija" },
              { Icon: Layers, label: "Slāņošana" },
              { Icon: GitMerge, label: "Savienojums" },
              { Icon: Shield, label: "Risks" },
              { Icon: MessageCircle, label: "Konsultācija" },
            ].map(({ Icon, label }) => (
              <div key={label} className="demo-design-dir__card flex flex-col gap-3 p-5 sm:p-6">
                <Icon className="h-6 w-6 text-[#6ba8ff]" strokeWidth={1.5} aria-hidden />
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/88">{label}</p>
                <p className="demo-design-dir__body text-[13px] leading-relaxed">
                  Īss parauga teksts kartītei — tas pats tips, tā pati līnija, cits ikonas motīvs.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="demo-design-dir__section demo-design-dir__section--band-b py-16 sm:py-20" id={sid("editorial")}>
        <div className="demo-design-dir__shell">
          <p className="demo-design-dir__kicker">4. Viena lasīšanas kolonna</p>
          <h2 className="demo-design-dir__title mt-2 max-w-[48rem]">Bez zig-zag: abi bloki centrā, šauri</h2>
          <div className="mx-auto mt-10 max-w-[36rem] space-y-10 text-left">
            <div>
              <h3 className="text-[15px] font-semibold uppercase tracking-[0.08em] text-white/90">Bloks A</h3>
              <p className="demo-design-dir__body mt-3">
                Garāka rindkopa demonstrācijai — tā pati kolonna, tā pati līnijas garums, lai acs neslēdz „režīmu” starp
                sadaļām. Šeit nav īstā mājaslapas satura; tas ir tikai kompozīcijas paraugs.
              </p>
            </div>
            <div>
              <h3 className="text-[15px] font-semibold uppercase tracking-[0.08em] text-white/90">Bloks B</h3>
              <p className="demo-design-dir__body mt-3">
                Otrs bloks ar tādu pašu līdzināšanu un platumu — mazāka kognitīvā slodze nekā pārmaiņus kreisā /
                labā / centrā līdzinājumiem vienā lapā.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="demo-design-dir__section demo-design-dir__section--band-c py-16 sm:py-20" id={sid("faq")}>
        <div className="demo-design-dir__shell">
          <p className="demo-design-dir__kicker">5. BUJ hroms = kartes hroms</p>
          <h2 className="demo-design-dir__title mt-2 max-w-[48rem]">Tās pašas robežas kā režģa kartītēm</h2>
          <div className="mx-auto mt-10 flex max-w-[40rem] flex-col gap-2">
            {["Jautājums A", "Jautājums B", "Jautājums C", "Jautājums D"].map((q) => (
              <div key={q} className="demo-design-dir__faq-row">
                <span className="text-[13px] font-medium text-white/85">{q}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/25" aria-hidden />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="demo-design-dir__section border-t border-white/[0.06] py-14" id={sid("outro")}>
        <div className="demo-design-dir__shell flex flex-col items-center gap-4 text-center">
          <p className="demo-design-dir__body max-w-[32rem] text-[13px]">
            Ja šis virziens der, to var pārnest uz īsto lapu ar taviem noteikumiem: tekstu nemainot, sliedi nemainot,
            vizuālos motīvus atkārtojot pa soļiem.
          </p>
          {embedded ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-white/12 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75 transition hover:border-white/25 hover:text-white"
              >
                <ArrowDown className="h-3.5 w-3.5 rotate-[-90deg]" aria-hidden />
                Atpakaļ uz produkcijas sākumu
              </Link>
              <a
                href="#demo-studio-intro"
                className="inline-flex items-center gap-2 rounded-full border border-white/12 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75 transition hover:border-white/25 hover:text-white"
              >
                <ArrowDown className="h-3.5 w-3.5 rotate-180" aria-hidden />
                Uz studijas ievadu
              </a>
            </div>
          ) : (
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/12 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/75 transition hover:border-white/25 hover:text-white"
            >
              <ArrowDown className="h-3.5 w-3.5 rotate-[-90deg]" aria-hidden />
              Atpakaļ uz produkcijas sākumu
            </Link>
          )}
        </div>
      </section>
    </>
  );

  if (embedded) {
    return (
      <div className="demo-design-dir min-w-0 pb-20 pt-2 text-white sm:pt-4">
        <div
          id="demo-studio-layout"
          className="scroll-mt-[max(0.35rem,env(safe-area-inset-top,0px)+2.75rem)] lg:scroll-mt-24"
        >
          <DesignDirectionHeroIntro sectionId="demo-studio-layout-hero" />
          {body}
        </div>
      </div>
    );
  }

  return (
    <div className="demo-design-dir min-w-0 pb-24 pt-6 text-white sm:pt-10">
      <DesignDirectionHeroIntro sectionId="demo-design-hero" />
      {body}
    </div>
  );
}
