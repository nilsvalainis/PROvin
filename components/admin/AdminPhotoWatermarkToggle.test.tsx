import { describe, expect, it } from "vitest";

import { AdminPhotoWatermarkToggle } from "@/components/admin/AdminPhotoWatermarkToggle";
import { renderHtml } from "@/lib/test-render";

describe("AdminPhotoWatermarkToggle", () => {
  it("noklusējumā rāda izslēgtu Slēpt ūdenszīmi izvēles rūtiņu", () => {
    const html = renderHtml(<AdminPhotoWatermarkToggle checked={false} onChange={() => undefined} />);
    expect(html).toContain("Slēpt ūdenszīmi");
    expect(html).toContain('type="checkbox"');
    expect(html).not.toMatch(/\schecked(=|\s|>)/);
  });

  it("ieslēgtā stāvoklī rūtiņa ir atzīmēta", () => {
    const html = renderHtml(<AdminPhotoWatermarkToggle checked={true} onChange={() => undefined} />);
    expect(html).toMatch(/\schecked(=|\s|>)/);
  });
});
