// src/lib/offlineQueue.ts
export type PendingMessageRecord = {
    clientTempId: string;
    content: string;
    receiverId: string;
    senderId: string;
    room?: string;
    createdAt: string;
    attempt?: number;
    meta?: any;
  };
  
  const STORAGE_KEY = 'chat_pending_messages_v1';
  
  function readStore(): PendingMessageRecord[] {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return [];
      return JSON.parse(raw) as PendingMessageRecord[];
    } catch (err) {
      console.warn('offlineQueue read error', err);
      return [];
    }
  }
  
  function writeStore(items: PendingMessageRecord[]) {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      }
    } catch (err) {
      console.warn('offlineQueue write error', err);
    }
  }
  
  export function addPendingMessage(msg: PendingMessageRecord) {
    const cur = readStore();
    cur.push(msg);
    writeStore(cur);
  }
  
  export function getPendingMessages(): PendingMessageRecord[] {
    return readStore();
  }
  
  export function removePendingMessage(clientTempId: string) {
    const cur = readStore().filter((m) => m.clientTempId !== clientTempId);
    writeStore(cur);
  }
  
  export function clearPendingMessages() {
    writeStore([]);
  }
  