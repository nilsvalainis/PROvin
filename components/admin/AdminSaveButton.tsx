"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ADMIN_SAVED_FLASH_MS, adminSaveLabel, isAdminSaveShortcut, type AdminSaveState } from "@/lib/admin-save-state";

/**
 * Saglabāšanas poga visam admin. Aizstāj veco "Saglabāt" + atsevišķo zaļo "Saglabāts".
 * - nesaglabātas izmaiņas: mazs punkts pogā;
 * - saglabā: griežas;
 * - saglabāts: ķeksis ~2 s, tad atpakaļ;
 * - kļūda: sarkana "Mēģināt vēlreiz".
 * `shortcut`: ⌘S / Ctrl+S saglabā (tikai vienai pogai lapā).
 */
export function AdminSaveButton({
  onSave,
  state,
  dirty = false,
  disabled = false,
  label = "Saglabāt",
  size = "md",
  shortcut = false,
  className = "",
}: {
  onSave: () => void;
  state: AdminSaveState;
  dirty?: boolean;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "md";
  shortcut?: boolean;
  className?: string;
}) {
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isAdminSaveShortcut(e)) return;
      e.preventDefault();
      if (!disabled && state !== "saving") saveRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut, disabled, state]);

  const tone =
    state === "saved"
      ? "bg-[#34c759] text-white"
      : state === "error"
        ? "bg-[#ff3b30] text-white"
        : dirty
          ? "bg-[#1a73e8] text-white hover:bg-[#1666d0]"
          : "bg-[#1d1d1f]/[0.06] text-[#1d1d1f] hover:bg-[#1d1d1f]/[0.1]";
  const dims = size === "sm" ? "h-8 px-3 text-[12.5px] gap-1.5" : "h-10 px-4 text-[14px] gap-2";

  return (
    <button
      type="button"
      onClick={() => onSave()}
      disabled={disabled || state === "saving"}
      aria-live="polite"
      title={shortcut ? `${label} (⌘S)` : label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold transition-colors duration-200 disabled:opacity-60 ${dims} ${tone} ${className}`.trim()}
      // Admin tēma visām pogām liek 12px stūrus un rāmi, bet PRO `span` krāsu #000; šeit tas nedrīkst pārrakstīt.
      style={{ borderRadius: 999, border: 0 }}
    >
      {state === "saving" ? (
        <svg viewBox="0 0 24 24" width={size === "sm" ? 14 : 16} height={size === "sm" ? 14 : 16} className="animate-spin" aria-hidden>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
          <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : state === "saved" ? (
        <svg viewBox="0 0 24 24" width={size === "sm" ? 14 : 16} height={size === "sm" ? 14 : 16} aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : dirty && state === "idle" ? (
        <span className="h-1.5 w-1.5 rounded-full bg-current" style={{ color: "inherit" }} aria-hidden />
      ) : null}
      <span style={{ color: "inherit" }}>{adminSaveLabel(state, dirty, label)}</span>
    </button>
  );
}

/**
 * Stāvokļa vadība pogai: `run(async () => …)` → saglabā / saglabāts / kļūda.
 * Funkcija atgriež `false` vai met kļūdu, ja saglabāt neizdevās.
 */
export function useAdminSaveState(): {
  state: AdminSaveState;
  run: (fn: () => Promise<unknown> | unknown) => Promise<boolean>;
  reset: () => void;
} {
  const [state, setState] = useState<AdminSaveState>("idle");
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  const run = useCallback(async (fn: () => Promise<unknown> | unknown) => {
    if (timer.current) window.clearTimeout(timer.current);
    setState("saving");
    try {
      const out = await fn();
      if (out === false) {
        setState("error");
        return false;
      }
      setState("saved");
      timer.current = window.setTimeout(() => setState("idle"), ADMIN_SAVED_FLASH_MS);
      return true;
    } catch {
      setState("error");
      return false;
    }
  }, []);
  const reset = useCallback(() => setState("idle"), []);
  return { state, run, reset };
}

/**
 * Komponentēm, kas jau glabā teksta ziņu ("Saglabāts." / "… neizdevās"): pārvērš to pogas stāvoklī.
 * `busy` = saglabā šobrīd.
 */
export function useSaveMessageState(saveMsg: string | null | undefined, busy: boolean): AdminSaveState {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!saveMsg?.startsWith("Saglabāts")) return;
    setFlash(true);
    const t = window.setTimeout(() => setFlash(false), ADMIN_SAVED_FLASH_MS);
    return () => window.clearTimeout(t);
  }, [saveMsg]);
  if (busy) return "saving";
  if (flash) return "saved";
  if (saveMsg && /neizdev|kļūd/i.test(saveMsg)) return "error";
  return "idle";
}
