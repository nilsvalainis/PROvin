"use client";

import { IrissStaggerErrorBoundary } from "@/components/iriss/IrissStaggerErrorBoundary";
import { IrissStaggerShell } from "@/components/iriss/IrissStaggerShell";
import { IrissStaggerStaticFallback } from "@/components/iriss/IrissStaggerStaticFallback";

export type IrissStaggerWithBoundaryProps = {
  headingClassName: string;
  bodyClassName: string;
  gapClassName: string;
  block1Heading: string;
  block1Body: string;
  block2Heading: string;
  block2Body: string;
  block3Heading: string;
  block3Body: string;
};

export function IrissStaggerWithBoundary(props: IrissStaggerWithBoundaryProps) {
  return (
    <IrissStaggerErrorBoundary fallback={<IrissStaggerStaticFallback {...props} />}>
      <IrissStaggerShell {...props} />
    </IrissStaggerErrorBoundary>
  );
}
