import { useLayoutEffect, useRef, useState } from 'react';

interface UseAnchoredMenuPositionInput {
  open: boolean;
  anchor: { x: number; y: number } | null;
  contentDependency?: number;
  offset?: number;
  padding?: number;
}

export function useAnchoredMenuPosition({
  open,
  anchor,
  contentDependency = 0,
  offset = 6,
  padding = 8
}: UseAnchoredMenuPositionInput) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [ready, setReady] = useState(false);
  const anchorX = anchor?.x ?? null;
  const anchorY = anchor?.y ?? null;

  useLayoutEffect(() => {
    if (!open || anchorX === null || anchorY === null) {
      setReady(false);
      return;
    }

    const updatePosition = () => {
      if (!ref.current) {
        return;
      }

      const rect = ref.current.getBoundingClientRect();
      const desiredLeft = anchorX + offset;
      const desiredTop = anchorY + offset;
      const maxLeft = Math.max(padding, window.innerWidth - rect.width - padding);
      const maxTop = Math.max(padding, window.innerHeight - rect.height - padding);

      setPosition({
        left: Math.min(Math.max(desiredLeft, padding), maxLeft),
        top: Math.min(Math.max(desiredTop, padding), maxTop)
      });
      setReady(true);
    };

    setReady(false);
    const frame = window.requestAnimationFrame(updatePosition);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [anchorX, anchorY, contentDependency, offset, open, padding]);

  return {
    ref,
    position,
    ready,
    padding
  };
}
