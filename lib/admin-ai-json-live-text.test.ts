import { describe, expect, it } from "vitest";
import {
  extractPartialJsonBoolean,
  extractPartialJsonString,
  liveAdminCommentFromPartialJson,
} from "@/lib/admin-ai-json-live-text";

describe("liveAdminCommentFromPartialJson", () => {
  it("extracts an in-progress comments string without dumping raw JSON", () => {
    const partial = `{ "listedForSale": "12", "comments": "Tirgū auto stāv **12** dienas`;
    expect(liveAdminCommentFromPartialJson(partial)).toBe("Tirgū auto stāv **12** dienas");
  });

  it("prefers comments over letter/text", () => {
    const raw = `{ "text": "ignored", "letter": "Sveiki!", "comments": "Tirgus." }`;
    expect(liveAdminCommentFromPartialJson(raw)).toBe("Tirgus.");
  });

  it("unescapes newlines in JSON strings", () => {
    expect(extractPartialJsonString(`{"letter":"A\\nB"}`, "letter")).toBe("A\nB");
  });

  it("reads booleans from partial JSON", () => {
    expect(extractPartialJsonBoolean(`{"closer": true, "letter": "x`, "closer")).toBe(true);
  });
});
