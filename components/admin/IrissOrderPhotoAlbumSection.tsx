"use client";

import { IrissOfferImageSorter } from "@/components/admin/IrissOfferImageSorter";
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
    <section className="min-w-0 rounded-2xl border border-[#e5e7eb] bg-white p-4">
      <p className="text-[13px] font-semibold text-[#111827]">{IRISS_ORDER_PHOTO_ALBUM_LV[albumId]}</p>
      <p className="mt-1 text-[12px] text-[#6b7280]">
        Tas pats kārtotājs kā piedāvājumā: vāks, dzēšana, atcelšana, velkšana.
      </p>
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
        <button type="button" className={`${roomBtn} ml-2 mt-3`} onClick={onCopyToOffer} disabled={attachments.length === 0}>
          Kopēt uz piedāvājumu
        </button>
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
