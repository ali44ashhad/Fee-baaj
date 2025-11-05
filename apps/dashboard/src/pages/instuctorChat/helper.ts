// helper.ts
// Shared helpers/constants used by MobileChat.tsx and DesktopChat.tsx
// Pure logic only (no DOM access, no React refs). Imported by both components.



export const EMOJIS = ['😀', '😂', '😍', '😎', '😢', '👍', '🙏', '🎉', '🔥', '❤️'];

// Read-more cutoff (characters)
export const MESSAGE_CUTOFF = 300;

// Pagination defaults
export const INITIAL_LIMIT = 40;
export const PAGE_LIMIT = 30;

// Textarea autosize defaults (line-height and rows)
export const LINE_HEIGHT_PX = 20;
export const MAX_ROWS = 5;
export const MAX_LINES = 5;
export const MAX_TEXTAREA_HEIGHT = LINE_HEIGHT_PX * MAX_ROWS;

// Typing debounce timeout (ms)
export const TYPING_TIMEOUT_MS = 2000;

// Small helper: generate a client temp id
export const genTempId = (): string => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// Lightweight deep clone for pure-data operations
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Types shared between components
export type ReplySnapshot = {
  _id: string;
  content?: string;
  sender?: { id?: string; model?: string };
  createdAt?: string;
};

export type IMessageWithId = any; // adapt to your concrete IMessage shape if desired

export interface ChatSummary {
  instructorId?: string;
  name: string;
  pictureId?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  pictureUrl: string;
  userId: string
}

export interface ChatProps {
    insId?: string;
    instructorName?: string;
    instructorAvatarUrl?: string;
    initialMessages?: any; // we accept various shapes; will normalize
    initialHasMore?: boolean;
    instructorProfession?: string;
    chats: ChatSummary[];
  }

// Pure helper: apply optimistic reaction to a messages array and return a new array.
// - Pure: does not access component state. Caller should call setMessages(prev => applyOptimisticReactionToMessages(...))
export function applyOptimisticReactionToMessages(
  messages: IMessageWithId[] = [],
  messageId: string,
  userId: string,
  type?: string | null,
) {
  return messages.map((m) => {
    if (String((m as any)._id) !== String(messageId)) return m;

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
    } else {
      if (existingIndex !== -1) {
        if (existingType === type) {
          // toggle off
          mm.reactions.splice(existingIndex, 1);
          mm.reactionCounts[type] = Math.max(0, (mm.reactionCounts[type] || 0) - 1);
        } else {
          // change type
          mm.reactions[existingIndex] = { ...mm.reactions[existingIndex], type, createdAt: new Date().toISOString() };
          if (existingType) mm.reactionCounts[existingType] = Math.max(0, (mm.reactionCounts[existingType] || 0) - 1);
          mm.reactionCounts[type] = (mm.reactionCounts[type] || 0) + 1;
        }
      } else {
        // add
        mm.reactions.push({ user: userId, type, createdAt: new Date().toISOString() });
        mm.reactionCounts[type] = (mm.reactionCounts[type] || 0) + 1;
      }
    }

    return mm;
  });
}

// Pure helper: update message by id in a messages array (returns a new array)
export function updateMessageById(messages: IMessageWithId[] = [], id: string, patch: Partial<IMessageWithId>) {
  return messages.map((m) => (String(m._id) === String(id) ? { ...m, ...patch } : m));
}

// Pure helper: replace temp message with server message in array (dedupe/replace/append).
export function replaceTempMessageWithServerMessageInList(
  messages: IMessageWithId[] = [],
  clientTempId: string | null,
  serverMsg: any,
) {
  const serverId = String(serverMsg._id);
  // if server message already present, drop the temp message (avoid duplicate)
  if (messages.some((m) => String(m._id) === serverId)) {
    if (!clientTempId) return messages;
    return messages.filter((m) => String(m._id) !== String(clientTempId));
  }

  // if clientTempId present and we have that temp in list -> replace it
  if (clientTempId && messages.some((m) => String(m._id) === String(clientTempId))) {
    return messages.map((m) => (String(m._id) === String(clientTempId) ? { ...(serverMsg as any), __status: 'sent' } : m));
  }

  // otherwise append server message
  return [...messages, { ...(serverMsg as any), __status: 'sent' }];
}


