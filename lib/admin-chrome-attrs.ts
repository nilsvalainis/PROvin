export type AdminWorkspaceId = "pro" | "iriss";
export type AdminColorScheme = "light" | "dark";

/** Dataset uz `.admin-m`: IRISS tokeni lasa `data-section` + `data-theme`. */
export function adminChromeDataset(workspace: AdminWorkspaceId, theme: AdminColorScheme) {
  return {
    "data-section": workspace,
    "data-theme": theme,
    "data-admin-theme": theme,
  } as const;
}
