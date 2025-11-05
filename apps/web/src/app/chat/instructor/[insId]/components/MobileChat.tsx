'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IMessage } from '@elearning/types';
import Image from 'next/image';
import { ArrowLeft, Smile, BadgeCheck, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useSocket } from '@/hooks/SocketContext';
import { fetchMessages, fetchMessageById, fetchMessagesAround } from '../../actions';
import MessageReactions from './MessageReaction';
import MessageStatus from './MessageStatus';
import { addPendingMessage, getPendingMessages, removePendingMessage, PendingMessageRecord } from '@/lib/offlineQueue';
import { useParams } from 'next/navigation';

import { MESSAGE_CUTOFF, INITIAL_LIMIT, PAGE_LIMIT, url, EMOJIS } from '../helper/chat';

import ReportMessageModal from './ReportMessageModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';

import type { ChatProps, ReplySnapshot, ChatSummary } from '../helper/chat';

// --- small helper: generate a client temp id
const genTempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

interface MobileChatProps extends ChatProps {}

const LONG_PRESS_MS = 480; // long press duration for mobile reaction

type IMessageWithId = IMessage & {
  _id: string;
  __status?: 'pending' | 'failed' | 'sent';
  replyTo?: ReplySnapshot | null;
  isDeleted: boolean;
};

const MEDIA_URL = process.env.NEXT_PUBLIC_MEDIA_API_URL || '';

