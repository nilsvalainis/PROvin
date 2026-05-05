"use client";

import { useState } from "react";

type Props = {
  videoId: string;
  /** YouTube embed start time (seconds); matches `...&t=90` in URL. */
  startSeconds?: number;
  playLabel: string;
};

export function IrissYoutubePreview({ videoId, startSeconds, playLabel }: Props) {
  const [playing, setPlaying] = useState(false);
  const thumbSrc = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  const embedParams = new URLSearchParams({ autoplay: "1", rel: "0" });
  if (startSeconds != null) embedParams.set("start", String(startSeconds));
  const embedSrc = `https://www.youtube-nocookie.com/embed/${videoId}?${embedParams}`;

  if (playing) {
    return (
      <div className="relative aspect-video w-full max-w-xl overflow-hidden rounded-xl border border-white/15 bg-black shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
        <iframe
          className="absolute inset-0 h-full w-full"
          src={embedSrc}
          title={playLabel}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={playLabel}
      className="group relative aspect-video w-full max-w-xl cursor-pointer overflow-hidden rounded-xl border border-white/15 bg-black text-left shadow-[0_20px_50px_rgba(0,0,0,0.45)] transition will-change-[border-color] hover:border-provin-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-provin-accent"
      onClick={() => setPlaying(true)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- external YouTube CDN; avoids next/image remotePatterns. */}
      <img
        src={thumbSrc}
        alt=""
        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
        loading="lazy"
        decoding="async"
        width={480}
        height={360}
      />
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover:bg-black/[0.18]"
        aria-hidden
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600/95 text-white shadow-lg transition duration-300 group-hover:scale-105 group-hover:bg-red-600">
          <IconPlayTriangle className="ml-1 h-6 w-6" />
        </span>
      </span>
    </button>
  );
}

function IconPlayTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}
