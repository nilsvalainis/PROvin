/** "Izpildīts" saglabāšana no saraksta (vilkšana pa labi, atsaukšana). */
export async function postAdminAuditComplete(sessionId: string, complete: boolean): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/audit-deadline-complete", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, complete }),
    });
    if (res.ok) window.dispatchEvent(new Event("admin-orders-changed"));
    return res.ok;
  } catch {
    return false;
  }
}
