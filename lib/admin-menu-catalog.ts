/**
 * IRISS un PRO telefona sākuma katalogs: visas ikonas un logrīki, ko var likt režģī.
 * Saturs un tiesības nāk no esošajām sadaļām (IRISS: sekcijas; PRO: visiem adminiem).
 */
import type { MenuCatalogItem } from "@/lib/admin-menu-layout";
import { canSeeIrissMobileMenuItem, IRISS_MOBILE_MENU_ITEMS } from "@/lib/iriss-mobile-menu";
import type { IrissSection } from "@/lib/staff-roles";

const LOGISTIKA_TONE = "#1a73e8";

const IRISS_APP_META: Record<string, { icon: string; tone: string; title?: string }> = {
  pasutijumi: { icon: "car", tone: "#3a3f4b" },
  sludinajumi: { icon: "list", tone: "#1a6fe0" },
  radars: { icon: "radar", tone: "#4f4ddb" },
  logistika: { icon: "pin", tone: LOGISTIKA_TONE },
  autoparks: { icon: "warehouse", tone: "#0f8fa8" },
  pavadzimes: { icon: "doc", tone: "#e8590c" },
  vin: { icon: "scan", tone: "#2b2f3a" },
  atskaite: { icon: "chart", tone: "#d6284f" },
  iestatijumi: { icon: "sliders", tone: "#6b7180" },
};

export function irissMenuCatalog(sections: readonly IrissSection[], isAdmin: boolean): MenuCatalogItem[] {
  const allowed = (section: string) =>
    canSeeIrissMobileMenuItem(
      { id: "", href: "", label: "", icon: "pasutijumi", group: 1, section: section as IrissSection },
      sections,
      isAdmin,
    );

  const apps: MenuCatalogItem[] = IRISS_MOBILE_MENU_ITEMS.filter((it) => allowed(it.section)).map((it) => {
    const meta = IRISS_APP_META[it.id] ?? { icon: "list", tone: "#6b7180" };
    return {
      id: it.id,
      kind: "app",
      title: it.label,
      href: it.href,
      sizes: ["app"],
      defaultSize: "app",
      section: it.section,
      icon: meta.icon,
      tone: meta.tone,
      badge: it.badge,
    };
  });

  const widgets: MenuCatalogItem[] = [
    {
      id: "w-logistika",
      kind: "widget",
      title: "Kravas un karte",
      href: "/admin/iriss/logistika",
      sizes: ["S", "M", "L", "app"],
      defaultSize: "M",
      section: "logistika",
      icon: "pin",
      tone: LOGISTIKA_TONE,
    },
    {
      id: "w-pavadzimes",
      kind: "widget",
      title: "Pavadzīmju termiņi",
      href: "/admin/iriss/pavadzimes",
      sizes: ["S", "M", "L", "app"],
      defaultSize: "M",
      rowsBySize: { S: 2, M: 4, L: 6 },
      section: "pavadzimes",
      icon: "doc",
      tone: "#e8590c",
    },
    {
      id: "w-sludinajumi",
      kind: "widget",
      title: "Jauni sludinājumi",
      href: "/admin/iriss/sludinajumi",
      sizes: ["S", "M", "app"],
      defaultSize: "S",
      section: "sludinajumi",
      icon: "list",
      tone: "#1a6fe0",
    },
    {
      id: "w-radars",
      kind: "widget",
      title: "Radara atradumi",
      href: "/admin/iriss/scan",
      sizes: ["S", "M", "app"],
      defaultSize: "S",
      section: "radars",
      icon: "radar",
      tone: "#4f4ddb",
    },
    {
      id: "w-autoparks",
      kind: "widget",
      title: "Autoparka laukums",
      href: "/admin/iriss/autoparks",
      sizes: ["S", "M", "app"],
      defaultSize: "S",
      section: "logistika",
      icon: "warehouse",
      tone: "#0f8fa8",
    },
  ];

  return [...apps, ...widgets.filter((w) => allowed(w.section ?? ""))];
}

