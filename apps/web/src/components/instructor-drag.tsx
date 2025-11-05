'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { BadgeCheck } from 'lucide-react';
// removed mongoose import (client-only)
import { useAuth } from '@/hooks/use-auth';
import { AuthPopup } from '@/app/auth/components/auth-popup';
import { useRouter } from 'next/navigation';


const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_API_URL || process.env.NEXT_PUBLIC_MEDIA_API_URL; // prefer explicit media url

export interface InstructorCardProps {
  instructorName?: string;         // may be empty
  instructorProfession?: string;   // may be empty
  profilePicUrl?: string;          // may be empty
  initialVisible?: boolean;        // true by default
  storageKey?: string;             // optional localStorage key for position persistence
  instructorId?: string;           // use string on client
}

export default function InstructorCard({
  instructorName = '',
  instructorProfession = '',
  profilePicUrl = '',
  initialVisible = true,
  storageKey = 'instructor-card-pos',
  instructorId = '',
}: InstructorCardProps) {
  // portal container
  const [mounted, setMounted] = useState(false);
  const portalRef = useRef<HTMLDivElement | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);

  const router = useRouter();
  const { isAuthenticated } = useAuth();

 
  // keep your original variable name (imageSrouce) to avoid changing other code
  const imageSrouce = profilePicUrl ? profilePicUrl : "/userPlaceHolder.jpg";

  const handleMessageClick = useCallback(() => {
    const idStr = instructorId ?? '';
    if (isAuthenticated) {
      router.push(`/chat/instructor/${idStr}`);
    } else {
      setAuthMode('login');
      setIsDialogOpen(true);
    }
  }, [isAuthenticated, instructorId, router]);

  useEffect(() => {
    setMounted(true);
    const el = document.createElement('div');
    document.body.appendChild(el);
    portalRef.current = el;
    return () => {
      try {
        if (portalRef.current) document.body.removeChild(portalRef.current);
      } catch {}
      portalRef.current = null;
    };
  }, []);

  // visibility
  const [visible, setVisible] = useState<boolean>(initialVisible);

  // image load fallback
  const [imgOk, setImgOk] = useState((imageSrouce?.trim()));

  // derived values
  const displayName = useMemo(
    () => (instructorName?.trim() ? instructorName.trim() : 'Unknown Instructor'),
    [instructorName],
  );
  const hasProfession = Boolean(instructorProfession?.trim());

  // draggable state
  const cardRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const dragMeta = useRef({
    startPointerX: 0,
    startPointerY: 0,
    startLeft: 0,
    startTop: 0,
  });

  // moved => we use left/top; if not moved, we anchor bottom-right
  const [moved, setMoved] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return Boolean(raw);
    } catch {
      return false;
    }
  });

  const [pos, setPos] = useState<{ left: number; top: number } | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  // clamp helper
  const clamp = (v: number, mn: number, mx: number) => Math.min(Math.max(v, mn), mx);

  // **NEW**: clamp saved pos on mount so it doesn't appear off-screen on small viewports
  useEffect(() => {
    if (!mounted) return;
    if (!pos) return;

    const rect = cardRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 280;
    const h = rect?.height ?? 200;

    const clampedLeft = clamp(pos.left, 8, window.innerWidth - w - 8);
    const clampedTop = clamp(pos.top, 8, window.innerHeight - h - 8);

    if (clampedLeft !== pos.left || clampedTop !== pos.top) {
      const next = { left: clampedLeft, top: clampedTop };
      setPos(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]); // run once after mount (don't depend on pos to avoid loops)

  // pointer down on header (start drag)
  const onPointerDown = (e: React.PointerEvent) => {
    // only left button or touch
    if ((e as any).button && (e as any).button !== 0) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);

    draggingRef.current = true;
    const rect = cardRef.current?.getBoundingClientRect();
    const startLeft = rect ? rect.left : pos?.left ?? window.innerWidth - 300 - 20;
    const startTop = rect ? rect.top : pos?.top ?? window.innerHeight - 200 - 20;

    dragMeta.current = {
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startLeft,
      startTop,
    };

    // mark as moved (switch anchoring to left/top)
    setMoved(true);
  };

  // pointer move listener (global)
  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingRef.current) return;
      const { startPointerX, startPointerY, startLeft, startTop } = dragMeta.current;
      const dx = e.clientX - startPointerX;
      const dy = e.clientY - startPointerY;
      const newLeft = startLeft + dx;
      const newTop = startTop + dy;

      const rect = cardRef.current?.getBoundingClientRect();
      const w = rect?.width ?? 280;
      const h = rect?.height ?? 200;

      const clampedLeft = clamp(newLeft, 8, window.innerWidth - w - 8);
      const clampedTop = clamp(newTop, 8, window.innerHeight - h - 8);

      setPos({ left: clampedLeft, top: clampedTop });
    },
    [],
  );

  // pointer up / cancel
  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;

      // persist
      try {
        if (pos) localStorage.setItem(storageKey, JSON.stringify(pos));
      } catch {}

      try {
        (e.target as Element).releasePointerCapture?.((e as any).pointerId);
      } catch {}
    },
    [pos, storageKey],
  );

  // wire/unwire global pointer listeners
  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  // keyboard escape -> close
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setVisible(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // nothing to render before portal is ready
  if (!mounted || !portalRef.current) return null;
  if (!visible) return null;

  // computed style: anchored bottom-right (if not moved) OR fixed left/top if moved
  const style: React.CSSProperties = moved
    ? {
        position: 'fixed',
        left: pos?.left ?? Math.max(8, window.innerWidth - 320),
        top: pos?.top ?? Math.max(8, window.innerHeight - 220),
        zIndex: 9999,
        touchAction: 'none',
      }
    : {
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 9999,
        touchAction: 'none',
      };

      const card = (
        <div
          ref={cardRef}
          style={style}
          className="mx-auto w-fit max-w-[92vw] rounded-xl bg-transparent"
        >
          {/* Header: centered title with badge; close button (mobile) absolutely positioned */}
          <div
            className="relative flex items-center justify-center px-3 py-2 cursor-grab rounded-t-xl bg-transparent"
            onPointerDown={onPointerDown}
          >
            <div className="flex items-center gap-3 justify-center text-center">
              <div className="text-sm flex items-center gap-2 justify-center">
                <div className="font-medium text-black leading-tight text-center">{displayName}</div>
                <BadgeCheck
                  className="
                    text-white fill-blue-400 shrink-0
                    tiny-custom:w-[18px] tiny-custom:h-[18px]
                    w-[20px] h-[20px]
                    sm-custom:w-[21px] sm-custom:h-[21px]"
                  aria-hidden
                />
              </div>
            </div>
      
            {/* Close: visible only on small screens (mobile). absolute so it doesn't affect centering */}
            <button
              type="button"
              onClick={() => setVisible(false)}
              aria-label="Close instructor card"
              className="md:hidden absolute right-2 top-1 inline-flex items-center justify-center p-1 rounded hover:bg-gray-100"
            >
              <svg className="h-4 w-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </div>
      
          {/* Body: centered content */}
          <div className="p-3">
            <div className="flex flex-col items-center text-center">
              <div className="h-[70px] w-[70px] rounded-full overflow-hidden">
                {profilePicUrl && imgOk ? (
                  <Image
                    src={imageSrouce}
                    alt={displayName}
                    width={71}
                    height={71}
                    className="object-cover w-full h-full"
                    onError={() => setImgOk(false)}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gray-400">
                      <Image
                    src={"/userPlaceHolder.jpg"}
                    alt={displayName}
                    width={71}
                    height={71}
                    className="object-cover w-full h-full"
                    
                  />
                  </div>
                )}
              </div>
      
              {/* Send Message button: full width on very small screens, auto-size and centered on larger screens */}
              <button
                type="button"
                onClick={() => {
                  handleMessageClick();
                }}
                className="mt-3 tiny:text-[11px] font-bold inline-flex w-fit sm:w-auto items-center justify-center rounded-md bg-[#0a8800] px-4 tiny:px-[4px] py-2 tiny:py-1 text-sm text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Send Message
              </button>
      
              {hasProfession && (
                <div className="mt-2 text-xs text-[#0A8800] text-center">{instructorProfession}</div>
              )}
            </div>
          </div>
      
          <AuthPopup
            authMode={authMode}
            setAuthMode={setAuthMode}
            isOpen={isDialogOpen}
            onClose={() => setIsDialogOpen(false)}
          />
        </div>
      );
      

  return createPortal(card, portalRef.current);
}
