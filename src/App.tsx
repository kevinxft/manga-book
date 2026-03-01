import { useEffect, useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { LibraryPage } from '@renderer/pages/Library';
import { ReaderPage } from '@renderer/pages/Reader';
import { SettingsPage } from '@renderer/pages/Settings';
import { useReaderSettingsStore } from '@renderer/stores/readerSettingsStore';

export default function App() {
  const [activeManga, setActiveManga] = useState<MangaBookWithCover | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    readerMode,
    widthMode,
    fixedWidthPercent,
    pageAnimationEnabled,
    hydrate,
    setReaderMode,
    setWidthMode,
    setFixedWidthPercent,
    applySettings
  } = useReaderSettingsStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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
        onFixedWidthPercentChange={setFixedWidthPercent}
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
        onSave={applySettings}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}
