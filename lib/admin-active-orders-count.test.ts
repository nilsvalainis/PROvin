import { describe, expect, it } from "vitest";
import { countAdminActiveOrders } from "./admin-active-orders-count";

describe("countAdminActiveOrders", () => {
  it("skaita neizpildītos un kavētos (48 h)", () => {
    const now = 10 * 86400 * 1000;
    const nowSec = now / 1000;
    const r = countAdminActiveOrders(
      [
        { created: nowSec - 3600 },
        { created: nowSec - 3 * 86400 },
        { created: nowSec - 3 * 86400, deadlineFromUnix: nowSec - 3600 },
        { created: nowSec - 5 * 86400, auditComplete: true },
        { created: nowSec - 5 * 86400, isB2bPack: true },
      ],
      now,
    );
    expect(r).toEqual({ activeCount: 3, overdueCount: 1 });
  });
});
