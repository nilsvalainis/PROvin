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
      className={`flex flex-col gap-8 sm:gap-9 lg:flex-row lg:items-stretch lg:gap-10 xl:gap-12 ${
        reverse ? "lg:flex-row-reverse" : ""
      }`}
    >
      <div className="flex w-full min-w-0 flex-1 justify-center px-2 sm:px-0 lg:items-center">
        <div className="flex w-full max-w-xl flex-col justify-center">{children}</div>
      </div>
      <div className="flex w-full flex-1 items-center justify-center px-2 sm:px-0 lg:justify-center">
        <IrissYoutubePreview videoId={videoId} startSeconds={startSeconds} playLabel={playLabel} />
      </div>
    </div>
  );
}
