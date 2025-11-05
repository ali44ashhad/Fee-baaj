// actions.ts
'use client';

import axios from 'axios';
import type { IMessage, IInstructorResponse } from '@elearning/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface IChatSummary {
  instructorId: string;
  chatWithName: string;
  chatWithModel: 'Instructor';
  lastMessage: {
    content: string;
    timestamp: string; // still string from backend; convert if needed
    fromMe: boolean;
  };
  unseenCount: number;
  chatWithAvatar?: string;
  online?: boolean;
}

const environment = process.env.NODE_ENV === 'production';
const axiosInstance = axios.create({
  baseURL: environment ? '/api' : API_BASE_URL, // for nginx proxy in prod or direct in dev
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Fetch conversation summaries (sidebar)
export async function fetchConversations(): Promise<IChatSummary[]> {
  // NOTE: your backend route for summaries may differ. Adjust path if necessary.
  const { data } = await axiosInstance.get<{
    results: { conversations: IChatSummary[] };
  }>('/chat/instructor/messages/summary');

  return data.results.conversations;
}

/**
 * Fetch messages for an instructor conversation.
 * - if before === undefined -> fetch latest `limit` messages
 * - if before is provided (ISO timestamp) -> fetch messages older than `before`
 *
 * Returns { messages, hasMore }
 */
export async function fetchMessages(
  insId: string,
  before?: string | undefined,
  limit: number = 80,
): Promise<{ messages: IMessage[]; hasMore: boolean }> {
  const params: Record<string, any> = { limit };
  if (before) params.before = before;

  const { data } = await axiosInstance.get<{
    results: { messages: IMessage[]; hasMore: boolean };
  }>(`/chat/instructor/${insId}/messages`, { params });

  return {
    messages: data.results.messages ?? [],
    hasMore: data.results.hasMore ?? false,
  }; 
}

/**
 * Fetch a single message by id (populates replyTo snippet).
 * Useful when replied-to message is not in current DOM.
 */
export async function fetchMessageById(messageId: string): Promise<IMessage> {
  const { data } = await axiosInstance.get<{ results: IMessage }>(`/chat/message/${messageId}`);
  return data.results;
}

/**
 * Fetch a chunk of messages around a target messageId (includes the pivot message).
 * Useful to load context when jumping to a message that isn't in the current page.
 *
 * GET /chat/instructor/:insId/messages/around/:aroundId?limit=40
 */
export async function fetchMessagesAround(
  insId: string,
  aroundMessageId: string,
  limit: number = 80,
): Promise<{ messages: IMessage[]; hasMoreBefore: boolean; hasMoreAfter: boolean }> {
  const { data } = await axiosInstance.get<{
    results: { messages: IMessage[]; hasMoreBefore: boolean; hasMoreAfter: boolean };
  }>(`/chat/instructor/${insId}/messages/around/${aroundMessageId}`, {
    params: { limit },
  });

  return {
    messages: data.results.messages ?? [],
    hasMoreBefore: data.results.hasMoreBefore ?? false,
    hasMoreAfter: data.results.hasMoreAfter ?? false,
  };
}

export async function sendMessage(insId: string, content: string, replyTo?: string | null): Promise<IMessage> {
  const { data } = await axiosInstance.post<{ results: IMessage }>(`/chat/instructor/${insId}/message`, {
    content,
    replyTo: replyTo ?? null,
  });
  return data.results;
}

export async function markMessagesAsRead(insId: string): Promise<void> {
  await axiosInstance.patch<void>(`/chat/instructor/${insId}/mark-read`);
}

export async function fetchInstructor(insId: string): Promise<IInstructorResponse> {
  const { data } = await axiosInstance.get<{
    results: IInstructorResponse;
  }>(`/instructor/${insId}`);

  return data.results;
}

/**
 * REPORT MESSAGE
 * POST /chat/message/:messageId/report
 * Body: { reason: string }
 *
 * Returns the created report document (data.results).
 * The backend enforces: reason is required and reporter cannot report their own message.
 */
export async function reportMessage(messageId: string, reason: string): Promise<any> {
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new Error('Report reason is required.');
  }
  const { data } = await axiosInstance.post<{ results: any }>(`/chat/message/${messageId}/report`, {
    reason: reason.trim(),
  });
  return data.results;
}
