import { useEffect, useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { LibraryPage } from '@renderer/pages/Library';
import { ReaderPage, type ReaderMode, type ReaderWidthMode } from '@renderer/pages/Reader';
import { SettingsPage } from '@renderer/pages/Settings';

const READER_MODE_STORAGE_KEY = 'manga-book.reader-mode';
const READER_WIDTH_MODE_STORAGE_KEY = 'manga-book.reader-width-mode';
const READER_FIXED_WIDTH_PERCENT_STORAGE_KEY = 'manga-book.reader-fixed-width-percent';
const READER_PAGE_ANIMATION_STORAGE_KEY = 'manga-book.reader-page-animation';

export default function App() {
  const [activeManga, setActiveManga] = useState<MangaBookWithCover | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readerMode, setReaderMode] = useState<ReaderMode>('paged');
  const [widthMode, setWidthMode] = useState<ReaderWidthMode>('fit');
  const [fixedWidthPercent, setFixedWidthPercent] = useState(90);
  const [pageAnimationEnabled, setPageAnimationEnabled] = useState(false);
  const [settingsHydrated, setSettingsHydrated] = useState(false);

  useEffect(() => {
    try {
      const savedMode = window.localStorage.getItem(READER_MODE_STORAGE_KEY);
      if (savedMode === 'paged' || savedMode === 'scroll') {
        setReaderMode(savedMode);
      }
      const savedWidthMode = window.localStorage.getItem(READER_WIDTH_MODE_STORAGE_KEY);
      if (savedWidthMode === 'fit' || savedWidthMode === 'fixed') {
        setWidthMode(savedWidthMode);
      }
      const savedFixedWidth = Number(window.localStorage.getItem(READER_FIXED_WIDTH_PERCENT_STORAGE_KEY));
      if (Number.isFinite(savedFixedWidth)) {
        setFixedWidthPercent(Math.min(100, Math.max(50, Math.round(savedFixedWidth))));
      }
      const savedAnimation = window.localStorage.getItem(READER_PAGE_ANIMATION_STORAGE_KEY);
      if (savedAnimation === '1' || savedAnimation === '0') {
        setPageAnimationEnabled(savedAnimation === '1');
      }
    } catch {
      // ignore localStorage read failures
    } finally {
      setSettingsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!settingsHydrated) return;
    try {
      window.localStorage.setItem(READER_MODE_STORAGE_KEY, readerMode);
      window.localStorage.setItem(READER_WIDTH_MODE_STORAGE_KEY, widthMode);
      window.localStorage.setItem(READER_FIXED_WIDTH_PERCENT_STORAGE_KEY, String(fixedWidthPercent));
      window.localStorage.setItem(READER_PAGE_ANIMATION_STORAGE_KEY, pageAnimationEnabled ? '1' : '0');
    } catch {
      // ignore localStorage write failures
    }
  }, [fixedWidthPercent, pageAnimationEnabled, readerMode, settingsHydrated, widthMode]);

  const handleFixedWidthPercentChange = (value: number) => {
    if (!Number.isFinite(value)) return;
    const snapped = Math.round(value / 5) * 5;
    setFixedWidthPercent(Math.min(100, Math.max(50, snapped)));
  };

  const handleSaveSettings = (next: {
    readerMode: ReaderMode;
    widthMode: ReaderWidthMode;
    fixedWidthPercent: number;
    pageAnimationEnabled: boolean;
  }) => {
    setReaderMode(next.readerMode);
    setWidthMode(next.widthMode);
    handleFixedWidthPercentChange(next.fixedWidthPercent);
    setPageAnimationEnabled(next.pageAnimationEnabled);
  };

  if (activeManga) {
    return (
      <ReaderPage
        manga={activeManga}
        readerMode={readerMode}
        widthMode={widthMode}
        fixedWidthPercent={fixedWidthPercent}
        pageAnimationEnabled={pageAnimationEnabled}
        onReaderModeChange={setReaderMode}
        onWidthModeChange={setWidthMode}
        onFixedWidthPercentChange={handleFixedWidthPercentChange}
        onBack={() => setActiveManga(null)}
      />
    );
  }

  return (
    <>
      <LibraryPage onOpenManga={setActiveManga} onOpenSettings={() => setSettingsOpen(true)} />
      <SettingsPage
        open={settingsOpen}
        readerMode={readerMode}
        widthMode={widthMode}
        fixedWidthPercent={fixedWidthPercent}
        pageAnimationEnabled={pageAnimationEnabled}
        onSave={handleSaveSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
