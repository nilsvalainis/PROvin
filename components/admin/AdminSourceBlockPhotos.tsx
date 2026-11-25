"use client";

import type { ReactNode } from "react";

import { AdminListingAnalysisPhotos } from "@/components/admin/AdminListingAnalysisPhotos";
import {
  SOURCE_BLOCK_MAX_PHOTOS,
  emptySourceBlockPhotoGroup,
  type SourceBlockPhotoGroup,
} from "@/lib/source-block-photo-types";

export function AdminSourceBlockPhotos({
  sessionId,
  photoGroups,
  disabled,
  onCommit,
  hidePhotoWatermarks,
  onHidePhotoWatermarksChange,
  maxPhotos = SOURCE_BLOCK_MAX_PHOTOS,
  blockKey,
  renderGroupExtra,
}: {
  sessionId: string;
  photoGroups: SourceBlockPhotoGroup[];
  disabled: boolean;
  onCommit: (next: SourceBlockPhotoGroup[]) => void;
  hidePhotoWatermarks?: boolean;
  onHidePhotoWatermarksChange?: (next: boolean) => void;
  maxPhotos?: number;
  /** Avota atslēga (piem. tirgus) - API izvēlas griestu. */
  blockKey?: string;
  renderGroupExtra?: (group: SourceBlockPhotoGroup) => ReactNode;
}) {
  return (
    <AdminListingAnalysisPhotos
      sessionId={sessionId}
      photoGroups={photoGroups}
      disabled={disabled}
      onPhotoGroupsStructuralCommit={onCommit}
      apiBasePath="/api/admin/source-block-photo"
      maxPhotos={maxPhotos}
      uploadBlockKey={blockKey}
      emptyGroup={emptySourceBlockPhotoGroup}
      sectionTitle="Fotogrāfijas (PDF)"
      hidePhotoWatermarks={hidePhotoWatermarks}
      onHidePhotoWatermarksChange={onHidePhotoWatermarksChange}
      renderGroupExtra={renderGroupExtra ? (g) => renderGroupExtra(g as SourceBlockPhotoGroup) : undefined}
    />
  );
}
