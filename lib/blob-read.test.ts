import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.fn();
vi.mock("@vercel/blob", () => ({ get: (...args: unknown[]) => getMock(...args) }));

import {
  BlobReadFailedError,
  isBlobMissingError,
  isNodeNotFoundError,
  isTransientBlobReadError,
  readPrivateBlobText,
} from "@/lib/blob-read";

describe("blob read error classification", () => {
  it("treats ENOENT as missing, not as a failed read", () => {
    const err = Object.assign(new Error("no such file"), { code: "ENOENT" });
    expect(isNodeNotFoundError(err)).toBe(true);
    expect(isNodeNotFoundError(new Error("EIO"))).toBe(false);
  });

  it("treats BlobNotFound / 404 as missing", () => {
    const named = Object.assign(new Error("The requested blob does not exist"), { name: "BlobNotFoundError" });
    expect(isBlobMissingError(named)).toBe(true);
    expect(isBlobMissingError(Object.assign(new Error("missing"), { statusCode: 404 }))).toBe(true);
  });

  it("does not treat network or etag errors as missing", () => {
    expect(isBlobMissingError(new Error("fetch failed"))).toBe(false);
    expect(isBlobMissingError(new BlobReadFailedError("blob_get_status_500"))).toBe(false);
    const etag = Object.assign(new Error("Precondition failed: ETag mismatch."), {
      name: "BlobPreconditionFailedError",
    });
    expect(isBlobMissingError(etag)).toBe(false);
  });

  it("5xx / tīkls ir pārejoši, etag/4xx nav", () => {
    expect(isTransientBlobReadError(new BlobReadFailedError("Vercel Blob: Failed to fetch blob: 500 Internal Server Error"))).toBe(true);
    expect(isTransientBlobReadError(new BlobReadFailedError("blob_get_status_503"))).toBe(true);
    expect(isTransientBlobReadError(new BlobReadFailedError("blob_get_missing_etag"))).toBe(false);
    expect(isTransientBlobReadError(new BlobReadFailedError("blob_get_status_403"))).toBe(false);
    expect(isTransientBlobReadError(new Error("cits"))).toBe(false);
  });
});

const okRes = (text: string) => ({
  statusCode: 200,
  stream: new Response(text).body,
  blob: { etag: '"e1"' },
});

describe("readPrivateBlobText: pārejoša Blob 500 (pending_http_500, 19.11)", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("vienreiz atkārto un atgriež dokumentu", async () => {
    getMock.mockRejectedValueOnce(new Error("Vercel Blob: Failed to fetch blob: 500 Internal Server Error"));
    getMock.mockResolvedValueOnce(okRes('{"a":1}'));
    const snap = await readPrivateBlobText({ pathname: "x.json", token: "t", retryDelayMs: 0 });
    expect(snap).toMatchObject({ state: "ok", text: '{"a":1}' });
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it("otrā kļūda tiek mesta (nekad tukšs dokuments)", async () => {
    getMock.mockImplementation(async () => {
      throw new Error("Vercel Blob: Failed to fetch blob: 500 Internal Server Error");
    });
    const err = await readPrivateBlobText({ pathname: "x.json", token: "t", retryDelayMs: 0 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BlobReadFailedError);
    expect(getMock).toHaveBeenCalledTimes(2);
  });

  it("404 = missing bez atkārtojuma", async () => {
    getMock.mockRejectedValueOnce(Object.assign(new Error("not found"), { name: "BlobNotFoundError" }));
    expect(await readPrivateBlobText({ pathname: "x.json", token: "t", retryDelayMs: 0 })).toEqual({ state: "missing" });
    expect(getMock).toHaveBeenCalledTimes(1);
  });
});
