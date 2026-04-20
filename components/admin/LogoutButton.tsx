"use client";

type Props = {
  className?: string;
};

export function LogoutButton({ className = "" }: Props) {
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      className={`rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm font-medium text-[var(--color-provin-muted)] transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-[var(--color-apple-text)] md:w-full md:text-center ${className}`}
    >
      Iziet
    </button>
  );
}
