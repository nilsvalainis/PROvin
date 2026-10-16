import { describe, expect, it } from "vitest";
import { blobEtagIsWeak, blobIfMatchPutFields, normalizeBlobEtag } from "@/lib/blob-etag";
import { WORKSPACE_SAVE_FAILED_LABEL, isWorkspacePersistHardFailure } from "@/lib/admin-workspace-persist-client";

describe("normalizeBlobEtag", () => {
  it("noņem W/ prefiksu, atstāj pēdiņas", () => {
    expect(normalizeBlobEtag('W/"abc123"')).toBe('"abc123"');
    expect(normalizeBlobEtag('w/"abc123"')).toBe('"abc123"');
    expect(normalizeBlobEtag('"abc123"')).toBe('"abc123"');
  });

  it("tukšu un trūkstošu ETag pārvērš par null", () => {
    expect(normalizeBlobEtag("")).toBeNull();
    expect(normalizeBlobEtag("   ")).toBeNull();
    expect(normalizeBlobEtag(null)).toBeNull();
    expect(normalizeBlobEtag(undefined)).toBeNull();
  });

  it("atpazīst vājo ETag", () => {
    expect(blobEtagIsWeak('W/"x"')).toBe(true);
    expect(blobEtagIsWeak('"x"')).toBe(false);
  });

  it("ifMatch lauki lieto tikai stipro ETag", () => {
    expect(blobIfMatchPutFields('W/"abc"')).toEqual({ allowOverwrite: true, ifMatch: '"abc"' });
    expect(blobIfMatchPutFields(null)).toEqual({ allowOverwrite: false });
  });
});

describe("workspace persist failure contract", () => {
  it("rāda Nav saglabāts! un konfliktus neuzskata par veiksmi", () => {
    expect(WORKSPACE_SAVE_FAILED_LABEL).toBe("Nav saglabāts!");
    expect(isWorkspacePersistHardFailure("conditional_write_conflict")).toBe(true);
    expect(isWorkspacePersistHardFailure("write_failed:fs_and_blob")).toBe(true);
    expect(isWorkspacePersistHardFailure("http_500")).toBe(true);
    expect(isWorkspacePersistHardFailure("stale_revision")).toBe(false);
  });
});
