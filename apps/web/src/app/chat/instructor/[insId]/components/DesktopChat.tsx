// DesktopChat.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IMessage } from '@elearning/types';
import Image from 'next/image';
import { Smile, MoreVertical, Trash2, CornerUpLeft, X, Flag } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useParams } from 'next/navigation';
import { useSocket } from '@/hooks/SocketContext';
import { fetchMessages, fetchMessageById, fetchMessagesAround } from '../../actions';
import MessageReactions from './MessageReaction';
import MessageStatus from './MessageStatus';
import { addPendingMessage, getPendingMessages, removePendingMessage, PendingMessageRecord } from '@/lib/offlineQueue';


import ConfirmDeleteModal from './ConfirmDeleteModal';
import ReportMessageModal from './ReportMessageModal';
import Portal from './Portal';

// small helper: generate a client temp id
const genTempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

interface DesktopChatProps {
  insId?: string;
  instructorName?: string;
  instructorAvatarUrl?: string;
  initialMessages?: any; // we accept various shapes; will normalize
  initialHasMore?: boolean;
  instructorProfession?: string;
  chats: ChatSummary[];
}

export type ReplySnapshot = {
  _id: string;
  content?: string;
  sender?: { id?: string; model?: string };
  createdAt?: string;
};

export type IMessageWithId = IMessage & {
  _id: string;
  sentByMe?: boolean;
  __status?: 'pending' | 'failed' | 'sent' | undefined;
  // optional replyTo snapshot (populated from server or optimistic)
  replyTo?: ReplySnapshot | null;
  isDeleted: boolean;
};

interface ChatSummary {
  instructorId: string;
  name: string;
  pictureId?: string;
  lastMessage: string;
  lastMessageAt: string; // ISO timestamp
  unreadCount: number;
  profession: string;
  pictureUrl?: string;
}


const MEDIA_URL =  process.env.NEXT_PUBLIC_MEDIA_API_URL || "";


const EMOJIS = ['😀', '😂', '😍', '😎', '😢', '👍', '🙏', '🎉', '🔥', '❤️'];

// constants
const MESSAGE_CUTOFF = 300;
const INITIAL_LIMIT = 12;
const PAGE_LIMIT = 20;
const LINE_HEIGHT_PX = 20;
const MAX_ROWS = 5;
const MAX_TEXTAREA_HEIGHT = LINE_HEIGHT_PX * MAX_ROWS;

