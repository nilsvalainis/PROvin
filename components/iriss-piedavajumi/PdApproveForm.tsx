"use client";

import { useState } from "react";

/** Klienta «Apstiprināt» (Q17: klients tikai apstiprina). Bez piesaistīta klienta prasa vārdu un tālruni. */
export function PdApproveForm({ token, needsContact }: { token: string; needsContact: boolean }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function approve() {
    setErr("");
    if (needsContact && (name.trim().length < 2 || phone.replace(/\D/g, "").length < 6)) {
      setErr("Ievadiet vārdu un tālruni.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/iriss-piedavajums/respond", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, name, phone }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (data.ok) setDone(true);
      else if (data.error === "closed") setErr("Piedāvājums vairs nav spēkā.");
      else if (data.error === "contact") setErr("Ievadiet vārdu un tālruni.");
      else setErr("Neizdevās nosūtīt. Mēģiniet vēlreiz.");
    } catch {
      setErr("Neizdevās nosūtīt. Mēģiniet vēlreiz.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <div className="pdc-done">Paldies! Piedāvājums apstiprināts - sazināsimies ar Jums.</div>;
  return (
    <div className="pdc-noprint" style={{ marginTop: 14 }}>
      {needsContact ? (
        <div className="pd-grid2">
          <div className="pd-fld">
            <label htmlFor="pd-name">Vārds, uzvārds</label>
            <input id="pd-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
          <div className="pd-fld">
            <label htmlFor="pd-phone">Tālrunis</label>
            <input id="pd-phone" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" />
          </div>
        </div>
      ) : null}
      {err ? <p className="pd-err" role="alert">{err}</p> : null}
      <button type="button" className="pd-btn p lg" style={{ width: "100%", marginTop: 8 }} disabled={busy} onClick={approve}>
        {busy ? "Sūta..." : "Apstiprināt"}
      </button>
    </div>
  );
}
