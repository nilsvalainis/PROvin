import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Demo — statiskie HTML koncepti (30)",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ locale: string }> };

type ManifestItem = { id: string; n: number; title: string };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

function loadManifest(): ManifestItem[] {
  const file = path.join(process.cwd(), "public", "concept-demos", "manifest.json");
  const raw = fs.readFileSync(file, "utf8");
  return JSON.parse(raw) as ManifestItem[];
}

export default async function StaticConceptsDemoPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  let items: ManifestItem[] = [];
  try {
    items = loadManifest();
  } catch {
    items = [];
  }

  return (
    <div className="min-w-0 bg-[#030304] text-white">
      <div className="sticky top-0 z-[28] border-b border-white/[0.08] bg-[#030304]/92 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-[#030304]/78">
        <div className="mx-auto flex max-w-[min(72rem,calc(100vw-2rem))] flex-wrap items-center gap-3 px-4 sm:px-6">
          <Link
            href="/demo"
            className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/45 transition hover:text-[#7eb6ff]"
          >
            ← Demo studija
          </Link>
          <span className="text-[10px] text-white/25">|</span>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
            Statiskie HTML / CSS / JS · 30 koncepti
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[min(72rem,calc(100vw-2rem))] px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="text-2xl font-semibold tracking-tight text-white/95 sm:text-3xl">Statiskie landing koncepti</h1>
        <p className="mt-4 max-w-[46rem] text-[15px] leading-relaxed text-white/58">
          Katrs atveras kā atsevišķa lapa no <code className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[13px] text-white/75">public/concept-demos/</code>{" "}
          (ceļš vietnē: <code className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[13px] text-white/75">/concept-demos/…</code>). Ģenerators:{" "}
          <code className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[13px] text-white/75">node scripts/generate-concept-demos.mjs</code>
        </p>

        {items.length === 0 ? (
          <p className="mt-8 text-sm text-amber-200/90">
            Nav atrasts <code className="text-white/80">public/concept-demos/manifest.json</code> — palaid ģeneratoru.
          </p>
        ) : (
          <ul className="mt-10 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.id}>
                <a
                  href={`/concept-demos/${item.id}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col rounded-xl border border-white/[0.09] bg-white/[0.03] px-3.5 py-3 transition hover:border-[#0066ff]/35 hover:bg-white/[0.05]"
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    {String(item.n).padStart(2, "0")}
                  </span>
                  <span className="mt-1 text-[13px] font-medium leading-snug text-white/88">{item.title}</span>
                  <span className="mt-2 text-[10px] text-[#7eb6ff]/90">Atvērt jaunā cilnē →</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