export default function DesktopChat({
  insId: initialInsId,
  instructorName: initialInstructorName,
  instructorAvatarUrl: initialInstructorAvatarUrl,
  initialMessages,
  initialHasMore = false,
  instructorProfession: initialInstructorProfession,
  chats, 
}: DesktopChatProps) {
  const { user } = useAuth();
  const socket = useSocket();
  const params = useParams();
  const paramInsId = typeof params.insId === 'string' ? params.insId : null;

  const [activeId, setActiveId] = useState(paramInsId);
  const [activeName, setActiveName] = useState(initialInstructorName);
  const [activeAvatar, setActiveAvatar] = useState(initialInstructorAvatarUrl);
  const [activeProfession, setActiveProfession] = useState(initialInstructorProfession);

  const normalizedInitialMessages = useMemo(() => {
    if (!initialMessages) return [];
    if (Array.isArray(initialMessages)) return initialMessages;
    if ((initialMessages as any).results && Array.isArray((initialMessages as any).results.messages)) {
      return (initialMessages as any).results.messages;
    }
    if (Array.isArray((initialMessages as any).messages)) return (initialMessages as any).messages;
    return [];
  }, [initialMessages]);

  // messages
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

  // NEW: typing map for instructors (per-instructor)
  const [instructorTyping, setInstructorTyping] = useState<Record<string, boolean>>({});

  // reply state: holds the message being replied to (id + snapshot)
  const [replyTarget, setReplyTarget] = useState<{ id: string; snapshot: ReplySnapshot } | null>(null);

  // menu open id (which message has options menu open)
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);

  // highlight map for scroll-to target
  const [highlighted, setHighlighted] = useState<Record<string, boolean>>({});

  // loading state when fetching a target message or around-chunk
  const [targetLoading, setTargetLoading] = useState<{ id: string; loading: boolean } | null>(null);

  // state to control modals
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{ messageId: string } | null>(null);
  const [confirmDeleteLoading, setConfirmDeleteLoading] = useState(false);

  const [reportTargetMessageId, setReportTargetMessageId] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // refs
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const snapshotRef = useRef<Record<string, IMessageWithId | null>>({});

  // Typing helpers
  const typingTimerRef = useRef<number | null>(null);
  const isTypingSentRef = useRef<boolean>(false);
  const prevActiveRef = useRef<string | undefined>(undefined);
  const TYPING_TIMEOUT_MS = 2000;

  // track mount to avoid smooth scroll on initial mount
  const mountedRef = useRef(false);
  // track previous last message id to detect new bottom messages
  const prevLastMessageIdRef = useRef<string | null>(null);

  const handleDelete = (msgId: string) => {
    // show the confirm delete modal only if message belongs to current user
    const msg = messages.find((m) => String(m._id) === String(msgId));
    if (!msg) return;
    const isMe = msg.sender?.model === 'User' || String(msg.sender?.id) === String(user?._id);
    if (!isMe) {
      // shouldn't allow deleting other people's messages
      alert('You can only delete your own messages.');
      setMenuOpenFor(null);
      return;
    }
    setMenuOpenFor(null);
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
      setMenuOpenFor(null);
      return;
    }
    setMenuOpenFor(null);
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

  const scrollToBottomInstant = useCallback(() => {
    const c = containerRef.current;
    if (c) {
      c.scrollTop = c.scrollHeight;
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, []);

  const scrollToBottomSmooth = useCallback(() => {
    const c = containerRef.current;
    if (c && 'scrollTo' in c) {
      try {
        (c as any).scrollTo({ top: c.scrollHeight, behavior: 'smooth' });
      } catch {
        // fallback
        c.scrollTop = c.scrollHeight;
      }
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // auto scroll when messages change if user is near bottom OR last message changed (new message)
  useEffect(() => {
    const c = containerRef.current;
    const last = messages.length ? String(messages[messages.length - 1]._id) : null;

    // On first mount/initial load: snap instantly (no smooth)
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevLastMessageIdRef.current = last;
      // If there are messages, jump to bottom (instant) so user sees latest on load
      if (last) {
        scrollToBottomInstant();
      }
      return;
    }

    // If last message id changed compared to previous -> new bottom message appended or replaced
    const prevLast = prevLastMessageIdRef.current;
    const distanceFromBottom = c ? c.scrollHeight - (c.scrollTop + c.clientHeight) : 0;

    if (prevLast !== last) {
      // If user near bottom OR the new message was sent by the current user (we can check last message)
      const lastMsg = messages.length ? messages[messages.length - 1] : null;
      const lastSentByMe =
        lastMsg && (lastMsg.sender?.model === 'User' || String(lastMsg.sender?.id) === String(user?._id));

      if (distanceFromBottom < 120 || lastSentByMe) {
        // smooth scroll to bottom
        scrollToBottomSmooth();
      }
    }

    prevLastMessageIdRef.current = last;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

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

  // --- loadInitialMessages: returns the loaded messages (avoid stale state)
  const loadInitialMessages = useCallback(
    async (insId: string): Promise<IMessageWithId[]> => {
      setLoadingMessages(true);
      try {
        const { messages: msgs = [], hasMore: hm = false } = await fetchMessages(insId, undefined, INITIAL_LIMIT);

        const annotated: IMessageWithId[] = Array.isArray(msgs)
          ? (msgs as any).map((m: any) => ({ ...(m as any), __status: 'sent' }))
          : [];

        setMessages(annotated);
        setHasMore(Boolean(hm));

        // scroll to bottom for immediate view
        requestAnimationFrame(() => {
          scrollToBottomInstant();
        });

        // return fresh array to avoid race with React state updates
        return annotated;
      } catch (err) {
        console.error('Failed to load initial messages:', err);
        return [];
      } finally {
        setLoadingMessages(false);
      }
    },
    [scrollToBottomInstant],
  );

  // load older messages (prepend) using `before` filter = earliest message createdAt
  const loadOlderMessages = useCallback(
    async (insId: string) => {
      if (!hasMore || isLoadingOlder) return;
      if (!messages || messages.length === 0) {
        // nothing to base before upon — just load initial chunk
        await loadInitialMessages(insId);
        return;
      }

      setIsLoadingOlder(true);
      const container = containerRef.current;
      const prevScrollHeight = container?.scrollHeight ?? 0;
      const prevScrollTop = container?.scrollTop ?? 0;

      // oldest message in current list
      const oldest = messages[0];
      const beforeIso = oldest && (oldest.createdAt ? String(oldest.createdAt) : undefined);
      try {
        const { messages: olderMsgs = [], hasMore: hm } = await fetchMessages(insId, beforeIso, PAGE_LIMIT);
        if (!olderMsgs || olderMsgs.length === 0) {
          setHasMore(Boolean(hm));
          return;
        }

        // filter duplicates
        const existingIds = new Set(messages.map((m) => String((m as any)._id)));
        const filtered = olderMsgs.filter((m: any) => !existingIds.has(String((m as any)._id)));
        const annotated = filtered.map((m: any) => ({ ...m, __status: 'sent' }));

        setMessages((prev) => [...annotated, ...prev]);

        // preserve scroll position: compute new scrollHeight and adjust
        requestAnimationFrame(() => {
          const newScrollHeight = container?.scrollHeight ?? 0;
          if (container) {
            const delta = newScrollHeight - prevScrollHeight;
            container.scrollTop = prevScrollTop + delta;
          }
        });

        setHasMore(Boolean(hm));
      } catch (err) {
        console.error('Failed to load older messages:', err);
      } finally {
        setIsLoadingOlder(false);
      }
    },
    [hasMore, isLoadingOlder, messages, loadInitialMessages],
  );

  // on mount or active change, load conversation
  const lastChatInsId = chats.length > 0 ? chats[0].instructorId : null;
  useEffect(() => {
    const idToLoad = activeId ?? lastChatInsId;
    if (!idToLoad) return;

    if (
      normalizedInitialMessages &&
      normalizedInitialMessages.length > 0 &&
      String(initialInsId) === String(idToLoad)
    ) {
      const annotated = normalizedInitialMessages.map((m: any) => ({ ...m, __status: 'sent' }));
      setMessages(annotated);
      setHasMore(Boolean(initialHasMore));
      requestAnimationFrame(() => {
        scrollToBottomInstant();
      });
      return;
    }

    loadInitialMessages(idToLoad);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastChatInsId, activeId, normalizedInitialMessages, initialHasMore]);

  // --- selectConversation: uses returned messages, joins room, marks instructor messages as seen
  const selectConversation = useCallback(
    async (c: ChatSummary) => {
      // short-circuit if already active
      if (c.instructorId === activeId) return;

      // if we were typing in previous conversation, notify server we stopped typing
      if (isTypingSentRef.current && user && prevActiveRef.current) {
        try {
          const prevRoom = `Instructor:${prevActiveRef.current}-User:${user._id}`;
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

      prevActiveRef.current = c.instructorId;

      const selectedInsPictureUrl = c.pictureUrl || '/userPlaceHolder.jpg'

      // set UI selection immediately
      setActiveId(c.instructorId);
      setActiveName(c.name);
      setActiveAvatar(selectedInsPictureUrl);
      setActiveProfession(c.profession);

      // clear current message buffer and reset pagination
      setMessages([]);
      setHasMore(false);

      // LOAD: get fresh messages (this returns the loaded array)
      const loaded = await loadInitialMessages(c.instructorId);

      // Clear unread count for this conversation in sidebar
      setSideConversations((prev) =>
        prev.map((x) => (x.instructorId === c.instructorId ? { ...x, unreadCount: 0 } : x)),
      );

      // Ensure socket joined proper rooms before sending markAsSeen emits
      try {
        socket?.emit('joinRoom', { room: `Instructor:${c.instructorId}-User:${user?._id}` });
        socket?.emit('joinRoom', { room: `User:${user?._id}` });
      } catch (err) {
        console.warn('joinRoom emits failed (non-fatal)', err);
      }

      // Mark instructor messages as seen using the freshly loaded array (avoid stale messages state)
      if (Array.isArray(loaded) && loaded.length > 0 && socket && user) {
        const idsToMark = loaded
          .filter((msg) => msg && msg.sender && msg.sender.model === 'Instructor' && msg._id)
          .filter((msg) => {
            const seenByArr = Array.isArray(msg.seenBy) ? msg.seenBy : [];
            return !seenByArr.some((p: any) => String(p.id) === String(user?._id));
          })
          .map((m) => String((m as any)._id));

        const uniqueIds = Array.from(new Set(idsToMark));

        if (uniqueIds.length > 0) {
          uniqueIds.forEach((messageId) => {
            try {
              if ((socket as any).connected) {
                socket.emit('markAsSeen', { messageId });
              }
            } catch (err) {
              console.warn('markAsSeen emit failed for', messageId, err);
            }
          });

          // Optimistically update local messages: add current user to seenBy for those messages
          setMessages((prev) =>
            prev.map((m) => {
              if (!m || !m._id) return m;
              if (!uniqueIds.includes(String(m._id))) return m;
              const existingSeen = Array.isArray(m.seenBy) ? m.seenBy.slice() : [];
              if (!existingSeen.some((p: any) => String(p?.id) === String(user?._id))) {
                existingSeen.push({ id: user?._id, model: 'User' });
              }
              return { ...m, seenBy: existingSeen };
            }),
          );
        }
      }
    },
    // dependencies: use stable callbacks/refs where possible
    [activeId, loadInitialMessages, socket, user],
  );

  // presence identify
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
    if (!socket || !activeId) return;
    socket.emit('checkOnlineStatus', { id: activeId, model: 'Instructor' }, ({ online }: { online: boolean }) => {
      setInstructorOnline((m) => ({ ...m, [activeId]: online }));
    });
  }, [socket, activeId]);

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

  // mark initial messages as seen (if necessary)
  useEffect(() => {
    if (!socket || !user) return;
    const arr = normalizedInitialMessages;
    if (!Array.isArray(arr) || arr.length === 0) return;

    arr.forEach((m: any) => {
      try {
        if (m && m.sender && m.sender.model === 'Instructor') {
          const seenByArr = Array.isArray(m.seenBy) ? m.seenBy : [];
          if (!seenByArr.some((p) => String(p.id) === String(user._id))) {
            socket.emit('markAsSeen', { messageId: (m as any)._id });
          }
        }
      } catch (err) {
        console.warn('Skipping malformed message while marking seen', err);
      }
    });

    setSideConversations((prev) => prev.map((c) => (c.instructorId === activeId ? { ...c, unreadCount: 0 } : c)));
  }, [normalizedInitialMessages, socket, user, activeId]);

  // -------------------------
  // Core realtime handlers
  // -------------------------
  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (msg: any) => {
      try {
        if (!msg) return;
        // compute the user id on the 'other' side (the student)
        const otherId =
          msg.sender?.model === 'Instructor'
            ? String(msg.sender.id)
            : msg.receiver?.model === 'Instructor'
              ? String(msg.receiver.id)
              : null;

        // update sidebar safely
        if (otherId) {
          setSideConversations((prev: ChatSummary[]) => {
            const next = (prev || []).filter(Boolean);
            const idx = next.findIndex((c) => String(c.instructorId ?? c.instructorId ?? '') === String(otherId));
            if (idx === -1) {
              const newSummary: ChatSummary = {
                instructorId: otherId,
                name: msg.sender?.name ?? msg.receiver?.name ?? 'Unknown',
                pictureUrl: msg.sender?.pictureUrl ?? msg.receiver?.pictureUrl ?? '/userPlaceHolder.jpg',
                lastMessage: msg.content ?? '',
                lastMessageAt: msg.createdAt ? new Date(msg.createdAt).toISOString() : new Date().toISOString(),
                unreadCount: 1,
              };
              return [newSummary, ...next].sort(
                (a, b) => Date.parse(b.lastMessageAt ?? '') - Date.parse(a.lastMessageAt ?? ''),
              );
            }

            const isActive = String(otherId) === String(activeId);
            const updated = next.map((c, i) =>
              i === idx
                ? {
                    ...c,
                    lastMessage: msg.content ?? c.lastMessage,
                    lastMessageAt: msg.createdAt
                      ? new Date(msg.createdAt).toISOString()
                      : (c.lastMessageAt ?? new Date().toISOString()),
                    unreadCount: isActive ? 0 : (c.unreadCount ?? 0) + (msg.sender?.model === 'Instructor' ? 1 : 0),
                  }
                : c,
            );
            return updated.sort((a, b) => Date.parse(b.lastMessageAt ?? '') - Date.parse(a.lastMessageAt ?? ''));
          });
        }

        // append to message list only if this belongs to the currently open conversation
        if (String(otherId) === String(activeId)) {
          setMessages((prev) => {
            // prevent duplicates
            const serverId = msg._id ? String(msg._id) : null;
            if (serverId && prev.some((m) => String(m._id) === serverId)) return prev;

            const maybeClientTempId = msg.clientTempId ? String(msg.clientTempId) : null;
            if (maybeClientTempId && prev.some((m) => String(m._id) === maybeClientTempId)) {
              // replace optimistic
              return prev.map((m) => (String(m._id) === maybeClientTempId ? { ...(msg as any), __status: 'sent' } : m));
            }

            return [...prev, { ...(msg as any), __status: 'sent' }];
          });

          // mark the incoming message as seen if it is from User
          try {
            if (msg.sender?.model === 'Instructor' && msg._id) {
              socket?.emit('markAsSeen', { messageId: msg._id });
            }
          } catch (err) {
            // ignore
          }
        }
      } catch (err) {
        console.error('onNewMessage error (defensive):', err);
      }
    };

    const onMessageSeen = ({ messageId, seenBy }: { messageId: string; seenBy: any[] }) => {
      setMessages((prev) => prev.map((m) => (String(m._id) === String(messageId) ? { ...m, seenBy } : m)));
    };

    const onReactionUpdated = (payload: any) => {
      if (!payload || !payload.messageId) return;
      const { messageId, reactionCounts, reactions } = payload;
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(messageId)
            ? { ...m, reactionCounts: reactionCounts ?? m.reactionCounts, reactions: reactions ?? m.reactions }
            : m,
        ),
      );
    };

    socket.on('newMessage', onNewMessage);
    socket.on('messageSeen', onMessageSeen);
    socket.on('messageReactionUpdated', onReactionUpdated);

    // ack handlers for optimistic reactions
    const onReactAck = (ack: any) => {
      try {
        if (!ack) return;
        if (!ack.ok) {
          const msgId = ack?.messageId || (ack?.data && ack.data.messageId);
          if (msgId && snapshotRef.current[msgId]) {
            const snap = snapshotRef.current[msgId];
            setMessages((prev) => prev.map((m) => (String(m._id) === String(msgId) ? (snap as any) : m)));
            delete snapshotRef.current[msgId];
          }
          console.error('reactAck failed:', ack.message || ack);
          return;
        }
        const data = ack.data;
        if (data && data.messageId) {
          setMessages((prev) =>
            prev.map((m) =>
              String(m._id) === String(data.messageId)
                ? {
                    ...m,
                    reactionCounts: data.reactionCounts ?? m.reactionCounts,
                    reactions: data.reactions ?? m.reactions,
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
            setMessages((prev) => prev.map((m) => (String(m._id) === String(msgId) ? (snap as any) : m)));
            delete snapshotRef.current[msgId];
          }
          console.error('removeReactionAck failed:', ack.message || ack);
          return;
        }
        const data = ack.data;
        if (data && data.messageId) {
          setMessages((prev) =>
            prev.map((m) =>
              String(m._id) === String(data.messageId)
                ? {
                    ...m,
                    reactionCounts: data.reactionCounts ?? m.reactionCounts,
                    reactions: data.reactions ?? m.reactions,
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
      try {
        socket.off('newMessage', onNewMessage);
        socket.off('messageSeen', onMessageSeen);
        socket.off('messageReactionUpdated', onReactionUpdated);
        socket.off('reactAck', onReactAck);
        socket.off('removeReactionAck', onRemoveAck);
      } catch {}
    };
  }, [socket, activeId, user, scrollToBottomSmooth]);

  // Listen for typing events from server
  useEffect(() => {
    if (!socket) return;

    const onTyping = (payload: { userId?: string; model?: 'User' | 'Instructor'; isTyping?: boolean }) => {
      try {
        if (!payload) return;
        // instructor typing indicator
        if (payload.model === 'Instructor' && String(payload.userId) === String(activeId)) {
          setInstructorTyping((prev) => ({ ...prev, [activeId as string]: !!payload.isTyping }));
        }
        // Optional: if you want to handle other users typing, extend here.
      } catch (err) {
        // ignore
      }
    };

    socket.on('typing', onTyping);
    return () => {
      socket.off('typing', onTyping);
      // Clear typing indicator for activeId when leaving
      setInstructorTyping((prev) => ({ ...prev, [activeId as string]: false }));
    };
  }, [socket, activeId]);

  // Acks for optimistic reactions (unchanged logic)
  useEffect(() => {
    if (!socket) return;

    const onReactAck = (ack: any) => {
      try {
        if (!ack) return;
        if (!ack.ok) {
          const msgId = ack?.messageId || (ack?.data && ack.data.messageId);
          if (msgId && snapshotRef.current[msgId]) {
            const snap = snapshotRef.current[msgId];
            setMessages((prev) => prev.map((m) => (String((m as any)._id) === String(msgId) ? snap : m)));
            delete snapshotRef.current[msgId];
          }
          console.error('reactAck failed:', ack.message || ack);
          return;
        }
        const data = ack.data;
        if (data && data.messageId) {
          setMessages((prev) =>
            prev.map((m) =>
              String((m as any)._id) === String(data.messageId)
                ? {
                    ...m,
                    reactionCounts: data.reactionCounts ?? m.reactionCounts,
                    reactions: data.reactions ?? m.reactions,
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
            setMessages((prev) => prev.map((m) => (String((m as any)._id) === String(msgId) ? snap : m)));
            delete snapshotRef.current[msgId];
          }
          console.error('removeReactionAck failed:', ack.message || ack);
          return;
        }
        const data = ack.data;
        if (data && data.messageId) {
          setMessages((prev) =>
            prev.map((m) =>
              String((m as any)._id) === String(data.messageId)
                ? {
                    ...m,
                    reactionCounts: data.reactionCounts ?? m.reactionCounts,
                    reactions: data.reactions ?? m.reactions,
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

  // ---------------------------
  // Reactions (frontend optimistic)
  // ---------------------------
  const cloneMsg = (m: any) => JSON.parse(JSON.stringify(m));

  const applyOptimisticReaction = (messageId: string, userId: string, type?: string | null) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (String((m as any)._id) !== String(messageId)) return m;

        const mm: any = { ...(m as any) };
        mm.reactionCounts = mm.reactionCounts ? { ...mm.reactionCounts } : {};
        mm.reactions = Array.isArray(mm.reactions) ? mm.reactions.slice() : [];

        const existingIndex = mm.reactions.findIndex((r: any) => String(r.user) === String(userId));
        const existingType = existingIndex !== -1 ? mm.reactions[existingIndex].type : null;

        if (!type) {
          if (existingIndex !== -1) {
            const removed = mm.reactions.splice(existingIndex, 1)[0];
            const et = removed.type;
            mm.reactionCounts[et] = Math.max(0, (mm.reactionCounts[et] || 0) - 1);
          }
        } else {
          if (existingIndex !== -1) {
            if (existingType === type) {
              mm.reactions.splice(existingIndex, 1);
              mm.reactionCounts[type] = Math.max(0, (mm.reactionCounts[type] || 0) - 1);
            } else {
              mm.reactions[existingIndex] = {
                ...mm.reactions[existingIndex],
                type,
                createdAt: new Date().toISOString(),
              };
              if (existingType)
                mm.reactionCounts[existingType] = Math.max(0, (mm.reactionCounts[existingType] || 0) - 1);
              mm.reactionCounts[type] = (mm.reactionCounts[type] || 0) + 1;
            }
          } else {
            mm.reactions.push({ user: userId, type, createdAt: new Date().toISOString() });
            mm.reactionCounts[type] = (mm.reactionCounts[type] || 0) + 1;
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
    const msgSnapshot = (messages || []).find((m) => String((m as any)._id) === String(messageId));
    snapshotRef.current[messageId] = msgSnapshot ? cloneMsg(msgSnapshot) : null;
    applyOptimisticReaction(messageId, user._id, type ?? null);
    if (type) {
      socket.emit('reactToMessage', { messageId, type, toggleOnSame: false });
    } else {
      socket.emit('removeMessageReaction', { messageId });
    }
  };

  // -------- send + offline queueing ----------
  const insertEmoji = useCallback((e: string) => {
    setDraft((d) => d + e);
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.focus();
    });
  }, []);

  // small helpers
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
        // Replacement usually corresponds to our sent message — smooth scroll to bottom
        requestAnimationFrame(() => {
          scrollToBottomSmooth();
        });
        return replaced;
      }

      // otherwise append server message
      requestAnimationFrame(() => {
        scrollToBottomSmooth();
      });
      return [...prev, { ...(serverMsg as any), __status: 'sent' }];
    });
  };

  const retrySend = (clientTempId: string) => {
    // attempt to re-queue and flush
    const pendingLocal = getPendingMessages().find((p) => p.clientTempId === clientTempId);
    const localMessage = messages.find((m) => String(m._id) === String(clientTempId));

    if (!pendingLocal && localMessage && user && activeId) {
      const built: PendingMessageRecord = {
        clientTempId,
        content: (localMessage as any).content ?? '',
        receiverId: activeId,
        senderId: user._id,
        room: `Instructor:${activeId}-User:${user._id}`,
        createdAt: new Date().toISOString(),
        attempt: 0,
      };
      addPendingMessage(built);
    }

    flushPendingQueue();
  };

  // send with replyTo support
  const handleSend = useCallback(() => {
    if (!draft.trim() || !user || !activeId) return;

    // stop typing (we just sent)
    try {
      if (isTypingSentRef.current) {
        const room = `Instructor:${activeId}-User:${user._id}`;
        socket?.emit('typing', { room, isTyping: false });
        isTypingSentRef.current = false;
      }
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    } catch (err) {
      // ignore
    }

    const content = draft.trim();
    const clientTempId = genTempId();
    const createdAt = new Date().toISOString();

    const optimisticMsg: IMessageWithId = {
      _id: clientTempId,
      content,
      createdAt,
      sender: { id: user._id, model: 'User' as const },
      receiver: { id: activeId, model: 'Instructor' as const },
      __status: 'pending',
      replyTo: replyTarget ? replyTarget.snapshot : null,
    } as any;

    // append UI
    setMessages((prev) => {
      const next = [...prev, optimisticMsg];
      return next;
    });

    // smooth scroll to bottom immediately — user expects to see their message
    requestAnimationFrame(() => {
      scrollToBottomSmooth();
    });

    // update sidebar
    setSideConversations((prev) =>
      prev
        .map((c) =>
          c.instructorId === activeId ? { ...c, lastMessage: content, lastMessageAt: new Date().toISOString() } : c,
        )
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()),
    );

    // capture replyTo id to send and clear composer
    const replyToIdToSend = replyTarget ? replyTarget.id : undefined;
    setReplyTarget(null);
    setDraft('');
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    });

    const pending: PendingMessageRecord = {
      clientTempId,
      content,
      receiverId: activeId,
      senderId: user._id,
      room: `Instructor:${activeId}-User:${user._id}`,
      createdAt,
      attempt: 0,
    };

    // Add replyTo to pending record so flush can send it
    (pending as any).replyTo = replyToIdToSend;

    // Try to send immediately if connected
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
              // server persisted message
              replaceTempMessageWithServerMessage(ack.data.clientTempId ?? pending.clientTempId, ack.data.message);
              removePendingMessage(pending.clientTempId);
            } else {
              // mark failed and ensure queued
              updateMessageByTempId(pending.clientTempId, { __status: 'failed' });
              addPendingMessage(pending);
            }
          },
        );
      } catch (err) {
        console.error('emit sendMessage failed, queueing', err);
        updateMessageByTempId(pending.clientTempId, { __status: 'pending' });
        addPendingMessage(pending);
      }
    } else {
      // offline -> queue
      addPendingMessage(pending);
      updateMessageByTempId(pending.clientTempId, { __status: 'pending' });
    }
  }, [draft, user, activeId, socket, replyTarget, scrollToBottomSmooth]);

  // Flush pending queue
  const flushPendingQueue = useCallback(() => {
    const pending = getPendingMessages();
    if (!socket || !socket.connected || pending.length === 0) return;

    // iterate in order (preserve user order)
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
              replaceTempMessageWithServerMessage(ack.data.clientTempId ?? p.clientTempId, ack.data.message);
              removePendingMessage(p.clientTempId);
            } else {
              // leaving in queue for later; mark failed
              updateMessageByTempId(p.clientTempId, { __status: 'failed' });
            }
          },
        );
      } catch (err) {
        console.error('flush emit error', err);
        updateMessageByTempId(p.clientTempId, { __status: 'failed' });
      }
    });
  }, [socket, replaceTempMessageWithServerMessage]);

  // attach flush to connect + window online
  useEffect(() => {
    if (!socket) return;
    const onConnect = () => {
      flushPendingQueue();
    };
    socket.on('connect', onConnect);
    if (socket.connected) flushPendingQueue();
    return () => {
      socket.off('connect', onConnect);
    };
  }, [socket, flushPendingQueue]);

  useEffect(() => {
    const onOnline = () => {
      if (socket && socket.connected) flushPendingQueue();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [socket, flushPendingQueue]);

  // autoresize textarea
  const autoResizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const scrollH = ta.scrollHeight;
    const newHeight = Math.min(scrollH, MAX_TEXTAREA_HEIGHT);
    ta.style.height = `${newHeight}px`;
    ta.style.overflowY = scrollH > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    autoResizeTextarea();
  }, [draft, autoResizeTextarea]);

  // Add a new useEffect to handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        !event.target.closest('button[aria-label="emoji-picker"]')
      ) {
        setShowPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Typing: send `typing` start/stop with debounce
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

  // call when user types (onChange)
  const handleUserTyping = useCallback(() => {
    if (!socket || !user || !activeId) return;
    const room = `Instructor:${activeId}-User:${user._id}`;
    try {
      if (!isTypingSentRef.current) {
        socket.emit('typing', { room, isTyping: true });
        isTypingSentRef.current = true;
      }
      // schedule stop after timeout
      scheduleStopTyping(room);
    } catch (err) {
      // ignore
    }
  }, [socket, user, activeId, scheduleStopTyping]);

  // When activeId changes we should clear any typing timers and notify server we stopped typing in previous room
  useEffect(() => {
    if (!user) return;
    const prev = prevActiveRef.current;
    if (prev && prev !== activeId && isTypingSentRef.current) {
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
    prevActiveRef.current = activeId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // autoresize helper for textarea on draft change + typing
  useEffect(() => {
    autoResizeTextarea();
    // emit typing when draft changes
    if (draft !== '') {
      handleUserTyping();
    } else {
      // if draft cleared, send stopTyping immediately
      if (isTypingSentRef.current && user && activeId) {
        try {
          const room = `Instructor:${activeId}-User:${user._id}`;
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

  // ensure we clear timers and send stop on unmount
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
      }
      if (isTypingSentRef.current && user && prevActiveRef.current) {
        try {
          const prevRoom = `Instructor:${prevActiveRef.current}-User:${user._id}`;
          socket?.emit('typing', { room: prevRoom, isTyping: false });
        } catch (err) {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderDateHeader(date: Date | string) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return (
      <div className="text-center bg-[#F1F1F1] px-2 py-1 rounded-md w-fit mx-auto text-[#84939A] font-bold text-[12px] my-4">
        {d.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </div>
    );
  }

  // compute lastSentMessageIdByMe
  const lastSentMessageIdByMe = (() => {
    if (!user || !messages || messages.length === 0) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i] as any;
      if (
        m?.sender &&
        String(m.sender.id) === String(user._id) &&
        (m.sender.model === 'User' || m.sender.model === 'user')
      ) {
        return (m as any)._id?.toString() ?? null;
      }
    }
    return null;
  })();

  const onScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      if (target.scrollTop < 120 && hasMore && !isLoadingOlder && activeId) {
        loadOlderMessages(activeId);
      }
    },
    [hasMore, isLoadingOlder, activeId, loadOlderMessages],
  );

  // --------- Reply helpers & menu handlers ---------
  // Set reply target (clicking reply option)
  const startReplyTo = (msg: IMessageWithId) => {
    const snapshot: ReplySnapshot = {
      _id: String((msg as any)._id),
      content: (msg as any).content ?? '',
      sender: (msg as any).sender ?? undefined,
      createdAt: (msg as any).createdAt ?? undefined,
    };
    setReplyTarget({ id: snapshot._id, snapshot });
    // focus composer
    requestAnimationFrame(() => textareaRef.current?.focus());
    // close menu
    setMenuOpenFor(null);
  };

  // Cancel reply
  const cancelReply = () => setReplyTarget(null);

  // Scroll to original message by id and highlight
  const scrollToMessageById = (targetId: string) => {
    // find element with id `msg-${targetId}`
    const el = document.getElementById(`msg-${targetId}`);
    const container = containerRef.current;
    if (!el) {
      // Not in DOM
      console.warn('Target message not in DOM:', targetId);
      return;
    }

    // Compute position relative to container
    if (container) {
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const offset = elRect.top - containerRect.top;
      // Scroll so element is about 1/3 from top
      container.scrollTop += offset - container.clientHeight / 3;
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // briefly highlight
    setHighlighted((h) => ({ ...h, [targetId]: true }));
    window.setTimeout(() => {
      setHighlighted((h) => {
        const copy = { ...h };
        delete copy[targetId];
        return copy;
      });
    }, 1800);
  };

  // Open menu for message
  const toggleMenuFor = (msgId: string) => {
    setMenuOpenFor((cur) => (cur === msgId ? null : msgId));
  };

  // If user clicks the reply snippet in a bubble
  const onClickReplySnippet = async (reply: ReplySnapshot | string | undefined) => {
    if (!reply) return;
    const id = typeof reply === 'string' ? reply : reply._id;
    if (!id) return;

    // If target DOM exists -> scroll to it
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      scrollToMessageById(id);
      return;
    }

    // Otherwise try to ensure message is in list (fetch single or around)
    try {
      setTargetLoading({ id, loading: true });

      // Strategy:
      // 1) Try fetching single message (cheap)
      // 2) If returned message timestamp makes it obvious we need context, or the client wants full context,
      //    call fetchMessagesAround and merge; we try single first and fall back to around if needed.

      // fetch the single message
      const single = await fetchMessageById(id);
      if (!single) {
        throw new Error('Message not found');
      }

      // Validate single belongs to current conversation (sender/receiver)
      const participants = [String(single.sender?.id ?? ''), String(single.receiver?.id ?? '')];
      if (!participants.includes(String(activeId)) && !participants.includes(String(user?._id))) {
        // shouldn't happen in normal flows — but don't merge messages from other conversations
        console.warn('Message belongs to different conversation', single);
        setTargetLoading(null);
        return;
      }

      // If the single message's createdAt is very old and we want context, we may instead fetch 'around' chunk.
      // Heuristic: if the single message is older than oldest loaded by more than (PAGE_LIMIT * 2) — fetch around.
      const oldest = messages[0];
      const singleCreated = single.createdAt ? new Date(single.createdAt).getTime() : 0;
      const oldestCreated = oldest && oldest.createdAt ? new Date(String(oldest.createdAt)).getTime() : null;
      const timeGap = oldestCreated ? Math.abs(oldestCreated - singleCreated) : null;

      // If we don't have any messages loaded OR the message is within currently loaded range -> insert single only
      const currentlyHas = messages.some((m) => String(m._id) === String(id));
      if (currentlyHas) {
        // should not happen (we checked DOM earlier), but just scroll if present
        setTargetLoading(null);
        scrollToMessageById(id);
        return;
      }

      // If message is close to the range (i.e. newer than oldest or within some reasonable gap), just merge single
      const SHOULD_FETCH_AROUND = timeGap !== null && timeGap > 1000 * 60 * 60 * 24 * 7; // e.g., > 7 days, try around for context

      if (!SHOULD_FETCH_AROUND) {
        // Merge single into messages list keeping chronological order
        setMessages((prev) => {
          const exists = prev.some((m) => String(m._id) === String(single._id));
          if (exists) return prev;
          const all = [...prev, { ...(single as any), __status: 'sent' }];
          all.sort(
            (a: any, b: any) => new Date(String(a.createdAt)).getTime() - new Date(String(b.createdAt)).getTime(),
          );
          return all;
        });

        // wait next paint then scroll
        requestAnimationFrame(() => {
          setTargetLoading(null);
          scrollToMessageById(id);
        });
        return;
      }

      // fallback: fetch a context chunk around the message and merge (safer for very old messages)
      const { messages: aroundChunk = [] } = await fetchMessagesAround(activeId as string, id, 40);
      if (!aroundChunk || aroundChunk.length === 0) {
        // if chunk empty, fallback to single insertion
        setMessages((prev) => {
          const exists = prev.some((m) => String(m._id) === String(single._id));
          if (exists) return prev;
          const all = [...prev, { ...(single as any), __status: 'sent' }];
          all.sort(
            (a: any, b: any) => new Date(String(a.createdAt)).getTime() - new Date(String(b.createdAt)).getTime(),
          );
          return all;
        });
        requestAnimationFrame(() => {
          setTargetLoading(null);
          scrollToMessageById(id);
        });
        return;
      }

      // Merge the chunk: dedupe, sort ascending chronological
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
        scrollToMessageById(id);
      });
    } catch (err) {
      console.error('Failed to ensure message in list:', err);
      setTargetLoading(null);
    }
  };

  // --------- Reply helpers continued (UI)---------
  // Set reply target (clicking reply option)
  // startReplyTo defined above

  // ---------------- Render ----------------
  return (
    <div className="flex h-screen bg-white">
      <aside className="w-1/3 border-r min-w-[30%] overflow-y-auto px-4 py-2 bg-white flex flex-col">
        <div className="flex-1 ">
          {sideConversations.map((chat, i) => (
            <div
              key={chat.instructorId || i}
              onClick={() => selectConversation(chat)}
              className={`flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                chat.instructorId === activeId ? 'bg-[#F0F2F5] rounded-md' : 'bg-white'
              }`}
            >
              <div className="w-[60px] h-[60px] rounded-full overflow-hidden">
                <Image
                  src={chat?.pictureUrl || "/userPlaceHolder.jpg"}
                  alt={chat.name}
                  width={100}
                  height={100}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="ml-3 flex-1">
                <p className="font-bold text-[14px]">{chat.name}</p>
                <p className="text-xs text-[#3B4A54] truncate max-w-[10vw]">{chat.lastMessage}</p>
              </div>
              <div className="flex flex-col items-center">
                <span className={`${chat.unreadCount > 0 ? 'text-primary font-[500]' : 'text-[#829C99]'} text-[10px]`}>
                  {new Date(chat.lastMessageAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {chat.unreadCount > 0 && (
                  <span className="flex mt-2 items-center justify-center text-white text-center rounded-full font-bold text-[10px] w-[20px] h-[20px] bg-primary">
                    {chat.unreadCount > 5 ? '+5' : chat.unreadCount}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex flex-col flex-1 bg-[url('/cover-homepage.webp')] bg-cover bg-center">
        {!activeId ? (
          <div className="text-center text-sm flex justify-center items-center h-full w-full ">
            <span>Select conversation</span>
          </div>
        ) : (
          <>
            <header className="flex items-start px-2 py-3 bg-transparent">
              <div className="w-[54px] h-[54px] rounded-full overflow-hidden">
                <Image
                  src={activeAvatar || "/userPlaceHolder.jpg" as string}
                  alt={`${activeName} avatar`}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="ml-4">
                <p className="font-medium text-lg">{activeName}</p>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span className="font-medium text-primary text-sm">
                    {instructorTyping[activeId as string]
                      ? 'Typing…'
                      : instructorOnline[activeId]
                        ? 'Online'
                        : 'Offline'}
                  </span>
                </div>
              </div>
              <div className="ml-4 border border-[#2b95e9] rounded-md px-2 py-1">
                <p className="text-[12px] font-bold text-[#2b95e9]">{activeProfession}</p>
              </div>
            </header>
            <main
              ref={(el) => (containerRef.current = el)}
              onScroll={onScroll}
              className="flex-1 font-helvetica overflow-y-auto px-6 py-4"
            >
              {loadingMessages && (
                <div className="flex justify-center py-4">
                  <span className="text-gray-500">Loading messages…</span>
                </div>
              )}

              {/* Loading overlay for target fetch */}
              {targetLoading && targetLoading.loading && (
                <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[800] bg-white/90 p-4 rounded shadow-lg flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary" />
                  <div className="text-sm">Loading message…</div>
                </div>
              )}

              {!loadingMessages &&
                (() => {
                  let lastDay = '';
                  const stableList = messages.map((m, i) => {
                    const key = m._id ? String(m._id) : `idx-${i}`;
                    return { key, msg: m, idx: i };
                  });

                  return stableList.map(({ key: messageKey, msg, idx }) => {
                    const createdAt =
                      typeof msg.createdAt === 'string'
                        ? new Date(msg.createdAt)
                        : msg.createdAt
                          ? new Date(msg.createdAt)
                          : new Date();
                    const dayKey = createdAt.toISOString().slice(0, 10);
                    const show = dayKey !== lastDay;
                    lastDay = dayKey;
                    const isMe = msg.sender?.model === 'User' || String(msg.sender?.id) === String(user?._id);

                    const content = msg.content ?? '';
                    const isLong = content.length > MESSAGE_CUTOFF;
                    const isExpanded = Boolean(expandedMap[messageKey]);
                    const preview = isLong && !isExpanded ? content.slice(0, MESSAGE_CUTOFF) + '...' : content;

                    const reactionCounts = (msg as any).reactionCounts ?? null;
                    const reactionsArr = Array.isArray((msg as any).reactions) ? (msg as any).reactions : [];

                    const hasReactions =
                      (reactionCounts && Object.values(reactionCounts).some((c) => c && c > 0)) ||
                      reactionsArr.length > 0;

                    const senderIdentity = msg?.sender?.model;

                    // highlight class if this message is currently targeted
                    const highlightClass = highlighted[messageKey] ? 'ring-2 ring-yellow-300 rounded-lg' : '';

                    return (
                      <div className={`${hasReactions ? 'mb-5' : ''}`} key={messageKey || idx}>
                        {show && renderDateHeader(createdAt)}
                        <div className={`flex items-start space-x-2 ${isMe ? 'justify-end' : ''}`}>
                          {!isMe && (
                            <div className="flex flex-col items-center">
                              {senderIdentity === 'Instructor' && (
                                <Image
                                  className="-mr-6 -mb-1"
                                  src="/verified-blue.svg"
                                  alt="verified"
                                  width={22}
                                  height={22}
                                />
                              )}
                              <div className="w-8 h-8  rounded-full overflow-hidden bg-[#FDD2D3]">
                                <Image
                                  src={activeAvatar}
                                  alt="Instructor"
                                  width={50}
                                  height={50}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </div>
                          )}
                          {/* message wrapper is a group so we can show hover controls */}
                          <div className="relative  group" tabIndex={0}>
                            <div
                              id={`msg-${messageKey}`}
                              className={`p-3 font-helvetica  rounded-lg text-[14px]  ${isMe ? 'bg-[#FDD2D3]' : 'bg-[#FDD2D3]'} text-black my-2 shadow-sm max-w-[30vw] ${highlightClass}`}
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
                                  <div className="truncate mt-1 text-[13px]">
                                    {((msg.replyTo as any).content ?? '').slice(0, 80)}
                                  </div>
                                </div>
                              )}

                              <p className="text-[14.5px] font-helvetica break-words">
                                {!msg.isDeleted ? preview : 'Message deleted.'}

                                {isLong && (
                                  <button
                                    onClick={() => {
                                      console.log('Read more button clicked');
                                      setExpandedMap((p) => ({ ...p, [messageKey]: !p[messageKey] }));
                                    }}
                                    className="ml-2 text-sm underline font-bold text-primary "
                                    style={{ position: 'relative', zIndex: 20 }}
                                    aria-expanded={isExpanded}
                                    type="button"
                                  >
                                    {!msg?.isDeleted && <div>{isExpanded ? 'See less' : 'Read more'}</div>}
                                  </button>
                                )}
                              </p>

                              <div className="mt-1 flex items-center justify-end gap-2">
                                <span className="text-[10px] text-gray-700">
                                  {createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>

                                {isMe && (msg as any).__status === 'pending' && (
                                  <span className="text-[11px] text-gray-500 italic">Sending…</span>
                                )}
                                {isMe && (msg as any).__status === 'failed' && (
                                  <button
                                    onClick={() => retrySend((msg as any)._id)}
                                    className="text-[11px] text-red-600 font-bold underline"
                                    type="button"
                                  >
                                    Failed — Retry
                                  </button>
                                )}

                                {isMe &&
                                  lastSentMessageIdByMe &&
                                  String(lastSentMessageIdByMe) === String((msg as any)._id) && (
                                    <MessageStatus
                                      message={msg as any}
                                      currentUserId={user?._id}
                                      className="self-end"
                                    />
                                  )}
                              </div>
                            </div>

                            {/* hover menu button (top-right of bubble) */}
                            <div className="absolute z-[49] -right-4 top-5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => toggleMenuFor(messageKey)}
                                className="p-1 bg-white rounded-full shadow-sm hover:bg-gray-100"
                                aria-label="message options"
                                type="button"
                              >
                                <MoreVertical className="w-4 h-4 text-gray-600" />
                              </button>
                            </div>

                            {/* small menu when opened */}
                            {menuOpenFor === messageKey && (
                              <div
                                className="absolute -right-[50px] -top-2 z-[500] bg-white border rounded-md shadow-lg min-w-[140px] text-sm"
                                onMouseLeave={() => setMenuOpenFor(null)}
                              >
                                <div className="flex flex-col">
                                  <button
                                    onClick={() => {
                                      startReplyTo(msg);
                                    }}
                                    className="px-3 py-2 flex items-center gap-2 hover:bg-gray-50 text-left"
                                    type="button"
                                  >
                                    <CornerUpLeft className="w-4 h-4" />
                                    Reply
                                  </button>
                                  {isMe && !msg.isDeleted && (
                                    <button
                                      onClick={() => {
                                        handleDelete(String(msg._id));
                                      }}
                                      className="px-3 py-2 flex items-center gap-2 hover:bg-gray-50 text-left hover:text-primary"
                                      type="button"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Delete
                                    </button>
                                  )}

                                  {!isMe && (
                                    <button
                                      onClick={() => {
                                        handleOpenReport(String(msg._id));
                                      }}
                                      className="px-3 py-2 flex items-center gap-2 hover:bg-gray-50 text-left hover:text-primary"
                                      type="button"
                                    >
                                      <Flag className="w-4 h-4" />
                                      Report
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            <div
                              className={`absolute -bottom-4 z-50 ${isMe ? 'right-10 translate-x-1/2' : 'left-0 -translate-x-1/2'}`}
                              style={{
                                pointerEvents: 'none', // Allow clicks to pass through the container
                              }}
                            >
                              <MessageReactions
                                messageId={messageKey}
                                reactionCounts={reactionCounts}
                                reactions={reactionsArr}
                                currentUserId={(user?._id as string) ?? null}
                                isMe={isMe}
                                onReact={(mid, type) => handleReactOptimistic(mid, type)}
                                onRemove={(mid) => handleReactOptimistic(mid, undefined)}
                              />
                            </div>
                          </div>

                          {isMe && (
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100">
                              <Image
                                src={user?.pictureUrl || "/userPlaceHolder.jpg"}
                                alt="You"
                                width={50}
                                height={50}
                                className="object-cover"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              <div ref={bottomRef} />
              {isLoadingOlder && (
                <div className="text-center text-sm text-gray-500 py-2">Loading earlier messages…</div>
              )}
            </main>

            {/* Composer + reply preview */}
            <div className="sticky bottom-0 bg-[#F6F6F6] border-t">
              <footer className="flex items-center px-6 py-3 relative flex-col gap-2">
                {/* Reply preview (if replying) */}
                {replyTarget && (
                  <div className="w-full px-1">
                    <div className="flex items-center  justify-between bg-white rounded-md border px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-xs text-gray-600 font-semibold ">
                          Replying to {replyTarget.snapshot.sender?.model === 'Instructor' ? 'Instructor' : 'You'}
                        </div>
                        <div className="text-sm  text-gray-700 truncate">
                          {(replyTarget.snapshot.content ?? '').slice(0, 25)}
                        </div>
                      </div>
                      <button onClick={cancelReply} className="ml-3 p-1" type="button" aria-label="Cancel reply">
                        <X className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center w-full">
                  <button
                    onClick={() => setShowPicker((v) => !v)}
                    className="mr-3 text-gray-600 hover:text-gray-800 z-20"
                    type="button"
                    aria-label="emoji-picker"
                  >
                    <Smile className="w-5 h-5 text-[#FF0004]" />
                  </button>

                  <div className="flex-1 relative custom-scroll ">
                    <textarea
                      ref={textareaRef}
                      value={draft}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        setShowPicker(false)
                        // user typing indicator wired by effect on draft (handleUserTyping triggered in effect)
                      }}
                      onBlur={() => {
                        // stop typing on blur immediately
                        if (isTypingSentRef.current && user && activeId) {
                          try {
                            const room = `Instructor:${activeId}-User:${user._id}`;
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
                      }}
                      placeholder="Type a message"
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      className="w-full border border-[#FDD2D3] rounded-2xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                      style={{
                        lineHeight: `${LINE_HEIGHT_PX}px`,
                        maxHeight: `${MAX_TEXTAREA_HEIGHT}px`,
                        overflowY: 'hidden',
                      }}
                    />

                    {showPicker && (
                      <Portal>
                        <div
                          ref={pickerRef}
                          className="fixed bottom-20 left-[42vw] transform -translate-x-1/2 bg-white border rounded-lg p-2 shadow-lg grid grid-cols-5 gap-2 z-[100000]"
                          style={
                            {
                              // Position it near the textarea
                            }
                          }
                        >
                          {EMOJIS.map((e, i) => (
                            <button
                              key={e || i}
                              onClick={() => insertEmoji(e)}
                              className="text-2xl leading-none hover:bg-gray-100 rounded"
                              type="button"
                              aria-label="emoji-picker"
                            >
                              {e}
                            </button>
                          ))}
                        </div>
                      </Portal>
                    )}
                  </div>

                  {draft.trim() && (
                    <button
                      onClick={() => {
                        handleSend();
                        // ensure we stop typing; that is handled inside handleSend
                      }}
                      className="ml-3 flex items-center"
                      type="button"
                    >
                      <img width={40} height={40} src="/message.png" alt="send" />
                    </button>
                  )}
                </div>
              </footer>
            </div>
          </>
        )}
      </div>
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
