import type { ReaderMode, ReaderWidthMode } from '@renderer/pages/Reader';

export interface ReaderSettingsPayload {
  readerMode: ReaderMode;
  widthMode: ReaderWidthMode;
  fixedWidthPercent: number;
  pageAnimationEnabled: boolean;
}
