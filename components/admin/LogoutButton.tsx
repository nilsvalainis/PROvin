"use client";

export function LogoutButton() {
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[var(--color-apple-text)] shadow-sm hover:bg-slate-50"
    >
      Iziet
    </button>
  );
}
