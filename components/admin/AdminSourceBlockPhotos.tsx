"use client";

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
}: {
  sessionId: string;
  photoGroups: SourceBlockPhotoGroup[];
  disabled: boolean;
  onCommit: (next: SourceBlockPhotoGroup[]) => void;
}) {
  return (
    <AdminListingAnalysisPhotos
      sessionId={sessionId}
      photoGroups={photoGroups}
      disabled={disabled}
      onPhotoGroupsStructuralCommit={onCommit}
      apiBasePath="/api/admin/source-block-photo"
      maxPhotos={SOURCE_BLOCK_MAX_PHOTOS}
      emptyGroup={emptySourceBlockPhotoGroup}
      sectionTitle="Fotogrāfijas (PDF)"
    />
  );
}
