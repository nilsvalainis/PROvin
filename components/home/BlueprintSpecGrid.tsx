import type { ReactNode } from "react";
import { BlueprintExplodedConnector } from "@/components/home/BlueprintExplodedConnector";

/** 0.5px vertical zone separators (black / 5%). */
export function BlueprintFourColumnRow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`grid w-full grid-cols-1 gap-y-12 lg:grid-cols-4 lg:gap-y-0 ${className}`.trim()}
      role="presentation"
    >
      {children}
    </div>
  );
}

export function BlueprintGridCell({ columnIndex, children }: { columnIndex: number; children: ReactNode }) {
  return (
    <div
      className={`flex min-h-0 flex-col items-center justify-center px-3 sm:px-4 ${
        columnIndex > 0 ? "lg:border-l-[0.5px] lg:border-black/[0.05]" : ""
      }`}
    >
      {children}
    </div>
  );
}

export type BlueprintSpecNodeCopy = {
  refTag: string;
  title: string;
  body: string;
};

/**
 * REF 5px above header; header 11px bold caps; body 10px at 70% ink.
 * columnIndex 0–1: connector to left edge (−20px); 2–3: to right edge (−20px).
 */
export function BlueprintSpecNode({ refTag, title, body, columnIndex }: BlueprintSpecNodeCopy & { columnIndex: number }) {
  const edge = columnIndex < 2 ? "left" : "right";
  return (
    <div className="flex w-full flex-col items-center">
      <div className="flex max-w-[min(100%,30ch)] flex-col items-center text-center">
        <p className="mb-[5px] font-mono text-[7px] font-medium uppercase tracking-[0.06em] text-[#050505]">{refTag}</p>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#050505]">{title}</h3>
        <p className="mt-1.5 text-[10px] font-normal leading-relaxed text-[#050505]/70">{body}</p>
      </div>
      <BlueprintExplodedConnector edge={edge} />
    </div>
  );
}
