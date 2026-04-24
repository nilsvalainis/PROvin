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
      className={`inline-flex min-h-[38px] items-center rounded-lg border-0 bg-transparent px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-black shadow-none transition md:w-auto md:text-center ${className}`}
    >
      Iziet
    </button>
  );
}
