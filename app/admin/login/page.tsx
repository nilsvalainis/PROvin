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

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 shadow-[0_8px_40px_rgba(15,23,42,0.08)]">
        <div className="mb-8 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">
            PROVIN
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--color-apple-text)]">
            Administrēšana
          </h1>
          <p className="mt-2 text-sm text-[var(--color-provin-muted)]">
            Ievadi lietotājvārdu un paroli, lai skatītu pasūtījumus.
          </p>
          <p className="mt-4 break-all rounded-lg bg-slate-50 px-3 py-2 text-left text-xs leading-relaxed text-[var(--color-provin-muted)]">
            <span className="font-medium text-[var(--color-apple-text)]">Pareizā adrese:</span>{" "}
            <a
              href={adminLoginUrl}
              className="text-[var(--color-provin-accent)] underline decoration-[var(--color-provin-accent)]/40 underline-offset-2"
            >
              {adminLoginUrl}
            </a>
            <span className="mt-2 block text-[11px] text-[var(--color-provin-muted)]">
              Izmanto pilnu adresi ar <code className="rounded bg-slate-200/80 px-1">http://</code> un portu, ko
              rāda terminālī pēc <code className="rounded bg-slate-200/80 px-1">npm run dev</code> (ja 3000 ir
              aizņemts, bieži ir 3001, 3010 utt.).
            </span>
          </p>
        </div>

        {!configured ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">Vide nav gatava</p>
            <p className="mt-1 text-amber-900/90">
              Serverī jāiestata <code className="rounded bg-amber-100 px-1">ADMIN_SECRET</code>,{" "}
              <code className="rounded bg-amber-100 px-1">ADMIN_USERNAME</code> un{" "}
              <code className="rounded bg-amber-100 px-1">ADMIN_PASSWORD</code> (skat.{" "}
              <code className="rounded bg-amber-100 px-1">.env.example</code>).
            </p>
          </div>
        ) : (
          <LoginForm />
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
