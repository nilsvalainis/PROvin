"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Nils 29.10 «kārtojot uzmet Application error»: kļūda kravu plānā vairs nenogāž visu Loģistikas lapu -
 * paliek karte un saraksts, kravu blokā poga «Pārlādēt».
 */
export class CargoPlanBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[iriss-logistika] kravu plāna kļūda", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <aside className="iriss-log-cargo-card" role="alert">
        <div className="px-3.5 py-3 text-[13px]">
          <p className="font-semibold">Kravu plānu neizdevās attēlot.</p>
          <p className="mt-1 text-[12px] text-[var(--iriss-ink-2)]">Izmaiņas ir saglabātas serverī. Pārlādē, lai turpinātu.</p>
          <button type="button" className="mt-2 rounded-full border border-[var(--iriss-line)] bg-white px-3 py-1.5 text-[12.5px] font-semibold" onClick={() => window.location.reload()}>
            Pārlādēt
          </button>
        </div>
      </aside>
    );
  }
}
