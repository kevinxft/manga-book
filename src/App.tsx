import { useEffect, useMemo, useState } from 'react';
import type { MangaBookWithCover } from '@shared/types';
import { cn } from '@renderer/lib/utils';
import { LibraryPage } from '@renderer/pages/Library';
import { OrganizerPage } from '@renderer/pages/Organizer';
import { ReaderPage } from '@renderer/pages/Reader';
import { SettingsPage } from '@renderer/pages/Settings';
import { useReaderSettingsStore } from '@renderer/stores/readerSettingsStore';
import { useLibraryStore } from '@renderer/stores/libraryStore';

export default function App() {
  const [activePage, setActivePage] = useState<'library' | 'organizer'>('library');
  const [activeManga, setActiveManga] = useState<MangaBookWithCover | null>(null);
  const [readerQueueIds, setReaderQueueIds] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const libraryMangas = useLibraryStore((state) => state.mangas);
  const {
    readerMode,
    widthMode,
    fixedWidthPercent,
    pageAnimationEnabled,
    boundarySuggestionCount,
    rememberReadingProgress,
    hydrate,
    setReaderMode,
    setWidthMode,
    setFixedWidthPercent,
    applySettings
  } = useReaderSettingsStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    document.documentElement.classList.add('app-ready');
    const splash = document.getElementById('boot-splash');
    const timer = window.setTimeout(() => {
      splash?.remove();
    }, 600);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!activeManga) {
      return;
    }

    const matchedManga = libraryMangas.find((item) => item.id === activeManga.id);
    if (matchedManga && matchedManga !== activeManga) {
      setActiveManga(matchedManga);
    }
  }, [activeManga, libraryMangas]);

  const handleOpenManga = (manga: MangaBookWithCover, queueIds?: string[]) => {
    setSettingsOpen(false);
    setActiveManga(manga);
    setReaderQueueIds(queueIds && queueIds.length > 0 ? queueIds : [manga.id]);
  };

  const readerQueue = useMemo(() => {
    if (readerQueueIds.length === 0) {
      return activeManga ? [activeManga] : [];
    }

    const mangaById = new Map(libraryMangas.map((item) => [item.id, item]));
    return readerQueueIds
      .map((id) => mangaById.get(id) ?? (activeManga?.id === id ? activeManga : null))
      .filter((item): item is MangaBookWithCover => Boolean(item));
  }, [activeManga, libraryMangas, readerQueueIds]);

  const activeMangaIndex = useMemo(
    () => (activeManga ? readerQueue.findIndex((item) => item.id === activeManga.id) : -1),
    [activeManga, readerQueue]
  );
  const previousManga = activeMangaIndex > 0 ? readerQueue[activeMangaIndex - 1] ?? null : null;
  const nextManga =
    activeMangaIndex >= 0 && activeMangaIndex < readerQueue.length - 1 ? readerQueue[activeMangaIndex + 1] ?? null : null;
  const previousMangaCandidates =
    activeMangaIndex > 0
      ? readerQueue.slice(Math.max(0, activeMangaIndex - boundarySuggestionCount), activeMangaIndex).reverse()
      : [];
  const nextMangaCandidates =
    activeMangaIndex >= 0
      ? readerQueue.slice(
          activeMangaIndex + 1,
          Math.min(activeMangaIndex + 1 + boundarySuggestionCount, readerQueue.length)
        )
      : [];

  return (
    <>
      <div className={cn('h-full w-full', activeManga ? 'pointer-events-none invisible' : '')}>
        <div className={cn('h-full w-full', activePage !== 'library' && 'pointer-events-none hidden')}>
          <LibraryPage
            active={activePage === 'library'}
            onOpenManga={handleOpenManga}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenOrganizer={() => setActivePage('organizer')}
          />
        </div>
        <div className={cn('h-full w-full', activePage !== 'organizer' && 'pointer-events-none hidden')}>
          <OrganizerPage
            active={activePage === 'organizer'}
            onBack={() => setActivePage('library')}
            onOpenManga={handleOpenManga}
          />
        </div>
        <SettingsPage
          open={settingsOpen}
          readerMode={readerMode}
          widthMode={widthMode}
          fixedWidthPercent={fixedWidthPercent}
          pageAnimationEnabled={pageAnimationEnabled}
          boundarySuggestionCount={boundarySuggestionCount}
          rememberReadingProgress={rememberReadingProgress}
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
            rememberReadingProgress={rememberReadingProgress}
            onReaderModeChange={setReaderMode}
            onWidthModeChange={setWidthMode}
            onFixedWidthPercentChange={setFixedWidthPercent}
            onBack={() => setActiveManga(null)}
            onOpenPreviousManga={previousManga ? () => setActiveManga(previousManga) : undefined}
            onOpenNextManga={nextManga ? () => setActiveManga(nextManga) : undefined}
            canOpenPreviousManga={Boolean(previousManga)}
            canOpenNextManga={Boolean(nextManga)}
            previousMangaCandidates={previousMangaCandidates}
            nextMangaCandidates={nextMangaCandidates}
            onOpenSuggestedManga={setActiveManga}
          />
        </div>
      ) : null}
    </>
  );
}
