import { useCallback, useEffect, useRef, useState } from 'react';

/** Clamps a width into the allowed range. */
export function clampWidth(width: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, width));
}

/** Reads a persisted width, falling back when absent or out of range. */
export function readStoredWidth(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return clampWidth(parsed, min, max);
}

interface ResizableOptions {
  storageKey: string;
  defaultWidth: number;
  min: number;
  max: number;
}

/**
 * Drag-to-resize for a right-hand panel, with the width persisted locally.
 *
 * The panel sits on the right, so dragging left must widen it — hence the
 * inverted delta. Width is committed to storage on release rather than on every
 * mouse move.
 */
export function useResizablePanel({ storageKey, defaultWidth, min, max }: ResizableOptions) {
  const [width, setWidth] = useState(() => {
    try {
      return readStoredWidth(localStorage.getItem(storageKey), defaultWidth, min, max);
    } catch {
      return defaultWidth;
    }
  });
  const [resizing, setResizing] = useState(false);
  const widthRef = useRef(width);
  widthRef.current = width;

  const startResize = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      event.preventDefault();
      const startX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const startWidth = widthRef.current;
      setResizing(true);

      const move = (clientX: number) => {
        // Dragging left (negative delta) makes a right-hand panel wider.
        setWidth(clampWidth(startWidth - (clientX - startX), min, max));
      };

      const onMouseMove = (e: MouseEvent) => move(e.clientX);
      const onTouchMove = (e: TouchEvent) => move(e.touches[0].clientX);

      const stop = () => {
        setResizing(false);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', stop);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', stop);
        try {
          localStorage.setItem(storageKey, String(widthRef.current));
        } catch {
          // Storage unavailable; the width simply won't persist.
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', stop);
      window.addEventListener('touchmove', onTouchMove);
      window.addEventListener('touchend', stop);
    },
    [max, min, storageKey],
  );

  /** Keyboard resizing, so the handle is usable without a pointer. */
  const nudge = useCallback(
    (delta: number) => {
      setWidth((current) => {
        const next = clampWidth(current + delta, min, max);
        try {
          localStorage.setItem(storageKey, String(next));
        } catch {
          // Ignore storage failures.
        }
        return next;
      });
    },
    [max, min, storageKey],
  );

  // While dragging, suppress text selection and keep the resize cursor.
  useEffect(() => {
    if (!resizing) return;
    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [resizing]);

  return { width, resizing, startResize, nudge };
}
