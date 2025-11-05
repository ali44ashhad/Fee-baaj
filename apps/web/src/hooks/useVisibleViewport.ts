// hooks/useVisibleViewport.ts
"use client"
import { useCallback, useEffect, useState } from 'react';

/**
 * Returns { visibleHeight, keyboardHeight, recompute }
 * - visibleHeight: visualViewport.height (or window.innerHeight fallback)
 * - keyboardHeight: window.innerHeight - visibleHeight (>= 0)
 * - recompute(): force re-read and update (useful after focus/blur)
 */
export default function useVisibleViewport() {
  const isBrowser = typeof window !== 'undefined';
  const vv = isBrowser ? (window as any).visualViewport as VisualViewport | undefined : undefined;

  const getVisible = () => (vv ? vv.height : isBrowser ? window.innerHeight : 0);
  const getKeyboard = () => (isBrowser ? Math.max(0, window.innerHeight - getVisible()) : 0);

  const [visibleHeight, setVisibleHeight] = useState<number>(() => (isBrowser ? getVisible() : 0));
  const [keyboardHeight, setKeyboardHeight] = useState<number>(() => (isBrowser ? getKeyboard() : 0));

  const apply = useCallback(() => {
    if (!isBrowser) return;
    const visual = (window as any).visualViewport as VisualViewport | undefined;
    const visible = visual ? visual.height : window.innerHeight;
    const kb = Math.max(0, window.innerHeight - visible);
    setVisibleHeight(visible);
    setKeyboardHeight(kb);
    // set CSS vars for optional use
    document.documentElement.style.setProperty('--app-vh', `${visible}px`);
    document.documentElement.style.setProperty('--keyboard-height', `${kb}px`);
  }, [isBrowser]);

  useEffect(() => {
    if (!isBrowser) return;
    const visual = (window as any).visualViewport as VisualViewport | undefined;
    apply();
    if (visual) {
      visual.addEventListener('resize', apply);
      visual.addEventListener('scroll', apply);
    }
    window.addEventListener('resize', apply);
    return () => {
      if (visual) {
        visual.removeEventListener('resize', apply);
        visual.removeEventListener('scroll', apply);
      }
      window.removeEventListener('resize', apply);
    };
  }, [apply, isBrowser]);

  return {
    visibleHeight,
    keyboardHeight,
    recompute: apply,
  };
}
