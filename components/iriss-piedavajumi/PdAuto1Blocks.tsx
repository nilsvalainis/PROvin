"use client";

import { useState, type ReactNode } from "react";
import { PdPaintMap } from "@/components/iriss-piedavajumi/PdPaintMap";
import {
  IRISS_PD_DAMAGE_AREA_LV,
  irissPdAuto1BlockCount,
  irissPdDamageSummary,
  type IrissPdAuto1Blocks,
  type IrissPdKv,
} from "@/lib/iriss-piedavajumi-auto1";
import { IRISS_PD_BLOCK_IDS, IRISS_PD_BLOCK_LV, type IrissPdBlockId, type IrissPdToggle, type IrissPdVisibility } from "@/lib/iriss-piedavajumi-types";

export type PdToggleTarget = IrissPdBlockId | "group";

export function PdToggle({
  label,
  on,
  disabled,
  onClick,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" role="switch" aria-checked={on} className="pd-tg" disabled={disabled || !onClick} onClick={onClick}>
      <i className="sw" aria-hidden="true" />
      {label}
    </button>
  );
}

export function PdToggles({
  value,
  disabled,
  onToggle,
}: {
  value: IrissPdToggle;
  disabled?: boolean;
  onToggle?: (mode: "pdf" | "link") => void;
}) {
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      <PdToggle label="PDF" on={value.pdf} disabled={disabled} onClick={onToggle ? () => onToggle("pdf") : undefined} />
      <PdToggle label="Saitē" on={value.link} disabled={disabled} onClick={onToggle ? () => onToggle("link") : undefined} />
    </span>
  );
}

function Kv({ rows }: { rows: IrissPdKv[] }) {
  return (
    <div className="pd-zt2">
      {rows.map((r) => (
        <div key={r.label}>
          <span>{r.label}:</span>
          {r.value}
        </div>
      ))}
    </div>
  );
}

function Empty() {
  return <p className="pd-mu" style={{ fontSize: 12, margin: 0 }}>Avota lapā šie dati netika atrasti.</p>;
}

function TechBlock({ rows, limit }: { rows: IrissPdKv[]; limit?: number }) {
  if (!rows.length) return <Empty />;
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <>
      <Kv rows={shown} />
      {limit && rows.length > limit ? <div className="pd-mu" style={{ fontSize: 12, padding: "5px 8px" }}>… +{rows.length - limit}</div> : null}
    </>
  );
}

