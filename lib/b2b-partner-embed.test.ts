import { describe, expect, it } from "vitest";
import {
  embedHostFromUrl,
  isEmbedHostAllowed,
  normalizeEmbedDomain,
  parseB2bPartnerEmbed,
  validateB2bPartnerEmbedInput,
} from "@/lib/b2b-partner-embed";
import { parsePartnerRecord } from "@/lib/b2b-partner-account";

describe("partnera Business pogas domēni", () => {
  it("no ievadītas adreses paliek tikai domēns", () => {
    expect(normalizeEmbedDomain("https://www.Percunbrauc.lv/cars/audi")).toBe("percunbrauc.lv");
    expect(normalizeEmbedDomain("rzautoparks.lv:443")).toBe("rzautoparks.lv");
    expect(normalizeEmbedDomain("nav domēns")).toBe("");
    expect(normalizeEmbedDomain("localhost")).toBe("");
  });

  it("klikšķis der tikai no partnera domēna vai tā apakšdomēna", () => {
    const domains = ["percunbrauc.lv"];
    expect(isEmbedHostAllowed(embedHostFromUrl("https://percunbrauc.lv/cars/x"), domains)).toBe(true);
    expect(isEmbedHostAllowed(embedHostFromUrl("https://www.percunbrauc.lv/cars/x"), domains)).toBe(true);
    expect(isEmbedHostAllowed(embedHostFromUrl("https://ru.percunbrauc.lv/"), domains)).toBe(true);
    expect(isEmbedHostAllowed(embedHostFromUrl("https://percunbrauc.lv.evil.com/"), domains)).toBe(false);
    expect(isEmbedHostAllowed(embedHostFromUrl("https://notpercunbrauc.lv/"), domains)).toBe(false);
    expect(isEmbedHostAllowed(embedHostFromUrl(null), domains)).toBe(false);
    expect(isEmbedHostAllowed(embedHostFromUrl("javascript:alert(1)"), domains)).toBe(false);
  });
});

describe("partnera Business pogas iestatījumi", () => {
  it("bez domēna poga nevar būt ieslēgta", () => {
    expect(parseB2bPartnerEmbed({ enabled: true, domains: [] }).enabled).toBe(false);
    expect(validateB2bPartnerEmbedInput({ enabled: true, domains: "" })).toEqual({ ok: false, error: "domains" });
  });

  it("nederīgu domēnu vai ne-https logo atraida, nevis klusi izmet", () => {
    expect(validateB2bPartnerEmbedInput({ domains: "percunbrauc.lv, ***" })).toEqual({ ok: false, error: "domains" });
    expect(validateB2bPartnerEmbedInput({ domains: "percunbrauc.lv", logoOnDarkUrl: "http://x.lv/l.svg" })).toEqual({
      ok: false,
      error: "logoOnDarkUrl",
    });
  });

  it("derīgu ievadi saglabā sakārtotu", () => {
    const r = validateB2bPartnerEmbedInput({
      enabled: true,
      domains: "https://www.percunbrauc.lv/, percunbrauc.lv\nauto.percunbrauc.lv",
      displayName: " Pērc un brauc ",
      logoOnDarkUrl: "https://percunbrauc.lv/logo.svg",
      buttonTone: "dark",
    });
    expect(r).toEqual({
      ok: true,
      embed: {
        enabled: true,
        domains: ["percunbrauc.lv", "auto.percunbrauc.lv"],
        displayName: "Pērc un brauc",
        logoOnDarkUrl: "https://percunbrauc.lv/logo.svg",
        logoOnLightUrl: "",
        buttonTone: "dark",
      },
    });
  });

  it("veciem partneru ierakstiem poga ir izslēgta", () => {
    const rec = parsePartnerRecord({
      id: "ptr_0123456789abcdef",
      email: "demo@provin.lv",
      passwordHash: "scrypt$a$b",
      status: "active",
      createdAt: "2026-09-04T00:00:00.000Z",
    });
    expect(rec?.businessEmbed.enabled).toBe(false);
    expect(rec?.businessEmbed.domains).toEqual([]);
  });
});
