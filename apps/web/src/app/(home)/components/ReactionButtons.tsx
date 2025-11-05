'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaThumbsUp } from 'react-icons/fa6';
import useOnClickOutside from '@/hooks/useOnClickOutside';
import { useReactToCourse } from '@/hooks/useReactToCourse';
import { useAuth } from '@/hooks/use-auth';
import { AuthPopup } from '../../auth/components/auth-popup';
import LoveIcon from '../../../components/ui/icons/love';

type ReactionType = 'like' | 'love' | 'wow' | 'default';
type AuthMode = 'login' | 'signup' | null;

const ICON_BOX = 22; // fixed size used for picker icons
const DEFAULT_HOVER_OPEN_DELAY = 1500;
const DEFAULT_HOVER_CLOSE_DELAY = 200;
const DEFAULT_LONG_PRESS_DELAY = 600;
const DEFAULT_DEBOUNCE_MS = 300;

/**
 * IconWrapper
 * - variant "main": used for the main button icon. Uses the responsive Tailwind classes you requested.
 * - variant "picker": used inside the reaction picker; enforces exact width/height via inline styles so all picker icons match.
 */
function IconWrapper({
  children,
  size = ICON_BOX,
  variant = 'picker',
}: {
  children: React.ReactNode;
  size?: number;
  variant?: 'main' | 'picker';
}) {
  if (variant === 'main') {
    // Use the responsive classes you provided — no inline width/height so Tailwind controls it.
    return (
      <span
        className="inline-flex w-[20px] h-[20px] sm-custom:w-[19px] sm-custom:h-[19px] xs:w-[18px] xs:h-[18px] tiny:w-[12px] tiny:h-[12px] items-center justify-center select-none"
        aria-hidden
        style={{
          lineHeight: 0,
          display: 'inline-flex',
        }}
      >
        {children}
      </span>
    );
  }

  // picker variant: exact enforced size so all picker icons stay identical
  return (
    <span
      className="inline-flex items-center justify-center select-none"
      aria-hidden
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        lineHeight: 0,
      }}
    >
      {children}
    </span>
  );
}

/**
 * AnimatedLikeIcon
 * - variant: 'main' -> fills wrapper (use w-full h-full on svg)
 * - variant: 'picker' -> uses numeric size prop
 */
function AnimatedLikeIcon({
  size = ICON_BOX,
  active = false,
  animate = false,
  variant = 'picker',
}: {
  size?: number;
  active?: boolean;
  animate?: boolean;
  variant?: 'main' | 'picker';
}) {
  const [scale, setScale] = useState(1);
  const animateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!animate) return;
    if (animateTimerRef.current) {
      clearTimeout(animateTimerRef.current);
      animateTimerRef.current = null;
    }
    setScale(1.6);
    animateTimerRef.current = window.setTimeout(() => {
      setScale(1);
      if (animateTimerRef.current) {
        clearTimeout(animateTimerRef.current);
        animateTimerRef.current = null;
      }
    }, 200);
    return () => {
      if (animateTimerRef.current) {
        clearTimeout(animateTimerRef.current);
        animateTimerRef.current = null;
      }
    };
  }, [animate]);

  const style: React.CSSProperties = {
    transform: `scale(${scale})`,
    transition: 'transform 200ms cubic-bezier(.2,.9,.2,1)',
    display: 'inline-block',
    lineHeight: 0,
    color: active ? 'var(--primary, rgb(255,0,0))' : 'rgb(107,114,128)', // active/fallback color
  };

  // For main variant: let svg fill wrapper using w-full h-full (react-icons accept className).
  if (variant === 'main') {
    return (
      <span style={style}>
        {/* no numeric size prop so icon scales to parent's width/height */}
        <FaThumbsUp className="w-full h-full" />
      </span>
    );
  }

  // picker variant: use numeric size for pixel-perfect alignment
  return (
    <span style={style}>
      <FaThumbsUp size={size} />
    </span>
  );
}

const LABELS: Record<ReactionType, string> = {
  like: 'Like',
  love: 'Love',
  wow: 'Wow',
  default: 'Like',
};

interface InitialReactionsShape {
  like?: number;
  love?: number;
  wow?: number;
  total?: number;
}

interface ReactionButtonsProps {
  courseId: string;
  initialReactions?: InitialReactionsShape | null;
  userReaction?: { type: ReactionType | null } | null;
  disableWhileRequestInFlight?: boolean;
  hoverOpenDelayMs?: number;
  hoverCloseDelayMs?: number;
  longPressDelayMs?: number;
  debounceMs?: number;
}