export const IRISS_DEFAULT_LAYOUT_IDS = ["w-logistika", "w-pavadzimes", "pasutijumi", "sludinajumi", "radars", "logistika", "pavadzimes", "vin"];

const PRO_APPS: Array<Omit<MenuCatalogItem, "kind" | "sizes" | "defaultSize">> = [
  { id: "pro-pasutijumi", title: "Pasūtījumi", href: "/admin/dashboard", icon: "car", tone: "#1a73e8", badge: "orders" },
  { id: "pro-vin", title: "VIN pārbaude", href: "/admin/vin-scan", icon: "scan", tone: "#2b2f3a" },
  { id: "pro-atrie", title: "Ātrie", href: "/admin/atras-vertesanas", icon: "bolt", tone: "#ff9f0a", badge: "fast" },
  { id: "pro-rits", title: "Rīta kopsavilkums", href: "/admin/kopsavilkums", icon: "sun", tone: "#e0a800" },
  { id: "pro-partneri", title: "Partneri", href: "/admin/partneri", icon: "partners", tone: "#8e3fd1", badge: "partners" },
  { id: "pro-dileri", title: "Demo dīleri", href: "/admin/b2b-demo", icon: "dealers", tone: "#4f4ddb" },
  { id: "pro-izmaksas", title: "Izmaksas", href: "/admin/izmaksas", icon: "wallet", tone: "#23a046" },
  { id: "pro-rekini", title: "Rēķini", href: "/admin/commission-invoice", icon: "euro", tone: "#1795ad" },
  { id: "pro-blogs", title: "Blogs", href: "/admin/blogs", icon: "pen", tone: "#e2551b" },
  { id: "pro-agregati", title: "Agregātu zināšanas", href: "/admin/agregatu-zinasanas", icon: "cog", tone: "#5d636e" },
  { id: "pro-statistika", title: "Statistika", href: "/admin/statistika", icon: "chart", tone: "#e0244f" },
  { id: "pro-teksti", title: "Teksti", href: "/admin/teksti", icon: "msg", tone: "#6c7280" },
];

export function proMenuCatalog(): MenuCatalogItem[] {
  const apps: MenuCatalogItem[] = PRO_APPS.map((a) => ({ ...a, kind: "app", sizes: ["app"], defaultSize: "app" }));
  const widgets: MenuCatalogItem[] = [
    { id: "w-pro-mini", kind: "widget", title: "MINI + auditi", href: "/admin/dashboard", sizes: ["S", "M", "L", "app"], defaultSize: "M", icon: "car", tone: "#1a73e8" },
    { id: "w-pro-dileri", kind: "widget", title: "Dīleru dati gaidīšanā", href: "/admin/dashboard", sizes: ["S", "M", "app"], defaultSize: "S", icon: "dealers", tone: "#4f4ddb" },
    { id: "w-pro-ienemumi", kind: "widget", title: "Šodienas ieņēmumi", href: "/admin/dashboard", sizes: ["S", "M", "app"], defaultSize: "S", icon: "euro", tone: "#1f8f3a" },
    { id: "w-pro-atrie", kind: "widget", title: "Ātrie vērtējumi", href: "/admin/atras-vertesanas", sizes: ["S", "M", "app"], defaultSize: "S", icon: "bolt", tone: "#ff9f0a" },
    { id: "w-pro-rits", kind: "widget", title: "Šodienas plāns", href: "/admin/kopsavilkums", sizes: ["S", "M", "app"], defaultSize: "S", icon: "sun", tone: "#e0a800" },
  ];
  return [...apps, ...widgets];
}

export const PRO_DEFAULT_LAYOUT_IDS = ["w-pro-mini", "w-pro-dileri", "w-pro-ienemumi", "pro-pasutijumi", "pro-atrie", "pro-vin", "pro-rits", "pro-partneri", "pro-dileri", "pro-izmaksas", "pro-rekini", "pro-blogs", "pro-agregati", "pro-statistika", "pro-teksti"];
