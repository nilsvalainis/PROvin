"use client";

import { Analytics } from "@vercel/analytics/react";

/** Vercel Web Analytics — darbojas izvietojumā uz Vercel; lokāli parasti neko nenosūta. */
export function SiteVercelAnalytics() {
  return <Analytics />;
}