export default function ReactionButtons({
  courseId,
  initialReactions = null,
  userReaction = null,
  disableWhileRequestInFlight = true,
  hoverOpenDelayMs = DEFAULT_HOVER_OPEN_DELAY,
  hoverCloseDelayMs = DEFAULT_HOVER_CLOSE_DELAY,
  longPressDelayMs = DEFAULT_LONG_PRESS_DELAY,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: ReactionButtonsProps) {
  const { isAuthenticated, mutate: mutateAuth } = useAuth();

  const supportsHoverRef = useRef(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      try {
        supportsHoverRef.current = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      } catch {
        supportsHoverRef.current = false;
      }
    }
  }, []);

  const suppressPickerOpenRef = useRef(false);
  const suppressHoverUntilMouseLeaveRef = useRef(false);

  const serverUserReaction: ReactionType | null = isAuthenticated ? (userReaction?.type ?? null) : null;
  const serverTotal: number =
    typeof initialReactions?.total === 'number'
      ? initialReactions.total
      : (initialReactions?.like ?? 0) + (initialReactions?.love ?? 0) + (initialReactions?.wow ?? 0);

  const [currentReaction, setCurrentReaction] = useState<ReactionType | null>(serverUserReaction);
  const [totalReacts, setTotalReacts] = useState<number>(serverTotal);
  useEffect(() => setCurrentReaction(serverUserReaction), [serverUserReaction]);
  useEffect(() => setTotalReacts(serverTotal), [serverTotal]);

  const reactMutation = useReactToCourse();

  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  useOnClickOutside(wrapperRef, () => setPickerOpen(false));

  // timers + refs
  const hoverOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  // mouse long-press
  const mouseDownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mainButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastActionAtRef = useRef(0);
  const requestCounterRef = useRef(0);
  const lastRequestIdRef = useRef(0);
  const activeRequestsRef = useRef(0);
  const [isInFlight, setIsInFlight] = useState(false);

  // animation states
  const [animateThumb, setAnimateThumb] = useState(false);
  const animateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pickerOpenLong, setPickerOpenLong] = useState(false); // true when opened by long press
  const [pickerAnimateIn, setPickerAnimateIn] = useState(false); // drives animated pop-in for icons
  const animateIconTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [animateIconType, setAnimateIconType] = useState<ReactionType | null>(null);

  useEffect(() => {
    return () => {
      [hoverOpenTimer, hoverCloseTimer, touchTimerRef, suppressTimerRef, mouseDownTimerRef, animateTimerRef, animateIconTimerRef].forEach(
        (r) => {
          if (r.current) {
            clearTimeout(r.current);
            r.current = null;
          }
        },
      );
    };
  }, []);

  const startRequest = () => {
    activeRequestsRef.current += 1;
    setIsInFlight(true);
  };
  const finishRequest = () => {
    activeRequestsRef.current = Math.max(0, activeRequestsRef.current - 1);
    if (activeRequestsRef.current === 0) setIsInFlight(false);
  };

  const clearHoverTimers = () => {
    if (hoverOpenTimer.current) {
      clearTimeout(hoverOpenTimer.current);
      hoverOpenTimer.current = null;
    }
    if (hoverCloseTimer.current) {
      clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
  };

  const handleMouseEnter = () => {
    // only open on hover if the device supports hover
    if (!supportsHoverRef.current) return;
    if (suppressPickerOpenRef.current || suppressHoverUntilMouseLeaveRef.current) return;

    if (hoverCloseTimer.current) {
      clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
    if (hoverOpenTimer.current) clearTimeout(hoverOpenTimer.current);
    hoverOpenTimer.current = window.setTimeout(() => {
      // open by hover -> static icons (no animateIn)
      setPickerOpen(true);
      setPickerOpenLong(false);
      setPickerAnimateIn(false);
      hoverOpenTimer.current = null;
    }, hoverOpenDelayMs);
  };

  const handleMouseLeave = () => {
    if (!supportsHoverRef.current) return;
    clearHoverTimers();
    hoverCloseTimer.current = window.setTimeout(() => {
      setPickerOpen(false);
      setPickerOpenLong(false);
      setPickerAnimateIn(false);
      hoverCloseTimer.current = null;
    }, hoverCloseDelayMs);

    if (suppressHoverUntilMouseLeaveRef.current) suppressHoverUntilMouseLeaveRef.current = false;
  };

  // touch long-press -> open picker with animation
  const handleTouchStart = (e: React.TouchEvent) => {
    if (suppressPickerOpenRef.current) return;
    longPressTriggeredRef.current = false;
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = window.setTimeout(() => {
      setPickerOpen(true);
      longPressTriggeredRef.current = true;
      setPickerOpenLong(true);
      // trigger animated pop-in for icons
      setPickerAnimateIn(false);
      // slight delay ensures initial style applied before transitioning to final state
      window.setTimeout(() => setPickerAnimateIn(true), 20);
    }, longPressDelayMs);
  };

  const clearSuppressTimer = () => {
    if (suppressTimerRef.current) {
      clearTimeout(suppressTimerRef.current);
      suppressTimerRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    suppressPickerOpenRef.current = true;
    clearSuppressTimer();
    suppressTimerRef.current = window.setTimeout(() => {
      suppressPickerOpenRef.current = false;
      suppressTimerRef.current = null;
    }, 250);
  };

  // Mouse press-and-hold to open picker (desktop long press)
  const handleMainMouseDown = (e?: React.MouseEvent) => {
    // start a mouse long press timer
    if (mouseDownTimerRef.current) {
      clearTimeout(mouseDownTimerRef.current);
      mouseDownTimerRef.current = null;
    }
    mouseDownTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setPickerOpen(true);
      setPickerOpenLong(true);
      setPickerAnimateIn(false);
      window.setTimeout(() => setPickerAnimateIn(true), 20);
      mouseDownTimerRef.current = null;
    }, longPressDelayMs);
  };

  const handleMainMouseUp = (e?: React.MouseEvent) => {
    if (mouseDownTimerRef.current) {
      clearTimeout(mouseDownTimerRef.current);
      mouseDownTimerRef.current = null;
    }
    // if we triggered long press, keep picker open (suppress click); handleMainClick uses shouldSuppressClick
  };

  const shouldSuppressClick = () => longPressTriggeredRef.current === true;

  // optimistic helpers (same as before)
  const optimisticSelect = (type: ReactionType) => {
    const prev = currentReaction;
    if (!prev) setTotalReacts((t) => t + 1);
    setCurrentReaction(type);

    // animate the selected icon briefly
    if (animateIconTimerRef.current) {
      clearTimeout(animateIconTimerRef.current);
      animateIconTimerRef.current = null;
    }
    setAnimateIconType(type);
    animateIconTimerRef.current = window.setTimeout(() => {
      setAnimateIconType(null);
      if (animateIconTimerRef.current) {
        clearTimeout(animateIconTimerRef.current);
        animateIconTimerRef.current = null;
      }
    }, 400);

    // animate thumb only when adding a like (no prev)
    if (type === 'like' && !prev) {
      if (animateTimerRef.current) {
        clearTimeout(animateTimerRef.current);
        animateTimerRef.current = null;
      }
      setAnimateThumb(true);
      animateTimerRef.current = window.setTimeout(() => {
        setAnimateThumb(false);
        if (animateTimerRef.current) {
          clearTimeout(animateTimerRef.current);
          animateTimerRef.current = null;
        }
      }, 700);
    }

    return prev;
  };

  const optimisticRemove = () => {
    const prev = currentReaction;
    if (prev) setTotalReacts((t) => Math.max(0, t - 1));
    setCurrentReaction(null);
    return prev;
  };

  const doMutate = useCallback(
    async (payload: any, onErrorRollback: () => void) => {
      const requestId = ++requestCounterRef.current;
      lastRequestIdRef.current = requestId;

      startRequest();

      const mutateAsync = (reactMutation as any)?.mutateAsync;
      if (typeof mutateAsync === 'function') {
        try {
          const res = await mutateAsync(payload);
          if (res && typeof res === 'object') {
            const r = res as any;
            if (typeof r.total === 'number') setTotalReacts(r.total);
            if ('type' in r) setCurrentReaction(r.type ?? null);
          }
        } catch (err) {
          if (lastRequestIdRef.current === requestId) onErrorRollback();
        } finally {
          finishRequest();
        }
      } else if (typeof (reactMutation as any)?.mutate === 'function') {
        (reactMutation as any).mutate(payload, {
          onError: () => {
            if (lastRequestIdRef.current === requestId) onErrorRollback();
          },
          onSuccess: (res: any) => {
            if (res && typeof res === 'object') {
              if (typeof res.total === 'number') setTotalReacts(res.total);
              if ('type' in res) setCurrentReaction(res.type ?? null);
            }
          },
          onSettled: () => {
            finishRequest();
          },
        });
      } else {
        finishRequest();
        onErrorRollback();
      }
    },
    [reactMutation],
  );

  const shouldDebounce = () => {
    const now = Date.now();
    if (now - lastActionAtRef.current < debounceMs) return true;
    lastActionAtRef.current = now;
    return false;
  };

  // Auth popup
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const setAuthModeGuarded = (mode: AuthMode | '' | undefined) => {
    const normalized: AuthMode = mode === '' || mode === undefined ? null : (mode as AuthMode);
    if (isAuthenticated && normalized !== null) {
      return;
    }
    setAuthMode(normalized);
  };

  useEffect(() => {
    if (isAuthenticated) {
      setAuthMode(null);
    }
  }, [isAuthenticated]);

  const onAuthSuccess = async () => {
    try {
      if (typeof mutateAuth === 'function') {
        await mutateAuth();
      }
    } catch (e) {
      // ignore
    } finally {
      setAuthMode(null);
    }

    const fn = pendingActionRef.current;
    pendingActionRef.current = null;
    if (fn) fn();
  };

  // Selection handlers
  const handleSelect = (type: ReactionType) => {
    if (!isAuthenticated) {
      pendingActionRef.current = () => handleSelect(type);
      setAuthMode('signup');
      return;
    }
    if (shouldDebounce()) return;

    setPickerOpen(false);
    longPressTriggeredRef.current = false;

    const prev = optimisticSelect(type);

    void doMutate({ courseId, type }, () => {
      setCurrentReaction(prev ?? null);
      if (!prev) setTotalReacts((t) => Math.max(0, t - 1));
    });
  };

  const handleRemove = () => {
    if (!isAuthenticated) {
      pendingActionRef.current = () => handleRemove();
      setAuthMode('signup');
      return;
    }
    if (shouldDebounce()) return;

    setPickerOpen(false);

    const prev = optimisticRemove();

    void doMutate({ courseId, action: 'remove' }, () => {
      setCurrentReaction(prev ?? null);
      if (prev) setTotalReacts((t) => t + 1);
    });

    longPressTriggeredRef.current = false;
  };

  const handleMainClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();

    if (!isAuthenticated) {
      pendingActionRef.current = () => handleMainClick();
      setAuthMode('signup');
      return;
    }

    if (shouldSuppressClick()) {
      longPressTriggeredRef.current = false;
      return;
    }

    if (shouldDebounce()) return;

    setPickerOpen(false);
    clearHoverTimers();

    if (!currentReaction) {
      const prev = optimisticSelect('like');
      void doMutate({ courseId, type: 'like' }, () => {
        setCurrentReaction(prev ?? null);
        if (!prev) setTotalReacts((t) => Math.max(0, t - 1));
      });
    } else {
      const prev = optimisticRemove();
      void doMutate({ courseId, action: 'remove' }, () => {
        setCurrentReaction(prev ?? null);
        if (prev) setTotalReacts((t) => t + 1);
      });
    }

    try {
      mainButtonRef.current?.blur();
    } catch {
      // ignore
    }

    if (supportsHoverRef.current) {
      suppressHoverUntilMouseLeaveRef.current = true;
    }

    suppressPickerOpenRef.current = true;
    clearSuppressTimer();
    suppressTimerRef.current = window.setTimeout(() => {
      suppressPickerOpenRef.current = false;
      suppressTimerRef.current = null;
    }, 250);
  };

  const handleMainKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleMainClick();
    }
  };

  const isDisabled = disableWhileRequestInFlight && isInFlight;

  // Render icon helper — supports 'main' (fills wrapper) and 'picker' (pixel size)
  const renderIcon = (type: ReactionType, variant: 'main' | 'picker' = 'picker') => {
    const activeClass = 'text-primary'; // ensure this matches your design (or swap to e.g. 'text-red-500')
    const inactiveClass = 'text-gray-400';

    if (type === 'like') {
      return (
        <AnimatedLikeIcon
          size={ICON_BOX}
          active={currentReaction === 'like'}
          animate={animateThumb && currentReaction === 'like'}
          variant={variant}
        />
      );
    }

    if (type === 'love') {
      // LoveIcon should accept number or CSS string like "100%"
      if (variant === 'main') {
        return (
          // allow wrapper button's color to apply if LoveIcon is color-flexible; otherwise Lottie may have its own colors
          <span className={currentReaction === 'love' ? activeClass : inactiveClass} style={{ display: 'inline-block', width: '100%', height: '100%' }}>
            <LoveIcon size="100%" />
          </span>
        );
      }
      return <LoveIcon size={ICON_BOX} />;
    }

    if (type === 'wow') {
      if (variant === 'main') {
        return <img src="/wow.png" alt="wow" style={{ width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} />;
      }
      return <img src="/wow.png" alt="wow" width={ICON_BOX} height={ICON_BOX} className="object-contain" draggable={false} />;
    }

    // default thumbs (when type === 'default')
    if (variant === 'main') {
      return <FaThumbsUp className={currentReaction ? 'w-full h-full' : 'w-full h-full text-gray-400'} />;
    }
    return <FaThumbsUp size={ICON_BOX} className="text-gray-400" />;
  };

  // When picker closes, reset long-press animation flags
  useEffect(() => {
    if (!pickerOpen) {
      longPressTriggeredRef.current = false;
      setPickerOpenLong(false);
      setPickerAnimateIn(false);
    }
  }, [pickerOpen]);

  // The reaction types we show
  const reactionTypes: ReactionType[] = ['like', 'love', 'wow'];

  return (
    <>
      <div
        ref={wrapperRef}
        className="relative inline-block rounded-lg min-w-[35px] select-none"
        style={{ WebkitUserSelect: 'none' as any, userSelect: 'none' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <button
          ref={mainButtonRef}
          onClick={handleMainClick}
          onKeyDown={handleMainKeyDown}
          onMouseDown={handleMainMouseDown}
          onMouseUp={handleMainMouseUp}
          aria-pressed={!!currentReaction}
          aria-label={currentReaction ? `Reacted: ${currentReaction}` : 'React'}
          aria-haspopup="menu"
          aria-expanded={pickerOpen}
          type="button"
          className={`flex items-center gap-2 px-2 py-2 rounded hover:shadow-sm focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${
            currentReaction ? 'text-primary' : 'text-gray-500'
          }`}
          // disabled={isDisabled}
        >
          {/* MAIN ICON: use 'main' variant so it follows your responsive Tailwind classes */}
          <IconWrapper variant="main">{currentReaction ? renderIcon(currentReaction, 'main') : renderIcon('default', 'main')}</IconWrapper>

          <span className={currentReaction ? 'text-sm text-gray-700' : 'text-sm text-gray-500'}>
            {currentReaction ? LABELS[currentReaction] : 'Like'}
          </span>
        </button>

        {pickerOpen && (
          <div
            id={`reaction-picker-${courseId}`}
            role="menu"
            aria-label="Reactions"
            className="absolute left-[90%] bottom-full mb-2 -translate-x-1/2 flex gap-2 bg-white px-3 py-2 rounded-full shadow-lg z-50"
          >
            {reactionTypes.map((type, idx) => {
              const delay = idx * 60;
              const baseStyle: React.CSSProperties = pickerOpenLong
                ? {
                    transform: pickerAnimateIn ? 'scale(1)' : 'scale(0.6)',
                    opacity: pickerAnimateIn ? 1 : 0,
                    transition: `transform 220ms cubic-bezier(.2,.9,.2,1) ${delay}ms, opacity 160ms ${delay}ms`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }
                : {
                    transform: 'scale(1)',
                    opacity: 1,
                    transition: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  };

              const isAnimatingIcon = animateIconType === type;
              if (isAnimatingIcon) {
                baseStyle.transform = 'scale(1.35)';
                baseStyle.transition = 'transform 180ms cubic-bezier(.2,.9,.2,1)';
              }

              return (
                <button
                  key={type}
                  onClick={() => handleSelect(type)}
                  className={`rounded-full text-sm disabled:opacity-60`}
                  aria-label={type}
                  role="menuitem"
                  type="button"
                  disabled={isDisabled}
                  style={{ padding: 6 }}
                >
                  <span style={baseStyle}>
                    {/* PICKER ICON: variant "picker" enforces exact ICON_BOX sizing */}
                    <IconWrapper size={ICON_BOX} variant="picker">
                      {renderIcon(type, 'picker')}
                    </IconWrapper>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <AuthPopup callback={onAuthSuccess} authMode={authMode} setAuthMode={setAuthModeGuarded} />
    </>
  );
}
