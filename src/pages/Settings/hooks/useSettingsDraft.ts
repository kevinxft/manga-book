import { useEffect, useMemo, useState } from 'react';
import type { ReaderMode, ReaderWidthMode } from '@renderer/pages/Reader';
import type { ReaderSettingsPayload } from '../types';

interface UseSettingsDraftOptions extends ReaderSettingsPayload {
  open: boolean;
}

export function useSettingsDraft({
  open,
  readerMode,
  widthMode,
  fixedWidthPercent,
  pageAnimationEnabled,
  boundarySuggestionCount
}: UseSettingsDraftOptions) {
  const [draftReaderMode, setDraftReaderMode] = useState<ReaderMode>(readerMode);
  const [draftWidthMode, setDraftWidthMode] = useState<ReaderWidthMode>(widthMode);
  const [draftFixedWidthPercent, setDraftFixedWidthPercent] = useState(fixedWidthPercent);
  const [draftPageAnimationEnabled, setDraftPageAnimationEnabled] = useState(pageAnimationEnabled);
  const [draftBoundarySuggestionCount, setDraftBoundarySuggestionCount] = useState(boundarySuggestionCount);

  useEffect(() => {
    if (!open) return;
    setDraftReaderMode(readerMode);
    setDraftWidthMode(widthMode);
    setDraftFixedWidthPercent(fixedWidthPercent);
    setDraftPageAnimationEnabled(pageAnimationEnabled);
    setDraftBoundarySuggestionCount(boundarySuggestionCount);
  }, [boundarySuggestionCount, fixedWidthPercent, open, pageAnimationEnabled, readerMode, widthMode]);

  const dirty = useMemo(
    () =>
      draftReaderMode !== readerMode ||
      draftWidthMode !== widthMode ||
      draftFixedWidthPercent !== fixedWidthPercent ||
      draftPageAnimationEnabled !== pageAnimationEnabled ||
      draftBoundarySuggestionCount !== boundarySuggestionCount,
    [
      boundarySuggestionCount,
      draftBoundarySuggestionCount,
      draftFixedWidthPercent,
      draftPageAnimationEnabled,
      draftReaderMode,
      draftWidthMode,
      fixedWidthPercent,
      pageAnimationEnabled,
      readerMode,
      widthMode
    ]
  );

  return {
    draftReaderMode,
    draftWidthMode,
    draftFixedWidthPercent,
    draftPageAnimationEnabled,
    draftBoundarySuggestionCount,
    setDraftReaderMode,
    setDraftWidthMode,
    setDraftFixedWidthPercent,
    setDraftPageAnimationEnabled,
    setDraftBoundarySuggestionCount,
    dirty,
    buildPayload(): ReaderSettingsPayload {
      return {
        readerMode: draftReaderMode,
        widthMode: draftWidthMode,
        fixedWidthPercent: draftFixedWidthPercent,
        pageAnimationEnabled: draftPageAnimationEnabled,
        boundarySuggestionCount: draftBoundarySuggestionCount
      };
    }
  };
}
