"use client";

import type { ReactNode } from "react";
import { Component } from "react";

type Props = {
  sessionId: string;
  children: ReactNode;
};

type State = {
  error: Error | null;
};

function clearLocalDraftForSession(sessionId: string): void {
  const keys = [
    `provin-admin-workspace-v3-${sessionId}`,
    `provin-admin-workspace-v2-${sessionId}`,
    `provin-admin-workspace-backup-v1-${sessionId}`,
    `provin-admin-internal-v1-${sessionId}`,
    `provin-admin-order-edits-v1-${sessionId}`,
  ];
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* quota */
    }
  }
}

/**
 * Ja darba zonas renderis avārijas (bojāts lokālais JSON u.c.), neļauj sabrukt visai lapai.
 */
export class AdminOrderWorkspaceErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error.message?.slice(0, 240) || "Nezināma kļūda";
      return (
        <div className="mx-auto max-w-lg rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950 shadow-sm">
          <p className="font-semibold">Neizdevās ielādēt pasūtījuma darba zonu</p>
          <p className="mt-2 text-[12px] leading-snug text-red-900/90">
            Iespējams, pārlūkā ir bojāts saglabātais melnraksts. Vari notīrīt lokālo kopiju un ielādēt no servera
            (ja tāda ir).
          </p>
          <p className="mt-2 font-mono text-[10px] text-red-800/80">{msg}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-900 hover:bg-red-100"
              onClick={() => {
                clearLocalDraftForSession(this.props.sessionId);
                window.location.reload();
              }}
            >
              Notīrīt pārlūka melnrakstu un pārlādēt
            </button>
            <button
              type="button"
              className="rounded-lg border border-red-200 px-3 py-1.5 text-[11px] font-medium text-red-900 hover:bg-red-100/60"
              onClick={() => this.setState({ error: null })}
            >
              Mēģināt vēlreiz
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