export default function MobileChat({
  insId: initialInsId,
  instructorName: initialInstructorName,
  instructorAvatarUrl: initialInstructorAvatarUrl,
  initialMessages,
  initialHasMore = false,
  instructorProfession: initialInstructorProfession,
  chats,
}: MobileChatProps) {
  const { user } = useAuth();
  const userImageId = user?.pictureUrl;

  const socket = useSocket();
  const params = useParams();
  const paramInsId = typeof params.insId === 'string' ? params.insId : null;


  const isIOS = () => {
    return (
      ['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod'].includes(navigator.platform) ||
      (navigator.userAgent.includes('Mac') && 'ontouchend' in document)
    );
  };

  // NEW: State to track if textarea is focused (keyboard open)
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);

  // Normalize initialMessages defensively (array or wrapped)
  const normalizedInitialMessages = useMemo(() => {
    if (!initialMessages) return [];
    if (Array.isArray(initialMessages)) return initialMessages;
    // common wrapper shapes:
    if ((initialMessages as any).results && Array.isArray((initialMessages as any).results.messages)) {
      return (initialMessages as any).results.messages;
    }
    if (Array.isArray((initialMessages as any).messages)) return (initialMessages as any).messages;
    return [];
  }, [initialMessages]);

  // Selected chat
  const [selectedChatId, setSelectedChatId] = useState<string | null>(paramInsId);

  // messages + pagination (we switched to "before" approach)
  const [messages, setMessages] = useState<IMessageWithId[]>(
    (normalizedInitialMessages || []).map((m: any) => ({ ...(m as any), __status: 'sent' })),
  );
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState<boolean>(() => Boolean(initialHasMore));

  const [sideConversations, setSideConversations] = useState<ChatSummary[]>([]);
  const [draft, setDraft] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [instructorOnline, setInstructorOnline] = useState<Record<string, boolean>>({});
  const [instructorProfessions, setInstructorProfessions] = useState<Record<string, string>>({
    [initialInsId as string]: initialInstructorProfession || '',
  });

  const [appHeight, setAppHeight] = useState<number>(typeof window !== 'undefined' ? window.innerHeight : 0);

  // optional computed main area height if you want to set it directly
  const [mainHeight, setMainHeight] = useState<number | null>(null);

  const savedBodyScrollY = useRef<number | null>(null);
  const vvRafRef = useRef<number | null>(null);
  const vvDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // NEW: typing map for instructors (per-instructor)
  const [instructorTyping, setInstructorTyping] = useState<Record<string, boolean>>({});

  // NEW: expanded state map for long messages
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  // -------- toggleExpanded (robust, works on iOS & Android) --------
  const toggleExpanded = useCallback((key: string) => {
    setExpandedMap((p) => ({ ...p, [key]: !p[key] }));

    // Wait for the DOM update so the element exists / layout updated
    requestAnimationFrame(() => {
      const el = document.getElementById(`msg-${key}`);
      if (!el) return;

      const c = containerRef.current;
      if (!c) {
        // fallback if container not available
        try {
          el.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        } catch {
          /* ignore */
        }
        return;
      }

      const elRect = el.getBoundingClientRect();
      const cRect = c.getBoundingClientRect();

      // If element is above the visible container area -> scroll so it becomes visible at top
      let desiredTop: number | null = null;
      if (elRect.top < cRect.top) {
        desiredTop = Math.max(0, Math.round(c.scrollTop + (elRect.top - cRect.top)));
      }
      // If element is below the visible container area -> scroll so it becomes visible at bottom
      else if (elRect.bottom > cRect.bottom) {
        const delta = elRect.bottom - cRect.bottom;
        desiredTop = Math.round(c.scrollTop + delta);
      }

      if (desiredTop !== null) {
        const direct = (top: number) => {
          try {
            (c as any).scrollTo?.({ top, behavior: 'auto' });
          } catch {
            c.scrollTop = top;
          }
        };
        // immediate + raf + tiny timeout retries
        direct(desiredTop);
        requestAnimationFrame(() => {
          direct(desiredTop);
          setTimeout(() => direct(desiredTop), 60);
        });

        // If visualViewport exists, resync after it stabilizes
        const vv = (window as any).visualViewport;
        if (vv) {
          const onVv = () => {
            direct(desiredTop!);
            vv.removeEventListener('resize', onVv);
            vv.removeEventListener('scroll', onVv);
          };
          vv.addEventListener('resize', onVv, { once: true });
          vv.addEventListener('scroll', onVv, { once: true });
        }
      }
    });
  }, []);
  // reply target state (set by swipe-right)
  const [replyTarget, setReplyTarget] = useState<{ id: string; snapshot: ReplySnapshot } | null>(null);

  // highlight map for scroll-to-target
  const [highlighted, setHighlighted] = useState<Record<string, boolean>>({});

  // state to control modals
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{ messageId: string } | null>(null);
  const [confirmDeleteLoading, setConfirmDeleteLoading] = useState(false);

  const [reportTargetMessageId, setReportTargetMessageId] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  //swipe animation
  const [swipingMessageId, setSwipingMessageId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  // reaction snapshot for rollback
  const snapshotRef = useRef<Record<string, IMessageWithId | null>>({});
  const cloneMsg = (m: any) => JSON.parse(JSON.stringify(m));

  // refs
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // swipe/touch refs for per-message swipe detection
  const swipeStartRef = useRef<Record<string, { x: number; y; number; t: number }>>({});
  const swipeMovedRef = useRef<Record<string, { dx: number; dy: number }>>({});

  // The textarea ref to control focus/caret and size
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [targetLoading, setTargetLoading] = useState<{ id: string; loading: boolean } | null>(null);

  const scrollToMessageByIdRef = useRef<((id: string) => void) | null>(null);
  const ensureMessageInListRef = useRef<((id: string) => Promise<void>) | null>(null);

  // Flag used to indicate we are inserting emoji programmatically (so onChange doesn't close the picker)
  const insertingEmojiRef = useRef(false);

  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const suppressScrollRef = useRef(false); // temporarily ignore scroll triggers while adjusting
  const scrollDebounceTimer = useRef<number | null>(null);

  const userImage = userImageId || '/userPlaceHolder.jpg';

  // Auto-resize: max lines 5, estimate line height to compute max-height in JS.
  const LINE_HEIGHT_PX = 20; // reasonable default; tweak if your font-size/line-height different
  const MAX_LINES = 5;
  const MAX_TEXTAREA_HEIGHT = LINE_HEIGHT_PX * MAX_LINES; // px

  const handleDelete = (msgId: string) => {
    // show the confirm delete modal only if message belongs to current user
    const msg = messages?.find((m) => String(m._id) === String(msgId));
    if (!msg) return;
    const isMe = msg.sender?.model === 'User' || String(msg.sender?.id) === String(user?._id);
    if (!isMe) {
      // shouldn't allow deleting other people's messages
      alert('You can only delete your own messages.');

      return;
    }

    setConfirmDeleteTarget({ messageId: msgId });
  };

  // Actual deletion logic (emit via socket; optimistic update)
  const performDelete = async (messageId: string) => {
    if (!socket || !messageId) {
      setConfirmDeleteTarget(null);
      return;
    }
    setConfirmDeleteLoading(true);

    try {
      // Emit delete request to server via socket.
      // Server should validate that sender === requester and then broadcast 'messageDeleted'
      socket.emit('deleteMessage', { messageId }, (ack: any) => {
        // Ack handler (optional) — server can return { ok: true/false, message }
        if (ack && ack.ok) {
          // server will broadcast messageDeleted to participants; we'll also optimistically update here
          setMessages((prev) =>
            prev.map((m) =>
              String(m._id) === String(messageId) ? ({ ...m, content: 'Message deleted', __deleted: true } as any) : m,
            ),
          );
        } else {
          // If server returned not ok -> show error
          const errMsg = ack?.message || 'Delete failed';
          alert(errMsg);
        }
        setConfirmDeleteLoading(false);
        setConfirmDeleteTarget(null);
      });

      // Fallback optimistic update in case server is slow/disconnected:
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(messageId) ? ({ ...m, content: 'Message deleted', __deleted: true } as any) : m,
        ),
      );
    } catch (err) {
      console.error('delete emit error', err);
      alert('Failed to delete message.');
      setConfirmDeleteLoading(false);
      setConfirmDeleteTarget(null);
    }
  };

  // Listen for messageDeleted broadcasts from server (so all participants update)
  useEffect(() => {
    if (!socket) return;
    const onMessageDeleted = (payload: {
      messageId: string;
      deletedBy?: { id: string; model: string };
      timestamp?: string;
    }) => {
      try {
        const { messageId } = payload || {};
        if (!messageId) return;
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(messageId) ? ({ ...m, content: 'Message deleted', __deleted: true } as any) : m,
          ),
        );
      } catch (err) {
        console.error('onMessageDeleted error', err);
      }
    };

    socket.on('messageDeleted', onMessageDeleted);
    return () => {
      socket.off('messageDeleted', onMessageDeleted);
    };
  }, [socket]);

  // REPORT: open modal (report only allowed for messages not sent by me)
  const handleOpenReport = (msgId: string) => {
    const msg = messages.find((m) => String(m._id) === String(msgId));
    if (!msg) return;
    const isMe = msg.sender?.model === 'User' || String(msg.sender?.id) === String(user?._id);
    if (isMe) {
      alert('You cannot report your own message.');

      return;
    }

    setReportTargetMessageId(msgId);
    setReportModalOpen(true);
  };

  // Called when report modal submits successfully
  const onReported = (res?: any) => {
    // optionally show a toast
    console.log('Reported:', res);
    setReportTargetMessageId(null);
    setReportModalOpen(false);
  };

  const adjustTextareaHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const scrollH = ta.scrollHeight;
    const newH = Math.min(scrollH, MAX_TEXTAREA_HEIGHT);
    ta.style.height = `${newH}px`;
    ta.style.overflowY = scrollH > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  }, []);

  // scroll helper: scroll to bottom
  const scrollToBottom = useCallback(() => {
    const c = containerRef.current;

    // If container not mounted, try bottomRef fallback (also instant)
    if (!c) {
      try {
        bottomRef.current?.scrollIntoView({ behavior: 'auto' });
      } catch {
        /* ignore */
      }
      return;
    }

    const directScroll = () => {
      try {
        // prefer scrollTo with behavior 'auto' if available
        if (typeof (c as any).scrollTo === 'function') {
          (c as any).scrollTo({ top: c.scrollHeight, behavior: 'auto' });
        } else {
          c.scrollTop = c.scrollHeight;
        }
      } catch {
        // final fallback
        c.scrollTop = c.scrollHeight;
      }
    };

    // Immediate direct scroll
    directScroll();

    // Extra attempts to guard against iOS layout/viewport race conditions
    // 1) RAF (next paint)
    requestAnimationFrame(() => {
      directScroll();
      // 2) tiny timeout (let layout/keyboard settle)
      setTimeout(() => {
        directScroll();
      }, 60);
    });

    // If visualViewport exists, also try once after it stabilizes
    const vv = (window as any).visualViewport;
    if (vv) {
      const onVv = () => {
        directScroll();
        vv.removeEventListener('resize', onVv);
        vv.removeEventListener('scroll', onVv);
      };
      vv.addEventListener('resize', onVv, { once: true });
      vv.addEventListener('scroll', onVv, { once: true });
    }
  }, []); // no deps: uses refs/states directly so stable

  // Typing indicator logic (mirror DesktopChat)
  const typingTimerRef = useRef<number | null>(null);
  const isTypingSentRef = useRef<boolean>(false);
  const prevSelectedRef = useRef<string | null>(selectedChatId);
  const TYPING_TIMEOUT_MS = 2000;

  const scheduleStopTyping = useCallback(
    (room: string) => {
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
      }
      typingTimerRef.current = window.setTimeout(() => {
        try {
          socket?.emit('typing', { room, isTyping: false });
        } catch (err) {
          // ignore
        }
        isTypingSentRef.current = false;
        typingTimerRef.current = null;
      }, TYPING_TIMEOUT_MS);
    },
    [socket],
  );

  const handleUserTyping = useCallback(() => {
    if (!socket || !user || !selectedChatId) return;
    const room = `Instructor:${selectedChatId}-User:${user._id}`;
    try {
      if (!isTypingSentRef.current) {
        socket.emit('typing', { room, isTyping: true });
        isTypingSentRef.current = true;
      }
      scheduleStopTyping(room);
    } catch (err) {
      // ignore
    }
  }, [socket, user, selectedChatId, scheduleStopTyping]);

  // auto-scroll behavior: if user near bottom, scroll on new messages
  // -------- auto-scroll on new messages (robust, iOS-safe) --------
  useEffect(() => {
    const c = containerRef.current;

    if (!c) {
      // no container yet -> try generic scrollToBottom fallback
      scrollToBottom();
      return;
    }

    const distanceFromBottom = c.scrollHeight - (c.scrollTop + c.clientHeight);

    // Auto-scroll only if we're exactly at the bottom OR the user is typing (ensures they see new messages)
    const shouldAutoScroll = distanceFromBottom <= 0 || isTextareaFocused;

    if (!shouldAutoScroll) return;

    // do the scroll via scrollToBottom (instant-only function you already have)
    if (isIOS()) {
      // On iOS, delay slightly to allow keyboard/visualViewport adjustments
      setTimeout(
        () => {
          scrollToBottom(); // scrollToBottom handles RAF/timeouts internally
        },
        isTextareaFocused ? 100 : 50,
      );
    } else {
      // Non-iOS: immediate
      scrollToBottom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, isTextareaFocused, scrollToBottom]);

  // Sidebar init
  useEffect(() => {
    // defensive: if chats is undefined/null, set empty
    if (!Array.isArray(chats)) {
      setSideConversations([]);
      return;
    }

    const sorted = chats
      .map((c) => {
        // compute a numeric timestamp once
        const ts = c?.lastMessageAt ? Date.parse(c.lastMessageAt) : 0;
        return { ...c, __lastAt: Number.isFinite(ts) ? ts : 0 };
      })
      .sort((a, b) => {
        // primary: newest first
        const diff = b.__lastAt - a.__lastAt;
        if (diff !== 0) return diff;
        // tie-breaker: unread first
        const unreadDiff = (b.unreadCount ?? 0) - (a.unreadCount ?? 0);
        if (unreadDiff !== 0) return unreadDiff;
        // final fallback: stable alphabetical by name
        return String(a.name ?? '').localeCompare(String(b.name ?? ''));
      })
      // remove the helper field before saving back
      .map(({ __lastAt, ...rest }) => rest);

    setSideConversations(sorted);
  }, [chats]);

  // When fetching new instructors, add to mapping
  useEffect(() => {
    const newProfessions: Record<string, string> = {};
    chats.forEach((chat) => {
      if (!instructorProfessions[chat.instructorId]) {
        newProfessions[chat.instructorId] = initialInstructorProfession || '';
      }
    });
    setInstructorProfessions((prev) => ({ ...prev, ...newProfessions }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats]);

  // Better iOS keyboard viewport tracking
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: number | null = null;
    let rafId: number | null = null;

    const KEYBOARD_THRESHOLD = 80; // px — tune if needed

    const getVV = () => (window as any).visualViewport as VisualViewport | undefined;

    const measureHeaderFooter = () => {
      const headerH = headerRef.current?.getBoundingClientRect().height ?? 0;
      const footerH = footerRef.current?.getBoundingClientRect().height ?? 0;
      return { headerH, footerH };
    };

    const setCssVarsAndState = (vvHeight: number, keyboardPx: number) => {
      // set CSS vars so CSS can use them
      document.documentElement.style.setProperty('--app-height', `${Math.round(vvHeight)}px`);
      document.documentElement.style.setProperty('--keyboard-offset', `${Math.round(keyboardPx)}px`);

      setAppHeight(Math.round(vvHeight)); // optional: keep state if used elsewhere

      // compute main area (visible height minus header/footer)
      const { headerH, footerH } = measureHeaderFooter();
      const mainH = Math.max(0, Math.round(vvHeight - headerH - footerH));
      setMainHeight(mainH);
    };

    const robustScrollToBottom = () => {
      const c = containerRef.current;
      if (c) {
        try {
          c.scrollTop = c.scrollHeight;
        } catch {
          try {
            (c as any).scrollTo?.({ top: c.scrollHeight, behavior: 'auto' });
          } catch {}
        }
        try {
          if (rafId) cancelAnimationFrame(rafId);
        } catch {}
        rafId = requestAnimationFrame(() => {
          try {
            c.scrollTop = c.scrollHeight;
          } catch {}
        });
      } else {
        try {
          bottomRef?.current?.scrollIntoView?.({ behavior: 'auto' });
        } catch {}
      }
    };

    const onViewportChange = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      // small debounce so keyboard animation can finish
      timeoutId = window.setTimeout(() => {
        const vvNow = getVV();
        const vvHeight = vvNow?.height ?? window.innerHeight;
        const vvOffsetTop = vvNow?.offsetTop ?? 0;
        const keyboardPx = Math.max(0, window.innerHeight - vvHeight - vvOffsetTop);

        setCssVarsAndState(vvHeight, keyboardPx);

        const likelyOpen = keyboardPx > KEYBOARD_THRESHOLD || vvHeight < window.innerHeight - KEYBOARD_THRESHOLD;
        const focused = document.activeElement === textareaRef.current || isTextareaFocused;

        // If focused and keyboard likely open -> aggressively ensure bottom visible
        if (focused && likelyOpen) {
          robustScrollToBottom();
          window.setTimeout(() => robustScrollToBottom(), 60);
          window.setTimeout(() => robustScrollToBottom(), 250);
        } else if (focused) {
          // no keyboard but focused -> simple scroll
          requestAnimationFrame(() => {
            try {
              containerRef.current?.scrollTo?.({ top: containerRef.current.scrollHeight, behavior: 'auto' });
            } catch {
              robustScrollToBottom();
            }
          });
        }
      }, 80); // debounce
    };

    // Attach listeners
    const vv = getVV();
    if (vv) {
      try {
        vv.addEventListener('resize', onViewportChange);
        vv.addEventListener('scroll', onViewportChange);
      } catch (e) {
        // ignore attach errors
      }
    }
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);
    window.addEventListener('focusin', onViewportChange);
    window.addEventListener('focusout', onViewportChange);

    // initial run
    onViewportChange();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      try {
        if (rafId) cancelAnimationFrame(rafId);
      } catch {}
      if (vv) {
        try {
          vv.removeEventListener('resize', onViewportChange);
          vv.removeEventListener('scroll', onViewportChange);
        } catch {}
      }
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('orientationchange', onViewportChange);
      window.removeEventListener('focusin', onViewportChange);
      window.removeEventListener('focusout', onViewportChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTextareaFocused]);

  // Helper: focus the textarea reliably when possible
  const focusTextarea = useCallback(() => {
    try {
      textareaRef.current?.focus();
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    } catch (err) {
      // ignore
    }
  }, []);

  // -------------------------
  // load messages using before-based pagination
  // -------------------------
  // load initial messages (latest)
  const loadInitialMessages = useCallback(
    async (instructorId: string): Promise<IMessageWithId[]> => {
      setLoadingMessages(true);
      try {
        const { messages: msgs = [], hasMore: hm = false } = await fetchMessages(
          instructorId,
          undefined,
          INITIAL_LIMIT,
        );

        const annotated: IMessageWithId[] = Array.isArray(msgs)
          ? (msgs as any).map((m: any) => ({ ...(m as any), __status: 'sent' }))
          : [];

        setMessages(annotated);
        setHasMore(Boolean(hm));

        // scroll to bottom after React paints — use robust helper for iOS/Android
        requestAnimationFrame(() => {
          scrollToBottom();
          requestAnimationFrame(() => {
            setTimeout(() => scrollToBottom(), 40);
          });
        });

        // try to focus input
        focusTextarea();

        return annotated;
      } catch (err) {
        console.error('Failed to load initial messages:', err);
        alert('Failed to load messages. Please check your connection.');
        return [];
      } finally {
        setLoadingMessages(false);
      }
    },
    [focusTextarea, scrollToBottom],
  );

  // load older messages (prepend) using oldest message createdAt as before
  const loadOlderMessages = useCallback(
    async (instructorId: string) => {
      if (!hasMore || isLoadingOlder || loadingMessages) {
        suppressScrollRef.current = false;
        return;
      }

      setIsLoadingOlder(true);
      suppressScrollRef.current = true;

      const container = containerRef.current;
      const prevScrollHeight = container?.scrollHeight ?? 0;
      const prevScrollTop = container?.scrollTop ?? 0;
      const oldest = messages[0];
      const beforeIso = oldest && oldest.createdAt ? String(oldest.createdAt) : undefined;

      try {
        const { messages: olderMsgs = [], hasMore: hm = false } = await fetchMessages(
          instructorId,
          beforeIso,
          PAGE_LIMIT,
        );

        if (!olderMsgs || olderMsgs.length === 0) {
          setHasMore(Boolean(hm));
          return;
        }

        const existingIds = new Set(messages.map((m) => String((m as any)._id)));
        const filtered = olderMsgs.filter((m: any) => !existingIds.has(String((m as any)._id)));
        const annotated = filtered.map((m: any) => ({ ...m, __status: 'sent' }));

        setMessages((prev) => [...annotated, ...prev]);

        // preserve scroll position after prepend
        requestAnimationFrame(() => {
          const newScrollHeight = container?.scrollHeight ?? 0;
          if (!container) return;
          const delta = newScrollHeight - prevScrollHeight;
          const targetTop = prevScrollTop + delta;

          try {
            if (typeof (container as any).scrollTo === 'function') {
              (container as any).scrollTo({ top: targetTop, behavior: 'auto' });
            } else {
              container.scrollTop = targetTop;
            }
          } catch {
            container.scrollTop = targetTop;
          }

          // extra RAF to help iOS stabilize, then release suppression shortly after
          requestAnimationFrame(() => {
            try {
              if (typeof (container as any).scrollTo === 'function') {
                (container as any).scrollTo({ top: targetTop, behavior: 'auto' });
              } else {
                container.scrollTop = targetTop;
              }
            } catch {
              container.scrollTop = targetTop;
            }

            setTimeout(() => {
              suppressScrollRef.current = false;
            }, 60);
          });
        });

        setHasMore(Boolean(hm));
      } catch (err) {
        console.error('Failed to load older messages:', err);
        alert('Failed to load older messages. Please check your connection.');
        suppressScrollRef.current = false;
      } finally {
        setIsLoadingOlder(false);
      }
    },
    [hasMore, isLoadingOlder, messages, PAGE_LIMIT, fetchMessages, loadingMessages], // adapt deps to actual names
  );

  // Open conversation (used from list) — keep keyboard open and focus
  // --- openChat: uses the returned messages from loadInitialMessages and marks them as seen correctly
  const openChat = useCallback(
    async (instructorId: string) => {
      // set UI selected conversation immediately
      setSelectedChatId(instructorId);
      focusTextarea();

      setLoadingMessages(true);
      try {
        // LOAD: get the fresh messages (loadInitialMessages now RETURNS the array)
        const loaded = await loadInitialMessages(instructorId);

        // Clear unread for this conversation in the sidebar
        setSideConversations((prev) =>
          prev.map((c) => (c.instructorId === instructorId ? { ...c, unreadCount: 0 } : c)),
        );

        // Ensure socket exists and we are (attempting) to join the relevant rooms so server-side routing works.
        // This avoids a race where we emit markAsSeen before the participant/instructor personal room exists on server.
        if (socket) {
          try {
            // join private room for this pair (in case it isn't already joined by other logic)
            socket.emit('joinRoom', { room: `Instructor:${instructorId}-User:${user?._id}` });
            // also join the user's personal room (defensive)
            socket.emit('joinRoom', { room: `User:${user?._id}` });
          } catch (err) {
            console.warn('joinRoom emits failed (non-fatal)', err);
          }
        }

        // If there are loaded messages, mark instructor messages as seen — use the freshly-loaded array (not `messages` state)
        if (Array.isArray(loaded) && loaded.length > 0 && socket && user) {
          // collect ids that need marking
          const idsToMark = loaded
            .filter((msg) => msg && msg.sender && msg.sender.model === 'Instructor' && msg._id)
            .filter((msg) => {
              // skip messages already seen by this user
              const seenByArr = Array.isArray(msg.seenBy) ? msg.seenBy : [];
              return !seenByArr.some((p: any) => String(p.id) === String(user?._id));
            })
            .map((m) => String((m as any)._id));

          // dedupe ids
          const uniqueIds = Array.from(new Set(idsToMark));

          if (uniqueIds.length > 0) {
            // Emit markAsSeen for each message (server will broadcast messageSeen back to participants)
            // Note: if you prefer, you can implement a server-side `markManyAsSeen` to reduce chattiness.
            uniqueIds.forEach((messageId) => {
              try {
                // only emit if socket is connected — otherwise these will be lost (or your pending queue logic will handle)
                if ((socket as any).connected) {
                  socket.emit('markAsSeen', { messageId });
                }
              } catch (err) {
                console.warn('markAsSeen emit failed for', messageId, err);
              }
            });

            // Optimistically update local messages so UI shows the messages as seen right away
            setMessages((prev) =>
              prev.map((m) => {
                if (!m || !m._id) return m;
                if (!uniqueIds.includes(String(m._id))) return m;
                const existingSeen = Array.isArray(m.seenBy) ? m.seenBy.slice() : [];
                // append current user if not already in seenBy
                if (!existingSeen.some((p: any) => String(p?.id) === String(user?._id))) {
                  existingSeen.push({ id: user?._id, model: 'User' });
                }
                return { ...m, seenBy: existingSeen };
              }),
            );
          }
        }
      } catch (err) {
        console.error('openChat error', err);
        alert('Failed to open chat. Please try again.');
      } finally {
        setLoadingMessages(false);
        requestAnimationFrame(() => focusTextarea());
        requestAnimationFrame(() => scrollToBottom());
      }
    },
    // dependencies: loadInitialMessages is stable (useCallback); socket and user are external
    [loadInitialMessages, socket, user, focusTextarea],
  );

  // If component receives initial messages for initialInsId, use them (mount)
  useEffect(() => {
    if (!initialInsId) return;
    if (normalizedInitialMessages && normalizedInitialMessages.length > 0) {
      const annotated = normalizedInitialMessages.map((m: any) => ({ ...m, __status: 'sent' }));
      setMessages(annotated);
      setHasMore(Boolean(initialHasMore));
      // ensure scroll bottom
      requestAnimationFrame(() => {
        const c = containerRef.current;
        if (c) c.scrollTop = c.scrollHeight;
        else bottomRef.current?.scrollIntoView({ behavior: 'auto' });
      });
      // focus textarea
      requestAnimationFrame(() => focusTextarea());
    } else {
      // if no initial messages provided, but an initialInsId exists, load initial chunk
      loadInitialMessages(initialInsId);
    }
    // set the selected chat to initialInsId if provided
    // setSelectedChatId(initialInsId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialInsId, normalizedInitialMessages, initialHasMore]);

  // Presence identification
  useEffect(() => {
    if (!socket || !user) return;
    socket.on('requestIdentify', () => socket.emit('identify', { id: user._id, model: 'User' }));
    socket.on('InstructorOnline', ({ id }) => setInstructorOnline((m) => ({ ...m, [id]: true })));
    socket.on('InstructorOffline', ({ id }) => setInstructorOnline((m) => ({ ...m, [id]: false })));
    return () => {
      socket.off('requestIdentify');
      socket.off('InstructorOnline');
      socket.off('InstructorOffline');
    };
  }, [socket, user]);

  // check online status on demand
  useEffect(() => {
    if (!socket || !selectedChatId) return;
    socket.emit('checkOnlineStatus', { id: selectedChatId, model: 'Instructor' }, ({ online }: { online: boolean }) => {
      setInstructorOnline((m) => ({ ...m, [selectedChatId]: online }));
    });
  }, [socket, selectedChatId]);

  // Join user-wide room and identify once socket + user exist
  useEffect(() => {
    if (!socket || !user) return;

    const userRoom = `User:${user._id}`;

    const onConnectUser = () => {
      try {
        socket.emit('identify', { id: user._id, model: 'User' });
        socket.emit('joinRoom', { room: userRoom });
      } catch (err) {
        console.error('onConnectUser error', err);
      }
    };

    socket.on('connect', onConnectUser);
    if ((socket as any).connected) onConnectUser();

    return () => {
      socket.off('connect', onConnectUser);
      try {
        socket.emit('leaveRoom', { room: userRoom });
      } catch {}
    };
  }, [socket, user]);
  // -------------------------
  // Core realtime handlers (with dedupe & temp replacement)
  // -------------------------
  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (msg: IMessage & { sentByMe?: boolean }) => {
      // Determine instructor id for this message (other party)
      const otherId =
        msg.sender.model === 'Instructor'
          ? String(msg.sender.id)
          : msg.receiver?.model === 'Instructor'
            ? String(msg.receiver.id)
            : null;

      if (!otherId) return;

      // Update sidebar: increment unread only when this conversation is NOT active.
      setSideConversations((prev) =>
        prev
          .map((c) => {
            // ensure instructorId is string for robust comparison
            const convId = String(c.instructorId);
            if (convId !== otherId) return c;

            // compute new unread:
            const currentlyActive = String(selectedChatId) === String(otherId);
            const currentUnread = Number(c.unreadCount ?? 0);

            const shouldIncrement = !currentlyActive && msg.sender.model === 'Instructor';
            const newUnread = shouldIncrement ? currentUnread + 1 : 0;

            return {
              ...c,
              lastMessage: msg.content,
              lastMessageAt: new Date(String(msg.createdAt)).toISOString(),
              unreadCount: newUnread,
            };
          })
          .sort((a, b) => new Date(String(b.lastMessageAt)).getTime() - new Date(String(a.lastMessageAt)).getTime()),
      );

      // If message belongs to currently open chat, append but dedupe and replace temp if possible
      if (String(otherId) === String(selectedChatId)) {
        setMessages((prev) => {
          const serverId = String((msg as any)._id);
          // If server message already exists -> ignore
          if (prev.some((x) => String(x._id) === serverId)) return prev;

          const clientTempId = (msg as any).clientTempId ? String((msg as any).clientTempId) : null;

          if (clientTempId && prev.some((x) => String(x._id) === clientTempId)) {
            // replace temp with server message
            const replaced = prev.map((m) =>
              String(m._id) === clientTempId ? { ...(msg as any), __status: 'sent' } : m,
            );
            requestAnimationFrame(() => scrollToBottom());
            return replaced;
          }

          // otherwise append server message
          const appended = [...prev, { ...(msg as any), __status: 'sent' }];

          const c = containerRef.current;
          const distanceFromBottom = c ? c.scrollHeight - (c.scrollTop + c.clientHeight) : 0;
          if (distanceFromBottom < 120) {
            requestAnimationFrame(() => scrollToBottom());
          }

          // If instructor message and chat is active, mark seen
          if (msg.sender.model === 'Instructor') {
            try {
              socket?.emit('markAsSeen', { messageId: (msg as any)._id });
            } catch (err) {
              console.warn('markAsSeen emit failed', err);
            }
          }

          return appended;
        });
      }
    };

    const onMessageSeen = ({ messageId, seenBy }: { messageId: string; seenBy: any[] }) => {
      setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, seenBy } : m)));
    };

    const onReactionUpdated = (payload: any) => {
      if (!payload || !payload.messageId) return;
      const { messageId, reactionCounts, reactions, userReaction } = payload;

      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(messageId)
            ? {
                ...m,
                // update counts if sent, otherwise keep existing
                reactionCounts: reactionCounts ?? m.reactionCounts,
                // full reactions array if backend provided one
                reactions: reactions ?? m.reactions,
                // backend sometimes returns 'userReaction' (current user's reaction) — keep it too
                userReaction: userReaction ?? (m as any).userReaction ?? null,
              }
            : m,
        ),
      );
    };

    socket.on('newMessage', onNewMessage);
    socket.on('messageSeen', onMessageSeen);
    socket.on('messageReactionUpdated', onReactionUpdated);

    return () => {
      socket.off('newMessage', onNewMessage);
      socket.off('messageSeen', onMessageSeen);
      socket.off('messageReactionUpdated', onReactionUpdated);
    };
  }, [socket, selectedChatId, scrollToBottom]);

  // listen for 'typing' events from server
  useEffect(() => {
    if (!socket) return;

    const onTyping = (payload: { userId?: string; model?: 'User' | 'Instructor'; isTyping?: boolean }) => {
      try {
        if (!payload) return;
        if (payload.model === 'Instructor' && String(payload.userId) === String(selectedChatId)) {
          setInstructorTyping((prev) => ({ ...prev, [selectedChatId as string]: !!payload.isTyping }));
        }
      } catch (err) {
        // ignore
      }
    };

    socket.on('typing', onTyping);
    return () => {
      socket.off('typing', onTyping);
      if (selectedChatId) setInstructorTyping((prev) => ({ ...prev, [selectedChatId]: false }));
    };
  }, [socket, selectedChatId]);

  // when selectedChatId changes, ensure we stop typing in previous room
  useEffect(() => {
    if (!user) return;
    const prev = prevSelectedRef.current;
    if (prev && prev !== selectedChatId && isTypingSentRef.current) {
      try {
        const prevRoom = `Instructor:${prev}-User:${user._id}`;
        socket?.emit('typing', { room: prevRoom, isTyping: false });
      } catch (err) {
        // ignore
      }
      isTypingSentRef.current = false;
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    }
    prevSelectedRef.current = selectedChatId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChatId]);

  // stop typing on blur
  const onTextareaBlur = () => {
    if (isTypingSentRef.current && user && selectedChatId) {
      try {
        const room = `Instructor:${selectedChatId}-User:${user._id}`;
        socket?.emit('typing', { room, isTyping: false });
      } catch (err) {
        // ignore
      }
      isTypingSentRef.current = false;
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    }
    // NEW: Update textarea focus state
    setIsTextareaFocused(false);
  };

  // cleanup on unmount: clear timers and send stop typing if needed
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
      }
      if (isTypingSentRef.current && user && prevSelectedRef.current) {
        try {
          const prevRoom = `Instructor:${prevSelectedRef.current}-User:${user._id}`;
          socket?.emit('typing', { room: prevRoom, isTyping: false });
        } catch (err) {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Acks for optimistic reactions (rollback on error)
  useEffect(() => {
    if (!socket) return;

    const onReactAck = (ack: any) => {
      try {
        if (!ack) return;
        if (!ack.ok) {
          const msgId = ack?.messageId || (ack?.data && ack.data.messageId);
          if (msgId && snapshotRef.current[msgId]) {
            const snap = snapshotRef.current[msgId];
            setMessages((prev) => prev.map((m) => ((m as any)._id === msgId ? snap : m)));
            delete snapshotRef.current[msgId];
            alert('Failed to react: ' + (ack.message || 'Unknown error'));
          }
          return;
        }
        const data = ack.data;
        if (data && data.messageId) {
          const { messageId, reactionCounts, reactions, userReaction } = data;
          setMessages((prev) =>
            prev.map((m) =>
              String(m._id) === String(messageId)
                ? {
                    ...m,
                    reactionCounts: reactionCounts ?? m.reactionCounts,
                    reactions: reactions ?? m.reactions,
                    userReaction: userReaction ?? (m as any).userReaction ?? null,
                  }
                : m,
            ),
          );
          delete snapshotRef.current[data.messageId];
        }
      } catch (err) {
        console.error('onReactAck handler error', err);
      }
    };

    const onRemoveAck = (ack: any) => {
      try {
        if (!ack) return;
        if (!ack.ok) {
          const msgId = ack?.messageId || (ack?.data && ack.data.messageId);
          if (msgId && snapshotRef.current[msgId]) {
            const snap = snapshotRef.current[msgId];
            setMessages((prev) => prev.map((m) => ((m as any)._id === msgId ? snap : m)));
            delete snapshotRef.current[msgId];
            alert('Failed to remove reaction: ' + (ack.message || 'Unknown error'));
          }
          return;
        }
        const data = ack.data;
        if (data && data.messageId) {
          const { messageId, reactionCounts, reactions, userReaction } = data;
          setMessages((prev) =>
            prev.map((m) =>
              String(m._id) === String(messageId)
                ? {
                    ...m,
                    reactionCounts: reactionCounts ?? m.reactionCounts,
                    reactions: reactions ?? m.reactions,
                    userReaction: userReaction ?? (m as any).userReaction ?? null,
                  }
                : m,
            ),
          );
          delete snapshotRef.current[data.messageId];
        }
      } catch (err) {
        console.error('onRemoveAck handler error', err);
      }
    };

    socket.on('reactAck', onReactAck);
    socket.on('removeReactionAck', onRemoveAck);

    return () => {
      socket.off('reactAck', onReactAck);
      socket.off('removeReactionAck', onRemoveAck);
    };
  }, [socket]);

  // --------------------------
  // Reaction handling (frontend optimistic)
  // --------------------------
  const applyOptimisticReaction = (messageId: string, userId: string, type?: string | null) => {
    setMessages((prev) =>
      prev.map((m) => {
        if ((m as any)._id !== messageId) return m;

        const mm: any = { ...(m as any) };
        mm.reactionCounts = mm.reactionCounts ? { ...mm.reactionCounts } : {};
        mm.reactions = Array.isArray(mm.reactions) ? mm.reactions.slice() : [];

        const existingIndex = mm.reactions.findIndex((r: any) => String(r.user) === String(userId));
        const existingType = existingIndex !== -1 ? mm.reactions[existingIndex].type : null;

        if (!type) {
          // remove reaction
          if (existingIndex !== -1) {
            const removed = mm.reactions.splice(existingIndex, 1)[0];
            const et = removed.type;
            mm.reactionCounts[et] = Math.max(0, (mm.reactionCounts[et] || 0) - 1);
          }
          // also clear the current user's reaction flag
          mm.userReaction = null;
        } else {
          if (existingIndex !== -1) {
            if (existingType === type) {
              // toggle off
              mm.reactions.splice(existingIndex, 1);
              mm.reactionCounts[type] = Math.max(0, (mm.reactionCounts[type] || 0) - 1);
              mm.userReaction = null;
            } else {
              // change type
              mm.reactions[existingIndex] = {
                ...mm.reactions[existingIndex],
                type,
                createdAt: new Date().toISOString(),
              };
              if (existingType)
                mm.reactionCounts[existingType] = Math.max(0, (mm.reactionCounts[existingType] || 0) - 1);
              mm.reactionCounts[type] = (mm.reactionCounts[type] || 0) + 1;
              mm.userReaction = type;
            }
          } else {
            // add
            mm.reactions.push({ user: userId, type, createdAt: new Date().toISOString() });
            mm.reactionCounts[type] = (mm.reactionCounts[type] || 0) + 1;
            mm.userReaction = type;
          }
        }

        return mm;
      }),
    );
  };

  const handleReactOptimistic = async (messageId: string, type?: string | null) => {
    if (!socket || !user) {
      alert('Please login to react.');
      return;
    }
    const msgSnapshot = (messages || []).find((m) => (m as any)._id === messageId);
    snapshotRef.current[messageId] = msgSnapshot ? cloneMsg(msgSnapshot) : null;

    applyOptimisticReaction(messageId, user._id as string, type ?? null);

    if (type) {
      socket.emit('reactToMessage', { messageId, type, toggleOnSame: false });
    } else {
      socket.emit('removeMessageReaction', { messageId });
    }
    // rely on ack/broadcast to finalize or rollback
  };

  // --------------------------
  // Mobile long-press handling to open reaction popover
  // --------------------------
  const longPressTimer = useRef<Record<string, number>>({});
  const [openReactionFor, setOpenReactionFor] = useState<string | null>(null);
  const [longPressActive, setLongPressActive] = useState<string | null>(null);

  const headerRef = useRef<HTMLElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);

  const startLongPress = (messageKey: string) => {
    setLongPressActive(messageKey);
    clearTimeout(longPressTimer.current[messageKey]);
    longPressTimer.current[messageKey] = window.setTimeout(() => {
      setOpenReactionFor(messageKey);
      setLongPressActive(null);
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = (messageKey: string) => {
    setLongPressActive(null);
    const t = longPressTimer.current[messageKey];
    if (t) {
      clearTimeout(t);
      delete longPressTimer.current[messageKey];
    }
  };

  const closeReactionPopover = () => setOpenReactionFor(null);

  // --------------------------
  // Swipe-right to reply: touch handlers
  // --------------------------
  const SWIPE_THRESHOLD_PX = 60; // how far right to consider a reply
  const MAX_VERTICAL_DRIFT = 80; // if user moves vertically more than this, cancel swipe

  const onMessageTouchStart = (ev: React.TouchEvent, messageKey: string) => {
    // don't cancel any timer here (we want the touch-start -> long-press sequence to succeed)
    const t = ev.touches[0];
    swipeStartRef.current[messageKey] = { x: t.clientX, y: t.clientY, t: Date.now() };
    swipeMovedRef.current[messageKey] = { dx: 0, dy: 0 };
  };

  const onMessageTouchMove = (ev: React.TouchEvent, messageKey: string) => {
    const s = swipeStartRef.current[messageKey];
    if (!s) return;
    const t = ev.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    swipeMovedRef.current[messageKey] = { dx, dy };

    // If we're swiping right (positive dx) and vertical drift is minimal
    if (dx > 0 && Math.abs(dy) < MAX_VERTICAL_DRIFT) {
      setSwipingMessageId(messageKey);
      // Calculate the swipe offset (capped at 80px)
      const offset = Math.min(dx, 80);
      setSwipeOffset(offset);
    } else if (Math.abs(dy) > MAX_VERTICAL_DRIFT) {
      // Cancel swipe if vertical drift is too large
      setSwipingMessageId(null);
      setSwipeOffset(0);
      delete swipeStartRef.current[messageKey];
    }
  };

  const onMessageTouchEnd = (ev: React.TouchEvent, msg: IMessageWithId, messageKey: string) => {
    // Clean up long press timer
    cancelLongPress(messageKey);

    const moved = swipeMovedRef.current[messageKey];
    const start = swipeStartRef.current[messageKey];
    delete swipeStartRef.current[messageKey];
    delete swipeMovedRef.current[messageKey];

    if (!moved || !start) return;

    // Animate back to original position
    setSwipeOffset(0);

    // After a short delay, check if it was a valid swipe
    setTimeout(() => {
      if (moved.dx > SWIPE_THRESHOLD_PX && Math.abs(moved.dy) < MAX_VERTICAL_DRIFT) {
        // Consider as reply swipe
        startReplyTo(msg);
      }
      setSwipingMessageId(null);
    }, 0); // Match this with the CSS transition duration
  };

  // Also handle pointer (mouse) drag for devices that support it — non-primary pointer ignored
  const onMessagePointerDown = (ev: React.PointerEvent, messageKey: string) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    const x = ev.clientX;
    const y: number = ev.clientY;
    swipeStartRef.current[messageKey] = { x, y, t: Date.now() };
    swipeMovedRef.current[messageKey] = { dx: 0, dy: 0 };
    // capture pointer to receive move/up
    (ev.target as Element).setPointerCapture?.((ev as any).pointerId);
  };

  const onMessagePointerMove = (ev: React.PointerEvent, messageKey: string) => {
    const s = swipeStartRef.current[messageKey];
    if (!s) return;
    const dx = ev.clientX - s.x;
    const dy = ev.clientY - s.y;
    swipeMovedRef.current[messageKey] = { dx, dy };

    // If we're swiping right (positive dx) and vertical drift is minimal
    if (dx > 0 && Math.abs(dy) < MAX_VERTICAL_DRIFT) {
      setSwipingMessageId(messageKey);
      // Calculate the swipe offset (capped at 80px)
      const offset = Math.min(dx, 80);
      setSwipeOffset(offset);
    } else if (Math.abs(dy) > MAX_VERTICAL_DRIFT) {
      // Cancel swipe if vertical drift is too large
      setSwipingMessageId(null);
      setSwipeOffset(0);
      delete swipeStartRef.current[messageKey];
    }
  };

  const onMessagePointerUp = (ev: React.PointerEvent, msg: IMessageWithId, messageKey: string) => {
    const moved = swipeMovedRef.current[messageKey];
    const start = swipeStartRef.current[messageKey];
    delete swipeStartRef.current[messageKey];
    delete swipeMovedRef.current[messageKey];
    try {
      (ev.target as Element).releasePointerCapture?.((ev as any).pointerId);
    } catch (err) {
      // ignore
    }

    // Animate back to original position
    setSwipeOffset(0);

    if (!moved || !start) return;

    // After a short delay, check if it was a valid swipe
    setTimeout(() => {
      if (moved.dx > SWIPE_THRESHOLD_PX && Math.abs(moved.dy) < MAX_VERTICAL_DRIFT) {
        startReplyTo(msg);
      }
      setSwipingMessageId(null);
    }, 300); // Match this with the CSS transition duration
  };
  // --------------------------
  // Sending messages / offline queueing & UI helpers (with replyTo)
  // --------------------------
  const insertEmoji = useCallback(
    (emoji: string) => {
      const ta = textareaRef.current;
      if (!ta) {
        insertingEmojiRef.current = true;
        setDraft((d) => d + emoji);
        requestAnimationFrame(() => adjustTextareaHeight());
        setTimeout(() => (insertingEmojiRef.current = false), 0);
        focusTextarea();
        return;
      }

      insertingEmojiRef.current = true;
      const start = ta.selectionStart ?? ta.value.length;
      const end = ta.selectionEnd ?? start;
      const before = ta.value.slice(0, start);
      const after = ta.value.slice(end);
      const newValue = before + emoji + after;

      setDraft(newValue);

      requestAnimationFrame(() => {
        try {
          const pos = (before + emoji).length;
          ta.focus();
          ta.setSelectionRange(pos, pos);
          adjustTextareaHeight();
        } catch (err) {
          // ignore
        } finally {
          setTimeout(() => {
            insertingEmojiRef.current = false;
            setShowPicker(false);
          }, 5000);
        }
      });
    },
    [adjustTextareaHeight, focusTextarea],
  );

  // Update message in state by clientTempId (temp ID) or server _id
  const updateMessageByTempId = (clientTempId: string, patch: Partial<IMessageWithId>) => {
    setMessages((prev) => prev.map((m) => (String(m._id) === String(clientTempId) ? { ...m, ...patch } : m)));
  };

  // Replace temp message with server message safely (dedupe)
  const replaceTempMessageWithServerMessage = (clientTempId: string | null, serverMsg: any) => {
    const serverId = String(serverMsg._id);
    setMessages((prev) => {
      // if server message already present, drop the temp message (avoid duplicate)
      if (prev.some((m) => String(m._id) === serverId)) {
        if (!clientTempId) return prev;
        return prev.filter((m) => String(m._id) !== String(clientTempId));
      }

      // if clientTempId present and we have that temp in list -> replace it
      if (clientTempId && prev.some((m) => String(m._id) === String(clientTempId))) {
        const replaced = prev.map((m) =>
          String(m._id) === String(clientTempId) ? { ...(serverMsg as any), __status: 'sent' } : m,
        );
        // After replacement, scroll to bottom (this is likely user's message)
        requestAnimationFrame(() => scrollToBottom());
        return replaced;
      }

      // otherwise append server message
      requestAnimationFrame(() => scrollToBottom());
      return [...prev, { ...(serverMsg as any), __status: 'sent' }];
    });
  };

  // Retry helper for failed message
  const retrySend = (clientTempId: string) => {
    const pendingLocal = getPendingMessages().find((p) => p.clientTempId === clientTempId);
    const localMessage = messages.find((m) => String(m._id) === String(clientTempId));

    if (!pendingLocal && localMessage && user && selectedChatId) {
      const built: PendingMessageRecord = {
        clientTempId,
        content: (localMessage as any).content ?? '',
        receiverId: selectedChatId,
        senderId: user._id as string,
        room: `Instructor:${selectedChatId}-User:${user._id}`,
        createdAt: new Date().toISOString(),
        attempt: 0,
      };
      // propagate replyTo if the optimistic message had one
      (built as any).replyTo = (localMessage as any).replyTo ? (localMessage as any).replyTo._id : undefined;
      addPendingMessage(built);
    }

    flushPendingQueue();
  };

  // Main send function with optimistic message + offline queueing
  const handleSend = useCallback(() => {
    if (!draft.trim() || !selectedChatId || !user || !socket) return;

    // stop typing immediately on send
    try {
      if (socket && socket.connected) {
        const room = `Instructor:${selectedChatId}-User:${user._id}`;
        socket.emit('typing', { room, isTyping: false });
      }
    } catch (err) {
      // ignore
    }
    // clear any typing timers
    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    isTypingSentRef.current = false;

    const content = draft.trim();
    const clientTempId = genTempId();
    const createdAt = new Date().toISOString();

    // Build optimistic message object (client-temp)
    const optimisticMsg: IMessageWithId = {
      _id: clientTempId,
      content,
      createdAt,
      sender: { id: user._id, model: 'User' as const },
      receiver: { id: selectedChatId, model: 'Instructor' as const },
      __status: socket && socket.connected ? 'pending' : 'pending',
      replyTo: replyTarget ? replyTarget.snapshot : null,
    } as any;

    // Append to UI immediately
    setMessages((prev) => {
      const next = [...prev, optimisticMsg];
      return next;
    });

    // Auto-scroll to bottom (WhatsApp-like)
    requestAnimationFrame(() => {
      scrollToBottom();
      requestAnimationFrame(() => {
        setTimeout(() => scrollToBottom(), 40);
      });
    });
    // Update sidebar preview
    setSideConversations((prev) =>
      prev
        .map((c) =>
          c.instructorId === selectedChatId
            ? { ...c, lastMessage: content, lastMessageAt: new Date().toISOString() }
            : c,
        )
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()),
    );

    // Capture reply id to send, then clear
    const replyToIdToSend = replyTarget ? replyTarget.id : undefined;
    setReplyTarget(null);

    // Clear local draft and keep focus
    setDraft('');
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    });

    // Build pending record
    const pending: PendingMessageRecord = {
      clientTempId,
      content,
      receiverId: selectedChatId,
      senderId: user._id as string,
      room: `Instructor:${selectedChatId}-User:${user._id}`,
      createdAt,
      attempt: 0,
    };

    // Attach replyTo id so flush will include it
    (pending as any).replyTo = replyToIdToSend ?? null;

    // If socket connected -> attempt to send now and handle ack
    if (socket && socket.connected) {
      try {
        socket.emit(
          'sendMessage',
          {
            receiverId: pending.receiverId,
            content: pending.content,
            room: pending.room,
            senderId: pending.senderId,
            clientTempId: pending.clientTempId,
            replyTo: replyToIdToSend ?? null,
          },
          (ack: any) => {
            if (ack && ack.ok && ack.data && ack.data.message) {
              // server persisted message; replace temp message
              replaceTempMessageWithServerMessage(ack.data.clientTempId ?? pending.clientTempId, ack.data.message);
              // remove from local queue if it was saved there
              removePendingMessage(pending.clientTempId);
            } else {
              // server returned error -> mark as failed and keep in local queue for retry
              updateMessageByTempId(pending.clientTempId, { __status: 'failed' });
              // ensure message is in queue (so flush can retry later)
              addPendingMessage(pending);
            }
          },
        );
      } catch (err) {
        // emit might throw if socket dies -> fallback to queue
        console.error('emit sendMessage failed, queueing', err);
        updateMessageByTempId(pending.clientTempId, { __status: 'pending' });
        addPendingMessage(pending);
      }
    } else {
      // No socket connection -> queue for later flush
      addPendingMessage(pending);
      updateMessageByTempId(pending.clientTempId, { __status: 'pending' });
    }
  }, [draft, user, selectedChatId, socket, replyTarget, scrollToBottom]);

  // Flush pending queue on connect / online
  const flushPendingQueue = useCallback(() => {
    const pending = getPendingMessages();
    if (!socket || !socket.connected || pending.length === 0) return;

    // Iterate sequentially to preserve order
    pending.forEach((p) => {
      try {
        socket.emit(
          'sendMessage',
          {
            receiverId: p.receiverId,
            content: p.content,
            room: p.room,
            senderId: p.senderId,
            clientTempId: p.clientTempId,
            replyTo: (p as any).replyTo ?? null,
          },
          (ack: any) => {
            if (ack && ack.ok && ack.data && ack.data.message) {
              // replace temp message in UI
              replaceTempMessageWithServerMessage(ack.data.clientTempId ?? p.clientTempId, ack.data.message);
              // remove from storage
              removePendingMessage(p.clientTempId);
            } else {
              // failed: leave in queue, mark failed
              updateMessageByTempId(p.clientTempId, { __status: 'failed' });
            }
          },
        );
      } catch (err) {
        console.error('flush emit error', err);
        updateMessageByTempId(p.clientTempId, { __status: 'failed' });
      }
    });
  }, [socket]);

  // Attach flush handlers: on socket connect + window online
  useEffect(() => {
    if (!socket) return;
    const onConnect = () => {
      flushPendingQueue();
    };
    socket.on('connect', onConnect);

    // also flush any pending messages created before mount (e.g., previous session)
    if (socket.connected) {
      flushPendingQueue();
    }

    return () => {
      socket.off('connect', onConnect);
    };
  }, [socket, flushPendingQueue]);

  useEffect(() => {
    const onOnline = () => {
      // if we come back online (browser), flush
      if (socket && socket.connected) {
        flushPendingQueue();
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [socket, flushPendingQueue]);

  // Auto-resize helper for textarea
  useEffect(() => {
    adjustTextareaHeight();
  }, [draft, adjustTextareaHeight]);

  // effect: send typing events when draft updates (but not when inserting emoji programmatically)
  useEffect(() => {
    if (!textareaRef.current) return;

    if (draft !== '' && !insertingEmojiRef.current) {
      handleUserTyping();
    } else if (draft === '') {
      // when draft cleared, send stopTyping immediately
      if (isTypingSentRef.current && user && selectedChatId) {
        try {
          const room = `Instructor:${selectedChatId}-User:${user._id}`;
          socket?.emit('typing', { room, isTyping: false });
        } catch (err) {
          // ignore
        }
        isTypingSentRef.current = false;
        if (typingTimerRef.current) {
          window.clearTimeout(typingTimerRef.current);
          typingTimerRef.current = null;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // Render date header
  const renderDateHeader = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return (
      <div className="text-center w-fit mx-auto px-2 py-1 font-bold bg-[#F1F1F1] text-[#84939A] text-xs my-2 rounded">
        {d.toLocaleDateString(undefined, {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </div>
    );
  };

  const currentChat = selectedChatId ? sideConversations?.find((c) => c.instructorId === selectedChatId) : null;

  // compute last outgoing message id (latest message sent by current user)
  const lastUserMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m?.sender?.model === 'User') {
        return (m as any)._id as string | undefined;
      }
    }
    return undefined;
  }, [messages]);

  const onScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (suppressScrollRef.current) return;
      const target = e.currentTarget;
      const scrollTop = target.scrollTop;

      // legacy threshold trigger (kept for backward compat)
      if (scrollTop < 100 && hasMore && !isLoadingOlder && !loadingMessages && selectedChatId) {
        if (scrollDebounceTimer.current) {
          window.clearTimeout(scrollDebounceTimer.current);
        }
        scrollDebounceTimer.current = window.setTimeout(() => {
          // set suppression to avoid reentrancy while loading & adjusting
          suppressScrollRef.current = true;
          void loadOlderMessages(selectedChatId);
        }, 120); // debounce 120ms
      }
    },
    [hasMore, isLoadingOlder, loadingMessages, selectedChatId, loadOlderMessages],
  );

  useEffect(() => {
    const c = containerRef.current;
    const sentinel = topSentinelRef.current;
    if (!c || !sentinel) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (
            entry.isIntersecting &&
            hasMore &&
            !isLoadingOlder &&
            !loadingMessages &&
            selectedChatId &&
            !suppressScrollRef.current
          ) {
            suppressScrollRef.current = true;
            void loadOlderMessages(selectedChatId);
          }
        });
      },
      {
        root: c,
        rootMargin: '200px 0px 0px 0px', // begin loading slightly before top
        threshold: 0.01,
      },
    );

    io.observe(sentinel);
    return () => io.disconnect();
  }, [hasMore, isLoadingOlder, loadingMessages, selectedChatId, loadOlderMessages]);

  // prevent pointer events (mousedown/touchstart) from stealing focus when user clicks emoji/send
  const preventStealFocus = (ev: React.MouseEvent | React.TouchEvent) => {
    ev.preventDefault();
  };

  // focus textarea when selectedChatId changes (attempt)
  useEffect(() => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [selectedChatId]);

  // -------------------------
  // Reply helpers
  // -------------------------
  const startReplyTo = (msg: IMessageWithId) => {
    const snapshot: ReplySnapshot = {
      _id: String((msg as any)._id),
      content: (msg as any).content ?? '',
      sender: (msg as any).sender ?? undefined,
      createdAt: (msg as any).createdAt ?? undefined,
    };

    setReplyTarget({ id: snapshot._id, snapshot });
    requestAnimationFrame(() => textareaRef.current?.focus());
    requestAnimationFrame(() => scrollToBottom());
  };

  const cancelReply = () => {
    setReplyTarget(null);
  };

  // ---------- scrollToMessageById (robust, works on iOS/Android) ----------
  const scrollToMessageById = useCallback(
    (targetId: string) => {
      const el = document.getElementById(`msg-${targetId}`);
      if (!el) {
        // If message element not in DOM, delegate to ensureMessageInList.
        // If ensureMessageInList is not yet initialized, schedule a retry when it becomes available.
        if (ensureMessageInListRef.current) {
          // ensureMessageInList will fetch/insert and then call scrollToMessageById again
          ensureMessageInListRef.current(targetId).catch((e) => {
            console.warn('ensureMessageInList failed:', e);
          });
        } else {
          // queue a small retry for cases where initialization order is different
          setTimeout(() => {
            ensureMessageInListRef.current?.(targetId).catch((e) => {
              console.warn('ensureMessageInList (deferred) failed:', e);
            });
          }, 60);
        }
        return;
      }

      const c = containerRef.current;
      if (!c) {
        // No container: fallback to scrollIntoView (best-effort)
        try {
          el.scrollIntoView({ behavior: 'auto', block: 'center' });
        } catch {
          // ignore
        }
        setHighlighted((h) => ({ ...h, [targetId]: true }));
        setTimeout(() => {
          setHighlighted((h) => {
            const copy = { ...h };
            delete copy[targetId];
            return copy;
          });
        }, 500);
        return;
      }

      // Compute element offset relative to container
      const elRect = el.getBoundingClientRect();
      const containerRect = c.getBoundingClientRect();
      const offsetTop = elRect.top - containerRect.top;

      // Center the element in the container (adjust if you prefer top/bottom)
      const desiredScrollTop = Math.max(
        0,
        Math.round(c.scrollTop + offsetTop - c.clientHeight / 2 + elRect.height / 2),
      );

      // Direct scroll helper (instant)
      const directScrollTo = (top: number) => {
        try {
          if (typeof (c as any).scrollTo === 'function') {
            (c as any).scrollTo({ top, behavior: 'auto' });
          } else {
            c.scrollTop = top;
          }
        } catch {
          c.scrollTop = top;
        }
      };

      // perform scroll and a couple of retries to guard iOS layout races
      directScrollTo(desiredScrollTop);
      requestAnimationFrame(() => {
        directScrollTo(desiredScrollTop);
        setTimeout(() => directScrollTo(desiredScrollTop), 60);
      });

      // If visualViewport exists, resync once when it changes (keyboard opening)
      const vv = (window as any).visualViewport;
      if (vv) {
        const onVv = () => {
          directScrollTo(desiredScrollTop);
          vv.removeEventListener('resize', onVv);
          vv.removeEventListener('scroll', onVv);
        };
        vv.addEventListener('resize', onVv, { once: true });
        vv.addEventListener('scroll', onVv, { once: true });
      }

      // Highlighting (same behavior as before)
      setHighlighted((h) => ({ ...h, [targetId]: true }));
      setTimeout(() => {
        setHighlighted((h) => {
          const copy = { ...h };
          delete copy[targetId];
          return copy;
        });
      }, 500);
    },
    [setHighlighted],
  ); // safe: uses refs for container/ensureMessage and reads DOM dynamically

  // keep ref up-to-date so other places can call ensureMessage even if order differs
  useEffect(() => {
    scrollToMessageByIdRef.current = scrollToMessageById;
    return () => {
      scrollToMessageByIdRef.current = null;
    };
  }, [scrollToMessageById]);

  // ---------- ensureMessageInList (fetch & merge) ----------
  const ensureMessageInList = useCallback(
    async (targetId: string) => {
      // If already present in the loaded messages array, try to scroll to it.
      if (messages.some((m) => String(m._id) === String(targetId))) {
        // Wait for DOM paint (the element may render a tick later)
        requestAnimationFrame(() => {
          const el = document.getElementById(`msg-${targetId}`);
          if (el) {
            scrollToMessageByIdRef.current?.(targetId);
          } else {
            // Try one more frame
            requestAnimationFrame(() => {
              const el2 = document.getElementById(`msg-${targetId}`);
              if (el2) {
                scrollToMessageByIdRef.current?.(targetId);
              } else {
                console.warn('Message present in state but not in DOM yet:', targetId);
              }
            });
          }
        });
        return;
      }

      // Not present — fetch & merge/insert into messages
      setTargetLoading({ id: targetId, loading: true });
      try {
        const single = await fetchMessageById(targetId);
        if (!single) {
          throw new Error('Message not found');
        }

        // Ensure message belongs to this conversation
        const participants = [String(single.sender?.id ?? ''), String(single.receiver?.id ?? '')];
        if (!participants.includes(String(selectedChatId)) && !participants.includes(String(user?._id))) {
          console.warn('Fetched message belongs to another conversation', single);
          setTargetLoading(null);
          return;
        }

        // Heuristic: decide whether to insert single or fetch a chunk for context
        const oldest = messages[0];
        const newest = messages[messages.length - 1];
        const singleCreated = single.createdAt ? new Date(single.createdAt).getTime() : 0;
        const oldestCreated = oldest && oldest.createdAt ? new Date(String(oldest.createdAt)).getTime() : null;
        const newestCreated = newest && newest.createdAt ? new Date(String(newest.createdAt)).getTime() : null;

        // If we have no messages loaded yet, just insert the single
        if (!oldestCreated) {
          setMessages((prev) => {
            const all = [...prev, { ...(single as any), __status: 'sent' }];
            all.sort(
              (a: any, b: any) => new Date(String(a.createdAt)).getTime() - new Date(String(b.createdAt)).getTime(),
            );
            return all;
          });
          requestAnimationFrame(() => {
            setTargetLoading(null);
            scrollToMessageByIdRef.current?.(targetId);
          });
          return;
        }

        // If near current range (within 7 days), insert single
        const nearRange =
          (oldestCreated && Math.abs(oldestCreated - singleCreated) < 1000 * 60 * 60 * 24 * 7) ||
          (newestCreated && Math.abs(newestCreated - singleCreated) < 1000 * 60 * 60 * 24 * 7);

        if (nearRange) {
          setMessages((prev) => {
            if (prev.some((m) => String(m._id) === String(single._id))) return prev;
            const all = [...prev, { ...(single as any), __status: 'sent' }];
            all.sort(
              (a: any, b: any) => new Date(String(a.createdAt)).getTime() - new Date(String(b.createdAt)).getTime(),
            );
            return all;
          });
          requestAnimationFrame(() => {
            setTargetLoading(null);
            scrollToMessageByIdRef.current?.(targetId);
          });
          return;
        }

        // Otherwise fetch a chunk around the message and merge
        const { messages: aroundChunk = [] } = await fetchMessagesAround(selectedChatId as string, targetId, 40);

        if (!aroundChunk || aroundChunk.length === 0) {
          // fallback: insert single
          setMessages((prev) => {
            if (prev.some((m) => String(m._id) === String(single._id))) return prev;
            const all = [...prev, { ...(single as any), __status: 'sent' }];
            all.sort(
              (a: any, b: any) => new Date(String(a.createdAt)).getTime() - new Date(String(b.createdAt)).getTime(),
            );
            return all;
          });
          requestAnimationFrame(() => {
            setTargetLoading(null);
            scrollToMessageByIdRef.current?.(targetId);
          });
          return;
        }

        // Merge the chunk (dedupe + sort)
        setMessages((prev) => {
          const map = new Map<string, any>();
          prev.forEach((m) => map.set(String(m._id), m));
          (aroundChunk as any[]).forEach((m) => map.set(String(m._id), { ...(m as any), __status: 'sent' }));
          const merged = Array.from(map.values()).sort(
            (a: any, b: any) => new Date(String(a.createdAt)).getTime() - new Date(String(b.createdAt)).getTime(),
          );
          return merged;
        });

        requestAnimationFrame(() => {
          setTargetLoading(null);
          scrollToMessageByIdRef.current?.(targetId);
        });
      } catch (err) {
        console.error('ensureMessageInList error:', err);
        setTargetLoading(null);
      }
    },
    // keep messages/selectors in deps so we react to latest state
    [messages, selectedChatId, user, fetchMessageById, fetchMessagesAround, setMessages],
  );

  // keep ref up-to-date so other callers (and scrollToMessageById) can call this safely
  useEffect(() => {
    ensureMessageInListRef.current = ensureMessageInList;
    return () => {
      ensureMessageInListRef.current = null;
    };
  }, [ensureMessageInList]);

  // If user clicks the reply snippet in a bubble
  const onClickReplySnippet = (reply: ReplySnapshot | string | undefined) => {
    if (!reply) return;
    const id = typeof reply === 'string' ? reply : reply._id;
    if (!id) return;
    // If element exists in DOM -> scroll immediately
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      scrollToMessageById(id);
      return;
    }
    // Otherwise ensure message is in list (fetch if necessary) and then scroll
    ensureMessageInList(id);
  };

  // Textarea onChange: detect real keyboard typing (vs emoji insertion). If user typed (not inserting emoji) and picker is open -> close it
  const onTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setShowPicker(false);
    const val = e.target.value;
    setDraft(val);
    // adjust height
    requestAnimationFrame(() => adjustTextareaHeight());
    // If user typed (i.e. not insertingEmojiRef), close picker:
    if (showPicker && !insertingEmojiRef.current) {
      setShowPicker(false);
    }
    // typing handled by draft effect
  };

  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Textarea onKeyDown: Enter sends unless Shift+Enter -> newline
  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    // if they press any character key while picker open, close it (we don't want to close if they used emoji insertion)
    if (showPicker && !insertingEmojiRef.current) {
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
        setShowPicker(false);
      }
    }
  };

  const touchStartY = useRef<number | null>(null);

  // useEffect(() => {
  //   if (typeof window === 'undefined') return;

  //   const KEYBOARD_THRESHOLD = 80; // px — tune this if needed
  //   let debounceTimer: number | null = null;
  //   let retryTimer1: number | null = null;
  //   let retryTimer2: number | null = null;
  //   let rafId: number | null = null;

  //   const getViewportHeight = () => {
  //     const vv = (window as any).visualViewport as VisualViewport | undefined;
  //     return vv?.height ?? window.innerHeight;
  //   };

  //   const getKeyboardDelta = () => {
  //     const vv = (window as any).visualViewport as VisualViewport | undefined;
  //     const offsetTop = vv?.offsetTop ?? 0;
  //     const vvHeight = vv?.height ?? window.innerHeight;
  //     return Math.max(0, window.innerHeight - vvHeight - offsetTop);
  //   };

  //   const doInstantScrollToBottom = () => {
  //     const c = containerRef.current;
  //     if (c) {
  //       try {
  //         c.scrollTop = c.scrollHeight; // instant
  //       } catch {
  //         try {
  //           (c as any).scrollTo?.({ top: c.scrollHeight, behavior: 'auto' });
  //         } catch {}
  //       }
  //       // extra RAF attempt to be safe on iOS
  //       try {
  //         if (rafId) cancelAnimationFrame(rafId);
  //       } catch {}
  //       rafId = requestAnimationFrame(() => {
  //         try {
  //           c.scrollTop = c.scrollHeight;
  //         } catch {}
  //       });
  //     } else {
  //       try {
  //         bottomRef?.current?.scrollIntoView?.({ behavior: 'auto' });
  //       } catch {}
  //     }
  //   };

  //   const handleViewportChange = () => {
  //     // debounce small bursts of events (visualViewport fires multiple times)
  //     if (debounceTimer) {
  //       window.clearTimeout(debounceTimer);
  //       debounceTimer = null;
  //     }
  //     debounceTimer = window.setTimeout(() => {
  //       const vvHeight = getViewportHeight();
  //       const kbDelta = getKeyboardDelta();

  //       // update appHeight
  //       try {
  //         setAppHeight(Math.round(vvHeight));
  //       } catch {}

  //       const keyboardLikelyOpen = kbDelta > KEYBOARD_THRESHOLD || vvHeight < window.innerHeight - KEYBOARD_THRESHOLD;

  //       // if user is focused on textarea or our flag says focused => ensure bottom visible
  //       const focused = document.activeElement === textareaRef.current || isTextareaFocused;

  //       if (focused && keyboardLikelyOpen) {
  //         // aggressive attempts to scroll after keyboard animation
  //         doInstantScrollToBottom();
  //         // small retry
  //         retryTimer1 = window.setTimeout(() => doInstantScrollToBottom(), 60);
  //         // longer retry to catch late layout changes
  //         retryTimer2 = window.setTimeout(() => doInstantScrollToBottom(), 250);
  //       } else if (focused) {
  //         // no keyboard — just ensure bottom
  //         requestAnimationFrame(() => {
  //           try {
  //             scrollToBottom?.();
  //           } catch {
  //             doInstantScrollToBottom();
  //           }
  //         });
  //       } else {
  //         // not focused => update layout only
  //       }
  //     }, 80); // debounce delay
  //   };

  //   // listeners: prefer visualViewport but also use window fallbacks
  //   const vv = (window as any).visualViewport as VisualViewport | undefined;
  //   if (vv) {
  //     try {
  //       vv.addEventListener('resize', handleViewportChange);
  //       vv.addEventListener('scroll', handleViewportChange);
  //     } catch {}
  //   }
  //   window.addEventListener('resize', handleViewportChange);
  //   window.addEventListener('orientationchange', handleViewportChange);
  //   window.addEventListener('focusin', handleViewportChange);
  //   window.addEventListener('focusout', handleViewportChange);

  //   // run once now to initialize appHeight & potentially scroll
  //   handleViewportChange();

  //   return () => {
  //     if (debounceTimer) {
  //       window.clearTimeout(debounceTimer);
  //       debounceTimer = null;
  //     }
  //     if (retryTimer1) {
  //       window.clearTimeout(retryTimer1);
  //       retryTimer1 = null;
  //     }
  //     if (retryTimer2) {
  //       window.clearTimeout(retryTimer2);
  //       retryTimer2 = null;
  //     }
  //     try {
  //       if (rafId) cancelAnimationFrame(rafId);
  //     } catch {}

  //     if (vv) {
  //       try {
  //         vv.removeEventListener('resize', handleViewportChange);
  //         vv.removeEventListener('scroll', handleViewportChange);
  //       } catch {}
  //     }
  //     window.removeEventListener('resize', handleViewportChange);
  //     window.removeEventListener('orientationchange', handleViewportChange);
  //     window.removeEventListener('focusin', handleViewportChange);
  //     window.removeEventListener('focusout', handleViewportChange);
  //   };
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [isTextareaFocused, scrollToBottom]);

  //  useEffect to handle iOS keyboard events specifically
  useEffect(() => {
    if (!isIOS()) return;

    const handleFocus = () => {
      setIsTextareaFocused(true);
      // Wait for keyboard to fully open and layout to stabilize
      setTimeout(() => {
        const container = containerRef.current;
        if (container) {
          // Calculate the visible area after keyboard opens
          const visibleHeight = window.visualViewport?.height || window.innerHeight;
          const headerHeight = 64; // Adjust based on your header height
          const footerHeight = 80; // Approximate footer height

          // Calculate available space for messages
          const availableHeight = visibleHeight - headerHeight - footerHeight;

          // Scroll to show the last message in the visible area
          container.scrollTop = container.scrollHeight - availableHeight;

          // Double check after a brief delay
          setTimeout(() => {
            container.scrollTop = container.scrollHeight;
          }, 50);
        }
      }, 350);
    };

    const handleBlur = () => {
      setIsTextareaFocused(false);

      const updateHeight = () => {
        const vh = window.innerHeight;
        // reset css var to full innerHeight
        document.documentElement.style.setProperty('--app-height', `${vh}px`);
        // recompute main height using header/footer
        const headerH = headerRef.current?.getBoundingClientRect().height ?? 0;
        const footerH = footerRef.current?.getBoundingClientRect().height ?? 0;
        setAppHeight(vh);
        setMainHeight(Math.max(0, vh - headerH - footerH));
      };

      window.addEventListener('resize', updateHeight);
      setTimeout(
        () => {
          updateHeight();
          window.removeEventListener('resize', updateHeight);
        },
        isIOS() ? 400 : 200,
      );
    };

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener('focus', handleFocus);
      textarea.addEventListener('blur', handleBlur);
    }

    return () => {
      if (textarea) {
        textarea.removeEventListener('focus', handleFocus);
        textarea.removeEventListener('blur', handleBlur);
      }
    };
  }, [scrollToBottom]);
  /* ---------- Overlay-based lock + visualViewport handling ---------- */
