import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * IRISS dizaina pamats v0.3: kopīgās komponentes. Stili - app/admin/iriss-tokens.css (tokeni --iriss-*).
 * Viena galvenā poga skatā (variant="primary" - IRISS oranžs); statusi neitrāli ar krāsainu punktu.
 */

export type IrissButtonVariant = "primary" | "dark" | "secondary" | "quiet" | "danger" | "danger-outline";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function irissButtonClass(variant: IrissButtonVariant = "secondary", size: "md" | "sm" = "md", extra = ""): string {
  return cx("iriss-btn", `iriss-btn--${variant}`, size === "sm" && "iriss-btn--sm", extra);
}

export function IrissButton({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: IrissButtonVariant; size?: "md" | "sm" }) {
  return <button type={type} className={irissButtonClass(variant, size, className)} {...rest} />;
}

/** Vienotā auto ceļa krāsu grupas: pelēks - nekas nav noticis, zils - procesā, oranžs - gaida, zaļš - gatavs, sarkans - kļūda/atcelts. */
export type IrissStatusTone = "mute" | "info" | "warn" | "ok" | "bad";

export function IrissStatusPill({ tone, children }: { tone: IrissStatusTone; children: ReactNode }) {
  return <span className={`iriss-pill iriss-pill--${tone}`}>{children}</span>;
}

export function IrissChip({
  pressed,
  count,
  onClick,
  children,
}: {
  pressed: boolean;
  count?: number;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="iriss-chip" aria-pressed={pressed} onClick={onClick}>
      {children}
      {count != null ? <span className="iriss-chip__n">{count}</span> : null}
    </button>
  );
}

/** Garie žurnāli un retais saturs - aizvērti pēc noklusējuma (Nils 26.10). */
export function IrissDisclosure({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: ReactNode;
  count?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="iriss-disclosure" open={defaultOpen || undefined}>
      <summary>
        {title}
        {count != null ? <span className="iriss-disclosure__count">{count}</span> : null}
      </summary>
      <div className="iriss-disclosure__body">{children}</div>
    </details>
  );
}
