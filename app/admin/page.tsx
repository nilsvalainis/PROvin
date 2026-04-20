import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminWorkspaceSwitcherPage() {
  const session = await getAdminSession();
  if (!session) {
    const h = await headers();
    const intended = h.get("x-admin-intended-path")?.trim() || "/admin";
    const safe =
      intended.startsWith("/admin") && !intended.startsWith("/admin/login")
        ? intended
        : "/admin";
    redirect(`/admin/login?next=${encodeURIComponent(safe)}`);
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#FFFFFF] px-6 py-12 font-sans">
      <div className="flex w-full max-w-[min(640px,calc(100vw-3rem))] flex-col items-center justify-center gap-6 sm:flex-row sm:gap-8">
        <Link
          href="/admin/dashboard"
          className="group block w-full max-w-[280px] shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:max-w-none sm:flex-1"
        >
          <div className="flex aspect-square w-full flex-col items-center justify-center rounded-3xl border border-[#E5E7EB] bg-white/75 text-[#000000] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.12),0_8px_16px_-8px_rgba(0,0,0,0.08)] backdrop-blur-md transition-transform duration-200 ease-out will-change-transform group-hover:scale-[1.02] group-active:scale-[0.98]">
            <span className="text-[clamp(2.75rem,11vw,4rem)] font-bold tracking-tight text-[#000000]">PRO</span>
          </div>
        </Link>
        <Link
          href="/admin/iriss"
          className="group block w-full max-w-[280px] shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-black/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:max-w-none sm:flex-1"
        >
          <div className="flex aspect-square w-full flex-col items-center justify-center rounded-3xl border border-[#E5E7EB] bg-white/75 text-[#000000] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.12),0_8px_16px_-8px_rgba(0,0,0,0.08)] backdrop-blur-md transition-transform duration-200 ease-out will-change-transform group-hover:scale-[1.02] group-active:scale-[0.98]">
            <span className="text-[clamp(2.75rem,11vw,4rem)] font-bold tracking-tight text-[#000000]">IRISS</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