// helper to apply visualViewport geometry to overlay
const applyViewportToOverlay = useCallback(() => {
  const overlay = overlayRef.current;
  const container = containerRef.current;
  if (!overlay) return;

  const vv: any = (window as any).visualViewport;
  // prefer visualViewport when available
  const top = vv?.offsetTop ?? 0;
  const left = vv?.offsetLeft ?? 0;
  const width = vv?.width ?? window.innerWidth;
  const height = vv?.height ?? window.innerHeight;

  // Use CSS env variables for safe-area insets (notch, home indicator)
  const safeBottom = typeof window !== 'undefined' ? `env(safe-area-inset-bottom, 0px)` : '0px';
  const safeTop = typeof window !== 'undefined' ? `env(safe-area-inset-top, 0px)` : '0px';

  overlay.style.position = 'fixed';
  // set top/left so overlay matches visible viewport (important on iOS)
  overlay.style.top = `${top}px`;
  overlay.style.left = `${left}px`;
  overlay.style.width = `${width}px`;
  overlay.style.height = `${height}px`;
  overlay.style.zIndex = '9999';
  overlay.style.overflow = 'hidden';
  // ensure overlay background matches app background to avoid white gap
  overlay.style.background = overlay.style.background || 'var(--app-bg, #fff)';
  // keep container scrollable
  if (container) {
    container.style.height = `calc(${height}px - ${headerRef.current?.getBoundingClientRect().height ?? 0}px - ${footerRef.current?.getBoundingClientRect().height ?? 0}px)`;
    container.style.overflowY = 'auto';
    container.style.webkitove = 'touch';
  }

  // Disable page scroll behind overlay softly
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
}, [headerRef, footerRef, containerRef, overlayRef]);

