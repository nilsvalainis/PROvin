import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { adminAuthConfigured, getAdminSession } from "@/lib/admin-auth";
import { getRequestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const session = await getAdminSession();
  if (session) {
    redirect("/admin");
  }

  const configured = adminAuthConfigured();
  const origin = await getRequestOrigin();
  const adminLoginUrl = `${origin}/admin/login`;
  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 shadow-[0_8px_40px_rgba(15,23,42,0.08)]">
        <header className="mb-6 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">
            PROVIN
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--color-apple-text)]">
            Administrēšana
          </h1>
          <p className="mt-2 text-sm text-[var(--color-provin-muted)]">
            {configured
              ? "Ievadi lietotājvārdu un paroli, lai skatītu pasūtījumus."
              : "Piekļuve pasūtījumu panelim ir iespējama pēc administratora vides iestatīšanas."}
          </p>
        </header>

        {!configured ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold tracking-tight">Vide nav gatava</p>
              <p className="mt-2 leading-relaxed text-amber-950/95">
                Servera vidē jānorāda administratora parametri (kopēj no{" "}
                <code className="rounded bg-amber-100/90 px-1.5 py-0.5 font-mono text-[13px]">
                  .env.example
                </code>
                ):
              </p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-amber-950/95">
                <li>
                  <code className="rounded bg-amber-100/90 px-1 font-mono text-[13px]">ADMIN_SECRET</code> — vismaz
                  16 rakstzīmes (nejauša virkne)
                </li>
                <li>
                  <code className="rounded bg-amber-100/90 px-1 font-mono text-[13px]">ADMIN_USERNAME</code>
                </li>
                <li>
                  <code className="rounded bg-amber-100/90 px-1 font-mono text-[13px]">ADMIN_PASSWORD</code>
                </li>
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-amber-900/85">
                Pēc izmaiņām .env — restartē{" "}
                <code className="rounded bg-amber-100/80 px-1 font-mono">npm run dev</code> vai veic jaunu deploy
                (Vercel).
              </p>
            </div>

            {isDev ? (
              <div className="rounded-lg border border-slate-200/90 bg-slate-50/90 px-3 py-2.5 text-left text-xs leading-relaxed text-[var(--color-provin-muted)]">
                <p className="font-medium text-[var(--color-apple-text)]">Pareizā adrese šajā sesijā</p>
                <a
                  href={adminLoginUrl}
                  className="mt-1 block break-all text-[var(--color-provin-accent)] underline decoration-[var(--color-provin-accent)]/40 underline-offset-2"
                >
                  {adminLoginUrl}
                </a>
                <p className="mt-2 text-[11px] leading-relaxed">
                  Izmanto pilnu adresi ar <code className="rounded bg-slate-200/80 px-1">http://</code> un portu, ko
                  rāda terminālis pēc <code className="rounded bg-slate-200/80 px-1">npm run dev</code> (ja 3000 ir
                  aizņemts — bieži 3001, 3010 utt.).
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-6">
            {isDev ? (
              <div className="rounded-lg border border-slate-200/90 bg-slate-50/90 px-3 py-2.5 text-left text-xs leading-relaxed text-[var(--color-provin-muted)]">
                <p className="font-medium text-[var(--color-apple-text)]">Šīs sesijas pieteikšanās URL</p>
                <a
                  href={adminLoginUrl}
                  className="mt-1 block break-all text-[var(--color-provin-accent)] underline decoration-[var(--color-provin-accent)]/40 underline-offset-2"
                >
                  {adminLoginUrl}
                </a>
                <p className="mt-2 text-[11px] leading-relaxed">
                  Lokāli: ja ports nav 3000, izmanto to, ko izdrukā <code className="rounded bg-slate-200/80 px-1">npm run dev</code>.
                </p>
              </div>
            ) : null}
            <LoginForm />
          </div>
        )}

        <p className="mt-8 text-center text-sm text-[var(--color-provin-muted)]">
          <Link href="/" className="text-[var(--color-provin-accent)] hover:underline">
            Atpakaļ uz sākumlapu
          </Link>
          {" · "}
          <Link href="/en" className="hover:underline">
            EN
          </Link>
        </p>
      </div>
    </div>
  );
}
