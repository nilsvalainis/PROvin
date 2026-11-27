/**
 * eParaksts pārlūka apstiprināšanas koda "pastkastīte" starp HTTP galapunktu un pārlūka plūsmu.
 * Plūsma atver (`open`), kad redz lapu "confirm this browser"; admins iesniedz kodu (`submit`) vai lūdz atkārtot
 * lapu (`renew`); plūsma paņem (`take`) un aizver (`close`). Kods glabājas tikai atmiņā līdz paņemšanai, nekad
 * netiek logots vai saglabāts failā.
 */
import { normalizeBrowserCode } from "./traficom-page.mjs";

export function createBrowserCodeBroker({ now = () => Date.now() } = {}) {
  let waiting = false;
  /** @type {null | { type: "code", code: string } | { type: "renew" }} */
  let pending = null;
  let openedAt = 0;

  return {
    /** Plūsma sāk gaidīt kodu (iepriekšējais neizmantotais tiek izmests). */
    open() {
      waiting = true;
      pending = null;
      openedAt = now();
    },
    close() {
      waiting = false;
      pending = null;
      openedAt = 0;
    },
    isWaiting() {
      return waiting;
    },
    openedAt() {
      return openedAt;
    },
    /** Admins: kods no eParaksts lietotnes. Atgriež { ok } vai { ok:false, error: "not_waiting" | "invalid_code" }. */
    submit(raw) {
      if (!waiting) return { ok: false, error: "not_waiting" };
      const code = normalizeBrowserCode(raw);
      if (!code) return { ok: false, error: "invalid_code" };
      pending = { type: "code", code };
      return { ok: true };
    },
    /** Admins: "Pieprasīt jaunu kodu" - plūsma pārlādē eParaksts lapu (SMS nekad). */
    renew() {
      if (!waiting) return { ok: false, error: "not_waiting" };
      pending = { type: "renew" };
      return { ok: true };
    },
    /** Plūsma: paņem iesniegto (vienreiz). */
    take() {
      const p = pending;
      pending = null;
      return p;
    },
  };
}
