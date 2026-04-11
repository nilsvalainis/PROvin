"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; fallback: ReactNode };

/**
 * Ja pavediena SVG/rAF kādā vidē salūzt, pārējā lapa paliek dzīva.
 */
export class IrissStaggerErrorBoundary extends Component<Props, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    /* var logot production monitoringā pēc vajadzības */
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
