import { useLayoutEffect, useState, type RefObject } from 'react';

export default function useAnchoredMenu(anchor: RefObject<HTMLElement>, width: number, enabled = true, align: 'start' | 'end' = 'end') {
  const [position, setPosition] = useState({ left: 12, top: 96, width, maxHeight: 500 });
  useLayoutEffect(() => {
    if (!enabled) return;
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const right = (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth);
      const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
      const fittedWidth = Math.min(width, right - (viewport?.offsetLeft ?? 0) - 24);
      const top = rect.bottom + 7;
      setPosition({ left: Math.max((viewport?.offsetLeft ?? 0) + 12, Math.min(align === 'start' ? rect.left : rect.right - fittedWidth, right - fittedWidth - 12)),
        top, width: fittedWidth, maxHeight: Math.max(0, bottom - top - 12) });
    };
    place();
    const observer = new ResizeObserver(place);
    if (anchor.current) observer.observe(anchor.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place); window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [anchor, width, enabled, align]);
  return position;
}
