// src/api/index.ts
import apiClient from '@/lib/apiClient';   // your wrapper around axiosInstance
import type { IMessage, IInstructor } from '@elearning/types';
import axios from 'axios';

/**
 * GET /instructors/:id
 */
export function fetchInstructor(id: string) {
  return apiClient<IInstructor>(`/instructors/${id}`, 'GET');
}

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});


export function fetchUserConversations(insId: string) {
  return apiClient<{ conversations: any[] }>(
    `/chat/instructor/${insId}/messages/summary`,
    'GET'
  ).then(res => res.conversations);
}

export async function fetchUserMessages(
  InstructorId: string,
  studentId: string,
  before?: string | undefined,
  limit: number = 80,
 
 

): Promise<{ messages: IMessage[]; hasMore: boolean }> {
  const params: Record<string, any> = { limit };
  if (before) params.before = before;

  try {
    const response = await axiosInstance.get<{
      messages: IMessage[];
      hasMore: boolean;
      results: any

    }>(`/chat/instructor/${InstructorId}/messages/${studentId}`, { params });
    
    return {
      messages: response.data.results.messages ?? [],
      hasMore: response.data.results.hasMore ?? false,
    };
  } catch (error) {
    console.error('Failed to fetch instructor messages:', error);
    return {
      messages: [],
      hasMore: false,
    };
  }
}
/**
 * POST /chat/user/:userId/message
 */
export function postUserMessage(userId: string, content: string) {
  return apiClient<IMessage>(
    `/chat/user/${userId}/message`,
    'POST',
    { content }
  );
}


export async function fetchMessagesAround(
  insId: string,
  studentId: string,
  aroundMessageId: string,
  limit: number = 80,
): Promise<{ messages: IMessage[]; hasMoreBefore: boolean; hasMoreAfter: boolean }> {
  const result = await apiClient<{
    messages: IMessage[];
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
  }>(
    `/chat/instructor/${insId}/messages/${studentId}/around/${aroundMessageId}`, // url first
    'GET',                                                         // method
    undefined,                                                      // no body
    { limit }                                                       // params
  );
 
  return {
    messages: result?.messages ?? [],
    hasMoreBefore: result?.hasMoreBefore ?? false,
    hasMoreAfter: result?.hasMoreAfter ?? false,
  };
}

export async function fetchMessageById(messageId: string): Promise<any> {

  const response = await apiClient<{ results: IMessage }>(
    `/chat/message/${messageId}`,
    'GET'
  );



  return response
}

export async function reportMessage(messageId: string, reason: string): Promise<any> {
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new Error('Report reason is required.');
  }

  const payload = { reason: reason.trim() };

  // apiClient<T, R>(url, method, data?, params?, options?)
  const result = await apiClient<any, typeof payload>(
    `/chat/message/${messageId}/report`,
    'POST',
    payload
  );

  return result;
}