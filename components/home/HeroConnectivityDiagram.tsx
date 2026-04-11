"use client";

import { FileText, Globe2, MessageCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

export type HeroDiagramNode = { id: string; title: string; body: string };

const ICONS: LucideIcon[] = [FileText, Globe2, TriangleAlert, MessageCircle];

type Corner = "tl" | "tr" | "bl" | "br";

function wirePathD(cx: number, cy: number, nx: number, ny: number, corner: Corner): string {
  if (corner === "tl" || corner === "tr") {
    const ex = corner === "tl" ? nx + (cy - ny) : nx + (ny - cy);
    return `M ${cx} ${cy} L ${ex} ${cy} L ${nx} ${ny}`;
  }
  const ey = corner === "bl" ? ny - (cx - nx) : ny - (nx - cx);
  return `M ${cx} ${cy} L ${cx} ${ey} L ${nx} ${ny}`;
}

function DiagramNode({
  corner,
  node,
  Icon,
  nodeRef,
}: {
  corner: Corner;
  node: HeroDiagramNode;
  Icon: LucideIcon;
  nodeRef: React.RefObject<HTMLDivElement | null>;
}) {
  const align =
    corner === "tl" || corner === "bl"
      ? "items-start text-left"
      : "items-end text-right";

  return (
    <div
      ref={nodeRef}
      className={`home-hero-diagram-ink flex max-w-[11.5rem] flex-col gap-1.5 ${align} sm:max-w-[13rem]`}
    >
      <Icon className="h-5 w-5 shrink-0" strokeWidth={1.35} aria-hidden />
      <p className="font-mono text-[9px] font-medium uppercase tracking-[0.12em] opacity-90">{node.id}</p>
      <h3 className="text-[12px] font-bold leading-snug tracking-tight">{node.title}</h3>
      <p className="home-hero-diagram-muted max-w-[13rem] text-[10px] font-normal leading-snug">
        {node.body}
      </p>
    </div>
  );
}

export function HeroConnectivityDiagram({ nodes, children }: { nodes: HeroDiagramNode[]; children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<HTMLDivElement>(null);
  const trRef = useRef<HTMLDivElement>(null);
  const blRef = useRef<HTMLDivElement>(null);
  const brRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<[string, string, string, string]>(["", "", "", ""]);
  const [vb, setVb] = useState({ w: 400, h: 700 });

  useLayoutEffect(() => {
    const recalc = () => {
      const root = containerRef.current;
      const c = centerRef.current;
      const refs = [tlRef, trRef, blRef, brRef] as const;
      const corners: Corner[] = ["tl", "tr", "bl", "br"];
      if (!root || !c) return;
      const rb = root.getBoundingClientRect();
      setVb({ w: Math.max(1, rb.width), h: Math.max(1, rb.height) });
      const cx = c.getBoundingClientRect().left + c.getBoundingClientRect().width / 2 - rb.left;
      const cy = c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2 - rb.top;
      const next: string[] = [];
      for (let i = 0; i < 4; i++) {
        const el = refs[i].current;
        if (!el) {
          next.push("");
          continue;
        }
        const nb = el.getBoundingClientRect();
        const nx = nb.left + nb.width / 2 - rb.left;
        const ny = nb.top + nb.height / 2 - rb.top;
        next.push(wirePathD(cx, cy, nx, ny, corners[i]));
      }
      setPaths([next[0]!, next[1]!, next[2]!, next[3]!]);
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    const root = containerRef.current;
    if (root) ro.observe(root);
    if (centerRef.current) ro.observe(centerRef.current);
    [tlRef, trRef, blRef, brRef].forEach((r) => {
      if (r.current) ro.observe(r.current);
    });
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc);
    };
  }, [nodes]);

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-[min(100%,72rem)] flex-1 px-1 sm:px-3">
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        viewBox={`0 0 ${vb.w} ${vb.h}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        aria-hidden
      >
        {paths.map(
          (d, i) =>
            d && (
              <path
                key={i}
                d={d}
                className="home-hero-diagram-stroke"
                strokeWidth={0.65}
                strokeDasharray="2 4"
                strokeLinecap="butt"
                vectorEffect="non-scaling-stroke"
              />
            ),
        )}
      </svg>

      <div className="relative z-10 mx-auto grid min-h-[min(74svh,48rem)] w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] gap-x-2 gap-y-2 pt-1 sm:min-h-[min(80svh,54rem)] sm:gap-x-4 sm:gap-y-4 sm:pt-2">
        <div className="col-start-1 row-start-1 justify-self-start">
          {nodes[0] ? (
            <DiagramNode corner="tl" node={nodes[0]} Icon={ICONS[0] ?? FileText} nodeRef={tlRef} />
          ) : null}
        </div>
        <div className="col-start-3 row-start-1 justify-self-end">
          {nodes[1] ? (
            <DiagramNode corner="tr" node={nodes[1]} Icon={ICONS[1] ?? FileText} nodeRef={trRef} />
          ) : null}
        </div>

        <div
          ref={centerRef}
          className="col-start-2 row-start-2 flex min-h-0 w-full min-w-0 max-w-[min(100%,53.76rem)] flex-col items-center justify-center justify-self-center px-1 py-2 sm:px-2 sm:py-4"
        >
          {children}
        </div>

        <div className="col-start-1 row-start-3 justify-self-start self-end">
          {nodes[2] ? (
            <DiagramNode corner="bl" node={nodes[2]} Icon={ICONS[2] ?? FileText} nodeRef={blRef} />
          ) : null}
        </div>
        <div className="col-start-3 row-start-3 justify-self-end self-end">
          {nodes[3] ? (
            <DiagramNode corner="br" node={nodes[3]} Icon={ICONS[3] ?? FileText} nodeRef={brRef} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
