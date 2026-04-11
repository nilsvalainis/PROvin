import type { ReactNode } from "react";

/**
 * Lenis smooth scroll īslaicīgi izslēgts — tas + ritināšanas slāņi bija saistīti ar klienta avārijām.
 * Kad viss stabils, šeit var atkal pievienot `useEffect` + `import("lenis")` kā iepriekš.
 */
export function LenisProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
