import { useEffect, useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { cn } from '@renderer/lib/utils';
import { LibraryPage } from '@renderer/pages/Library';
import { OrganizerPage } from '@renderer/pages/Organizer';
import { ReaderPage } from '@renderer/pages/Reader';
import { SettingsPage } from '@renderer/pages/Settings';
import { useReaderSettingsStore } from '@renderer/stores/readerSettingsStore';

export default function App() {
  const [activePage, setActivePage] = useState<'library' | 'organizer'>('library');
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

  const handleOpenManga = (manga: MangaBookWithCover) => {
    setSettingsOpen(false);
    setActiveManga(manga);
  };

  return (
    <>
      <div className={cn('h-full w-full', activeManga ? 'pointer-events-none invisible' : '')}>
        {activePage === 'library' ? (
          <LibraryPage
            onOpenManga={handleOpenManga}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenOrganizer={() => setActivePage('organizer')}
          />
        ) : (
          <OrganizerPage
            onBack={() => setActivePage('library')}
            onOpenManga={handleOpenManga}
          />
        )}
        <SettingsPage
          open={settingsOpen}
          readerMode={readerMode}
          widthMode={widthMode}
          fixedWidthPercent={fixedWidthPercent}
          pageAnimationEnabled={pageAnimationEnabled}
          onSave={applySettings}
          onClose={() => setSettingsOpen(false)}
        />
      </div>

      {activeManga ? (
        <div className="fixed inset-0 z-[140]">
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
        </div>
      ) : null}
    </>
  );
}
