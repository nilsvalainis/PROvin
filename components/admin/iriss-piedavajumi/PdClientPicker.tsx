"use client";

import { useMemo, useState } from "react";
import { filterIrissPdClientOptions, type IrissPdClientOption } from "@/lib/iriss-piedavajumi";
import type { IrissPdClient } from "@/lib/iriss-piedavajumi-types";

/**
 * Klients piedāvājumam (Nils 30.10: «abi»): izvēle no esošajiem pasūtījumiem vai jauns klients bez pasūtījuma
 * (vārds + telefons + e-pasts). Ieteikumi ir saraksts zem lauka lapas plūsmā (nevis pārklājums).
 */
export function PdClientPicker({
  value,
  options,
  disabled,
  onChange,
}: {
  value: IrissPdClient;
  options: IrissPdClientOption[];
  disabled: boolean;
  onChange: (c: IrissPdClient) => void;
}) {
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => filterIrissPdClientOptions(options, value.name), [options, value.name]);
  const free = !value.orderId && value.name.trim() !== "";
  return (
    <div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          id="pd-client"
          value={value.name}
          disabled={disabled}
          placeholder="Izvēlies pasūtījuma klientu vai ieraksti jaunu"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(e) => onChange({ name: e.target.value, phone: value.orderId ? "" : value.phone, email: value.orderId ? "" : value.email, orderId: "" })}
        />
        {value.name && !disabled ? (
          <button type="button" className="pd-btn" aria-label="Noņemt klientu" onClick={() => onChange({ name: "", phone: "", email: "", orderId: "" })}>
            ×
          </button>
        ) : null}
      </div>
      {open && !disabled && matches.length > 0 ? (
        <div className="pde-sugg" role="listbox">
          {matches.map((o) => (
            <button
              type="button"
              key={o.orderId}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({ name: o.name, phone: o.phone, email: o.email, orderId: o.orderId });
                setOpen(false);
              }}
            >
              <span className="pd-el">{o.name}</span>
              <span className="pd-mu pd-el">{o.sub}</span>
            </button>
          ))}
        </div>
      ) : null}
      {value.orderId ? (
        <p className="pd-mu" style={{ marginTop: 4, fontSize: 12 }}>
          Piesaistīts pasūtījumam{value.phone ? ` · ${value.phone}` : ""}
        </p>
      ) : free ? (
        // Jauns klients bez pasūtījuma - kontakti, lai piedāvājumu var nosūtīt.
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
          <input
            aria-label="Klienta telefons"
            placeholder="Telefons"
            inputMode="tel"
            value={value.phone}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
          />
          <input
            aria-label="Klienta e-pasts"
            placeholder="E-pasts"
            inputMode="email"
            value={value.email}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
          />
        </div>
      ) : null}
    </div>
  );
}
