// src/pages/DesktopChat.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Smile, MoreVertical, Trash2, CornerUpLeft, X, Flag } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useSocket } from '@/hooks/SocketContext';
import type { IMessage } from '@elearning/types';
import { fetchUserConversations, fetchUserMessages, fetchMessageById, fetchMessagesAround } from './api';
import MessageReactions from './MessageReactions';
import MessageStatus from './MessageStatus';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import ReportMessageModal from './ReportMessageModal';
import Portal from './Portal';
import { addPendingMessage, getPendingMessages, removePendingMessage, PendingMessageRecord } from '@/lib/offlineQueue';

/**
 * Instructor Desktop Chat (Admin UI)
 *
 * - This component uses the route param `insId` as the Instructor id.
 * - Admin answers chats on behalf of the instructor (sender: { id: insId, model: 'Instructor' }).
 * - Uses pictureUrl directly for avatars.
 */

// ---------- Types ----------
export type ReplySnapshot = {
  _id: string;
  content?: string;
  sender?: { id?: string; model?: string };
  createdAt?: string;
};

export type IMessageWithId = IMessage & {
  _id: string;
  __status?: 'pending' | 'failed' | 'sent' | undefined;
  replyTo?: ReplySnapshot | null;
  isDeleted?: boolean;
  sender?: any;
  receiver?: any;
};

interface ChatSummary {
  userId?: string;
  instructorId?: string;
  name: string;
  pictureUrl?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
  profession?: string;
}

const EMOJIS = ['😀', '😂', '😍', '😎', '😢', '👍', '🙏', '🎉', '🔥', '❤️'];
const MESSAGE_CUTOFF = 300;
const INITIAL_LIMIT = 30;
const PAGE_LIMIT = 30;
const LINE_HEIGHT_PX = 20;
const MAX_ROWS = 6;
const MAX_TEXTAREA_HEIGHT = LINE_HEIGHT_PX * MAX_ROWS;

const genTempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// ---------- Component ----------
export default function DesktopChat({
  instructorAvatarUrl,
  instructorName,
  instructorProfession,
  chats = [],
  adminDisplayName = 'Admin',
}: {
  instructorAvatarUrl?: string;
  instructorName?: string;
  instructorProfession?: string;
  chats?: ChatSummary[];
  adminDisplayName?: string;
}) {
  // route param: the instructor whose chats admin is viewing/responding to
  const params = useParams<{ insId?: string }>();
  const insId = params.insId;
  if (!insId) {
    throw new Error('insId route param is required for Instructor Desktop Chat (admin UI).');
  }

  // socket context
  const socket = useSocket();

  // UI state
  const [sideConversations, setSideConversations] = useState<ChatSummary[]>(chats || []);
  const [activeUserId, setActiveUserId] = useState<string | undefined>(undefined);
  const [activeName, setActiveName] = useState<string | undefined>(instructorName);
  const [activeAvatar, setActiveAvatar] = useState<string | undefined>(instructorAvatarUrl ?? '/userPlaceHolder.jpg');

  // messages & fetch state
  const [messages, setMessages] = useState<IMessageWithId[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // composer
  const [draft, setDraft] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  // UI extras
  const [instructorOnline, setInstructorOnline] = useState<Record<string, boolean>>({});
  const [instructorTyping, setInstructorTyping] = useState<Record<string, boolean>>({});
  const [replyTarget, setReplyTarget] = useState<{ id: string; snapshot: ReplySnapshot } | null>(null);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [highlighted, setHighlighted] = useState<Record<string, boolean>>({});

  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{ messageId: string } | null>(null);
  const [confirmDeleteLoading, setConfirmDeleteLoading] = useState(false);
  const [reportTargetMessageId, setReportTargetMessageId] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  // internals
  const snapshotRef = useRef<Record<string, IMessageWithId | null>>({});
  const typingTimerRef = useRef<number | null>(null);
  const isTypingSentRef = useRef<boolean>(false);
  const prevActiveRef = useRef<string | undefined>(undefined);
  const mountedRef = useRef(false);
  const prevLastMessageIdRef = useRef<string | null>(null);
  const TYPING_TIMEOUT_MS = 2000;

  // ---------- Sidebar (fetch on mount + use prop fallback) ----------
  useEffect(() => {
    // safe map of incoming `chats` prop
    const safeChats: ChatSummary[] = Array.isArray(chats) ? (chats.filter(Boolean) as ChatSummary[]) : [];
    // if there are prop conversations, set them; then fetch server state to ensure freshness
    const sortedFromProp = safeChats
      .map((c) => {
        const lastMessageAt =
          typeof c.lastMessageAt === 'string' && c.lastMessageAt ? c.lastMessageAt : new Date(0).toISOString();
        return { ...c, lastMessageAt, unreadCount: c.unreadCount ?? 0, _lastAt: Date.parse(lastMessageAt) || 0 };
      })
      .sort((a, b) => b._lastAt - a._lastAt)
      .map(({ _lastAt, ...rest }) => rest as ChatSummary);

    setSideConversations(sortedFromProp);

    // fetch server state to keep sidebar up-to-date
    (async () => {
      try {
        const convs = await fetchUserConversations(insId);
        if (!Array.isArray(convs)) return;
        const normalized = convs
          .filter(Boolean)
          .map((c: any) => ({
            userId: c.userId ?? c.user?._id ?? c.id ?? undefined,
            instructorId: c.instructorId ?? c.instructor?._id ?? undefined,
            name: c.name ?? c.user?.name ?? c.user?.fullName ?? 'Unknown',
            pictureUrl: c.pictureUrl ?? c.user?.pictureUrl ?? '/userPlaceHolder.jpg',
            lastMessage: c.lastMessage ?? c.last_message ?? '',
            lastMessageAt: c.lastMessageAt ?? c.last_message_at ?? c.updatedAt ?? new Date(0).toISOString(),
            unreadCount: typeof c.unreadCount === 'number' ? c.unreadCount : 0,
            profession: c.profession ?? undefined,
          }))
          .sort((a: any, b: any) => Date.parse(b.lastMessageAt ?? '') - Date.parse(a.lastMessageAt ?? ''));
        setSideConversations(normalized);
        // set initial active if none
        if (!activeUserId && normalized.length > 0) {
          const first = normalized[0];
          const id = first.userId ?? first.instructorId;
          setActiveUserId(id);
          setActiveName(first.name);
          setActiveAvatar(first.pictureUrl ?? '/userPlaceHolder.jpg');
        }
      } catch (err) {
        // ignore fetch errors, keep prop-based state
        console.error('fetchUserConversations error', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, insId]);

  // ---------- Scroll helpers ----------
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
        c.scrollTop = c.scrollHeight;
      }
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // ---------- Message loading ----------
  const loadInitialMessages = useCallback(
    async (instructorId: string, studentId: string) => {
      if (!instructorId || !studentId) return;
      setLoadingMessages(true);
      try {
        const { messages: msgs, hasMore: hm } = await fetchUserMessages(
          instructorId,
          studentId,
          undefined,
          INITIAL_LIMIT,
        );
        const annotated = Array.isArray(msgs) ? msgs.map((m: any) => ({ ...m, __status: 'sent' })) : [];
        setMessages(annotated as IMessageWithId[]);
        setHasMore(Boolean(hm));
        // clear unread for this conversation in sidebar
        setSideConversations((prev) =>
          prev.map((c) => ((c.userId ?? c.instructorId) === studentId ? { ...c, unreadCount: 0 } : c)),
        );
        // mark unseen messages as seen
        try {
          annotated.forEach((m: any) => {
            if (m && m.sender && m.sender.model === 'User' && m._id) {
              // seenBy might be missing or not array
              const seenBy = Array.isArray(m.seenBy) ? m.seenBy : [];
              const alreadySeen = seenBy.some((p: any) => String(p.id) === String(instructorId));
              if (!alreadySeen) {
                socket?.emit('markAsSeen', { messageId: m._id });
              }
            }
          });
        } catch (err) {
          // ignore marking errors
        }
        requestAnimationFrame(() => scrollToBottomInstant());
      } catch (err) {
        console.error('Failed to load initial messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    },
    [scrollToBottomInstant, socket],
  );

  const loadOlderMessages = useCallback(
    async (instructorId: string) => {
      if (!instructorId || !activeUserId) return;
      if (!hasMore || isLoadingOlder) return;
      if (!messages || messages.length === 0) {
        await loadInitialMessages(instructorId, activeUserId);
        return;
      }

      setIsLoadingOlder(true);
      const container = containerRef.current;
      const prevScrollHeight = container?.scrollHeight ?? 0;
      const prevScrollTop = container?.scrollTop ?? 0;

      const oldest = messages[0];
      const beforeIso = oldest && oldest.createdAt ? String(oldest.createdAt) : undefined;

      try {
        const { messages: olderMsgs = [], hasMore: hm } = await fetchUserMessages(
          instructorId,
          activeUserId,
          beforeIso,
          PAGE_LIMIT,
        );
        const existingIds = new Set(messages.map((m) => String(m._id)));
        const filtered = olderMsgs.filter((m: any) => !existingIds.has(String(m._id)));
        const annotated = filtered.map((m: any) => ({ ...m, __status: 'sent' }));

        setMessages((prev) => [...annotated, ...prev]);

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
    [hasMore, isLoadingOlder, messages, loadInitialMessages, activeUserId],
  );

  // when active user changes, load messages
  useEffect(() => {
    if (!insId || !activeUserId) return;
    setMessages([]);
    void loadInitialMessages(insId, activeUserId);
  }, [activeUserId, loadInitialMessages, insId]);

  // ---------- Socket presence & rooms ----------
  useEffect(() => {
    if (!socket) return;

    const onRequest = () => {
      try {
        socket.emit('identify', { id: insId, model: 'Instructor' });
      } catch {}
    };
    const onOnline = ({ id }: any) => setInstructorOnline((m) => ({ ...m, [id]: true }));
    const onOffline = ({ id }: any) => setInstructorOnline((m) => ({ ...m, [id]: false }));

    socket.on('requestIdentify', onRequest);
    socket.on('UserOnline', onOnline);
    socket.on('UserOffline', onOffline);

    return () => {
      try {
        socket.off('requestIdentify', onRequest);
        socket.off('UserOnline', onOnline);
        socket.off('UserOffline', onOffline);
      } catch {}
    };
  }, [socket, insId]);

  // check online for active user
  useEffect(() => {
    if (!socket || !activeUserId) return;
    try {
      socket.emit('checkOnlineStatus', { id: activeUserId, model: 'User' }, ({ online }: { online: boolean }) => {
        setInstructorOnline((m) => ({ ...m, [activeUserId]: online }));
      });
    } catch (err) {
      // ignore
    }
  }, [socket, activeUserId]);

  // join room & identify on connect
  useEffect(() => {
    if (!socket || !insId || !activeUserId) return;

    const room = `Instructor:${insId}-User:${activeUserId}`;
    const onConnect = (): void => {
      try {
        socket.emit('identify', { id: insId, model: 'Instructor' });
        socket.emit('joinRoom', { room });
        socket.emit('joinRoom', { room: `Instructor:${insId}` });
      } catch (err) {
        console.error('onConnect error', err);
      }
    };
    socket.on('connect', onConnect);

    if ((socket as any).connected) onConnect();

    return () => {
      try {
        socket.off('connect', onConnect);
      } catch {}
    };
  }, [socket, insId, activeUserId]);

  // ---------- Core realtime handlers ----------
  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (msg: any) => {
      try {
        if (!msg) return;

        // compute the user id on the 'other' side (the student)
        const otherId =
          msg.sender?.model === 'User'
            ? String(msg.sender.id)
            : msg.receiver?.model === 'User'
              ? String(msg.receiver.id)
              : null;

        if (!otherId) return;

        // Prefer using server timestamp if available, fallback to now
        const newLastAt = msg.createdAt ? new Date(msg.createdAt).toISOString() : new Date().toISOString();
        const newLastId = msg._id ? String(msg._id) : null;

        setSideConversations((prev: ChatSummary[] = []) => {
          const next = (prev || []).filter(Boolean);
          const idx = next.findIndex((c) => String(c.userId ?? c.instructorId ?? '') === String(otherId));

          // Insert new conversation if not found
          if (idx === -1) {
            const newSummary: ChatSummary = {
              userId: otherId,
              name: msg.sender?.name ?? msg.receiver?.name ?? 'Unknown',
              pictureUrl: msg.sender?.pictureUrl ?? msg.receiver?.pictureUrl ?? '/userPlaceHolder.jpg',
              lastMessage: msg.content ?? '',
              lastMessageAt: newLastAt,
              unreadCount: 1,
            };
            return [newSummary, ...next].sort(
              (a, b) => Date.parse(b.lastMessageAt ?? '') - Date.parse(a.lastMessageAt ?? ''),
            );
          }

          // Update existing conversation
          const isActive = String(otherId) === String(activeUserId);
          const existing = next[idx];

          // If incoming message is older-or-equal to what we already have, don't increment (dedupe)
          const existingLastAt = existing.lastMessageAt ? Date.parse(existing.lastMessageAt) : 0;
          const incomingLastAt = Date.parse(newLastAt);

          // If server provided message id and it equals lastMessage (rare), consider duplicate
          const lastIdMatches =
            (existing as any)._lastMessageId && newLastId && (existing as any)._lastMessageId === newLastId;

          // Build updated object
          const shouldIncrement =
            !isActive && // only increment unread when conversation is not active
            msg.sender?.model === 'User' && // only increment for incoming user messages
            (incomingLastAt > existingLastAt || !existing.lastMessageAt) && // only if newer
            !lastIdMatches; // and not same id

          const updated = next.map((c, i) =>
            i === idx
              ? {
                  ...c,
                  lastMessage: msg.content ?? c.lastMessage,
                  lastMessageAt: incomingLastAt ? newLastAt : (c.lastMessageAt ?? newLastAt),
                  // keep unreadCount stable if active; otherwise add 1 only when we determined above
                  unreadCount: isActive ? 0 : shouldIncrement ? (c.unreadCount ?? 0) + 1 : (c.unreadCount ?? 0),
                  // store lastMessageId for future dedupe checks (non-UI field)
                  // @ts-ignore -- harmless extra prop for client-only dedupe
                  _lastMessageId: newLastId ?? (c as any)._lastMessageId ?? null,
                }
              : c,
          );

          return updated.sort((a, b) => Date.parse(b.lastMessageAt ?? '') - Date.parse(a.lastMessageAt ?? ''));
        });

        // append to message list only if this belongs to the currently open conversation
        if (String(otherId) === String(activeUserId)) {
          setMessages((prev) => {
            // prevent duplicates by server id
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
            if (msg.sender?.model === 'User' && msg._id) {
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

    // inside the same useEffect where you register other socket handlers

    const onMessageDeleted = (payload: {
      messageId?: string;
      isDeleted?: boolean;
      deletedBy?: any;
      deletedAt?: string;
    }) => {
      try {
        if (!payload || !payload.messageId) return;
        const { messageId, isDeleted = true, deletedBy, deletedAt } = payload;

        // Update the messages list (mark message as deleted)
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(messageId)
              ? {
                  ...m,
                  content: 'Message deleted',
                  isDeleted: Boolean(isDeleted),
                  deletedBy: deletedBy ?? (m as any).deletedBy,
                  deletedAt: deletedAt ?? (m as any).deletedAt,
                }
              : m,
          ),
        );

        // Optional: if the deleted message is the lastMessage in the sidebar entry,
        // update the sidebar preview (best-effort — only do if text match)
        setSideConversations((prev) =>
          prev.map((c) => {
            if (!c) return c;
            // Heuristic: if lastMessage exactly equals the deleted content before,
            // replace with a placeholder. If you don't keep lastMessageId, you may
            // not be able to detect it reliably — skip if unsure.
            if (c.lastMessage && String(c.lastMessage).includes('(deleted)')) return c;
            return c;
          }),
        );
      } catch (err) {
        console.error('onMessageDeleted handler error', err);
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

    // register handler
    socket.on('messageDeleted', onMessageDeleted);

    return () => {
      try {
        socket.off('newMessage', onNewMessage);
        socket.off('messageSeen', onMessageSeen);
        socket.off('messageReactionUpdated', onReactionUpdated);
        socket.off('reactAck', onReactAck);
        socket.off('removeReactionAck', onRemoveAck);
        socket.off('messageDeleted', onMessageDeleted);
      } catch {}
    };
  }, [socket, activeUserId, insId, scrollToBottomSmooth]);

  // typing listener
  useEffect(() => {
    if (!socket) return;
    const onTyping = (payload: { userId?: string; model?: 'User' | 'Instructor'; isTyping?: boolean }) => {
      try {
        if (!payload) return;
        if (payload.model === 'User' && String(payload.userId) === String(activeUserId)) {
          setInstructorTyping((prev) => ({ ...prev, [activeUserId as string]: !!payload.isTyping }));
        }
      } catch {}
    };
    socket.on('typing', onTyping);
    return () => {
      try {
        socket.off('typing', onTyping);
      } catch {}
      setInstructorTyping((prev) => ({ ...prev, [activeUserId as string]: false }));
    };
  }, [socket, activeUserId]);

  // ---------- Reactions optimistic ----------
  const cloneMsg = (m: any) => JSON.parse(JSON.stringify(m));

  const applyOptimisticReaction = (messageId: string, userId: string, type?: string | null) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (String(m._id) !== String(messageId)) return m;
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
    if (!socket) {
      alert('Socket not connected');
      return;
    }
    const msgSnapshot = messages.find((m) => String(m._id) === String(messageId));
    snapshotRef.current[messageId] = msgSnapshot ? cloneMsg(msgSnapshot) : null;

    applyOptimisticReaction(messageId, insId, type ?? null);

    if (type) socket.emit('reactToMessage', { messageId, type, toggleOnSame: false });
    else socket.emit('removeMessageReaction', { messageId });
  };

  // ---------- Send + offline queueing (Instructor send) ----------
  const insertEmoji = useCallback((e: string) => {
    setDraft((d) => d + e);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const updateMessageByTempId = (clientTempId: string, patch: Partial<IMessageWithId>) => {
    setMessages((prev) => prev.map((m) => (String(m._id) === String(clientTempId) ? { ...m, ...patch } : m)));
  };

  const replaceTempMessageWithServerMessage = (clientTempId: string | null, serverMsg: any) => {
    const serverId = String(serverMsg._id);
    setMessages((prev) => {
      if (prev.some((m) => String(m._id) === serverId)) {
        if (!clientTempId) return prev;
        return prev.filter((m) => String(m._id) !== String(clientTempId));
      }
      if (clientTempId && prev.some((m) => String(m._id) === String(clientTempId))) {
        const replaced = prev.map((m) =>
          String(m._id) === String(clientTempId) ? { ...(serverMsg as any), __status: 'sent' } : m,
        );
        requestAnimationFrame(() => scrollToBottomSmooth());
        return replaced;
      }
      requestAnimationFrame(() => scrollToBottomSmooth());
      return [...prev, { ...(serverMsg as any), __status: 'sent' }];
    });
  };

  const flushPendingQueue = useCallback(() => {
    const pending = getPendingMessages();
    if (!socket || !socket.connected || pending.length === 0) return;

    pending.forEach((p) => {
      try {
        socket.emit(
          'instructorSendMessage',
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

  useEffect(() => {
    if (!socket) return;
    const onConnect = () => flushPendingQueue();
    socket.on('connect', onConnect);
    if ((socket as any).connected) flushPendingQueue();

    return () => {
      try {
        socket.off('connect', onConnect);
      } catch {}
    };
  }, [socket, flushPendingQueue]);

  useEffect(() => {
    const onOnline = () => {
      if (socket && socket.connected) flushPendingQueue();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [socket, flushPendingQueue]);

  const retrySend = (clientTempId: string) => {
    const pendingLocal = getPendingMessages().find((p) => p.clientTempId === clientTempId);
    const localMessage = messages.find((m) => String(m._id) === String(clientTempId));

    if (!pendingLocal && localMessage && insId && activeUserId) {
      const built: PendingMessageRecord = {
        clientTempId,
        content: (localMessage as any).content ?? '',
        receiverId: activeUserId,
        senderId: insId,
        room: `Instructor:${insId}-User:${activeUserId}`,
        createdAt: new Date().toISOString(),
        attempt: 0,
      };
      addPendingMessage(built);
    }

    flushPendingQueue();
  };

  const handleSend = useCallback(() => {
    if (!draft.trim() || !insId || !activeUserId) return;

    // stop typing
    try {
      if (isTypingSentRef.current) {
        const room = `Instructor:${insId}-User:${activeUserId}`;
        socket?.emit('typing', { room, isTyping: false });
        isTypingSentRef.current = false;
      }
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    } catch {}

    const content = draft.trim();
    const clientTempId = genTempId();
    const createdAt = new Date().toISOString();

    const optimisticMsg: IMessageWithId = {
      _id: clientTempId,
      content,
      createdAt,
      sender: { id: insId, model: 'Instructor' },
      receiver: { id: activeUserId, model: 'User' },
      __status: 'pending',
      replyTo: replyTarget ? replyTarget.snapshot : null,
      isDeleted: false,
    } as any;

    // append UI
    setMessages((prev) => {
      const next = [...prev, optimisticMsg];
      return next;
    });

    requestAnimationFrame(() => scrollToBottomSmooth());

    // update sidebar
    setSideConversations((prev) =>
      prev
        .map((c) =>
          (c.userId ?? c.instructorId) === activeUserId
            ? { ...c, lastMessage: content, lastMessageAt: new Date().toISOString(), unreadCount: c.unreadCount ?? 0 }
            : c,
        )
        .sort((a, b) => Date.parse(b.lastMessageAt ?? '') - Date.parse(a.lastMessageAt ?? '')),
    );

    // capture replyTo id and clear composer
    const replyToIdToSend = replyTarget ? replyTarget.id : undefined;
    setReplyTarget(null);
    setDraft('');
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    });

    const pendingRecord: PendingMessageRecord = {
      clientTempId,
      content,
      receiverId: activeUserId,
      senderId: insId,
      room: `Instructor:${insId}-User:${activeUserId}`,
      createdAt,
      attempt: 0,
    };

    if (socket && socket.connected) {
      try {
        socket.emit(
          'instructorSendMessage',
          {
            receiverId: activeUserId,
            content,
            room: `Instructor:${insId}-User:${activeUserId}`,
            senderId: insId,
            clientTempId,
            replyTo: replyToIdToSend ?? null,
          },
          (ack: any) => {
            if (ack && ack.ok && ack.data && ack.data.message) {
              replaceTempMessageWithServerMessage(ack.data.clientTempId ?? clientTempId, ack.data.message);
              removePendingMessage(clientTempId);
            } else {
              updateMessageByTempId(clientTempId, { __status: 'failed' });
              addPendingMessage(pendingRecord);
            }
          },
        );
      } catch (err) {
        console.error('emit instructorSendMessage failed, queueing', err);
        updateMessageByTempId(clientTempId, { __status: 'pending' });
        addPendingMessage(pendingRecord);
      }
    } else {
      addPendingMessage(pendingRecord);
      updateMessageByTempId(clientTempId, { __status: 'pending' });
    }
  }, [draft, insId, activeUserId, socket, replyTarget, scrollToBottomSmooth]);

  // ---------- Reply helpers ----------
  const startReplyTo = (msg: IMessageWithId) => {
    const snapshot: ReplySnapshot = {
      _id: String((msg as any)._id),
      content: (msg as any).content ?? '',
      sender: (msg as any).sender ?? undefined,
      createdAt: (msg as any).createdAt ?? undefined,
    };
    setReplyTarget({ id: snapshot._id, snapshot });
    requestAnimationFrame(() => textareaRef.current?.focus());
    setMenuOpenFor(null);
  };

  const cancelReply = () => setReplyTarget(null);

  // ---------- Jump-to message / fetch-around ----------
  const scrollToMessageById = (targetId: string) => {
    const el = document.getElementById(`msg-${targetId}`);
    const container = containerRef.current;
    if (!el) {
      console.warn('Target message not in DOM:', targetId);
      return;
    }
    if (container) {
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const offset = elRect.top - containerRect.top;
      container.scrollTop += offset - container.clientHeight / 3;
    } else el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    setHighlighted((h) => ({ ...h, [targetId]: true }));
    window.setTimeout(
      () =>
        setHighlighted((h) => {
          const copy = { ...h };
          delete copy[targetId];
          return copy;
        }),
      1800,
    );
  };

  const onClickReplySnippet = async (reply: ReplySnapshot | string | undefined) => {
    if (!reply) return;
    const id = typeof reply === 'string' ? reply : reply._id;
    if (!id) return;

    const el = document.getElementById(`msg-${id}`);
    if (el) {
      scrollToMessageById(id);
      return;
    }

    try {
      setTargetLoadingState(true);
      const single = await fetchMessageById(id);
      if (!single) throw new Error('Message not found');

      const participants = [String(single.sender?.id ?? ''), String(single.receiver?.id ?? '')];
      if (!participants.includes(String(activeUserId)) && !participants.includes(String(insId))) {
        setTargetLoadingState(false);
        return;
      }

      const currentlyHas = messages.some((m) => String(m._id) === String(id));
      if (currentlyHas) {
        setTargetLoadingState(false);
        scrollToMessageById(id);
        return;
      }

      const oldest = messages[0];
      const singleCreated = single.createdAt ? new Date(single.createdAt).getTime() : 0;
      const oldestCreated = oldest && oldest.createdAt ? new Date(String(oldest.createdAt)).getTime() : null;
      const timeGap = oldestCreated ? Math.abs(oldestCreated - singleCreated) : null;

      const SHOULD_FETCH_AROUND = timeGap !== null && timeGap > 1000 * 60 * 60 * 24 * 7; // > 7 days

      if (!SHOULD_FETCH_AROUND) {
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
          setTargetLoadingState(false);
          scrollToMessageById(id);
        });
        return;
      }

      const { messages: aroundChunk = [] } = await fetchMessagesAround(insId, activeUserId as string, id, 40);
      if (!aroundChunk || aroundChunk.length === 0) {
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
          setTargetLoadingState(false);
          scrollToMessageById(id);
        });
        return;
      }

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
        setTargetLoadingState(false);
        scrollToMessageById(id);
      });
    } catch (err) {
      console.error('Failed to ensure message in list:', err);
      setTargetLoadingState(false);
    }
  };

  // small helper to manage target-loading boolean
  const [targetLoadingState, setTargetLoadingState] = useState(false);

  // ---------- Delete & Report ----------
  const handleDelete = (msgId: string) => {
    const msg = messages.find((m) => String(m._id) === String(msgId));
    if (!msg) return;
    const isMe = msg.sender?.model === 'Instructor' || String(msg.sender?.id) === String(insId);
    if (!isMe) {
      alert('You can only delete your own messages.');
      setMenuOpenFor(null);
      return;
    }
    setMenuOpenFor(null);
    setConfirmDeleteTarget({ messageId: msgId });
  };

  const performDelete = async (messageId: string) => {
    if (!socket || !messageId) {
      setConfirmDeleteTarget(null);
      return;
    }
    setConfirmDeleteLoading(true);
    try {
      socket.emit('deleteMessage', { messageId }, (ack: any) => {
        if (ack && ack.ok) {
          setMessages((prev) =>
            prev.map((m) =>
              String(m._id) === String(messageId) ? ({ ...m, content: 'Message deleted', isDeleted: true } as any) : m,
            ),
          );
        } else {
          const errMsg = ack?.message || 'Delete failed';
          alert(errMsg);
        }
        setConfirmDeleteLoading(false);
        setConfirmDeleteTarget(null);
      });
    } catch (err) {
      console.error('delete emit error', err);
      alert('Failed to delete message.');
      setConfirmDeleteLoading(false);
      setConfirmDeleteTarget(null);
    }
  };

  const handleOpenReport = (msgId: string) => {
    const msg = messages.find((m) => String(m._id) === String(msgId));
    if (!msg) return;
    const isMe = msg.sender?.model === 'Instructor' || String(msg.sender?.id) === String(insId);
    if (isMe) {
      alert('You cannot report your own message.');
      setMenuOpenFor(null);
      return;
    }
    setMenuOpenFor(null);
    setReportTargetMessageId(msgId);
    setReportModalOpen(true);
  };

  const onReported = (res?: any) => {
    console.log('Reported:', res);
    setReportTargetMessageId(null);
    setReportModalOpen(false);
  };

  // ---------- Textarea autosize + typing logic ----------
  const autoResizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const scrollH = ta.scrollHeight;
    const newHeight = Math.min(scrollH, MAX_TEXTAREA_HEIGHT);
    ta.style.height = `${newHeight}px`;
    ta.style.overflowY = scrollH > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
  }, []);

  useEffect(() => autoResizeTextarea(), [draft, autoResizeTextarea]);

  // click outside emoji picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('button[aria-label="emoji-picker"]')
      ) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scheduleStopTyping = useCallback(
    (room: string) => {
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = window.setTimeout(() => {
        try {
          socket?.emit('typing', { room, isTyping: false });
        } catch {}
        isTypingSentRef.current = false;
        typingTimerRef.current = null;
      }, TYPING_TIMEOUT_MS);
    },
    [socket],
  );

  const handleTyping = useCallback(() => {
    if (!socket || !insId || !activeUserId) return;
    const room = `Instructor:${insId}-User:${activeUserId}`;
    try {
      if (!isTypingSentRef.current) {
        socket.emit('typing', { room, isTyping: true });
        isTypingSentRef.current = true;
      }
      scheduleStopTyping(room);
    } catch {}
  }, [socket, insId, activeUserId, scheduleStopTyping]);

  useEffect(() => {
    autoResizeTextarea();
    if (draft !== '') {
      handleTyping();
    } else {
      if (isTypingSentRef.current && insId && activeUserId) {
        try {
          const room = `Instructor:${insId}-User:${activeUserId}`;
          socket?.emit('typing', { room, isTyping: false });
        } catch {}
        isTypingSentRef.current = false;
        if (typingTimerRef.current) {
          window.clearTimeout(typingTimerRef.current);
          typingTimerRef.current = null;
        }
      }
    }
  }, [draft, autoResizeTextarea, handleTyping, insId, activeUserId, socket]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      if (isTypingSentRef.current && insId && prevActiveRef.current) {
        try {
          const prevRoom = `Instructor:${prevActiveRef.current}-User:${insId}`;
          socket?.emit('typing', { room: prevRoom, isTyping: false });
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Auto-scroll on new messages ----------
  useEffect(() => {
    const c = containerRef.current;
    const last = messages.length ? String(messages[messages.length - 1]._id) : null;
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevLastMessageIdRef.current = last;
      if (last) scrollToBottomInstant();
      return;
    }

    const prevLast = prevLastMessageIdRef.current;
    const distanceFromBottom = c ? c.scrollHeight - (c.scrollTop + c.clientHeight) : 0;

    if (prevLast !== last) {
      const lastMsg = messages.length ? messages[messages.length - 1] : null;
      const lastSentByInstructor =
        lastMsg && (lastMsg.sender?.model === 'Instructor' || String(lastMsg.sender?.id) === String(insId));
      if (distanceFromBottom < 120 || lastSentByInstructor) scrollToBottomSmooth();
    }

    prevLastMessageIdRef.current = last;
  }, [messages, scrollToBottomInstant, scrollToBottomSmooth, insId]);

  // ---------- Helpers for UI ----------
  function renderDateHeader(date: Date | string) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return (
      <div className="text-center bg-[#F1F1F1] px-2 py-1 rounded-md w-fit mx-auto text-[#84939A] font-bold text-[12px] my-4">
        {d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
      </div>
    );
  }

  const lastSentMessageIdByInstructor = (() => {
    if (!messages || messages.length === 0) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i] as any;
      if (
        m?.sender &&
        String(m.sender.id) === String(insId) &&
        (m.sender.model === 'Instructor' || m.sender.model === 'instructor')
      )
        return (m as any)._id?.toString() ?? null;
    }
    return null;
  })();

  const onScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      if (target.scrollTop < 120 && hasMore && !isLoadingOlder && insId) loadOlderMessages(insId);
    },
    [hasMore, isLoadingOlder, insId, loadOlderMessages],
  );

  const toggleExpanded = (messageKey: string) => {
    setExpandedMap((prev) => ({ ...prev, [messageKey]: !prev[messageKey] }));
    setTimeout(() => {
      const el = document.getElementById(`msg-${messageKey}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
  };

  console.log(sideConversations)

  // ---------- Render ----------
  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <aside className="w-1/3 border-r min-w-[30%] overflow-y-auto px-4 py-2 bg-white flex flex-col">
        <div className="flex-1">
          {sideConversations.map((chat, i) => {
            if (!chat) return null;
            const id = chat.userId ?? chat.instructorId ?? String(i);
            return (
              <div
                key={id || i}
                onClick={() => {
                  const idClick = chat.userId ?? chat.instructorId ?? '';
                  setActiveUserId(idClick);
                  setActiveName(chat.name);
                  setActiveAvatar(chat.pictureUrl ?? '/userPlaceHolder.jpg');

                  setMessages([]);
                  // clear unread immediately in UI
                  setSideConversations((prev) =>
                    prev.map((c) => (c && (c.userId ?? c.instructorId) === idClick ? { ...c, unreadCount: 0 } : c)),
                  );
                  void loadInitialMessages(insId, idClick);
                }}
                className={`flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer ${(chat.userId ?? chat.instructorId) === activeUserId ? 'bg-[#F0F2F5] rounded-md' : 'bg-white'}`}
                role="button"
                tabIndex={0}
              >
                <div className="w-[60px] h-[60px] rounded-full overflow-hidden">
                  <img
                    src={chat.pictureUrl ?? '/userPlaceHolder.jpg'}
                    alt={chat.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="font-bold text-[14px] truncate">{chat.name}</p>
                  <p className="text-xs text-[#3B4A54] truncate max-w-[10vw]">{chat.lastMessage ?? ''}</p>
                </div>
                <div className="flex flex-col items-center">
                  <span
                    className={`${(chat.unreadCount ?? 0) > 0 ? 'text-primary font-[500]' : 'text-[#829C99]'} text-[10px]`}
                  >
                    {chat.lastMessageAt
                      ? new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </span>
                  {(chat.unreadCount ?? 0) > 0 && (
                    <span className="flex mt-2 items-center justify-center text-white text-center rounded-full font-bold text-[10px] w-[20px] h-[20px] bg-primary">
                      {(chat.unreadCount ?? 0) > 5 ? '+5' : chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Chat area */}
      <div className="flex flex-col flex-1 bg-[url('/cover-homepage.webp')] bg-cover bg-center">
        <header className="flex items-start px-2 py-3 bg-transparent">
          <div className="w-[54px] h-[54px] rounded-full overflow-hidden">
            <img src={activeAvatar || "/userPlaceHolder.jpg"} alt={`${activeName} avatar`} className="w-full h-full object-cover" />
          </div>

          <div className="ml-4">
            <p className="font-medium text-lg">{activeName ?? 'Select a conversation'}</p>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="font-medium text-primary text-sm">
                {activeUserId
                  ? instructorTyping[activeUserId as string]
                    ? 'Typing…'
                    : instructorOnline[activeUserId]
                      ? 'Online'
                      : 'Offline'
                  : 'Offline'}
              </span>
            </div>
          </div>
        </header>

        <main
          ref={(el) => {
            containerRef.current = el as HTMLDivElement | null;
          }}
          onScroll={onScroll}
          className="flex-1 font-helvetica overflow-y-auto px-6 py-4"
        >
          {loadingMessages && (
            <div className="flex justify-center py-4">
              <span className="text-gray-500">Loading messages…</span>
            </div>
          )}

          {targetLoadingState && (
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[800] bg-white/90 p-4 rounded shadow-lg flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary" />
              <div className="text-sm">Loading message…</div>
            </div>
          )}

          {!loadingMessages &&
            (() => {
              let lastDay = '';
              const stableList = messages.map((m, i) => ({ key: m._id ? String(m._id) : `idx-${i}`, msg: m, idx: i }));

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
                const isMe = msg.sender?.model === 'Instructor' || String(msg.sender?.id) === String(insId);

                const content = msg.content ?? '';
                const isLong = content.length > MESSAGE_CUTOFF;
                const isExpanded = Boolean(expandedMap[messageKey]);
                const preview = isLong && !isExpanded ? content.slice(0, MESSAGE_CUTOFF) + '...' : content;

                const reactionCounts = (msg as any).reactionCounts ?? null;
                const reactionsArr = Array.isArray((msg as any).reactions) ? (msg as any).reactions : [];

                const senderIdentity = msg?.sender?.model;
                const highlightClass = highlighted[messageKey] ? 'ring-2 ring-yellow-300 rounded-lg' : '';

                return (
                  <div className={`${reactionCounts ? 'mb-5' : ''}`} key={messageKey || idx}>
                    {show && renderDateHeader(createdAt)}

                    <div className={`flex items-start space-x-2 ${isMe ? 'justify-end' : ''}`}>
                      {!isMe && (
                        <div className="flex flex-col items-center">
                          {senderIdentity === 'Instructor' && (
                            <img
                              className="-mr-6 -mb-1"
                              src="/verified-blue.svg"
                              alt="verified"
                              width={22}
                              height={22}
                            />
                          )}
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-300">
                            <img
                              src={activeAvatar ?? '/userPlaceHolder.jpg'}
                              alt="Sender"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>
                      )}

                      <div className="relative group" tabIndex={0}>
                        <div
                          id={`msg-${messageKey}`}
                          className={`p-3 font-helvetica rounded-lg text-[14px] ${isMe ? 'bg-[#FDD2D3]' : 'bg-[#FFFFFF]'} text-black my-2 shadow-sm max-w-[30vw] ${highlightClass}`}
                        >
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
                                  : 'User'}
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
                                onClick={() => setExpandedMap((p) => ({ ...p, [messageKey]: !p[messageKey] }))}
                                className="ml-2 text-sm underline font-bold text-primary"
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
                              lastSentMessageIdByInstructor &&
                              String(lastSentMessageIdByInstructor) === String((msg as any)._id) && (
                                <MessageStatus message={msg as any} currentUserId={insId} className="self-end" />
                              )}
                          </div>
                        </div>

                        <div className="absolute z-[49] -right-4 top-5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setMenuOpenFor((cur) => (cur === messageKey ? null : messageKey))}
                            className="p-1 bg-white rounded-full shadow-sm hover:bg-gray-100"
                            aria-label="message options"
                            type="button"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>

                        {menuOpenFor === messageKey && (
                          <div
                            className="absolute -right-[50px] -top-2 z-[500] bg-white border rounded-md shadow-lg min-w-[140px] text-sm"
                            onMouseLeave={() => setMenuOpenFor(null)}
                          >
                            <div className="flex flex-col">
                              <button
                                onClick={() => startReplyTo(msg)}
                                className="px-3 py-2 flex items-center gap-2 hover:bg-gray-50 text-left"
                                type="button"
                              >
                                <CornerUpLeft className="w-4 h-4" /> Reply
                              </button>

                              {(msg.sender?.model === 'Instructor' || String(msg.sender?.id) === String(insId)) &&
                                !msg.isDeleted && (
                                  <button
                                    onClick={() => handleDelete(String(msg._id))}
                                    className="px-3 py-2 flex items-center gap-2 hover:bg-gray-50 text-left hover:text-primary"
                                    type="button"
                                  >
                                    <Trash2 className="w-4 h-4" /> Delete
                                  </button>
                                )}

                              {!(msg.sender?.model === 'Instructor' || String(msg.sender?.id) === String(insId)) && (
                                <button
                                  onClick={() => handleOpenReport(String(msg._id))}
                                  className="px-3 py-2 flex items-center gap-2 hover:bg-gray-50 text-left hover:text-primary"
                                  type="button"
                                >
                                  <Flag className="w-4 h-4" /> Report
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        <div
                          className={`absolute -bottom-4 z-50 ${isMe ? 'right-10 translate-x-1/2' : 'left-0 -translate-x-1/2'}`}
                          style={{ pointerEvents: 'none' }}
                        >
                          <MessageReactions
                            messageId={messageKey}
                            reactionCounts={reactionCounts}
                            reactions={reactionsArr}
                            currentUserId={insId}
                            isMe={isMe}
                            onReact={(mid, type) => handleReactOptimistic(mid, type)}
                            onRemove={(mid) => handleReactOptimistic(mid, undefined)}
                          />
                        </div>
                      </div>

                      {isMe && (
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100">
                          <img
                            src={instructorAvatarUrl ?? instructorAvatarUrl ?? '/userPlaceHolder.jpg'}
                            alt="Instructor"
                            className="object-cover w-full h-full"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}

          <div ref={bottomRef} />
          {isLoadingOlder && <div className="text-center text-sm text-gray-500 py-2">Loading earlier messages…</div>}
        </main>

        <div className="sticky bottom-0 bg-[#F6F6F6] border-t">
          <footer className="flex items-center px-6 py-3 relative flex-col gap-2">
            {replyTarget && (
              <div className="w-full px-1">
                <div className="flex items-center justify-between bg-white rounded-md border px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-xs text-gray-600 font-semibold">
                      Replying to {replyTarget.snapshot.sender?.model === 'Instructor' ? 'Instructor' : 'User'}
                    </div>
                    <div className="text-sm text-gray-700 truncate">
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

              <div className="flex-1 relative custom-scroll">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={  (e) =>{ 
                    
                    setDraft(e.target.value)
                    setShowPicker(false)
                  }}
                  onBlur={() => {
                    if (isTypingSentRef.current && insId && activeUserId) {
                      try {
                        const room = `Instructor:${insId}-User:${activeUserId}`;
                        socket?.emit('typing', { room, isTyping: false });
                      } catch {}
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
                    >
                      {EMOJIS.map((e, i) => (
                        <button
                          key={e || i}
                          onClick={() => insertEmoji(e)}
                          className="text-2xl leading-none hover:bg-gray-100 rounded"
                          type="button"
                          aria-label="emoji"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </Portal>
                )}
              </div>

              {/* Send button visible only when there's typed content */}
              {draft.trim() ? (
                <button
                  onClick={() => handleSend()}
                  className="ml-3 flex items-center"
                  type="button"
                  aria-label="Send message"
                >
                  <img width={40} height={40} src="/message.png" alt="send" />
                </button>
              ) : null}
            </div>
          </footer>
        </div>
      </div>

      {/* Modals */}
      <ConfirmDeleteModal
        isOpen={Boolean(confirmDeleteTarget)}
        onClose={() => {
          setConfirmDeleteTarget(null);
          setConfirmDeleteLoading(false);
        }}
        onConfirm={() => {
          if (confirmDeleteTarget) void performDelete(confirmDeleteTarget.messageId);
        }}
        loading={confirmDeleteLoading}
      />

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