const lockOverlayScroll = useCallback(() => {
  if (typeof window === 'undefined') return;
  const overlay = overlayRef.current;
  if (!overlay) return;
  savedBodyScrollY.current = window.scrollY || window.pageYOffset || 0;

  // Apply visual viewport immediately
  applyViewportToOverlay();

  // Keep updating while visualViewport animates (iOS keyboard)
  const vv: any = (window as any).visualViewport;
  if (vv) {
    const listener = () => {
      // debounce a little to avoid flicker while keyboard animates
      if (vvDebounceRef.current) clearTimeout(vvDebounceRef.current);
      vvDebounceRef.current = setTimeout(() => {
        applyViewportToOverlay();
        // ensure scrolled to bottom so latest messages remain visible
        const container = containerRef.current;
        if (container) container.scrollTop = container.scrollHeight;
      }, 40);
    };
    vv.addEventListener('resize', listener);
    vv.addEventListener('scroll', listener);

    // Save ref for cleanup (store the handler on overlay element)
    (overlay as any).__vv_listener = listener;
  } else {
    // fallback: window resize
    const winListener = () => {
      if (vvDebounceRef.current) clearTimeout(vvDebounceRef.current);
      vvDebounceRef.current = setTimeout(() => {
        applyViewportToOverlay();
        const container = containerRef.current;
        if (container) container.scrollTop = container.scrollHeight;
      }, 40);
    };
    window.addEventListener('resize', winListener);
    (overlay as any).__win_listener = winListener;
  }
}, [applyViewportToOverlay]);

