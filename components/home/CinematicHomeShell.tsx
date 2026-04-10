"use client";

import type { ReactNode } from "react";
import { AutoWireframeEngine } from "@/components/home/AutoWireframeEngine";
import { CinematicHomeProvider } from "@/components/home/cinematic-home-context";
import { HomeProcessRail } from "@/components/home/HomeProcessRail";
import { SilverWashSpotlight } from "@/components/home/SilverWashSpotlight";

export function CinematicHomeShell({ children }: { children: ReactNode }) {
  return (
    <CinematicHomeProvider>
      <div className="relative isolate min-w-0 bg-[#050505]">
        <AutoWireframeEngine />
        <SilverWashSpotlight />
        <HomeProcessRail />
        <div className="relative z-10 min-w-0">{children}</div>
      </div>
    </CinematicHomeProvider>
  );
}
