"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IRISS_UNSAVED_CHANGES_CANCEL,
  IRISS_UNSAVED_CHANGES_LEAVE,
  IRISS_UNSAVED_CHANGES_SAVE,
  IRISS_UNSAVED_CHANGES_TITLE,
  irissInternalAdminHref,
} from "@/lib/iriss-unsaved-changes";
import type { IrissOrderSaveResult } from "@/lib/iriss-order-section-save";

const dialogBtn =
  "inline-flex h-10 min-h-10 items-center justify-center rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-[12.5px] font-semibold text-[#111827] shadow-[0_1px_2px_#0000000d] transition hover:bg-[#f9fafb] disabled:opacity-40";

const dialogBtnPrimary =
  "inline-flex h-10 min-h-10 items-center justify-center rounded-[10px] border border-[#2563eb] bg-[#2563eb] px-3 text-[12.5px] font-semibold text-white shadow-[0_1px_2px_#0000000d] transition hover:brightness-105 disabled:opacity-40";

export function IrissUnsavedChangesGuard({
  dirty,
  onSave,
}: {
  dirty: boolean;
  onSave: () => Promise<IrissOrderSaveResult>;
}) {
  const router = useRouter();
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const bypassRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const pendingHref = useRef<string | null>(null);
  const pendingBack = useRef(false);

  const leave = useCallback(() => {
    bypassRef.current = true;
    const href = pendingHref.current;
    const back = pendingBack.current;
    pendingHref.current = null;
    pendingBack.current = false;
    setOpen(false);
    if (href) {
      router.push(href);
      return;
    }
    if (back) {
      router.back();
    }
  }, [router]);

  const confirmSave = useCallback(async () => {
    setBusy(true);
    const result = await onSave();
    setBusy(false);
    if (!result.ok) return;
    leave();
  }, [leave, onSave]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current || bypassRef.current) return;
      e.preventDefault();
      e.returnValue = IRISS_UNSAVED_CHANGES_TITLE;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || bypassRef.current) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      const a = target.closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = irissInternalAdminHref(a.getAttribute("href") ?? "");
      if (!href) return;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (href === current) return;
      e.preventDefault();
      e.stopPropagation();
      pendingHref.current = href;
      pendingBack.current = false;
      setOpen(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onPop = () => {
      if (!dirtyRef.current || bypassRef.current) return;
      history.pushState({ irissUnsaved: 1 }, "", window.location.href);
      pendingHref.current = null;
      pendingBack.current = true;
      setOpen(true);
    };
    history.pushState({ irissUnsaved: 1 }, "", window.location.href);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [dirty]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0f172a66] p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="iriss-unsaved-title"
        className="w-full max-w-sm rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-xl"
      >
        <p id="iriss-unsaved-title" className="text-[15px] font-semibold text-[#111827]">
          {IRISS_UNSAVED_CHANGES_TITLE}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" className={dialogBtnPrimary} disabled={busy} onClick={() => void confirmSave()}>
            {busy ? "Saglabā…" : IRISS_UNSAVED_CHANGES_SAVE}
          </button>
          <button type="button" className={dialogBtn} disabled={busy} onClick={leave}>
            {IRISS_UNSAVED_CHANGES_LEAVE}
          </button>
          <button
            type="button"
            className={dialogBtn}
            disabled={busy}
            onClick={() => {
              pendingHref.current = null;
              pendingBack.current = false;
              setOpen(false);
            }}
          >
            {IRISS_UNSAVED_CHANGES_CANCEL}
          </button>
        </div>
      </div>
    </div>
  );
}
