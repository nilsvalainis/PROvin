"use client";

import { useEffect, useRef } from "react";
import { clearFormDraft, loadFormDraft, saveFormDraft, type FormDraftEnvelope } from "@/lib/form-draft-storage";

const AUTOSAVE_DEBOUNCE_MS = 600;

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Ielādē vienreiz (atveroties logam) saglabātu melnrakstu - lietotājs pats izvēlas atjaunot. */
export function readFormDraftOnce<T>(key: string): FormDraftEnvelope<T> | null {
  const storage = browserStorage();
  if (!storage) return null;
  return loadFormDraft<T>(storage, key);
}

export function clearFormDraftNow(key: string): void {
  const storage = browserStorage();
  if (!storage) return;
  clearFormDraft(storage, key);
}

/** Debounsēts autosave uz localStorage, kamēr `enabled` (piem. logs vaļā). */
export function useFormDraftAutosave<T>(key: string, value: T, enabled: boolean): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const storage = browserStorage();
    if (!storage) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveFormDraft(storage, key, value), AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key, value, enabled]);
}
