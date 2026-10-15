"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

export function IrissOrderMatchFallback() {
  return <p className="mt-2 text-[12px] text-[var(--color-provin-muted)]">Atbilstības dati nav pieejami.</p>;
}

type Props = { children: ReactNode };
type State = { failed: boolean };

/** Atbilstības / statusa / dublikātu kļūda nedrīkst aizvērt pasūtījuma istabu. */
export class IrissOrderMatchBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(_error: unknown): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* istaba paliek atvērta; detaļas neliekam klientam */
  }

  render() {
    if (this.state.failed) return <IrissOrderMatchFallback />;
    return this.props.children;
  }
}