function EquipmentBlock({ b, limit }: { b: IrissPdAuto1Blocks; limit?: number }) {
  const eq = limit ? b.equipment.slice(0, limit) : b.equipment;
  const hasSide = b.service.length > 0 || b.inspection.length > 0;
  if (!eq.length && !hasSide) return <Empty />;
  const list = (
    <div>
      {eq.map((e) => (
        <div className="pd-eq" key={e.name}>
          <i className="pd-ck" aria-hidden="true">✓</i>
          <b>{e.name}</b>
          <span>{e.detail}</span>
        </div>
      ))}
    </div>
  );
  if (limit || !hasSide) return list;
  return (
    <div className="pd-eqs">
      {list}
      <div>
        {b.service.length ? (
          <>
            <p className="pd-mini-h">Servisa dati</p>
            <div className="pd-kvs">
              {b.service.map((r) => (
                <div key={r.label}>
                  {r.label}
                  <b>{r.value}</b>
                </div>
              ))}
            </div>
          </>
        ) : null}
        {b.inspection.length ? (
          <>
            <p className="pd-mini-h" style={{ marginTop: 12 }}>Tehniskā apskate</p>
            <div className="pd-kvs">
              {b.inspection.map((r) => (
                <div key={r.label}>
                  {r.label}
                  <b>{r.value}</b>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function DamageBlock({ b, summary }: { b: IrissPdAuto1Blocks; summary?: boolean }) {
  if (!b.damage.length) return <Empty />;
  if (summary) {
    return (
      <div className="pd-kvs">
        {irissPdDamageSummary(b.damage).map((s) => (
          <div key={s.area}>
            {IRISS_PD_DAMAGE_AREA_LV[s.area]} · {s.kinds.join(" / ")}
            <b>{s.total}</b>
          </div>
        ))}
      </div>
    );
  }
  let lastArea = "";
  return (
    <>
      <p className="pd-mu" style={{ fontSize: 11, margin: "0 0 6px" }}>Novērtējuma rezultāti apkopoti tabulā un attēloti krāsas kartē.</p>
      <div className="pd-dm-wrap">
        <table className="pd-dm">
          <thead>
            <tr>
              <th>Zona</th>
              <th>Bojājums</th>
              <th>Nopietnība</th>
              <th>Apraksts</th>
              <th>Daudzums</th>
              <th>Ietekmētās daļas</th>
            </tr>
          </thead>
          <tbody>
            {b.damage.map((r, i) => {
              const area = r.area !== lastArea ? IRISS_PD_DAMAGE_AREA_LV[r.area] : "";
              const prev = b.damage[i - 1];
              const dmg = !prev || prev.damage !== r.damage || prev.area !== r.area ? r.damage : "";
              lastArea = r.area;
              return (
                <tr key={i} className={r.area === "interior" ? "in" : undefined}>
                  <td>
                    <b>{area}</b>
                  </td>
                  <td>{dmg}</td>
                  <td>{r.severity || "-"}</td>
                  <td>{r.description || "-"}</td>
                  <td>{r.quantity}</td>
                  <td>{r.parts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function VinBlock({ items, expandAll = false }: { items: string[]; expandAll?: boolean }) {
  const [open, setAll] = useState(false);
  const all = open || expandAll;
  if (!items.length) return <Empty />;
  const LIMIT = 16;
  const shown = all ? items : items.slice(0, LIMIT);
  return (
    <>
      <div className="pd-vin">
        {shown.map((x, i) => (
          <div key={`${i}-${x}`}>
            <i className="pd-ck" aria-hidden="true">✓</i>
            {x}
          </div>
        ))}
      </div>
      {items.length > LIMIT && !expandAll ? (
        <div className="pd-more pdc-noprint">
          <button type="button" onClick={() => setAll((v) => !v)}>
            {all ? "Rādīt mazāk" : `Rādīt vairāk (+${items.length - LIMIT})`}
          </button>
        </div>
      ) : null}
    </>
  );
}

function Block({ id, title, right, children }: { id: IrissPdBlockId; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="pd-a1" data-block={id}>
      <div className="pd-a1h">
        <b>{title}</b>
        {right}
      </div>
      {children}
    </section>
  );
}

/**
 * Auto1 bloki (maketi 05/06). Admins: visi bloki ar PDF/Saitē slēdžiem. Klients: tikai `show` bloki, bez slēdžiem.
 * `compact` - priekšskatījumam (tehniskie dati 6 rindas, bojājumi kopsavilkumā).
 */
export function PdAuto1Blocks({
  blocks,
  show,
  visibility,
  onToggle,
  disabled,
  compact = false,
  expandAll = false,
}: {
  blocks: IrissPdAuto1Blocks;
  show?: Partial<Record<IrissPdBlockId, true>>;
  visibility?: IrissPdVisibility;
  onToggle?: (target: PdToggleTarget, mode: "pdf" | "link") => void;
  disabled?: boolean;
  compact?: boolean;
  /** PDF: visi «Dati pēc VIN» bez «Rādīt vairāk». */
  expandAll?: boolean;
}) {
  const visible = (id: IrissPdBlockId) => (show ? Boolean(show[id]) : irissPdAuto1BlockCount(blocks, id) > 0);
  const right = (id: IrissPdBlockId) =>
    visibility ? (
      <PdToggles value={visibility.blocks[id]} disabled={disabled || (!visibility.group.pdf && !visibility.group.link)} onToggle={onToggle ? (m) => onToggle(id, m) : undefined} />
    ) : null;
  const body: Record<IrissPdBlockId, ReactNode> = {
    paint: blocks.paint ? <PdPaintMap paint={blocks.paint} compact={compact} /> : <Empty />,
    tech: <TechBlock rows={blocks.tech} limit={compact ? 6 : undefined} />,
    equipment: <EquipmentBlock b={blocks} limit={compact ? 4 : undefined} />,
    damage: <DamageBlock b={blocks} summary={compact} />,
    vin: compact ? <p className="pd-mu" style={{ fontSize: 12, margin: 0 }}>{blocks.vinData.length} ieraksti</p> : <VinBlock items={blocks.vinData} expandAll={expandAll} />,
  };
  const ids = IRISS_PD_BLOCK_IDS.filter(visible);
  if (ids.length === 0) return null;
  const twoUp = !compact && visible("paint") && visible("tech");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {twoUp ? (
        <div className="pd-a1-grid">
          <Block id="paint" title={IRISS_PD_BLOCK_LV.paint} right={right("paint")}>
            {body.paint}
          </Block>
          <Block id="tech" title={IRISS_PD_BLOCK_LV.tech} right={right("tech")}>
            {body.tech}
          </Block>
        </div>
      ) : null}
      {(["paint", "tech", "damage", "equipment", "vin"] as const)
        .filter((id) => visible(id) && !(twoUp && (id === "paint" || id === "tech")))
        .map((id) => (
          <Block key={id} id={id} title={IRISS_PD_BLOCK_LV[id]} right={right(id)}>
            {body[id]}
          </Block>
        ))}
    </div>
  );
}
