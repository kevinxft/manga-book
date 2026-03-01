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
  pageAnimationEnabled
}: UseSettingsDraftOptions) {
  const [draftReaderMode, setDraftReaderMode] = useState<ReaderMode>(readerMode);
  const [draftWidthMode, setDraftWidthMode] = useState<ReaderWidthMode>(widthMode);
  const [draftFixedWidthPercent, setDraftFixedWidthPercent] = useState(fixedWidthPercent);
  const [draftPageAnimationEnabled, setDraftPageAnimationEnabled] = useState(pageAnimationEnabled);

  useEffect(() => {
    if (!open) return;
    setDraftReaderMode(readerMode);
    setDraftWidthMode(widthMode);
    setDraftFixedWidthPercent(fixedWidthPercent);
    setDraftPageAnimationEnabled(pageAnimationEnabled);
  }, [fixedWidthPercent, open, pageAnimationEnabled, readerMode, widthMode]);

  const dirty = useMemo(
    () =>
      draftReaderMode !== readerMode ||
      draftWidthMode !== widthMode ||
      draftFixedWidthPercent !== fixedWidthPercent ||
      draftPageAnimationEnabled !== pageAnimationEnabled,
    [
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
    setDraftReaderMode,
    setDraftWidthMode,
    setDraftFixedWidthPercent,
    setDraftPageAnimationEnabled,
    dirty,
    buildPayload(): ReaderSettingsPayload {
      return {
        readerMode: draftReaderMode,
        widthMode: draftWidthMode,
        fixedWidthPercent: draftFixedWidthPercent,
        pageAnimationEnabled: draftPageAnimationEnabled
      };
    }
  };
}
