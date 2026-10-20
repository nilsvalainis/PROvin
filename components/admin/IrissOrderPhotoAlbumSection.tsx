"use client";

import { IrissOfferImageSorter } from "@/components/admin/IrissOfferImageSorter";
import { IrissOverflowItem, IrissOverflowMenu } from "@/components/admin/IrissOverflowMenu";
import { IRISS_ORDER_PHOTO_ALBUM_LV, type IrissOrderPhotoAlbum, type IrissOrderPhotoAlbumId } from "@/lib/iriss-order-photos";
import { IRISS_MAX_OFFER_ATTACHMENTS, type IrissOfferAttachment } from "@/lib/iriss-pasutijumi-types";

const roomBtn =
  "inline-flex h-10 min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-[12.5px] font-semibold text-[#111827] shadow-[0_1px_2px_#0000000d]";

export function IrissOrderPhotoAlbumSection({
  albumId,
  album,
  onChange,
  onFiles,
  busy = false,
  onCopyToOffer,
}: {
  albumId: IrissOrderPhotoAlbumId;
  album: IrissOrderPhotoAlbum | undefined;
  onChange: (next: IrissOrderPhotoAlbum) => void;
  onFiles?: (files: FileList | null) => void;
  busy?: boolean;
  onCopyToOffer?: () => void;
}) {
  const attachments = album?.attachments ?? [];
  const coverId = album?.coverAttachmentId ?? "";

  return (
    <section className="min-w-0 rounded-[22px] bg-[var(--s1)] p-4 shadow-[var(--sh)]">
      <p className="text-[13px] font-semibold text-[var(--ink)]">{IRISS_ORDER_PHOTO_ALBUM_LV[albumId]}</p>
      <p className="mt-1 text-[12px] text-[var(--ink2)]">
        Tas pats kārtotājs kā piedāvājumā: vāks, dzēšana, atcelšana, velkšana.
      </p>
      {attachments.length === 0 ? (
        <p className="mt-3 rounded-[14px] bg-[var(--fill)] px-3 py-4 text-[13px] text-[var(--ink2)]">
          Vēl nav failu. Pievienot failus, lai rādītu sīktēlus un Vāks birku.
        </p>
      ) : null}
      {onFiles ? (
        <label className={`${roomBtn} mt-3 cursor-pointer`}>
          Pievienot failus
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            disabled={busy || attachments.length >= IRISS_MAX_OFFER_ATTACHMENTS}
            onChange={(e) => {
              onFiles(e.target.files);
              e.currentTarget.value = "";
            }}
          />
        </label>
      ) : null}
      {onCopyToOffer ? (
        <>
          <button type="button" className={`${roomBtn} ml-2 mt-3 max-md:hidden`} onClick={onCopyToOffer} disabled={attachments.length === 0}>
            Kopēt uz piedāvājumu
          </button>
          <span className="ml-2 mt-3 inline-flex md:hidden">
            <IrissOverflowMenu label="Vairāk">
              <IrissOverflowItem disabled={attachments.length === 0} onClick={onCopyToOffer}>
                Kopēt uz piedāvājumu
              </IrissOverflowItem>
            </IrissOverflowMenu>
          </span>
        </>
      ) : null}
      <IrissOfferImageSorter
        attachments={attachments}
        coverId={coverId}
        disabled={busy}
        onChange={(next) =>
          onChange({
            attachments: next.attachments,
            ...(next.coverId ? { coverAttachmentId: next.coverId } : {}),
          })
        }
      />
    </section>
  );
}
