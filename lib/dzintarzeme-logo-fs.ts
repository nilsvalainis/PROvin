import path from "node:path";
import { DZINTARZEME_AUTO_LOGO_FILENAME } from "@/lib/dzintarzeme-logo";

/** Servera ceļš uz logo PNG (bez ēnas). Nav importējams "use client" grafā. */
export function dzintarzemeAutoLogoFsPath(cwd = process.cwd()): string {
  return path.join(cwd, "public", "brands", DZINTARZEME_AUTO_LOGO_FILENAME);
}
