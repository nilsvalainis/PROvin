import { describe, expect, it } from "vitest";

import { AdminManualOrderPaymentPanel } from "@/components/admin/AdminManualOrderPaymentPanel";
import { renderHtml } from "@/lib/test-render";

describe("AdminManualOrderPaymentPanel", () => {
  it("aizņem vietu jau pirms datu ielādes (lapa nelec uz leju, kad dati atnāk)", () => {
    const html = renderHtml(<AdminManualOrderPaymentPanel sessionId="manual_order_1_test" />);
    expect(html).toContain("Apmaksas pieprasījums");
    expect(html).toContain("Izveidot apmaksas saiti");
    // kamēr ielādējas - nevar spiest
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Izveidot apmaksas saiti/);
  });
});
