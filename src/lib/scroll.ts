function getScrollableElement(selector: string): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null;
  }
  return document.querySelector<HTMLElement>(selector);
}

export async function runWithScrollRestore(selector: string, task: () => Promise<void>): Promise<void> {
  const container = getScrollableElement(selector);
  const scrollTop = container?.scrollTop ?? 0;
  const scrollLeft = container?.scrollLeft ?? 0;

  await task();

  if (typeof window === 'undefined') {
    return;
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const latest = getScrollableElement(selector);
      if (!latest) {
        return;
      }
      const maxTop = Math.max(0, latest.scrollHeight - latest.clientHeight);
      const maxLeft = Math.max(0, latest.scrollWidth - latest.clientWidth);
      latest.scrollTop = Math.min(scrollTop, maxTop);
      latest.scrollLeft = Math.min(scrollLeft, maxLeft);
    });
  });
}