const unlockOverlayScroll = useCallback(() => {
  if (typeof window === 'undefined') return;
  const overlay = overlayRef.current;
  if (!overlay) return;

  // remove listeners
  const vv: any = (window as any).visualViewport;
  if (vv && (overlay as any).__vv_listener) {
    const l = (overlay as any).__vv_listener;
    vv.removeEventListener('resize', l);
    vv.removeEventListener('scroll', l);
    (overlay as any).__vv_listener = null;
  }
  if ((overlay as any).__win_listener) {
    window.removeEventListener('resize', (overlay as any).__win_listener);
    (overlay as any).__win_listener = null;
  }

  // restore overlay styles
  overlay.style.position = '';
  overlay.style.top = '';
  overlay.style.left = '';
  overlay.style.width = '';
  overlay.style.height = '';
  overlay.style.zIndex = '';
  overlay.style.overflow = '';
  overlay.style.background = '';

  // restore container
  const container = containerRef.current;
  if (container) {
    container.style.height = '';
    container.style.overflowY = '';
    container.style.webkitOverflowScrolling = '';
  }

  // restore page scroll
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  const scrollY = savedBodyScrollY.current ?? 0;
  savedBodyScrollY.current = null;
  window.scrollTo(0, scrollY);

  if (vvDebounceRef.current) {
    clearTimeout(vvDebounceRef.current);
    vvDebounceRef.current = null;
  }
}, []);

  // 3) When overlay (chat) is opened/closed → lock/unlock
  useEffect(() => {
    if (selectedChatId) {
      lockOverlayScroll();
      // keep final adjustment a little later to catch keyboard settled state
      setTimeout(() => {
        applyViewportToOverlay();
        const container = containerRef.current;
        if (container) container.scrollTop = container.scrollHeight;
      }, 250); // tweak 250-400ms if needed
    } else { 
      unlockOverlayScroll();
    }
    return () => {
      // safety unlock on unmount
      unlockOverlayScroll();
    };
  }, [selectedChatId, lockOverlayScroll, unlockOverlayScroll, applyViewportToOverlay]);
  
  // 4) Trap touchmove globally but allow scrolling inside `containerRef` only
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const container = containerRef.current;
    const overlay = overlayRef.current;

    const onContainerTouchStart = (ev: TouchEvent) => {
      touchStartY.current = ev.touches?.[0]?.clientY ?? null;
    };

    const onDocTouchMove = (ev: TouchEvent) => {
      const startY = touchStartY.current;
      const curY = ev.touches?.[0]?.clientY ?? null;
      const deltaY = startY !== null && curY !== null ? curY - startY : 0;

      // Is the touch inside overlay/container? If not, block default to prevent background scroll.
      const path = (ev.composedPath && ev.composedPath()) || (ev as any).path || [];
      const inOverlay = !!(overlay && (path.includes(overlay) || overlay.contains(ev.target as Node)));
      const inContainer = !!(container && (path.includes(container) || container.contains(ev.target as Node)));

      if (!inOverlay) {
        // block page scroll when overlay is open; allow normal behavior if overlay closed
        if (selectedChatId) ev.preventDefault();
        return;
      }

      // If inside overlay but not container (e.g., header area), block default to prevent page behind moving
      if (!inContainer || !container) {
        // iOS subtlety: allow small moves to pass through, but prevent big moves
        if (!isIOS() || Math.abs(deltaY) > 10) {
          ev.preventDefault();
        }
        return;
      }

      // allow inner scrolling only while container can scroll in that direction
      const scrollTop = container.scrollTop;
      const clientH = container.clientHeight;
      const scrollH = container.scrollHeight;

      if (scrollH <= clientH) {
        ev.preventDefault();
        return;
      }

      if (deltaY > 0 && scrollTop <= 0) {
        ev.preventDefault();
        return;
      }

      if (deltaY < 0 && scrollTop + clientH >= scrollH - 1) {
        ev.preventDefault();
        return;
      }
      // otherwise allow the scroll (do nothing)
    };

    container?.addEventListener('touchstart', onContainerTouchStart, { passive: true });
    document.addEventListener('touchmove', onDocTouchMove, { passive: false });

    return () => {
      container?.removeEventListener('touchstart', onContainerTouchStart);
      document.removeEventListener('touchmove', onDocTouchMove);
    };
  }, [containerRef, overlayRef, selectedChatId]);

  // ---------------- Render ----------------
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        // ✅ CHANGE 1: Use '100dvh' (Dynamic Viewport Height) instead of fixed 'appHeight' or '100%'.
        // This unit automatically shrinks when the virtual keyboard appears on mobile,
        // ensuring the entire container fits the visible screen.
        width: '100%',
        zIndex: 50,
      }}
      className="flex flex-col"
    >
      {!selectedChatId ? (
        // Chat list view
        <>
          {/* <header className="bg-primary text-white px-4 py-3 shadow">
            <h1 className="text-[20px]  font-bold">Chat with instructors</h1>
          </header> */}

          <div className="flex-1 overflow-y-auto">
            {sideConversations.map((chat, i) => {
              const imageUrl = chat?.pictureUrl ? chat?.pictureUrl : '/userPlaceHolder.jpg';
              return (
                <div
                  key={chat.instructorId || i}
                  onClick={() => openChat(chat.instructorId)}
                  className="flex items-center my-1 px-4 py-3 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="w-[53px] h-[53px] rounded-full overflow-hidden bg-gray-200">
                    <Image
                      src={imageUrl || '/userPlaceHolder.jpg'}
                      alt={chat.name}
                      width={70}
                      height={70}
                      className="object-cover w-full h-full"
                    />
                  </div>

                  <div className="ml-3 flex-1 min-w-0">
                    <div className="flex justify-between">
                      <p className="font-bold text-[14px] font-roboto truncate">{chat.name}</p>
                      <span className="text-[12px] font-bold text-[#998E8E]">
                        {new Date(chat.lastMessageAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex justify-between items-center mt-1">
                      <p className="text-[13px] text-[#889095] truncate max-w-[70%]">{chat.lastMessage}</p>
                      {chat.unreadCount > 0 && (
                        <span className="flex items-center justify-center text-white text-xs font-bold rounded-full w-6 h-6 bg-primary">
                          {chat.unreadCount > 5 ? '+5' : chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        // Chat conversation view
        <div
          ref={overlayRef}
          style={{
            position: 'fixed',
            inset: 0,
            height: 'var(--app-height)', // <- use CSS var
            width: '100%',
            zIndex: 50,
          }}
          className="flex flex-col chat-overlay"
        >
          {/* UPDATED: Added conditional sticky class based on textarea focus */}
          <header
            ref={headerRef}
            className={`flex items-center  w-full  tiny:py-3 tiny:px-1 px-3 py-3 bg-primary text-white shadow 
  `}
          >
            <button
              onClick={() => {
                setSelectedChatId(null);
                setMessages([]);
              }}
              className="p-1 mr-1"
            >
              <ArrowLeft className="w-[26px]  h-[23px] tiny:w-[20px] tiny:h-[17px] text-white font-bold" />
            </button>

            <div className="flex items-center flex-1">
              <div className="tiny:w-[35px] xs:w-[42px] tiny:h-[35px] xs:h-[42px] w-[51px] h-[51px] overflow-hidden bg-white flex-shrink-0 rounded-full">
                <Image
                  src={currentChat?.pictureUrl || '/userPlaceHolder.jpg'}
                  alt={currentChat?.name || initialInstructorName}
                  width={70}
                  height={70}
                  className="object-cover w-full h-full"
                />
              </div>

              <div className="ml-2 min-w-0 w-full">
                <div className="flex items-center gap-x-1 w-full min-w-0">
                  <span className="font-bold truncate min-w-0 tiny:text-[13px] xs:text-[15px] ms-custom:text-[17px] text-[18px] max-w-[40%]">
                    {currentChat?.name || initialInstructorName}
                  </span>

                  <BadgeCheck className="flex-shrink-0 text-white tiny:w-[16px] tiny:h-[16px] xs:w-[18px] xs:h-[18px] w-5 h-5" />

                  <span className="truncate min-w-0 text-center text-[12px] tiny:text-[10px] font-bold xs:text-[11px] border border-white tiny:px-1 xs:px-1 px-1 py-1 rounded-md max-w-[40%]">
                    {currentChat?.profession || initialInstructorProfession}
                  </span>
                </div>

                <div className="flex items-center text-[0.75rem] font-semibold gap-1 mt-1">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${instructorOnline[selectedChatId || ''] ? 'bg-green-400' : 'bg-gray-100'}`}
                  />
                  <span className="text-[12px] tiny:text-[10px] xs:text-[11px]">
                    {instructorTyping[selectedChatId || '']
                      ? 'Typing…'
                      : instructorOnline[selectedChatId || '']
                        ? 'Online'
                        : 'Offline'}
                  </span>
                </div>
              </div>
            </div>
          </header>
          <main
            ref={(el) => (containerRef.current = el)}
            onScroll={onScroll}
            style={{
              flex: 1,
              minHeight: 0,
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
            }}
            className=" chat-messages bg-[url('/cover-homepage.webp')] bg-cover bg-center overflow-x-hidden overflow-y-auto p-2"
          >
            <div ref={topSentinelRef} style={{ height: 1, width: '100%' }} aria-hidden />
            {/* Loading older messages - shows at top when scrolling up */}
            {isLoadingOlder && (
              <div className="flex justify-center py-3  sticky top-[40%] bg-transparent z-[1000]">
                <div className="flex items-center gap-2 text-sm text-gray-500 bg-white/95 backdrop-blur-sm px-4 py-3 rounded-lg shadow-md border border-gray-200">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary"></div>
                  <span className="text-sm font-medium text-gray-700">Loading older messages</span>
                </div>
              </div>
            )}

            {/* Initial loading or no messages */}
            {loadingMessages ? (
              <div className="flex justify-center items-center h-32">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
                  <span className="text-sm text-gray-600">Loading messages...</span>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex justify-center items-center h-32">
                <p className="text-center text-gray-500 text-sm">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const createdAt = msg.createdAt ? new Date(msg.createdAt) : new Date();
                const isMe = msg.sender?.model === 'User';

                // message key: prefer _id (server or temp), fallback to idx (but _id should always be present)
                const messageKey = ((msg as any)._id as string) ?? `idx-${idx}`;

                // read-more logic
                const content = msg.content ?? '';
                const isLong = content.length > MESSAGE_CUTOFF;
                const isExpanded = Boolean(expandedMap[messageKey]);
                const preview = isLong && !isExpanded ? content.slice(0, MESSAGE_CUTOFF) + '...' : content;

                // reaction data
                const reactionCounts = (msg as any).reactionCounts ?? null;
                const reactionsArr = Array.isArray((msg as any).reactions) ? (msg as any).reactions : [];

                // is this the last message sent by the current user?
                const isLatestUserMessage =
                  isMe && Boolean(lastUserMessageId) && String((msg as any)._id) === String(lastUserMessageId);

                const hasReactions =
                  (reactionCounts && Object.values(reactionCounts).some((c) => c && c > 0)) || reactionsArr.length > 0;

                const senderIdentity = msg?.sender?.model;

                const highlightClass = highlighted[messageKey] ? 'ring-2 ring-yellow-300 rounded-lg' : '';
                const isLastMessage = idx === messages.length - 1;

                return (
                  <div
                    ref={isLastMessage ? bottomRef : null}
                    className={`${hasReactions ? 'mb-5' : ''}`}
                    key={messageKey || idx}
                    id={`msg-${messageKey}`}
                  >
                    {idx === 0 || new Date(messages[idx - 1].createdAt).toDateString() !== createdAt.toDateString()
                      ? renderDateHeader(createdAt)
                      : null}

                    <div
                      className={`flex mb-3 ${isMe ? 'justify-end' : 'justify-start'} select-none message-container ${swipingMessageId === messageKey ? 'swiping' : ''}`}
                      // swipe and long-press handlers
                      onTouchStart={(e) => {
                        // Only start long press if not in a swipe
                        if (e.touches.length === 1) {
                          startLongPress(messageKey);
                        }
                        onMessageTouchStart(e, messageKey);
                      }}
                      onTouchMove={(e) => {
                        onMessageTouchMove(e, messageKey);
                        const moved = swipeMovedRef.current[messageKey];
                        if (moved && (Math.abs(moved.dx) > 6 || Math.abs(moved.dy) > 6)) {
                          cancelLongPress(messageKey);
                        }
                      }}
                      onTouchEnd={(e) => {
                        cancelLongPress(messageKey);
                        onMessageTouchEnd(e, msg, messageKey);
                      }}
                      onMouseDown={() => startLongPress(messageKey)}
                      onMouseUp={() => cancelLongPress(messageKey)}
                      onMouseLeave={() => cancelLongPress(messageKey)}
                      onPointerDown={(e) => onMessagePointerDown(e, messageKey)}
                      onPointerMove={(e) => onMessagePointerMove(e, messageKey)}
                      onPointerUp={(e) => onMessagePointerUp(e as any, msg, messageKey)}
                      style={{
                        transform: swipingMessageId === messageKey ? `translateX(${swipeOffset}px)` : 'translateX(0)',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        MozUserSelect: 'none',
                        msUserSelect: 'none',
                        WebkitTouchCallout: 'none', // iOS long-press callout
                        WebkitTapHighlightColor: 'transparent',
                        // keep pointer events enabled so your reactions and reply clicks still work
                      }}
                    >
                      {!isMe && (
                        <div className="reply-indicator w-fit">
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M10 9L5 4M5 4V8M5 4H9"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M6 12C6 15.3137 8.68629 18 12 18C14.4829 18 16.5864 16.5182 17.5252 14.2929"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      )}
                      {!isMe && (
                        <div className="flex flex-col items-center">
                          {senderIdentity === 'Instructor' && (
                            <Image
                              className="-mr-6 -mb-1"
                              src="/verified-blue.svg"
                              alt="verified"
                              width={22}
                              height={22}
                              priority
                            />
                          )}
                          <div className="w-[41px] h-[41px] rounded-full overflow-hidden mr-2 flex-shrink-0">
                            <Image
                              src={currentChat?.pictureUrl || '/userPlaceHolder.jpg'}
                              alt="Instructor"
                              width={50}
                              height={50}
                              className="object-cover w-full h-full"
                              priority
                            />
                          </div>
                        </div>
                      )}

                      <div
                        className={`relative p-3 rounded-lg ${isMe ? 'bg-[#FDD2D3]' : 'bg-[#FDD2D3]'} ${longPressActive === messageKey ? 'opacity-80 scale-95' : ''} transition-all duration-150 overflow-visible ${highlightClass}`}
                      >
                        {/* If this message is a REPLY (has replyTo snapshot), show compact snippet */}
                        {msg.replyTo && (msg.replyTo as any)._id && (
                          <div
                            onClick={() => onClickReplySnippet(msg.replyTo as ReplySnapshot)}
                            className="mb-2 p-2 bg-white rounded-md border cursor-pointer text-xs text-[#374151] hover:bg-gray-50"
                            role="button"
                            aria-label="Open replied message"
                          >
                            <div className="font-semibold truncate">
                              {(msg.replyTo as any).sender && (msg.replyTo as any).sender.model === 'Instructor'
                                ? 'Instructor'
                                : 'You'}
                            </div>
                            <div className="truncate w-[100px] mt-1 text-[13px]">
                              {((msg.replyTo as any).content ?? '').slice(0, 120)}
                            </div>
                          </div>
                        )}

                        <p className="text-sm font-semibold max-w-[200px] break-words">
                          {!msg.isDeleted ? preview : 'Message deleted.'}
                          {isLong && (
                            <button
                              onClick={() => toggleExpanded(messageKey)}
                              className="ml-2 text-sm font-bold underline text-primary relative z-40"
                              aria-expanded={isExpanded}
                              type="button"
                              style={{ pointerEvents: 'auto', WebkitTapHighlightColor: 'transparent' }}
                            >
                              {!msg?.isDeleted && <div>{isExpanded ? 'See less' : 'Read more'}</div>}
                            </button>
                          )}
                        </p>

                        <div className="flex justify-end items-center">
                          <p className="text-right text-[12px] text-gray-500 mt-1">
                            {createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>

                          {/* Inline pending/failed UI */}
                          {isMe && (msg as any).__status === 'pending' && (
                            <span className="text-[11px] text-gray-500 italic ml-2">Sending…</span>
                          )}
                          {isMe && (msg as any).__status === 'failed' && (
                            <button
                              onClick={() => retrySend((msg as any)._id)}
                              className="text-[11px] text-red-600 font-bold underline ml-2"
                              type="button"
                            >
                              Failed — Retry
                            </button>
                          )}

                          {isLatestUserMessage && (
                            <div className="text-right ml-2">
                              <MessageStatus message={msg} currentUserId={user?._id as string} />
                            </div>
                          )}
                        </div>

                        {/* Reactions summary + trigger */}
                        <div
                          className={`absolute -bottom-5 ${isMe ? 'right-0' : 'left-0'} z-50`} // Increased z-index to 50
                          style={{ pointerEvents: 'auto' }}
                        >
                          <MessageReactions
                            messageId={messageKey}
                            reactionCounts={reactionCounts}
                            reactions={reactionsArr}
                            currentUserId={(user?._id as string) ?? null}
                            isMe={isMe}
                            onReact={(mid, type) => handleReactOptimistic(mid, type)}
                            onRemove={(mid) => handleReactOptimistic(mid, undefined)}
                            open={openReactionFor === messageKey}
                            onOpenChange={(v) => {
                              if (!v) closeReactionPopover();
                              else setOpenReactionFor(messageKey);
                            }}
                            isDeleted={msg.isDeleted}
                            onDelete={(mid) => handleDelete(mid)}
                            onReport={(mid) => handleOpenReport(mid)}
                          />
                        </div>
                      </div>

                      {isMe && (
                        <div className="w-[41px] h-[41px] rounded-full overflow-hidden ml-2 flex-shrink-0">
                          <Image
                            src={userImage}
                            alt="You"
                            width={60}
                            height={60}
                            className="object-cover w-full h-full"
                            priority
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {/* <div className="my-1" ref={bottomRef} /> */}
            {/* {isLoadingOlder && (
              <div className="flex justify-center py-3 sticky top-0 bg-transparent z-10">
                <div className="flex items-center gap-2 text-sm text-gray-500 bg-white/95 backdrop-blur-sm px-4 py-3 rounded-lg shadow-md border border-gray-200">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary"></div>
                  <span className="text-sm font-medium text-gray-700">Loading older messages</span>
                </div>
              </div>
            )} */}
          </main>

          {targetLoading && targetLoading.loading && (
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[800] bg-white/90 p-4 rounded shadow-lg flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary" />
              <div className="text-sm">Loading message…</div>
            </div>
          )}

          <footer ref={footerRef} className="p-3 bg-[url('/cover-homepage.webp')] bg-cover bg-center">
            {/* Reply preview (if replying) */}
            {replyTarget && (
              <div className="mb-2 mt-2 px-2">
                <div className="flex items-center justify-between bg-white rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-xs text-gray-600 font-semibold">
                      Replying to {replyTarget.snapshot.sender?.model === 'Instructor' ? 'Instructor' : 'You'}
                    </div>
                    <div className="text-sm  text-gray-700 truncate">
                      {(replyTarget.snapshot.content ?? '').slice(0, 160)}
                    </div>
                  </div>
                  <button onClick={cancelReply} className="ml-3 p-1" type="button" aria-label="Cancel reply">
                    <X className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center">
              {/* 1) Textarea + smile + picker all live in this relative container */}
              <div className="relative flex-1">
                {/* Smile button */}
                <button
                  // prevent pointer from stealing focus
                  onMouseDown={preventStealFocus}
                  onTouchStart={preventStealFocus}
                  onClick={() => {
                    setShowPicker((v) => !v);
                    // keep focus on textarea
                    requestAnimationFrame(() => textareaRef.current?.focus());
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-1 text-gray-600"
                  type="button"
                >
                  <Smile className="w-5 h-5 text-[#FF0004]" />
                </button>

                {/* Multiline textarea */}
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={onTextareaChange}
                  onFocus={() => setIsTextareaFocused(true)}
                  onBlur={onTextareaBlur}
                  placeholder="Type a message"
                  rows={1}
                  className="chat-textarea custom-scroll w-full border border-[#FFD5D5] rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary"
                  // iOS-specific attributes
                  enterKeyHint="send"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="sentences"
                  autoCorrect="on"
                  spellCheck="true"
                />

                {/* <-- picker moved here! --> */}
                {showPicker && (
                  <div
                    ref={pickerRef}
                    className="absolute bottom-full mb-2 left-3 bg-white border rounded-lg p-2 shadow-lg grid grid-cols-5 gap-2 z-41"
                  >
                    {EMOJIS.map((e, i) => (
                      <button
                        key={i}
                        // prevent pointer from stealing focus (touch/mousedown)
                        onMouseDown={preventStealFocus}
                        onTouchStart={preventStealFocus}
                        // actual click handler inserts emoji at caret and keeps focus
                        onClick={() => insertEmoji(e)}
                        type="button"
                        className="text-2xl hover:bg-gray-100 rounded w-8 h-8 flex items-center justify-center"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Send button outside the input border */}
              {draft.trim() && (
                <button
                  onMouseDown={preventStealFocus}
                  onTouchStart={preventStealFocus}
                  onClick={() => {
                    handleSend();
                    // keep focus
                    requestAnimationFrame(() => textareaRef.current?.focus());
                  }}
                  className="ml-2 bg-primary rounded-full p-2 text-white"
                  type="button"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                  </svg>
                </button>
              )}
            </div>
          </footer>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={Boolean(confirmDeleteTarget)}
        onClose={() => {
          setConfirmDeleteTarget(null);
          setConfirmDeleteLoading(false);
        }}
        onConfirm={() => {
          if (confirmDeleteTarget) {
            void performDelete(confirmDeleteTarget.messageId);
          }
        }}
        loading={confirmDeleteLoading}
      />

      {/* Report Message Modal */}
      <ReportMessageModal
        isOpen={reportModalOpen}
        onClose={() => {
          setReportModalOpen(false);
          setReportTargetMessageId(null);
        }}
        messageId={reportTargetMessageId}
        onReported={onReported}
      />
    </div>
  );
}
