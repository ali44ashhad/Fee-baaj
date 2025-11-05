'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { MoreVertical, Flag, Trash2 } from 'lucide-react';

type ReactionType = 'like' | 'love' | 'wow' | 'laugh' | 'sad' | 'angry';

interface ReactionItem {
  _id?: string;
  user: string | { toString(): string };
  model?: string;
  type: ReactionType;
  createdAt?: string;
}

interface Props {
  messageId: string;
  reactionCounts?: Record<string, number> | null;
  reactions?: ReactionItem[]; // raw reaction docs for this message
  currentUserId?: string | null;
  isMe: boolean; // used to anchor popover direction (sender/receiver)
  onReact: (messageId: string, type: ReactionType) => void;
  onRemove: (messageId: string) => void;

  // optional controlled open API (useful for mobile long-press)
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isDeleted?: boolean | undefined;
  onDelete?: (messageId: string) => void;
  onReport?: (messageId: string) => void;
}

const REACTION_EMOJI: Record<ReactionType, string> = {
  like: '👍',
  love: '❤️',
  wow: '😮',
  laugh: '😂',
  sad: '😢',
  angry: '😡',
};

export default function MessageReactions({
  messageId,
  reactionCounts,
  reactions = [],
  currentUserId = null,
  isMe,
  onReact,
  onRemove,
  open: controlledOpen,
  onOpenChange,
  isDeleted,
  onDelete,
  onReport,
}: Props) {
  const [openInternal, setOpenInternal] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // controlled vs uncontrolled open state
  const isControlled = typeof controlledOpen === 'boolean';
  const open = isControlled ? controlledOpen! : openInternal;
  const setOpen = useCallback(
    (v: boolean) => {
      if (isControlled) {
        onOpenChange?.(v);
      } else {
        setOpenInternal(v);
      }
    },
    [isControlled, onOpenChange],
  );

  // Compute user's reaction from reactions array (prefer reactions prop).
  const userReactionFromReactions = useMemo(() => {
    if (!currentUserId) return null;
    const r = reactions.find((rr) => String(rr.user) === String(currentUserId));
    return r ? (r.type as ReactionType) : null;
  }, [reactions, currentUserId]);

  // Build counts map (same logic as before)
  const countsMap = useMemo(() => {
    if (reactionCounts && Object.keys(reactionCounts).length > 0) {
      const sanitized: Record<string, number> = {};
      for (const k of Object.keys(reactionCounts)) {
        const v = Number(reactionCounts[k]);
        if (v > 0) sanitized[k] = v;
      }
      return sanitized;
    }

    const userLatest = new Map<string, ReactionType>();
    for (const r of reactions) {
      const uid = String(r.user);
      userLatest.set(uid, r.type as ReactionType);
    }

    const m: Record<string, number> = {};
    for (const [, t] of userLatest) {
      m[t] = (m[t] || 0) + 1;
    }

    Object.keys(m).forEach((k) => {
      m[k] = Number(m[k]) || 0;
      if (m[k] === 0) delete m[k];
    });

    return m;
  }, [reactionCounts, reactions]);

  const totalReactions = useMemo(() => {
    return Object.values(countsMap).reduce((a, b) => a + (b || 0), 0);
  }, [countsMap]);

  const topReactionTypes = useMemo(() => {
    return Object.entries(countsMap)
      .filter(([, cnt]) => (cnt || 0) > 0)
      .map(([type, cnt]) => ({ type, cnt }))
      .sort((a, b) => b.cnt - a.cnt);
  }, [countsMap]);

  const summaryTwo = useMemo(() => topReactionTypes.slice(0, 2).map((s) => s.type as ReactionType), [topReactionTypes]);

  const toggleOpen = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setOpen(!open);
    },
    [open, setOpen],
  );

  const close = useCallback(() => setOpen(false), [setOpen]);

  // click outside / Esc to close
  useEffect(() => {
    if (!open) return;
    const onDocClick = (ev: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(ev.target as Node)) close();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  // Handler when user selects a reaction
  const handleSelect = (type: ReactionType) => {
    if (userReactionFromReactions === type) {
      onRemove(messageId);
    } else {
      onReact(messageId, type);
    }
    setOpen(false);
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(messageId);
    setOpen(false);
  };

  // anchor style depending on isMe (sender: right anchor, receiver: left anchor)
  const popoverAnchoredClass = isMe ? 'right-0' : 'left-0';
  const nubAlignment = isMe ? 'mr-3 ml-auto' : 'ml-3';

  // -------------------
  // RENDER
  // -------------------
  return (
    // ADD `group` here so group-hover in the trigger works
    <div ref={containerRef} className="flex items-center select-none relative z-20 group">
      {/* Reaction summary: up to two emojis + single total count badge */}
      {summaryTwo.length > 0 && (
        <div className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs shadow-sm bg-white" aria-hidden>
          {summaryTwo.map((t, i) => (
            <span key={i} className="text-[14px] leading-none">
              <span aria-hidden>{REACTION_EMOJI[t]}</span>
            </span>
          ))}

          <span className="ml-2 text-[11px] font-semibold text-gray-700 tabular-nums">
            {totalReactions > 0 && totalReactions}
          </span>
        </div>
      )}

      {/* Trigger: will be visible on group hover or when open; ensure pointer-events enabled when open */}
      <button
        onClick={toggleOpen}
        title="React"
        type="button"
        className={` ml-2 rounded-full p-1 hover:bg-gray-100
        focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary hidden md:inline-flex transition-opacity
        duration-150 ${
          open
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto'
        } `}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="text-sm">😊</span>
      </button>

      {/* Popover: explicitly control pointer-events depending on open state */}
      <div
        aria-hidden={!open}
        role="menu"
        className={`absolute z-50 bottom-full mb-2 ${popoverAnchoredClass} ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          // animated panel: scale + fade + subtle translate; also ensure pointer-events none when closed
          className={`flex items-center ${open ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-95 -translate-y-1'}`}
          style={{ willChange: 'opacity, transform' }}
        >
          <div className="rounded-full bg-white p-2 shadow-lg flex gap-2 items-center transform transition-all duration-180 ease-out">
            {(['like', 'love', 'wow', 'laugh', 'sad', 'angry'] as ReactionType[]).map((type, i) => {
              const isActive = userReactionFromReactions === type;
              return (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation(); // avoid bubbling to document click handler
                    handleSelect(type);
                  }}
                  aria-label={type}
                  type="button"
                  className={`tiny:w-[22px] tiny:h-[22px] xs:w-[30px] xs:h-[30px] w-[36px] h-[36px] flex items-center justify-center rounded-full tiny:px-[2px] xs:px-[4px] px-2 py-1 text-lg leading-none focus:outline-none transition-transform duration-150 ${
                    isActive ? 'ring-2 ring-offset-1 ring-primary' : 'hover:scale-110'
                  }`}
                >
                  <span style={{ pointerEvents: 'none' }}>{REACTION_EMOJI[type]}</span>
                </button>
              );
            })}

            {userReactionFromReactions && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveClick(e);
                }}
                title="Remove reaction"
                className="ml-1 px-2 py-1 rounded-full hover:bg-gray-100 focus:outline-none"
              >
                ✖
              </button>
            )}
          </div>
          <div className="ml-2 inline-flex md:hidden">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (isDeleted) return;
                setMoreOpen((v) => !v);
              }}
              aria-haspopup="menu"
              className="p-1 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary"
            >
              <MoreVertical className="w-4 h-4 text-gray-600" />
            </button>

            {moreOpen && (
              <div
                role="menu"
                className={`absolute bottom-full mb-2 ${popoverAnchoredClass} z-50`}
                onClick={(e) => e.stopPropagation()}
                style={{ minWidth: 160 }}
              >
                <div className="bg-white border rounded-md shadow-lg py-1">
                  {!isMe && !isDeleted && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReport?.(messageId);
                        setMoreOpen(false);
                        setOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-red-600 flex items-center gap-2"
                      type="button"
                    >
                      <Flag className="w-4 h-4" />
                      <span>Report</span>
                    </button>
                  )}

                  {isMe && !isDeleted && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.(messageId);
                        setMoreOpen(false);
                        setOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm text-red-600 flex items-center gap-2"
                      type="button"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
