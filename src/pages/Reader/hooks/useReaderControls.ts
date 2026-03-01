import { useCallback, useEffect } from 'react';
import type { ReaderMode, ReaderWidthMode } from '../types';

interface UseReaderControlsInput {
  pageStep: number;
  movePage: (delta: number) => void;
  onBack: () => void;
  readerMode: ReaderMode;
  widthMode: ReaderWidthMode;
  onWidthModeChange: (mode: ReaderWidthMode) => void;
}

export function useReaderControls({
  pageStep,
  movePage,
  onBack,
  readerMode,
  widthMode,
  onWidthModeChange
}: UseReaderControlsInput) {
  const handleReaderMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button === 0) {
        event.preventDefault();
        movePage(pageStep);
      } else if (event.button === 2) {
        event.preventDefault();
        movePage(-pageStep);
      }
    },
    [movePage, pageStep]
  );

  const handleReaderContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleToolbarButtonMouseDown = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  }, []);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onBack();
        return;
      }

      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement && activeElement.tagName === 'BUTTON') {
          activeElement.blur();
        }
        movePage(event.shiftKey ? -pageStep : pageStep);
      } else if (event.code === 'KeyD' || event.code === 'KeyS') {
        event.preventDefault();
        movePage(pageStep);
      } else if (event.code === 'KeyA' || event.code === 'KeyW') {
        event.preventDefault();
        movePage(-pageStep);
      } else if (readerMode === 'scroll' && event.key === 'ArrowDown') {
        event.preventDefault();
        movePage(1);
      } else if (readerMode === 'scroll' && event.key === 'ArrowUp') {
        event.preventDefault();
        movePage(-1);
      } else if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault();
        movePage(pageStep);
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        movePage(-pageStep);
      } else if (event.key === 'f' || event.key === 'F') {
        event.preventDefault();
        onWidthModeChange(widthMode === 'fit' ? 'fixed' : 'fit');
      }
    };

    window.addEventListener('keydown', handleKeydown, true);
    return () => window.removeEventListener('keydown', handleKeydown, true);
  }, [movePage, onBack, onWidthModeChange, pageStep, widthMode, readerMode]);

  return {
    handleReaderMouseDown,
    handleReaderContextMenu,
    handleToolbarButtonMouseDown
  };
}
