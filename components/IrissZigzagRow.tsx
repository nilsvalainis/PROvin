"use client";

import type { ReactNode } from "react";
import { IrissYoutubePreview } from "@/components/IrissYoutubePreview";

type Props = {
  videoId: string;
  startSeconds?: number;
  reverse?: boolean;
  playLabel: string;
  children: ReactNode;
};

export function IrissZigzagRow({ videoId, startSeconds, reverse, playLabel, children }: Props) {
  return (
    <div
      className={`flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-12 xl:gap-16 ${
        reverse ? "lg:flex-row-reverse" : ""
      }`}
    >
      <div className="flex w-full min-w-0 flex-1 justify-center lg:min-h-[min(28rem,calc((100vw-4rem)*0.42))] lg:items-center">
        <div className="w-full max-w-lg px-2 text-center sm:px-0">{children}</div>
      </div>
      <div className="flex w-full flex-1 justify-center px-2 sm:px-0 lg:justify-center">
        <IrissYoutubePreview videoId={videoId} startSeconds={startSeconds} playLabel={playLabel} />
      </div>
    </div>
  );
}
