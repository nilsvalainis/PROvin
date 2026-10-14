"use client";

import { useMemo } from "react";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import {
  buildCountryTimelineSegments,
  countryTimelineSegmentWeights,
} from "@/lib/admin-pro-overview-bars";
import { buildCountryTimeline } from "@/lib/vehicle-country-timeline";
import { collectWorkspaceCountryTimeline } from "@/lib/workspace-country-timeline";

const SEGMENT_SHADES = ["#1d1d1f", "#48484a", "#6e6e73", "#8e8e93", "#aeaeb2"] as const;

/** Valstu laika josla no jau ievadītajiem avotiem. Tikai attēlošana. */
export function AdminOrderCountryTimelineStrip({ sourceBlocks }: { sourceBlocks: WorkspaceSourceBlocks }) {
  const segments = useMemo(
    () => buildCountryTimelineSegments(buildCountryTimeline(collectWorkspaceCountryTimeline(sourceBlocks))),
    [sourceBlocks],
  );
  const weights = useMemo(() => countryTimelineSegmentWeights(segments), [segments]);

  return (
    <section className="provin-timeline-strip" aria-label="Laika josla, visi avoti">
      <p className="provin-timeline-label">Laika josla · visi avoti</p>
      {segments.length === 0 ? (
        <p className="provin-timeline-empty">Avotos vēl nav datumu ar valsti.</p>
      ) : (
        <div className="provin-timeline-track">
          {segments.map((s, i) => (
            <div
              key={`${s.country}-${s.startMs}`}
              className="provin-timeline-seg"
              style={{ flexGrow: weights[i] ?? 1 }}
              title={`${s.country}: ${s.yearLabel}`}
            >
              <span
                className="provin-timeline-bar"
                style={{ background: SEGMENT_SHADES[Math.min(i, SEGMENT_SHADES.length - 1)] }}
                aria-hidden
              />
              <span className="provin-timeline-text">
                <span className="provin-timeline-country">{s.country}</span>
                <span className="provin-timeline-years">{s.yearLabel}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
